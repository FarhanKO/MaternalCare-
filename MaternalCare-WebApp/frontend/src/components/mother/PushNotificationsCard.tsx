import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { AlarmClock, BellOff, BellRing, Check, Loader2, Send, Smartphone } from 'lucide-react';
import { LiquidButton } from '@/components/ui/LiquidButton';
import { cn } from '@/lib/cn';
import { isNative } from '@/lib/native';
import {
  allowExactTiming, disablePush, enablePush, pushState, sendTest, type PushState,
} from '@/lib/push';

/**
 * "Get reminders on this device" — the switch for browser notifications.
 *
 * Sits at the top of the reminders section because that is what it
 * notifies about. Five states, each with its own sentence; the important
 * one is `blocked`, where a button would do nothing and the only honest
 * answer is to say where the browser hides the setting.
 *
 * "Send a test" exists so she sees a notification arrive while she is
 * looking, rather than discovering at six in the morning whether it works.
 */
export function PushNotificationsCard() {
  const [state, setState] = useState<PushState | 'checking'>('checking');
  const [devices, setDevices] = useState(0);
  // app only: whether Android will fire them on the minute (see lib/localReminders)
  const [exact, setExact] = useState(true);
  const [busy, setBusy] = useState<'enable' | 'disable' | 'test' | null>(null);
  const [note, setNote] = useState<{ tone: 'ok' | 'bad'; text: string } | null>(null);

  const refresh = () => pushState()
    .then((s) => { setState(s.state); setDevices(s.devices); setExact(s.exact); })
    .catch(() => setState('unsupported'));

  useEffect(() => { void refresh(); }, []);

  const say = (tone: 'ok' | 'bad', text: string) => {
    setNote({ tone, text });
    window.setTimeout(() => setNote(null), 6000);
  };

  const enable = async () => {
    setBusy('enable');
    try {
      const { devices: n } = await enablePush();
      setDevices(n); setState('on');
      say('ok', isNative ? 'This phone will show each reminder at its time.' : 'This device will be told when a reminder is due.');
      void refresh();
    } catch (err) {
      say('bad', err instanceof Error ? err.message : 'Could not turn notifications on');
      void refresh();
    } finally { setBusy(null); }
  };

  const disable = async () => {
    setBusy('disable');
    try {
      const { devices: n } = await disablePush();
      setDevices(n); setState('off');
      say('ok', 'This device will not be notified.');
    } catch (err) {
      say('bad', err instanceof Error ? err.message : 'Could not turn notifications off');
    } finally { setBusy(null); }
  };

  const test = async () => {
    setBusy('test');
    try {
      const r = await sendTest();
      say('ok', r.delivered > 0
        ? (isNative ? 'It is in your notifications now — pull down from the top to see it.'
          : `Sent to ${r.delivered} device${r.delivered === 1 ? '' : 's'} — it should appear in a moment.`)
        : 'The push service did not accept it. Try turning notifications off and on again.');
    } catch (err) {
      say('bad', err instanceof Error ? err.message : 'Could not send a test');
    } finally { setBusy(null); }
  };

  const on = state === 'on';
  const Icon = state === 'blocked' ? BellOff : BellRing;

  const headline = {
    checking: 'Checking this device…',
    unsupported: 'This browser cannot show notifications',
    blocked: isNative ? 'Notifications are turned off for MaternalCare+' : 'Notifications are blocked for this site',
    off: isNative ? 'Get reminders on this phone' : 'Get reminders on this device',
    on: isNative ? 'Reminders show on this phone' : 'Reminders reach this device',
  }[state];

  const detail = {
    checking: '',
    unsupported: 'Open MaternalCare+ in Chrome, Edge or Firefox — or add it to your home screen on iPhone — to be told when a reminder is due.',
    blocked: isNative
      ? 'You said no once, and Android remembers. Open the phone’s settings → Apps → MaternalCare+ → Notifications to allow them.'
      : 'You said no once, and the browser remembers. To change that, open the site settings (the icon beside the address) and allow notifications, then reload.',
    off: isNative
      ? 'A medicine, a test, a visit — each one will show on this phone at its time, even with the app closed. Nothing leaves the phone to do it.'
      : 'A medicine, a test, a visit — each one will show on this device at its time, even with the app closed.',
    on: isNative
      ? (exact ? 'Each reminder shows once, at its time, even with the app closed.' : 'Each reminder shows once, but Android may hold it back a few minutes unless exact timing is allowed.')
      : devices > 1 ? `On ${devices} devices. Each reminder is sent once, at its time.` : 'Each reminder is sent once, at its time, even with the app closed.',
  }[state];

  const fixTiming = async () => {
    const ok = await allowExactTiming();
    setExact(ok);
    if (ok) say('ok', 'Reminders will now arrive on the minute.');
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
      className={cn(
        'mb-5 flex flex-wrap items-center gap-4 rounded-3xl border px-5 py-4',
        on ? 'border-brand-300/60 bg-brand-500/[0.07]' : 'border-white/60 bg-white/55',
      )}
    >
      <span className={cn(
        'grid h-11 w-11 flex-none place-items-center rounded-2xl',
        on ? 'bg-brand-500 text-white shadow-md' : state === 'blocked' ? 'bg-amber-500/15 text-amber-600' : 'bg-brand-500/12 text-brand-600',
      )}>
        {state === 'checking' ? <Loader2 className="h-5 w-5 animate-spin" /> : <Icon className="h-5 w-5" strokeWidth={2.1} />}
      </span>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 text-[14px] font-extrabold text-ink">
          {headline}
          {on && (
            <span className="inline-flex items-center gap-1 rounded-full bg-brand-500/12 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-brand-700">
              <Check className="h-3 w-3" /> on
            </span>
          )}
        </div>
        <p className="mt-0.5 text-[12px] font-medium leading-relaxed text-ink-muted">{note ? '' : detail}</p>
        {note && (
          <p className={cn('mt-0.5 text-[12px] font-semibold', note.tone === 'ok' ? 'text-brand-700' : 'text-rose-600')}>
            {note.text}
          </p>
        )}
        {isNative && on && !exact && (
          <button
            onClick={fixTiming}
            className="mt-2 inline-flex items-center gap-1.5 rounded-xl bg-amber-500/12 px-3 py-1.5 text-[12px] font-bold text-amber-700 ring-1 ring-amber-300/60"
          >
            <AlarmClock className="h-3.5 w-3.5" /> Allow exact timing
          </button>
        )}
      </div>

      {(state === 'off' || state === 'on') && (
        /* on a phone the buttons take a row of their own rather than squeezing the text */
        <div className="flex basis-full items-center gap-2 sm:basis-auto sm:flex-none">
          {on && (
            <button
              onClick={test}
              disabled={busy !== null}
              className="inline-flex items-center gap-1.5 rounded-2xl border border-white/70 bg-white/70 px-3.5 py-2.5 text-[12.5px] font-bold text-ink-soft transition hover:text-ink disabled:opacity-50"
            >
              {busy === 'test' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Send a test
            </button>
          )}
          {on ? (
            <button
              onClick={disable}
              disabled={busy !== null}
              className="inline-flex items-center gap-1.5 rounded-2xl px-3.5 py-2.5 text-[12.5px] font-bold text-ink-faint underline decoration-ink-faint/40 underline-offset-4 transition hover:text-rose-600 disabled:opacity-50"
            >
              {busy === 'disable' ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Turn off
            </button>
          ) : (
            <LiquidButton onClick={enable} disabled={busy !== null} icon={<Smartphone className="h-[18px] w-[18px]" />}>
              {busy === 'enable' ? 'Asking…' : 'Turn on'}
            </LiquidButton>
          )}
        </div>
      )}
    </motion.div>
  );
}
