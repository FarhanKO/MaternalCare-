import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import { ExternalLink, X } from 'lucide-react';
import { TermsContent, TermsTabs } from '@/components/ui/TermsContent';
import { TERMS_VERSION, type TermsPart } from '@/data/terms';

interface Props {
  open: boolean;
  onClose: () => void;
  /** which tab opens first */
  part?: TermsPart;
  /** section to land on */
  focus?: string;
  accent?: 'blue' | 'peach';
  /**
   * What this account agreed to, when it registered. Shown so a person can
   * see at a glance whether the document has moved on since.
   */
  accepted?: { version: string | null; at: string | null };
}

/**
 * The terms and privacy notice, over whatever screen asked for them.
 *
 * Opened from the registration form (so the form she has half filled in is
 * still there when she closes it) and from the profile panel. The same
 * content is at /terms as a page, linked from the footer and from here.
 */
export function TermsModal({
  open, onClose, part = 'terms', focus, accent = 'blue', accepted,
}: Props) {
  const [tab, setTab] = useState<TermsPart>(part);

  // re-open on the tab the caller asked for, not the one left from last time
  useEffect(() => { if (open) setTab(part); }, [open, part]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && open && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (typeof document === 'undefined') return null;

  const acceptedLine = accepted && (
    accepted.version
      ? `You agreed to version ${accepted.version} on ${new Date(accepted.at!).toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' })}`
        + (accepted.version === TERMS_VERSION ? ' — the current version.' : ` — the current version is ${TERMS_VERSION}.`)
      : 'Your account predates the recorded agreement; this is the current version.'
  );

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
            role="dialog" aria-modal="true" aria-label="Terms and privacy"
            initial={{ opacity: 0, scale: 0.94, y: 18 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: 10, transition: { duration: 0.18 } }}
            transition={{ type: 'spring', stiffness: 260, damping: 26 }}
            className="glass-strong ring-gradient relative flex max-h-[88vh] w-full max-w-2xl flex-col overflow-hidden rounded-4xl"
          >
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/60 px-6 pb-4 pt-6 sm:px-8">
              <div>
                <h2 className="text-xl font-extrabold tracking-tight text-ink">Terms &amp; privacy</h2>
                {acceptedLine && (
                  <p className="mt-0.5 text-[11.5px] font-semibold text-ink-muted">{acceptedLine}</p>
                )}
              </div>
              <div className="flex items-center gap-2">
                <TermsTabs part={tab} onChange={setTab} accent={accent} />
                <button
                  onClick={onClose} aria-label="Close"
                  className="grid h-9 w-9 place-items-center rounded-xl bg-white/70 text-ink-soft transition-colors hover:text-ink"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-6 sm:px-8">
              <TermsContent part={tab} focus={tab === part ? focus : undefined} compact />
            </div>

            <div className="border-t border-white/60 px-6 py-3 text-right sm:px-8">
              <Link
                to={`/terms${tab === 'privacy' ? '#privacy' : ''}`}
                target="_blank"
                rel="noopener"
                className="inline-flex items-center gap-1.5 text-[12px] font-bold text-ink-soft underline decoration-ink-faint/40 underline-offset-4 hover:text-ink"
              >
                Open as a page <ExternalLink className="h-3.5 w-3.5" />
              </Link>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
