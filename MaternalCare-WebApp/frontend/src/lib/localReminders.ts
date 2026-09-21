/**
 * Reminders that reach the phone — the app's half of lib/push.ts.
 *
 * On the web a reminder reaches the device as a browser push: the server
 * works out when each one falls due and sends it (models/pushModel.js). A
 * WebView cannot receive browser push, and the alternative — Firebase Cloud
 * Messaging — would mean a Firebase project, a server-side sender and a
 * device token, all to tell a phone about times it already knows.
 *
 * So in the app the phone schedules the reminders itself, with Android's
 * alarm manager (Capacitor's LocalNotifications). They fire with the app
 * closed, survive a reboot, and need no network. The schedule is rebuilt
 * from her reminders whenever they change and whenever the app opens, so
 * the phone never shows a reminder she has since deleted.
 *
 * What is shown is the same as the server would push: the title, the note
 * or a sentence for the kind, and a tap that opens the reminders tab.
 *
 * Timing: a repeating reminder is a cron-style schedule ("every day at
 * 9:00"), which the plugin rearms after each firing; a one-off is an exact
 * alarm at its time. From Android 12 exact alarms are a permission she
 * grants in settings — without it a reminder can arrive some minutes late,
 * which the card says, with a button to the setting.
 */
import { LocalNotifications, type LocalNotificationSchema, type Weekday } from '@capacitor/local-notifications';
import { Preferences } from '@capacitor/preferences';
import { isNative } from '@/lib/native';
import { KIND_LABEL, type Reminder, type ReminderKind } from '@/data/reminders';

const ENABLED_KEY = 'reminders.notify';
const CHANNEL = 'reminders';

/** The same sentence the server pushes for a reminder with no note. */
const KIND_WORD: Record<ReminderKind, string> = {
  medicine: 'Time for your medicine',
  doctor: 'Appointment',
  test: 'Test due',
  exercise: 'Time to move',
  vaccination: 'Vaccination due',
};

/* -------------------------------------------------------------- state */

let enabled = false;
let enabledLoaded = false;
let lastReminders: Reminder[] = [];

async function loadEnabled(): Promise<boolean> {
  if (enabledLoaded) return enabled;
  try {
    enabled = (await Preferences.get({ key: ENABLED_KEY })).value === 'true';
  } catch {
    enabled = false;
  }
  enabledLoaded = true;
  return enabled;
}

export type LocalReminderState = 'off' | 'on' | 'blocked';

/**
 * Where this phone stands: on (permission granted and she turned it on),
 * blocked (she refused the notification permission — only settings can
 * undo that), or off. `exact` says whether reminders will be on time.
 */
export async function localReminderState(): Promise<{ state: LocalReminderState; exact: boolean }> {
  const on = await loadEnabled();
  const perm = await LocalNotifications.checkPermissions();
  const exact = await exactAllowed();
  if (perm.display === 'denied') return { state: 'blocked', exact };
  return { state: on && perm.display === 'granted' ? 'on' : 'off', exact };
}

async function exactAllowed(): Promise<boolean> {
  try {
    return (await LocalNotifications.checkExactNotificationSetting()).exact_alarm === 'granted';
  } catch {
    return true;                                   // before Android 12 there is no such setting
  }
}

/** Open the "Alarms & reminders" setting; resolves with whether it is now allowed. */
export async function askExactTiming(): Promise<boolean> {
  try {
    return (await LocalNotifications.changeExactNotificationSetting()).exact_alarm === 'granted';
  } catch {
    return true;
  }
}

/* ------------------------------------------------------------- enable */

export async function enableLocalReminders(): Promise<void> {
  const perm = await LocalNotifications.requestPermissions();
  if (perm.display !== 'granted') {
    throw new Error('Notifications were not allowed. You can allow them in the phone’s settings for MaternalCare+.');
  }
  await LocalNotifications.createChannel({
    id: CHANNEL,
    name: 'Reminders',
    description: 'Medicine, tests, appointments and exercise, each at its time',
    importance: 4,                                 // high: heads-up, sound
    visibility: 1,                                 // shown on the lock screen
    vibration: true,
  });
  enabled = true;
  enabledLoaded = true;
  await Preferences.set({ key: ENABLED_KEY, value: 'true' });
  await syncLocalReminders(lastReminders);
}

export async function disableLocalReminders(): Promise<void> {
  enabled = false;
  enabledLoaded = true;
  await Preferences.set({ key: ENABLED_KEY, value: 'false' });
  await cancelAll();
}

/**
 * A notification now, so she sees one arrive while looking. Shown at once
 * rather than scheduled a few seconds out: without the exact-alarm
 * permission Android may hold a scheduled one back for minutes, which
 * would make a test look broken when it is not.
 */
export async function sendLocalTest(): Promise<void> {
  await LocalNotifications.schedule({
    notifications: [{
      id: 1,                                       // outside the range reminders use
      title: 'This is what a reminder looks like',
      body: 'Each one will show here at its time, even with the app closed.',
      channelId: CHANNEL,
      extra: { url: '/mother?tab=reminders' },
    }],
  });
}

/* ----------------------------------------------------------- schedule */

/**
 * Rebuild the phone's schedule from her reminders. Called with every change
 * to them and on every open of the app; a no-op in a browser or while she
 * has not turned this on.
 */
export async function syncLocalReminders(reminders: Reminder[]): Promise<void> {
  lastReminders = reminders;
  if (!isNative) return;
  if (!(await loadEnabled())) return;
  if ((await LocalNotifications.checkPermissions()).display !== 'granted') return;

  await cancelAll();
  const now = Date.now();
  const notifications = reminders
    .map((r) => toNotification(r, now))
    .filter((n): n is LocalNotificationSchema => n !== null);
  if (notifications.length > 0) await LocalNotifications.schedule({ notifications });
}

async function cancelAll() {
  const pending = await LocalNotifications.getPending();
  if (pending.notifications.length > 0) {
    await LocalNotifications.cancel({ notifications: pending.notifications.map((n) => ({ id: n.id })) });
  }
}

/**
 * One reminder as the phone will schedule it.
 *
 * A repeating reminder whose first time has passed becomes a cron-style
 * rule at that time of day (and weekday), which the plugin rearms after
 * every firing. One that has not started yet is an exact alarm for its
 * first time; the next sync after that — the app reopening, a reminder
 * edited — turns it into the rule. A one-off that has passed is nothing.
 */
function toNotification(r: Reminder, now: number): LocalNotificationSchema | null {
  const due = new Date(r.at);
  if (Number.isNaN(due.getTime())) return null;
  const base = {
    id: idFor(r.id),
    title: r.title,
    body: r.note || KIND_WORD[r.kind] || KIND_LABEL[r.kind] || 'Reminder',
    channelId: CHANNEL,
    extra: { url: '/mother?tab=reminders', reminderId: r.id },
  };
  const repeat = r.repeat ?? 'once';
  if (repeat === 'once' || due.getTime() > now) {
    if (due.getTime() <= now) return null;
    return { ...base, schedule: { at: due, allowWhileIdle: true } };
  }
  const on = repeat === 'weekly'
    ? { weekday: (due.getDay() + 1) as Weekday, hour: due.getHours(), minute: due.getMinutes() }
    : { hour: due.getHours(), minute: due.getMinutes() };
  return { ...base, schedule: { on, allowWhileIdle: true } };
}

/** A stable positive int for a reminder id ("42", "v-1726…"); Android wants ints. */
function idFor(id: string): number {
  let h = 5381;
  for (let i = 0; i < id.length; i += 1) h = ((h * 33) ^ id.charCodeAt(i)) >>> 0;
  return 1000 + (h % 2_000_000_000);
}

/* ---------------------------------------------------------------- taps */

/** Where a tapped notification wants the app to go, delivered to `go`. */
export function onReminderTap(go: (url: string) => void): () => void {
  if (!isNative) return () => {};
  const handle = LocalNotifications.addListener('localNotificationActionPerformed', (a) => {
    const url = a.notification.extra?.url;
    if (typeof url === 'string') go(url);
  });
  return () => { void handle.then((h) => h.remove()); };
}
