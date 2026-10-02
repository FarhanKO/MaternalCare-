import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

interface Props {
  open: boolean;
  onClose: () => void;
}

/**
 * The product tour, played over the landing page.
 *
 * The file lives in public/media so it is served from this origin, which the
 * CSP's media-src 'self' allows. It starts with sound because opening it is
 * the click that asked for it; if the browser still refuses, the controls
 * are there.
 */
export function TourModal({ open, onClose }: Props) {
  const video = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && open && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  useEffect(() => {
    if (open) video.current?.play().catch(() => { /* autoplay refused — the controls are showing */ });
  }, [open]);

  if (typeof document === 'undefined') return null;

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[140] flex items-center justify-center p-3 sm:p-6"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }}
          exit={{ opacity: 0, pointerEvents: 'none', transition: { duration: 0.2 } }}
        >
          <motion.div
            className="absolute inset-0 bg-ink/60"
            onClick={onClose}
            initial={{ opacity: 0, backdropFilter: 'blur(0px)' }}
            animate={{ opacity: 1, backdropFilter: 'blur(18px)' }}
            transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
          />

          <motion.div
            role="dialog" aria-modal="true" aria-label="MaternalCare+ tour"
            initial={{ opacity: 0, scale: 0.94, y: 18 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: 10, transition: { duration: 0.18 } }}
            transition={{ type: 'spring', stiffness: 260, damping: 26 }}
            className="relative w-full max-w-6xl overflow-hidden rounded-3xl bg-ink shadow-glass-lg ring-1 ring-white/20"
          >
            <video
              ref={video}
              className="block aspect-video w-full"
              src="/media/maternalcare-tour.mp4"
              poster="/media/maternalcare-tour-poster.jpg"
              controls
              playsInline
              preload="metadata"
            />
            <button
              onClick={onClose} aria-label="Close the tour"
              className="absolute right-3 top-3 grid h-10 w-10 place-items-center rounded-xl bg-white/80 text-ink-soft backdrop-blur transition-colors hover:text-ink"
            >
              <X className="h-4 w-4" />
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
