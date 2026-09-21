import { useEffect, useMemo, useState } from 'react';
import {
  Activity, BellRing, BookOpen, Check, Droplet, Ear, Footprints, Heart, LayoutGrid, Leaf, Moon,
  RefreshCw, Smartphone, Smile, Sparkles, Sun, Wind, type LucideIcon,
} from 'lucide-react';
import { GlassCard } from '@/components/ui/GlassCard';
import { LiquidButton } from '@/components/ui/LiquidButton';
import { cn } from '@/lib/cn';
import { isNative } from '@/lib/native';
import {
  buildSnapshot, chooseMessage, requestWidgetPin, setWidgetShow, widgetShow, widgetStatus,
  type WidgetInput, type WidgetShow,
} from '@/lib/widget';
import type { MessageIcon } from '@/data/sweetMessages';

/**
 * "Your home-screen widget" — only in the app; a browser has no home screen.
 *
 * A preview of the widget as it is right now, drawn from the same snapshot
 * and the same message rule the phone uses, so what she sees here is what
 * she will see there. Four switches for the four blocks, a way to flip
 * through the messages, and the button that asks the launcher to add it.
 */

const ICONS: Record<MessageIcon, LucideIcon> = {
  droplet: Droplet, heart: Heart, moon: Moon, sun: Sun, leaf: Leaf, sparkles: Sparkles,
  footprints: Footprints, wind: Wind, smile: Smile, ear: Ear,
};

const BLOCKS: { key: keyof WidgetShow; label: string; hint: string; icon: LucideIcon }[] = [
  { key: 'week', label: 'This week', hint: 'Week, days to go, baby’s size', icon: Activity },
  { key: 'message', label: 'Small messages', hint: 'A gentle nudge that changes through the day', icon: Heart },
  { key: 'reminder', label: 'Next reminder', hint: 'Whatever is coming up first', icon: BellRing },
  { key: 'reading', label: 'Today’s reading', hint: 'The article written for this week', icon: BookOpen },
];

// rounded, as the server counts daysLeft — the hero and the widget must agree
const daysAhead = (ms: number, from: number) => Math.round((ms - from) / 86_400_000);

function whenLabel(atMs: number) {
  const d = new Date(atMs);
  const today = new Date();
  const sameDay = d.toDateString() === today.toDateString();
  const time = d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  if (sameDay) return `Today ${time}`;
  const tomorrow = new Date(today); tomorrow.setDate(today.getDate() + 1);
  if (d.toDateString() === tomorrow.toDateString()) return `Tomorrow ${time}`;
  return `${d.toLocaleDateString([], { weekday: 'short' })} ${time}`;
}

export function WidgetSection({ input }: { input: WidgetInput }) {
  const [show, setShow] = useState<WidgetShow>(widgetShow());
  const [offset, setOffset] = useState(0);
  const [status, setStatus] = useState<{ supported: boolean; pinned: number } | null>(null);
  const [note, setNote] = useState<string | null>(null);

  useEffect(() => {
    if (!isNative) return;
    widgetStatus().then((s) => { setStatus(s); setShow(widgetShow()); });
  }, []);

  const snapshot = useMemo(() => buildSnapshot(input, show), [input, show]);
  const message = useMemo(() => chooseMessage(snapshot.messages, offset), [snapshot, offset]);
  // the snapshot is stamped when built; measuring against that keeps render pure
  const nextReminder = snapshot.reminders.find((r) => r.atMs >= snapshot.updatedAt - 60 * 60 * 1000) ?? null;

  if (!isNative) return null;

  const toggle = async (key: keyof WidgetShow) => {
    const next = { ...show, [key]: !show[key] };
    setShow(next);
    await setWidgetShow(next);
  };

  const add = async () => {
    setNote(null);
    const r = await requestWidgetPin();
    if (r.requested) {
      setNote('Confirm on your home screen — Android is asking where to put it.');
      // the launcher answers in its own time; look again shortly
      setTimeout(() => widgetStatus().then(setStatus), 4000);
    } else {
      setNote('Long-press an empty spot on your home screen → Widgets → MaternalCare+.');
    }
  };

  const MessageIconC = message ? ICONS[message.icon] : Heart;
  const daysToGo = snapshot.eddMs ? daysAhead(snapshot.eddMs, snapshot.updatedAt) : null;
  const nothingOn = !show.week && !show.message && !show.reminder && !show.reading;

  return (
    <GlassCard float className="p-6">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-brand-500/10 text-brand-600">
            <LayoutGrid className="h-[18px] w-[18px]" />
          </span>
          <div>
            <h3 className="text-[15px] font-bold tracking-tight text-ink">Your home-screen widget</h3>
            <p className="text-[12.5px] text-ink-muted">A glance at your week without opening the app.</p>
          </div>
        </div>
        {status && status.pinned > 0 && (
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-bold text-emerald-700 ring-1 ring-emerald-200">
            <Check className="h-3 w-3" strokeWidth={3} /> On your home screen
          </span>
        )}
      </div>

      {/* the preview — the widget as the phone will draw it now */}
      <div className="mt-5 rounded-3xl bg-gradient-to-br from-[#f5f8ff] to-[#dce6ff] p-4 ring-1 ring-white/70 shadow-[0_12px_30px_-14px_rgba(63,102,240,0.45)]">
        {show.week && (
          <div className="flex items-center gap-2">
            <span className="grid h-6 w-6 place-items-center rounded-lg bg-gradient-to-br from-brand-500 to-brand-700">
              <Activity className="h-3.5 w-3.5 text-white" strokeWidth={2.6} />
            </span>
            {snapshot.week !== null ? (
              <>
                <span className="text-[14px] font-bold text-ink">Week {snapshot.week}</span>
                <span className="ml-auto text-[12px] font-semibold text-ink-soft">
                  {daysToGo !== null && daysToGo >= 0 ? `${daysToGo} days to go` : ''}
                </span>
              </>
            ) : (
              <span className="text-[14px] font-bold text-ink">Good to see you, {snapshot.name}</span>
            )}
          </div>
        )}
        {show.week && snapshot.babySize && (
          <div className="mt-1 pl-8 text-[12px] text-ink-soft">{snapshot.babySize}</div>
        )}

        {show.message && message && (
          <button
            type="button"
            onClick={() => setOffset((o) => o + 1)}
            className={cn('flex w-full items-start gap-2.5 rounded-2xl bg-white/70 px-3 py-2.5 text-left', show.week && 'mt-3')}
            aria-label="Show the next message"
          >
            <MessageIconC className="mt-0.5 h-[18px] w-[18px] flex-none text-brand-600" />
            <span className="text-[13px] font-medium leading-snug text-ink">{message.text}</span>
          </button>
        )}

        {show.reminder && (
          <div className="mt-2.5 flex items-center gap-2.5 px-1 text-[12.5px] text-ink-soft">
            <BellRing className="h-4 w-4 flex-none text-brand-600" />
            {nextReminder
              ? <span><span className="font-semibold text-ink">{nextReminder.title}</span> · {whenLabel(nextReminder.atMs)}</span>
              : <span>Nothing scheduled — add a reminder in the app</span>}
          </div>
        )}

        {show.reading && snapshot.reading && (
          <div className="mt-2 flex items-center gap-2.5 px-1 text-[12.5px] text-ink-soft">
            <BookOpen className="h-4 w-4 flex-none text-brand-600" />
            <span className="line-clamp-1"><span className="font-semibold text-ink">{snapshot.reading.title}</span> · {snapshot.reading.mins} min</span>
          </div>
        )}

        {nothingOn && (
          <div className="py-3 text-center text-[12.5px] text-ink-muted">Turn on at least one block below.</div>
        )}
      </div>

      <div className="mt-3 flex items-center justify-between gap-3">
        <span className="flex-1 text-[11.5px] text-ink-faint">Tap the message on the widget for the next one.</span>
        <button
          type="button"
          onClick={() => setOffset((o) => o + 1)}
          className="inline-flex flex-none items-center gap-1.5 whitespace-nowrap rounded-lg px-2 py-1 text-[12px] font-semibold text-brand-600 hover:bg-white/60"
        >
          <RefreshCw className="h-3.5 w-3.5" /> Next message
        </button>
      </div>

      {/* what goes on it */}
      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        {BLOCKS.map((b) => (
          <button
            key={b.key}
            type="button"
            role="switch"
            aria-checked={show[b.key]}
            onClick={() => toggle(b.key)}
            className={cn(
              'flex items-center gap-3 rounded-2xl px-3.5 py-3 text-left ring-1 transition',
              show[b.key] ? 'bg-white/80 ring-brand-200' : 'bg-white/40 ring-ink/5',
            )}
          >
            <span className={cn('grid h-8 w-8 flex-none place-items-center rounded-xl', show[b.key] ? 'bg-brand-500/10 text-brand-600' : 'bg-ink/5 text-ink-faint')}>
              <b.icon className="h-4 w-4" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[13px] font-semibold text-ink">{b.label}</span>
              <span className="block truncate text-[11.5px] text-ink-muted">{b.hint}</span>
            </span>
            <span className={cn('relative h-5 w-9 flex-none rounded-full transition', show[b.key] ? 'bg-brand-600' : 'bg-ink/15')}>
              <span className={cn('absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition', show[b.key] ? 'left-[18px]' : 'left-0.5')} />
            </span>
          </button>
        ))}
      </div>

      <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center">
        <LiquidButton size="md" onClick={add} icon={<Smartphone className="h-4 w-4" />}>
          {status && status.pinned > 0 ? 'Add another' : 'Add to home screen'}
        </LiquidButton>
        {note && <p className="text-[12.5px] text-ink-soft">{note}</p>}
      </div>
    </GlassCard>
  );
}
