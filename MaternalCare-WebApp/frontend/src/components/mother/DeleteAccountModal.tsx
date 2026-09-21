import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  AlertTriangle, ArrowRight, Check, Download, Heart, Loader2, Lock, ShieldCheck, Trash2, X,
} from 'lucide-react';
import { LiquidButton } from '@/components/ui/LiquidButton';
import { cn } from '@/lib/cn';
import { api } from '@/lib/api';
import { saveBlob } from '@/lib/files';

/**
 * Closing an account.
 *
 * The order of this screen is deliberate. She is told we are sorry and asked
 * why before anything destructive is offered; then given her data to keep;
 * then told plainly what happens to the records and when; and only then asked
 * for a password. Nothing is deleted until every one of those has been passed.
 *
 * There is no undo, and the screen never implies there is. The seven days are
 * not a grace period for changing her mind — they exist because this holds a
 * maternity record, and a care team may need to look at it one last time.
 */

const REASONS = [
  { key: 'no-longer-needed', label: 'I no longer need it', hint: 'My pregnancy or my child’s care has moved on' },
  { key: 'privacy', label: 'Privacy concerns', hint: 'I would rather my health data was not stored' },
  { key: 'not-useful', label: 'It was not useful to me', hint: 'The app did not fit how I manage my care' },
  { key: 'too-many-notifications', label: 'Too many reminders', hint: 'It asked more of me than it gave back' },
  { key: 'switching', label: 'Using something else', hint: 'My clinic or another app covers this' },
  { key: 'other', label: 'Another reason', hint: 'Tell us below if you would like to' },
] as const;

type Step = 'sorry' | 'keep' | 'terms' | 'confirm' | 'done';

interface Props {
  open: boolean;
  onClose: () => void;
  name: string;
  /** 'mother' or 'clinician' — only used for wording */
  role?: string;
  /** called after the account is gone, to leave the app */
  onDeleted: () => void;
}

export function DeleteAccountModal({ open, onClose, name, role = 'mother', onDeleted }: Props) {
  const [step, setStep] = useState<Step>('sorry');
  const [reason, setReason] = useState<string>('');
  const [feedback, setFeedback] = useState('');
  const [password, setPassword] = useState('');
  const [agreed, setAgreed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [downloaded, setDownloaded] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [purgeOn, setPurgeOn] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setStep('sorry'); setReason(''); setFeedback(''); setPassword('');
    setAgreed(false); setBusy(false); setDownloaded(null); setError(null); setPurgeOn(null);
  }, [open]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // never let Escape close it mid-delete, or after, when the app must reload
      if (e.key === 'Escape' && open && step !== 'done' && !busy) onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, step, busy, onClose]);

  const download = async () => {
    setError(null); setBusy(true);
    try {
      const { blob, filename } = await api.exportMyData();
      await saveBlob(blob, filename, 'Your MaternalCare+ data');
      setDownloaded(filename);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'That download could not be prepared');
    } finally { setBusy(false); }
  };

  const destroy = async () => {
    setError(null); setBusy(true);
    try {
      const res = await api.deleteMyAccount({ password, reason, feedback: feedback.trim() || undefined });
      setPurgeOn(new Date(res.purgeAfter).toLocaleDateString(undefined, {
        weekday: 'long', day: 'numeric', month: 'long',
      }));
      setStep('done');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'The account could not be closed');
      setBusy(false);
    }
  };

  const first = name.trim().split(/\s+/)[0] || 'there';
  const who = role === 'clinician' ? 'your patients' : 'your care team';

  if (typeof document === 'undefined') return null;

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[130] flex items-center justify-center p-4"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }}
          exit={{ opacity: 0, pointerEvents: 'none', transition: { duration: 0.2 } }}
        >
          <motion.div
            className="absolute inset-0 bg-ink/45"
            onClick={() => step !== 'done' && !busy && onClose()}
            initial={{ opacity: 0, backdropFilter: 'blur(0px)' }}
            animate={{ opacity: 1, backdropFilter: 'blur(18px)' }}
            transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
          />

          <motion.div
            role="dialog" aria-modal="true" aria-label="Delete your account"
            initial={{ opacity: 0, scale: 0.94, y: 18 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: 10, transition: { duration: 0.18 } }}
            transition={{ type: 'spring', stiffness: 260, damping: 26 }}
            className="glass-strong ring-gradient relative flex max-h-[88vh] w-full max-w-lg flex-col overflow-hidden rounded-4xl"
          >
            {step !== 'done' && (
              <button
                onClick={onClose} aria-label="Close" disabled={busy}
                className="absolute right-5 top-5 z-10 grid h-9 w-9 place-items-center rounded-xl bg-white/70 text-ink-soft transition-colors hover:text-ink disabled:opacity-40"
              >
                <X className="h-4 w-4" />
              </button>
            )}

            <div className="flex-1 overflow-y-auto px-6 py-7 sm:px-8">
              {/* ------------------------------------------------ sorry */}
              {step === 'sorry' && (
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                  <span className="grid h-12 w-12 place-items-center rounded-2xl bg-rose-500/12 text-rose-600">
                    <Heart className="h-[22px] w-[22px]" strokeWidth={2.1} />
                  </span>
                  <h2 className="mt-5 text-2xl font-extrabold tracking-tight text-ink">
                    We’re sorry to see you go, {first}
                  </h2>
                  <p className="mt-3 text-[15px] leading-relaxed text-ink-soft">
                    We built this to make the months around a birth a little less heavy, and
                    we clearly did not get it right for you. That is on us, not on you.
                  </p>
                  <p className="mt-2.5 text-[15px] leading-relaxed text-ink-soft">
                    If you have a moment, telling us why would genuinely help the next person.
                    You can skip it and we will not ask again.
                  </p>

                  <div className="mt-6">
                    <div className="text-[11px] font-bold uppercase tracking-wider text-ink-faint">
                      What made you decide?
                    </div>
                    <div className="mt-3 space-y-2">
                      {REASONS.map((r) => (
                        <button
                          key={r.key}
                          onClick={() => setReason(r.key)}
                          className={cn(
                            'flex w-full items-start gap-3 rounded-2xl border px-4 py-3 text-left transition',
                            reason === r.key
                              ? 'border-brand-500/40 bg-brand-500/10'
                              : 'border-white/60 bg-white/60 hover:bg-white',
                          )}
                        >
                          <span className={cn(
                            'mt-0.5 grid h-4 w-4 flex-none place-items-center rounded-full border-2',
                            reason === r.key ? 'border-brand-600 bg-brand-600' : 'border-ink/20',
                          )}>
                            {reason === r.key && <Check className="h-2.5 w-2.5 text-white" strokeWidth={4} />}
                          </span>
                          <span className="min-w-0">
                            <span className="block text-[13.5px] font-bold text-ink">{r.label}</span>
                            <span className="block text-[11.5px] font-medium text-ink-muted">{r.hint}</span>
                          </span>
                        </button>
                      ))}
                    </div>

                    <textarea
                      value={feedback}
                      onChange={(e) => setFeedback(e.target.value.slice(0, 2000))}
                      rows={3}
                      placeholder="Anything else you would like us to know? (optional)"
                      className="mt-3 w-full resize-none rounded-2xl border border-white/60 bg-white/70 px-4 py-3 text-[14px] leading-relaxed text-ink outline-none transition placeholder:text-ink-faint focus:border-brand-400 focus:ring-2 focus:ring-brand-500/20"
                    />
                  </div>
                </motion.div>
              )}

              {/* ------------------------------------------ keep a copy */}
              {step === 'keep' && (
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                  <span className="grid h-12 w-12 place-items-center rounded-2xl bg-brand-500/12 text-brand-600">
                    <Download className="h-[22px] w-[22px]" strokeWidth={2.1} />
                  </span>
                  <h2 className="mt-5 text-2xl font-extrabold tracking-tight text-ink">
                    Take your records with you
                  </h2>
                  <p className="mt-3 text-[15px] leading-relaxed text-ink-soft">
                    Closing your account should not mean losing what you wrote down. This
                    downloads everything we hold — your readings, your daily logs, your
                    symptoms, appointments, vaccinations and your child’s growth — as a single
                    file you keep.
                  </p>
                  <p className="mt-2.5 text-[13px] leading-relaxed text-ink-muted">
                    Worth doing even if you are certain. Once the records are gone we cannot
                    produce them again, and a clinician may ask for this history later.
                  </p>

                  <button
                    onClick={download}
                    disabled={busy}
                    className={cn(
                      'mt-5 flex w-full items-center justify-center gap-2 rounded-2xl px-5 py-3.5 text-[14px] font-bold transition',
                      downloaded
                        ? 'bg-emerald-500/12 text-emerald-700 ring-1 ring-emerald-500/25'
                        : 'bg-gradient-to-br from-brand-500 to-brand-700 text-white shadow-glow hover:shadow-lg',
                      busy && 'opacity-60',
                    )}
                  >
                    {busy ? <Loader2 className="h-[18px] w-[18px] animate-spin" />
                      : downloaded ? <Check className="h-[18px] w-[18px]" strokeWidth={3} />
                        : <Download className="h-[18px] w-[18px]" />}
                    {busy ? 'Preparing your file…'
                      : downloaded ? `Saved — ${downloaded}` : 'Download all my data'}
                  </button>

                  {downloaded && (
                    <p className="mt-2.5 text-center text-[11.5px] font-semibold text-ink-muted">
                      Check your downloads folder before continuing.
                    </p>
                  )}
                </motion.div>
              )}

              {/* ---------------------------------------------- terms */}
              {step === 'terms' && (
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                  <span className="grid h-12 w-12 place-items-center rounded-2xl bg-amber-500/15 text-amber-600">
                    <ShieldCheck className="h-[22px] w-[22px]" strokeWidth={2.1} />
                  </span>
                  <h2 className="mt-5 text-2xl font-extrabold tracking-tight text-ink">
                    What happens to your records
                  </h2>

                  <ul className="mt-5 space-y-3">
                    {[
                      ['Your account closes straight away',
                        `You will be signed out on every device, and ${who} will no longer see you.`],
                      ['Your records are kept for 7 more days',
                        'Only for safety: if anything about your care is queried in that week, '
                        + 'a clinician or an auditor can still look. Nobody browses it, and it is '
                        + 'not used for anything else.'],
                      ['After 7 days everything is destroyed',
                        'Your profile, readings, logs, symptoms, documents, photographs, '
                        + 'appointments, community posts and comments are permanently deleted '
                        + 'from the database and from disk. This cannot be reversed.'],
                      ['Your reason is kept, without you attached',
                        'What you told us on the first screen is separated from your account '
                        + 'and kept as anonymous feedback. It carries no name, email or phone.'],
                    ].map(([title, body]) => (
                      <li key={title} className="rounded-2xl border border-white/60 bg-white/60 px-4 py-3">
                        <div className="text-[13.5px] font-extrabold text-ink">{title}</div>
                        <div className="mt-1 text-[12.5px] leading-relaxed text-ink-soft">{body}</div>
                      </li>
                    ))}
                  </ul>

                  <label className="mt-5 flex cursor-pointer items-start gap-3 rounded-2xl border border-white/60 bg-white/60 px-4 py-3.5">
                    <input
                      type="checkbox"
                      checked={agreed}
                      onChange={(e) => setAgreed(e.target.checked)}
                      className="mt-0.5 h-4 w-4 flex-none accent-rose-600"
                    />
                    <span className="text-[13px] font-semibold leading-relaxed text-ink-soft">
                      I understand my records will be permanently deleted after seven days,
                      and that this cannot be undone.
                    </span>
                  </label>
                </motion.div>
              )}

              {/* -------------------------------------------- confirm */}
              {step === 'confirm' && (
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                  <span className="grid h-12 w-12 place-items-center rounded-2xl bg-rose-500/12 text-rose-600">
                    <Lock className="h-[22px] w-[22px]" strokeWidth={2.1} />
                  </span>
                  <h2 className="mt-5 text-2xl font-extrabold tracking-tight text-ink">
                    Confirm it is you
                  </h2>
                  <p className="mt-3 text-[15px] leading-relaxed text-ink-soft">
                    This is the last step, and it cannot be undone. Enter your password to
                    close the account.
                  </p>

                  <input
                    type="password"
                    value={password}
                    autoComplete="current-password"
                    onChange={(e) => setPassword(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && password && !busy && destroy()}
                    placeholder="Your password"
                    className="mt-5 h-12 w-full rounded-2xl border border-white/60 bg-white/70 px-4 text-[15px] font-medium text-ink outline-none transition placeholder:text-ink-faint focus:border-rose-400 focus:ring-2 focus:ring-rose-500/20"
                  />

                  <div className="mt-4 flex items-start gap-2.5 rounded-2xl bg-rose-500/[0.07] px-4 py-3">
                    <AlertTriangle className="mt-0.5 h-4 w-4 flex-none text-rose-600" />
                    <p className="text-[12.5px] font-semibold leading-relaxed text-rose-700">
                      Deleting removes your pregnancy record, your child’s growth history and
                      every document you have filed. There is no way to bring them back.
                    </p>
                  </div>
                </motion.div>
              )}

              {/* ------------------------------------------------ done */}
              {step === 'done' && (
                <motion.div
                  initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
                  className="py-6 text-center"
                >
                  <motion.span
                    initial={{ scale: 0.6, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ delay: 0.1, type: 'spring', stiffness: 220, damping: 18 }}
                    className="mx-auto grid h-16 w-16 place-items-center rounded-3xl bg-gradient-to-br from-brand-500 to-brand-700 shadow-glow"
                  >
                    <Check className="h-8 w-8 text-white" strokeWidth={2.6} />
                  </motion.span>

                  <motion.h2
                    initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.25, duration: 0.5 }}
                    className="mt-6 text-balance font-serif text-3xl italic leading-snug text-ink"
                  >
                    Thank you for trusting us with{' '}
                    <span className="text-gradient not-italic">this part of your life.</span>
                  </motion.h2>

                  <motion.p
                    initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                    transition={{ delay: 0.45, duration: 0.5 }}
                    className="mx-auto mt-4 max-w-sm text-[14.5px] leading-relaxed text-ink-soft"
                  >
                    Your account is closed. Your records will be permanently deleted
                    {purgeOn ? <> on <span className="font-bold text-ink">{purgeOn}</span></> : ' in seven days'}.
                  </motion.p>

                  <motion.p
                    initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                    transition={{ delay: 0.6, duration: 0.5 }}
                    className="mt-3 text-[13px] font-medium text-ink-muted"
                  >
                    Look after yourself, {first}.
                  </motion.p>
                </motion.div>
              )}

              {error && (
                <div className="mt-4 rounded-2xl bg-rose-500/10 px-4 py-3 text-[12.5px] font-semibold text-rose-700 ring-1 ring-rose-500/20">
                  {error}
                </div>
              )}
            </div>

            {/* ------------------------------------------------- footer */}
            <div className="flex items-center justify-between gap-2 border-t border-white/50 px-6 py-4 sm:px-8">
              {step === 'sorry' && (
                <>
                  <LiquidButton variant="ghost" onClick={onClose}>Keep my account</LiquidButton>
                  <LiquidButton
                    variant="glass"
                    onClick={() => setStep('keep')}
                    disabled={!reason}
                    iconRight={<ArrowRight className="h-[18px] w-[18px]" />}
                  >
                    Continue
                  </LiquidButton>
                </>
              )}

              {step === 'keep' && (
                <>
                  <LiquidButton variant="ghost" onClick={() => setStep('sorry')}>Back</LiquidButton>
                  <LiquidButton
                    variant="glass"
                    onClick={() => setStep('terms')}
                    iconRight={<ArrowRight className="h-[18px] w-[18px]" />}
                  >
                    {downloaded ? 'Continue' : 'Continue without downloading'}
                  </LiquidButton>
                </>
              )}

              {step === 'terms' && (
                <>
                  <LiquidButton variant="ghost" onClick={() => setStep('keep')}>Back</LiquidButton>
                  <LiquidButton
                    variant="glass"
                    onClick={() => setStep('confirm')}
                    disabled={!agreed}
                    iconRight={<ArrowRight className="h-[18px] w-[18px]" />}
                  >
                    I understand
                  </LiquidButton>
                </>
              )}

              {step === 'confirm' && (
                <>
                  <LiquidButton variant="ghost" onClick={() => setStep('terms')} disabled={busy}>
                    Back
                  </LiquidButton>
                  <button
                    onClick={destroy}
                    disabled={!password || busy}
                    className="inline-flex h-[52px] items-center gap-2.5 rounded-2xl bg-gradient-to-br from-rose-500 to-rose-700 px-7 text-[15px] font-bold text-white shadow-[0_10px_30px_-8px_rgba(229,72,77,0.55)] transition hover:shadow-[0_16px_40px_-8px_rgba(229,72,77,0.7)] disabled:opacity-40"
                  >
                    {busy ? <Loader2 className="h-[18px] w-[18px] animate-spin" />
                      : <Trash2 className="h-[18px] w-[18px]" />}
                    {busy ? 'Closing your account…' : 'Delete my account'}
                  </button>
                </>
              )}

              {step === 'done' && (
                <LiquidButton className="w-full" onClick={onDeleted}>
                  Close
                </LiquidButton>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
