/**
 * The home-screen widget.
 *
 * Android draws a widget from a native layout, not from this bundle, so the
 * app's job is to hand the native side everything it needs — as one JSON
 * snapshot — whenever the dashboard has fresh data. The native provider
 * (android/…/MaternalCareWidget.java) keeps the snapshot in SharedPreferences
 * and redraws from it: on its half-hourly refresh, when she resizes it, and
 * when she taps for the next message.
 *
 * Two things are deliberately decided on the phone at draw time rather than
 * here, so a widget that has not been opened for days does not go stale:
 *
 *   the week and the days to go, from her LMP and due date;
 *   which small message to show, from the hour of the day.
 *
 * `chooseMessage` below is the same rule the Java side applies, so the
 * preview in the app shows exactly what the widget shows.
 */
import { registerPlugin } from '@capacitor/core';
import { Preferences } from '@capacitor/preferences';
import { isNative } from '@/lib/native';
import { pick, type MessageIcon, type TimeOfDay } from '@/data/sweetMessages';
import { readingFor, type LifeStage } from '@/data/reading';
import type { Pregnancy } from '@/data/records';
import { upcoming, KIND_SHORT, type Reminder } from '@/data/reminders';

/* ------------------------------------------------------------- options */

/** Which blocks she wants on the widget. */
export interface WidgetShow {
  week: boolean;
  message: boolean;
  reminder: boolean;
  reading: boolean;
}

export const DEFAULT_SHOW: WidgetShow = { week: true, message: true, reminder: true, reading: true };

const SHOW_KEY = 'widget.show';

let show: WidgetShow = DEFAULT_SHOW;
let showLoaded = false;

async function loadShow(): Promise<WidgetShow> {
  if (showLoaded || !isNative) return show;
  try {
    const { value } = await Preferences.get({ key: SHOW_KEY });
    if (value) show = { ...DEFAULT_SHOW, ...(JSON.parse(value) as Partial<WidgetShow>) };
  } catch {
    /* unreadable: the defaults */
  }
  showLoaded = true;
  return show;
}

export const widgetShow = () => show;

/* ------------------------------------------------------------ snapshot */

export interface WidgetMessage { text: string; icon: MessageIcon; when: TimeOfDay }

export interface WidgetSnapshot {
  name: string;
  stage: LifeStage;
  /** the week this snapshot was built in — the size line is only right for it */
  week: number | null;
  trimester: number | null;
  /** epoch ms; the phone computes the week and the days to go from these */
  lmpMs: number | null;
  eddMs: number | null;
  babySize: string | null;
  reading: { title: string; mins: number } | null;
  /** the next few, soonest first; the phone shows the first still ahead */
  reminders: { title: string; kind: string; atMs: number }[];
  messages: WidgetMessage[];
  show: WidgetShow;
  updatedAt: number;
}

export interface WidgetInput {
  name: string;
  stage: LifeStage | 'general';
  pregnancy: Pregnancy | null;
  reminders: Reminder[];
}

/** Everything the widget can show, from what the dashboard already holds. */
export function buildSnapshot(input: WidgetInput, showNow: WidgetShow = show): WidgetSnapshot {
  // 'general' has no reading or messages of its own — the pregnancy set fits best
  const stage: LifeStage = input.stage === 'general' ? 'pregnant' : input.stage;
  const p = stage === 'pregnant' ? input.pregnancy : null;
  const week = p?.week ?? null;
  const top = readingFor(stage, week ?? 0).items[0];
  const first = input.name.trim().split(/\s+/)[0] || input.name;
  return {
    name: first,
    stage,
    week,
    trimester: p?.trimester ?? null,
    lmpMs: p ? Date.parse(p.lmp) : null,
    eddMs: p ? Date.parse(p.edd) : null,
    babySize: p ? `${p.babySize.fruit} · ${p.babySize.length} · ${p.babySize.weight}` : null,
    reading: top ? { title: top.title, mins: top.readMins } : null,
    reminders: upcoming(input.reminders).slice(0, 5).map((r) => ({
      title: r.title,
      kind: KIND_SHORT[r.kind],
      atMs: new Date(r.at).getTime(),
    })),
    messages: pick(stage, week).map((m) => ({ text: m.text, icon: m.icon, when: m.when })),
    show: showNow,
    updatedAt: Date.now(),
  };
}

/* ------------------------------------------------- choosing a message */

/** 05–11 morning, 11–17 afternoon, 17–22 evening, otherwise night. */
export function timeOfDay(now = new Date()): Exclude<TimeOfDay, 'any'> {
  const h = now.getHours();
  if (h >= 5 && h < 11) return 'morning';
  if (h >= 11 && h < 17) return 'afternoon';
  if (h >= 17 && h < 22) return 'evening';
  return 'night';
}

const dayOfYear = (d: Date) => Math.floor((d.getTime() - new Date(d.getFullYear(), 0, 0).getTime()) / 86_400_000);

/**
 * The message for this moment: one that fits the time of day, changing
 * every three hours and with every tap. The Java side computes the same
 * seed from the same clock, so the app's preview and the widget agree.
 */
export function chooseMessage(messages: WidgetMessage[], offset = 0, now = new Date()): WidgetMessage | null {
  const slot = timeOfDay(now);
  const fitting = messages.filter((m) => m.when === slot || m.when === 'any');
  const pool = fitting.length > 0 ? fitting : messages;
  if (pool.length === 0) return null;
  const seed = dayOfYear(now) * 8 + Math.floor(now.getHours() / 3);
  return pool[(((seed + offset) % pool.length) + pool.length) % pool.length];
}

/* --------------------------------------------------------------- native */

interface WidgetPlugin {
  update(o: { snapshot: string }): Promise<void>;
  status(): Promise<{ supported: boolean; pinned: number }>;
  requestPin(): Promise<{ supported: boolean; requested: boolean }>;
}

const Widget = registerPlugin<WidgetPlugin>('Widget');

let lastInput: WidgetInput | null = null;

/** Hand the widget fresh data. A no-op in a browser. */
export async function syncWidget(input: WidgetInput): Promise<void> {
  lastInput = input;
  if (!isNative) return;
  await loadShow();
  try {
    await Widget.update({ snapshot: JSON.stringify(buildSnapshot(input, show)) });
  } catch {
    /* the plugin is missing on an old build — the widget keeps what it had */
  }
}

/** Change what the widget shows, keep the choice, and redraw it. */
export async function setWidgetShow(next: WidgetShow): Promise<WidgetShow> {
  show = next;
  showLoaded = true;
  if (!isNative) return show;
  await Preferences.set({ key: SHOW_KEY, value: JSON.stringify(next) });
  if (lastInput) await syncWidget(lastInput);
  return show;
}

/** How many of her widgets are on the home screen, and whether we can offer to add one. */
export async function widgetStatus(): Promise<{ supported: boolean; pinned: number }> {
  if (!isNative) return { supported: false, pinned: 0 };
  await loadShow();
  try {
    return await Widget.status();
  } catch {
    return { supported: false, pinned: 0 };
  }
}

/**
 * Ask the launcher to add the widget. Android shows its own confirmation
 * sheet; `requested` is whether that sheet was shown, not whether she
 * accepted — `widgetStatus` answers that afterwards.
 */
export async function requestWidgetPin(): Promise<{ supported: boolean; requested: boolean }> {
  if (!isNative) return { supported: false, requested: false };
  try {
    return await Widget.requestPin();
  } catch {
    return { supported: false, requested: false };
  }
}
