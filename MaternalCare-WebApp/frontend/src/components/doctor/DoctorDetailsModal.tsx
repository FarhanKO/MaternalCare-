import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { BadgeCheck, Loader2, Mail, Stethoscope, Users, X } from 'lucide-react';
import { LiquidButton } from '@/components/ui/LiquidButton';
import { GlassSelect } from '@/components/ui/GlassSelect';
import { api, FieldError } from '@/lib/api';
import { cn } from '@/lib/cn';
import type { Doctor } from '@/data/care';

/** The same list registration offers, so an edit reads alongside the roster. */
export const SPECIALTIES = [
  'Obstetrics & Gynaecology',
  'Obstetrics & Maternal Medicine',
  'Maternal-Fetal Medicine',
  'Paediatrics',
  'Perinatal Mental Health',
  'Nutrition & Dietetics',
  'General Practice',
];

export type DetailsSection = 'details' | 'caseload';

interface Props {
  open: boolean;
  onClose: () => void;
  doctor: Doctor | null;
  section: DetailsSection;
  /** the saved record, so the panel behind can show it without a reload */
  onSaved: (doctor: Doctor) => void;
}

const field =
  'h-12 w-full rounded-2xl border border-ink/10 bg-white/70 px-4 text-[14px] font-medium text-ink outline-none transition-all focus:border-peach-500 focus:bg-white focus:ring-4 focus:ring-peach-500/15';

/**
 * A clinician correcting her own entry.
 *
 * Two sections. "Your details" is what registration asked — specialty,
 * qualification, years, phone — with the licence number and sign-in email
 * shown but not editable. "Caseload" is capacity and whether she is taking
 * new patients: the two numbers the directory's open/busy/full badge and
 * the booking button are computed from, so a change here is visible to
 * every mother at once.
 *
 * This replaced two buttons that did nothing — "Caseload settings —
 * capacity and referral rules" and "Alert thresholds — when you are
 * notified". There are no referral rules and no thresholds to set; there is
 * capacity, and it is here.
 */
export function DoctorDetailsModal({ open, onClose, doctor, section, onSaved }: Props) {
  const [tab, setTab] = useState<DetailsSection>(section);
  const [form, setForm] = useState({
    name: '', specialty: '', qualification: '', years: '', phone: '', capacity: '', available: true,
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<{ field?: string; message: string } | null>(null);
  const [saved, setSaved] = useState(false);

  // open on the section that was pressed, with what the record says now
  useEffect(() => {
    if (!open) return;
    setTab(section);
    setError(null); setSaved(false);
    setForm({
      name: doctor?.name ?? '',
      specialty: doctor?.specialty ?? '',
      qualification: doctor?.qualification ?? '',
      years: String(doctor?.years ?? ''),
      phone: doctor?.phone ?? '',
      capacity: String(doctor?.capacity ?? ''),
      available: doctor?.available ?? true,
    });
  }, [open, section, doctor]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && open && !busy && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, busy, onClose]);

  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => setForm((f) => ({ ...f, [k]: v }));

  const save = async () => {
    setBusy(true); setError(null);
    try {
      const updated = await api.updateMyDoctor(tab === 'details'
        ? { name: form.name, specialty: form.specialty, qualification: form.qualification, years: Number(form.years), phone: form.phone }
        : { capacity: Number(form.capacity), available: form.available });
      onSaved(updated);
      setSaved(true);
      window.setTimeout(onClose, 900);
    } catch (err) {
      setError({ field: err instanceof FieldError ? err.field : undefined, message: err instanceof Error ? err.message : 'Could not save' });
    } finally { setBusy(false); }
  };

  if (typeof document === 'undefined') return null;
  const load = doctor ? Math.round((doctor.panel / Math.max(1, Number(form.capacity) || doctor.capacity)) * 100) : 0;

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
            onClick={() => !busy && onClose()}
            initial={{ opacity: 0, backdropFilter: 'blur(0px)' }}
            animate={{ opacity: 1, backdropFilter: 'blur(18px)' }}
            transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
          />
          <motion.div
            role="dialog" aria-modal="true" aria-label="Your clinician details"
            initial={{ opacity: 0, scale: 0.94, y: 18 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: 10, transition: { duration: 0.18 } }}
            transition={{ type: 'spring', stiffness: 260, damping: 26 }}
            className="glass-strong ring-gradient relative flex max-h-[88vh] w-full max-w-lg flex-col overflow-hidden rounded-4xl"
          >
            <button
              onClick={onClose} aria-label="Close" disabled={busy}
              className="absolute right-5 top-5 z-10 grid h-9 w-9 place-items-center rounded-xl bg-white/70 text-ink-soft transition-colors hover:text-ink disabled:opacity-40"
            >
              <X className="h-4 w-4" />
            </button>

            <div className="flex-1 overflow-y-auto px-6 py-7 sm:px-8">
              <div className="inline-flex rounded-2xl border border-white/60 bg-white/55 p-1">
                {([['details', 'Your details', Stethoscope], ['caseload', 'Caseload', Users]] as const).map(([id, label, Icon]) => (
                  <button
                    key={id} onClick={() => setTab(id)}
                    className={cn('inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-[12.5px] font-bold transition',
                      tab === id ? 'bg-peach-500 text-white shadow-md' : 'text-ink-soft hover:text-ink')}
                  >
                    <Icon className="h-3.5 w-3.5" /> {label}
                  </button>
                ))}
              </div>

              {tab === 'details' && (
                <div className="mt-6 space-y-4">
                  <h2 className="text-2xl font-extrabold tracking-tight text-ink">Your details</h2>
                  <p className="text-[13.5px] leading-relaxed text-ink-soft">
                    What mothers see when they look for a clinician. Your licence number and the email you
                    sign in with are shown for the record and cannot be changed here.
                  </p>
                  <div className="grid gap-2 rounded-2xl border border-white/60 bg-white/55 px-4 py-3 text-[12.5px] font-semibold text-ink-soft">
                    <span className="inline-flex items-center gap-2"><BadgeCheck className="h-4 w-4 text-peach-600" /> Licence {doctor?.licenseNo ?? '—'}</span>
                    <span className="inline-flex items-center gap-2"><Mail className="h-4 w-4 text-peach-600" /> {doctor?.email ?? '—'}</span>
                  </div>
                  <label className="block">
                    <span className="mb-1.5 block text-[12px] font-bold text-ink-soft">Full name</span>
                    <input className={field} value={form.name} onChange={(e) => set('name', e.target.value)} />
                  </label>
                  <GlassSelect label="Specialty" accent="peach" options={SPECIALTIES} value={form.specialty} onChange={(v) => set('specialty', v)} icon={<Stethoscope className="h-[18px] w-[18px]" />} />
                  <label className="block">
                    <span className="mb-1.5 block text-[12px] font-bold text-ink-soft">Qualification</span>
                    <input className={field} value={form.qualification} onChange={(e) => set('qualification', e.target.value)} placeholder="MBBS, FCPS (Obs & Gynae)" />
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    <label className="block">
                      <span className="mb-1.5 block text-[12px] font-bold text-ink-soft">Years of experience</span>
                      <input className={field} type="number" min={0} max={60} value={form.years} onChange={(e) => set('years', e.target.value)} />
                    </label>
                    <label className="block">
                      <span className="mb-1.5 block text-[12px] font-bold text-ink-soft">Phone</span>
                      <input className={field} value={form.phone} onChange={(e) => set('phone', e.target.value)} placeholder="01…" />
                    </label>
                  </div>
                </div>
              )}

              {tab === 'caseload' && (
                <div className="mt-6 space-y-4">
                  <h2 className="text-2xl font-extrabold tracking-tight text-ink">Caseload</h2>
                  <p className="text-[13.5px] leading-relaxed text-ink-soft">
                    You have <strong className="text-ink">{doctor?.panel ?? 0}</strong> mother{doctor?.panel === 1 ? '' : 's'} under your care.
                    Capacity decides when the directory shows you as busy or full; switching off new patients
                    hides the booking button without ending anyone's care.
                  </p>
                  <label className="block">
                    <span className="mb-1.5 block text-[12px] font-bold text-ink-soft">Capacity (patients)</span>
                    <input className={field} type="number" min={1} max={200} value={form.capacity} onChange={(e) => set('capacity', e.target.value)} />
                  </label>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-ink/10">
                    <div className={cn('h-full rounded-full', load >= 100 ? 'bg-rose-500' : load >= 85 ? 'bg-amber-500' : 'bg-peach-500')} style={{ width: `${Math.min(100, load)}%` }} />
                  </div>
                  <div className="text-[11.5px] font-semibold text-ink-muted">{load}% of capacity — {load >= 100 ? 'full' : load >= 85 ? 'busy' : 'open'}</div>
                  <label className="flex cursor-pointer items-center justify-between rounded-2xl border border-white/60 bg-white/55 px-4 py-3">
                    <span>
                      <span className="block text-[13.5px] font-bold text-ink">Accepting new patients</span>
                      <span className="block text-[11.5px] font-medium text-ink-muted">Off while on leave; you stay reachable to everyone already with you.</span>
                    </span>
                    <input type="checkbox" className="h-5 w-5 accent-peach-600" checked={form.available} onChange={(e) => set('available', e.target.checked)} />
                  </label>
                </div>
              )}

              {error && <p className="mt-4 text-[12.5px] font-semibold text-rose-600">{error.message}</p>}

              <div className="mt-6 flex items-center justify-end gap-2">
                <LiquidButton variant="ghost" onClick={onClose} disabled={busy}>Cancel</LiquidButton>
                <LiquidButton variant="peach" onClick={save} disabled={busy || saved}>
                  {busy ? <><Loader2 className="h-4 w-4 animate-spin" /> Saving…</> : saved ? 'Saved' : 'Save changes'}
                </LiquidButton>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
