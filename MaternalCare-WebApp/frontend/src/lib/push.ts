/**
 * Browser push, from the page's side.
 *
 * The browser does the hard parts — asks permission, mints the keys, gets an
 * endpoint from its push service — and hands back a subscription. This
 * carries that to the server, and tells the screen which of five states the
 * device is in so it can say the right thing:
 *
 *   unsupported   no service worker or Push API (older iOS Safari, in-app browsers)
 *   blocked       permission was denied once; only the browser's site settings undo that
 *   off           supported, allowed or not yet asked, not subscribed
 *   on            subscribed, and the server has this device on record
 *
 * A subscription is per browser profile, not per account. Signing in as
 * someone else on the same browser re-registers the endpoint under them —
 * the server's ON CONFLICT does that — so a shared computer never keeps
 * sending the previous person's reminders.
 */
import { api } from '@/lib/api';
import { isNative } from '@/lib/native';
import {
  askExactTiming, disableLocalReminders, enableLocalReminders, localReminderState, sendLocalTest,
} from '@/lib/localReminders';

export type PushState = 'unsupported' | 'blocked' | 'off' | 'on';

const WORKER_URL = '/sw.js';

export const pushSupported = () =>
  typeof window !== 'undefined'
  && 'serviceWorker' in navigator
  && 'PushManager' in window
  && 'Notification' in window;

/**
 * Register the worker. Idempotent, and cheap to call on every load — a
 * device that subscribed last month needs the worker registered today for
 * the message to have somewhere to arrive.
 */
export async function registerWorker() {
  if (!pushSupported()) return null;
  try {
    return await navigator.serviceWorker.register(WORKER_URL);
  } catch {
    return null;
  }
}

async function currentSubscription() {
  const reg = await navigator.serviceWorker.getRegistration(WORKER_URL);
  return reg ? reg.pushManager.getSubscription() : null;
}

/** Where this device stands, asking the server whether it knows the endpoint. */
/**
 * Where this device stands. In the app the answer comes from the phone
 * itself (lib/localReminders): its reminders are scheduled there, not
 * pushed, and "devices" is always this one. `exact` is the app's only
 * extra: whether Android will fire them on the minute.
 */
export async function pushState(): Promise<{ state: PushState; devices: number; exact: boolean }> {
  if (isNative) {
    const { state, exact } = await localReminderState();
    return { state, devices: state === 'on' ? 1 : 0, exact };
  }
  if (!pushSupported()) return { state: 'unsupported', devices: 0, exact: true };
  if (Notification.permission === 'denied') {
    const { devices } = await api.getPushStatus().catch(() => ({ devices: 0, thisDevice: false }));
    return { state: 'blocked', devices, exact: true };
  }
  const sub = await currentSubscription().catch(() => null);
  const status = await api.getPushStatus(sub?.endpoint).catch(() => ({ thisDevice: false, devices: 0 }));
  return { state: sub && status.thisDevice ? 'on' : 'off', devices: status.devices, exact: true };
}

/** The VAPID key arrives base64url; PushManager wants raw bytes. */
function keyBytes(base64url: string) {
  const padded = base64url + '='.repeat((4 - (base64url.length % 4)) % 4);
  const raw = atob(padded.replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

/**
 * Ask, subscribe, record. Throws with a sentence a screen can show.
 */
export async function enablePush(): Promise<{ devices: number }> {
  if (isNative) {
    await enableLocalReminders();
    return { devices: 1 };
  }
  if (!pushSupported()) throw new Error('This browser cannot receive notifications');
  const reg = (await registerWorker()) ?? (await navigator.serviceWorker.ready);

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') {
    throw new Error(permission === 'denied'
      ? 'Notifications are blocked for this site — allow them in your browser\'s site settings'
      : 'No permission was given');
  }

  const { publicKey } = await api.getPushKey();
  const existing = await reg.pushManager.getSubscription();
  const sub = existing ?? await reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: keyBytes(publicKey),
  });

  const { devices } = await api.savePushSubscription(sub.toJSON() as PushSubscriptionJSON);
  return { devices };
}

/** Unsubscribe in the browser and forget the device on the server. */
export async function disablePush(): Promise<{ devices: number }> {
  if (isNative) {
    await disableLocalReminders();
    return { devices: 0 };
  }
  const sub = await currentSubscription().catch(() => null);
  let devices = 0;
  if (sub) {
    ({ devices } = await api.removePushSubscription(sub.endpoint));
    await sub.unsubscribe().catch(() => { /* already gone */ });
  }
  return { devices };
}

/**
 * A notification now, so she sees one arrive while she is looking. On the
 * web the server sends it to every device on record; in the app the phone
 * shows one itself a few seconds from now.
 */
export async function sendTest(): Promise<{ delivered: number }> {
  if (isNative) {
    await sendLocalTest();
    return { delivered: 1 };
  }
  const r = await api.sendTestPush();
  return { delivered: r.delivered };
}

/** App only: open the setting that lets reminders fire on the minute. */
export const allowExactTiming = askExactTiming;
