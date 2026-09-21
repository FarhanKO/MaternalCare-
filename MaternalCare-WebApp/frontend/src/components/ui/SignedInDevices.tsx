import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronRight, Loader2, MonitorSmartphone, X } from 'lucide-react';
import { api } from '@/lib/api';
import type { SignedInDevice } from '@/data/records';
import { sinceLabel } from '@/data/sos';
import { cn } from '@/lib/cn';

/**
 * Where this account is signed in.
 *
 * In the profile panel it is one row — "Where you're signed in · 2 devices"
 * — and the list opens over the panel when pressed. The count on the row
 * and every line in the list come from GET /auth/sessions each time the
 * panel opens; nothing here is written down in advance.
 *
 * From the list, any session that is not this one can be ended, or all of
 * them at once. "Sign out everywhere else" keeps this device, which is the
 * one doing the asking. `accent` picks the mother's blue or the clinician's
 * peach for the current-device mark.
 */
export function SignedInDevices({ accent = 'blue' }: { accent?: 'blue' | 'peach' }) {
  const [devices, setDevices] = useState<SignedInDevice[] | null>(null);
  const [limits, setLimits] = useState<{ idle: string; absoluteDays: number } | null>(null);
  const [failed, setFailed] = useState(false);
  const [open, setOpen] = useState(false);

  const load = () => api.getSignedInDevices()
    .then(({ devices: list, idle, absoluteDays }) => {
      setDevices(list); setLimits({ idle, absoluteDays }); setFailed(false);
    })
    .catch(() => setFailed(true));

  useEffect(() => { void load(); }, []);
  // re-read when the list opens: a phone signed in a minute ago should show
  useEffect(() => { if (open) void load(); }, [open]);

  const count = devices?.length ?? null;
  const summary = failed
    ? 'Could not reach the server'
    : count === null
      ? 'Checking…'
      : count === 1
        ? 'Only this device'
        : `${count} devices`;

  const tint = accent === 'peach' ? 'bg-peach-500/12 text-peach-600' : 'bg-brand-500/10 text-brand-600';

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="mt-1.5 flex w-full items-center gap-3 rounded-2xl border border-white/60 bg-white/55 px-3 py-2.5 text-left transition hover:bg-white"
      >
        <span className={cn('grid h-8 w-8 flex-none place-items-center rounded-xl', tint)}>
          <MonitorSmartphone className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="text-[13px] font-bold text-ink">Where you're signed in</div>
          <div className="text-[11px] font-medium text-ink-muted">{summary}</div>
        </div>
        <ChevronRight className="h-4 w-4 flex-none text-ink-faint" />
      </button>

      <DevicesModal
        open={open}
        onClose={() => setOpen(false)}
        devices={devices}
        limits={limits}
        failed={failed}
        accent={accent}
        onChanged={load}
      />
    </>
  );
}

function DevicesModal({
  open, onClose, devices, limits, failed, accent, onChanged,
}: {
  open: boolean;
  onClose: () => void;
  devices: SignedInDevice[] | null;
  limits: { idle: string; absoluteDays: number } | null;
  failed: boolean;
  accent: 'blue' | 'peach';
  onChanged: () => Promise<void>;
}) {
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && open && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const endOne = async (id: string) => {
    setBusy(id); setError(null);
    try { await api.signOutDevice(id); await onChanged(); } catch { setError('That device could not be signed out'); } finally { setBusy(null); }
  };
  const endOthers = async () => {
    setBusy('others'); setError(null);
    try { await api.signOutEverywhereElse(); await onChanged(); } catch { setError('Could not sign out the other devices'); } finally { setBusy(null); }
  };

  if (typeof document === 'undefined') return null;
  const others = (devices ?? []).filter((d) => !d.current);
  const dot = accent === 'peach' ? 'bg-peach-500' : 'bg-brand-500';

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[140] flex items-center justify-center p-4"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }}
          exit={{ opacity: 0, pointerEvents: 'none', transition: { duration: 0.2 } }}
        >
          <motion.div
            className="absolute inset-0 bg-ink/45"
            onClick={onClose}
            initial={{ opacity: 0, backdropFilter: 'blur(0px)' }}
            animate={{ opacity: 1, backdropFilter: 'blur(18px)' }}
            transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
          />
          <motion.div
            role="dialog" aria-modal="true" aria-label="Where you're signed in"
            initial={{ opacity: 0, scale: 0.94, y: 18 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: 10, transition: { duration: 0.18 } }}
            transition={{ type: 'spring', stiffness: 260, damping: 26 }}
            className="glass-strong ring-gradient relative flex max-h-[85vh] w-full max-w-md flex-col overflow-hidden rounded-4xl"
          >
            <button
              onClick={onClose} aria-label="Close"
              className="absolute right-5 top-5 z-10 grid h-9 w-9 place-items-center rounded-xl bg-white/70 text-ink-soft transition-colors hover:text-ink"
            >
              <X className="h-4 w-4" />
            </button>

            <div className="flex-1 overflow-y-auto px-6 py-7 sm:px-7">
              <span className={cn('grid h-12 w-12 place-items-center rounded-2xl', accent === 'peach' ? 'bg-peach-500/15 text-peach-600' : 'bg-brand-500/12 text-brand-600')}>
                <MonitorSmartphone className="h-[22px] w-[22px]" strokeWidth={2.1} />
              </span>
              <h2 className="mt-5 text-2xl font-extrabold tracking-tight text-ink">Where you're signed in</h2>
              <p className="mt-2 text-[14px] leading-relaxed text-ink-soft">
                Every device with an open session on this account. A phone you no longer have, or a
                computer you forgot to sign out of, can be ended from here.
              </p>

              {devices === null && !failed && (
                <div className="mt-5 flex items-center gap-2 text-[12px] font-medium text-ink-muted">
                  <Loader2 className="h-4 w-4 animate-spin" /> Checking…
                </div>
              )}
              {failed && <p className="mt-5 text-[12.5px] font-medium text-rose-600">Could not reach the server just now.</p>}

              {devices && (
                <ul className="mt-5 space-y-2">
                  {devices.map((d) => (
                    <li key={d.id} className="flex items-center gap-3 rounded-2xl border border-white/60 bg-white/60 px-3.5 py-3">
                      <span className="grid h-9 w-9 flex-none place-items-center rounded-xl bg-ink/5 text-ink-soft">
                        <MonitorSmartphone className="h-4 w-4" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 text-[13.5px] font-bold text-ink">
                          <span className="truncate">{d.device}</span>
                          {d.current && (
                            <span className="inline-flex flex-none items-center gap-1 rounded-full bg-ink/5 px-1.5 py-0.5 text-[9.5px] font-bold uppercase tracking-wide text-ink-soft">
                              <span className={cn('h-1.5 w-1.5 rounded-full', dot)} /> this device
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] font-medium text-ink-muted">
                          {d.current ? 'Active now' : `Last active ${sinceLabel(d.lastSeenAt)}`}
                          {' · '}signed in {new Date(d.createdAt).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}
                        </div>
                      </div>
                      {!d.current && (
                        <button
                          onClick={() => endOne(d.id)}
                          disabled={busy !== null}
                          className="flex-none rounded-xl px-2.5 py-1.5 text-[11.5px] font-bold text-rose-600 transition hover:bg-rose-500/10 disabled:opacity-50"
                        >
                          {busy === d.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Sign out'}
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              )}

              {error && <p className="mt-3 text-[12px] font-semibold text-rose-600">{error}</p>}

              {others.length > 0 && (
                <button
                  onClick={endOthers}
                  disabled={busy !== null}
                  className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-rose-300/70 bg-rose-500/10 px-4 py-3 text-sm font-bold text-rose-600 transition hover:bg-rose-500/15 disabled:opacity-60"
                >
                  {busy === 'others' ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  Sign out everywhere else ({others.length})
                </button>
              )}

              {limits && (
                <p className="mt-4 text-[11px] font-medium leading-relaxed text-ink-faint">
                  A session ends on its own after {limits.idle} unused, or {limits.absoluteDays} days in any case.
                  Changing your password ends every other one.
                </p>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
