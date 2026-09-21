import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import {
  AlertTriangle, Baby, Camera, CalendarDays, Check, ChevronRight, ClipboardList, Droplet, HeartPulse,
  LogOut, Milk, Pencil, Ruler, ShieldCheck, Syringe,
  Sparkles, Stethoscope, Trash2, X,
} from 'lucide-react';
import { cn } from '@/lib/cn';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import type { ChildState, VaccinationStats } from '@/data/records';
import { useProfile } from '@/context/ProfileContext';
import { ReportButton } from '@/components/ui/ReportButton';
import { DeleteAccountModal } from '@/components/mother/DeleteAccountModal';
import { SignedInDevices } from '@/components/ui/SignedInDevices';
import { TermsModal } from '@/components/ui/TermsModal';

interface Props {
  open: boolean;
  onClose: () => void;
  score: number;
  band: { label: string; tone: string };
}

const TRIMESTER = [null, 'first', 'second', 'third'];

const BLOOD_GROUPS = ['A+', 'A−', 'B+', 'B−', 'O+', 'O−', 'AB+', 'AB−'];

/*
 * "Your care team" listed two doctors written into this file, shown to every
 * mother who opened her profile. One of them — Dr. Priya Nair — does not have
 * an account in the system at all, so a mother could believe a clinician was
 * looking after her who does not exist. The list now comes from the doctors
 * she actually has appointments with.
 */
const TINTS = ['#3f66f0', '#2fbf9b', '#8b7bf3', '#fb7534'];

const initialsOf = (name: string) => String(name || '')
  .replace(/^Dr\.?\s*/i, '')
  .split(/\s+/)
  .filter(Boolean)
  .slice(0, 2)
  .map((w) => w[0]?.toUpperCase() ?? '')
  .join('') || '?';

const MENU = [
  { icon: Pencil, label: 'Edit profile', hint: 'Name, photo, bio' },
  { icon: ShieldCheck, label: 'Privacy & data', hint: 'Who can see your records' },
];

export function ProfileModal({ open, onClose, score, band }: Props) {
  const { name, avatar, initials, bio, stage, details, setAvatar, setBio, setDetail } = useProfile();
  const {
    week, dueDate, trimester, bloodGroup, age, conditions, history,
  } = details;
  const navigate = useNavigate();
  /* reopen the questionnaire on the question this line answers */
  const editAnswer = (field: string) => {
    onClose();
    navigate(`/onboarding?stage=${stage}&focus=${field}`);
  };
  const [signingOut, setSigningOut] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [termsOpen, setTermsOpen] = useState(false);
  // the signed-in account, for whether this is a mother or a clinician leaving
  const { user: account } = useAuth();
  const [editingBio, setEditingBio] = useState(false);

  /*
   * The two stage-specific facts.
   *
   * A pregnant mother's four boxes are week, due date, blood group and age.
   * Removing the first two for everybody else left the other three stages
   * with a half-empty panel, so each now fills the gap with something true
   * of her: her child's age and how they feed for a new mother, her child's
   * age and vaccination progress for a parent, and her recorded conditions
   * for a woman planning. All of it already exists in the database.
   */
  const [child, setChild] = useState<ChildState | null>(null);
  const [vax, setVax] = useState<VaccinationStats | null>(null);
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    api.getChild()
      .then((c) => { if (!cancelled) setChild(c); })
      .catch(() => { /* she may have no child; the boxes fall back */ });
    api.getVaccinations()
      .then((v) => { if (!cancelled) setVax(v.stats); })
      .catch(() => { /* the box shows an em dash */ });
    return () => { cancelled = true; };
  }, [open]);

  /* the clinicians she actually has appointments with */
  const [careTeam, setCareTeam] = useState<
    { id: string; name: string; role: string; hospital?: string }[] | null
  >(null);
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    api.getMyCareTeam()
      .then((t) => { if (!cancelled) setCareTeam(t); })
      .catch(() => { if (!cancelled) setCareTeam([]); });
    return () => { cancelled = true; };
  }, [open]);
  const [draftBio, setDraftBio] = useState(bio);
  const [editingFact, setEditingFact] = useState<null | 'week' | 'dueDate' | 'bloodGroup' | 'age'>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && open && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  useEffect(() => { if (open) { setDraftBio(bio); setEditingBio(false); } }, [open]);

  /**
   * End the session, then leave by a full page load rather than a router
   * navigation — so every provider is torn down and nothing of hers survives
   * in memory for whoever signs in next. The redirect happens even if the
   * request fails: a cookie the server has already forgotten is no reason to
   * keep her looking at her own record.
   */
  const signOut = async () => {
    setSigningOut(true);
    try {
      await api.logout();
    } finally {
      window.location.assign('/signin');
    }
  };

  const pickPhoto = (file?: File) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setAvatar(String(reader.result));
    reader.readAsDataURL(file);
  };

  /*
   * Week and due date are computed from her LMP on the server, so they are
   * shown rather than offered for editing — the pencil used to imply she could
   * correct them, and typing a new number changed the screen and nothing else.
   * They disappear entirely for a mother who has no pregnancy to have a week
   * of, instead of the 26 this panel used to show everybody.
   */
  /** Read-only facts are computed from her record; only blood group and age are hers to type. */
  const readOnly = (key: string, icon: typeof Baby, label: string, value: string) => ({
    key: key as 'week', icon, label, value,
    editable: false, type: 'text' as const, min: undefined, max: undefined,
  });

  const FEEDING_LABEL: Record<string, string> = {
    breastfeeding: 'Breast', formula: 'Formula', mixed: 'Mixed',
  };

  /*
   * Four boxes at every stage, each one true of the woman reading it.
   *
   * Week and due date belong to a pregnancy and were correctly dropped for
   * the other three stages — but nothing replaced them, so a planning mother
   * and a parent were left looking at two boxes in a grid built for four.
   */
  const stageFacts = week !== null
    ? [
      readOnly('week', Baby, 'Week', `${week}`),
      ...(dueDate ? [readOnly('dueDate', CalendarDays, 'Due', dueDate)] : []),
    ]
    : stage === 'new-mother' || stage === 'parent'
      ? [
        readOnly('child', Baby, child?.child?.name?.split(' ')[0] || 'Child',
          child?.child?.agePretty ?? '—'),
        stage === 'new-mother'
          ? readOnly('feeding', Milk, 'Feeding',
            FEEDING_LABEL[child?.child?.feeding ?? ''] ?? '—')
          : readOnly('vaccines', Syringe, 'Vaccines',
            vax ? `${vax.done}/${vax.total}` : '—'),
      ]
      : [
        // planning, or a stage we do not recognise
        readOnly('conditions', HeartPulse, 'Health',
          conditions?.trim() ? conditions.trim() : 'Nothing noted'),
        readOnly('vaccines', Syringe, 'Vaccines', vax ? `${vax.done}/${vax.total}` : '—'),
      ];

  const facts = [
    ...stageFacts,
    { key: 'bloodGroup' as const, icon: Droplet, label: 'Blood', value: bloodGroup || '—', editable: true, type: 'select' as const, min: undefined, max: undefined },
    { key: 'age' as const, icon: Ruler, label: 'Age', value: age === null ? '—' : `${age}`, editable: true, type: 'number' as const, min: 12, max: 60 },
  ];

  if (typeof document === 'undefined') return null;

  /*
   * Only the sheet is AnimatePresence's child, and it carries a key. The two
   * dialogs used to sit beside it as unkeyed siblings, which framer-motion
   * reported as two children with the same key on every open; they animate
   * themselves and belong outside.
   */
  return createPortal(
    <>
    <AnimatePresence>
      {open && (
        <motion.div
          key="profile"
          className="fixed inset-0 z-[110] flex items-center justify-center p-4"
          initial={{ opacity: 1 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, pointerEvents: 'none', transition: { duration: 0.22 } }}
        >
          <motion.div
            className="absolute inset-0 bg-ink/35"
            onClick={onClose}
            initial={{ opacity: 0, backdropFilter: 'blur(0px)', WebkitBackdropFilter: 'blur(0px)' }}
            animate={{ opacity: 1, backdropFilter: 'blur(18px)', WebkitBackdropFilter: 'blur(18px)' }}
            transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          />

          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label="Your profile"
            initial={{ opacity: 0, scale: 0.94, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: 12, transition: { duration: 0.18 } }}
            transition={{ type: 'spring', stiffness: 260, damping: 26 }}
            className="glass-strong ring-gradient relative flex max-h-[88vh] w-full max-w-md flex-col overflow-hidden rounded-4xl shadow-float"
          >
            {/* cover */}
            <div
              className="relative h-28 flex-none overflow-hidden"
              style={{ background: 'linear-gradient(140deg, #ff9db9 0%, #f76592 48%, #7a9dff 100%)' }}
            >
              <div className="pointer-events-none absolute -right-10 -top-16 h-44 w-44 rounded-full bg-white/25 blur-2xl" />
              <div className="pointer-events-none absolute -bottom-20 left-6 h-40 w-40 rounded-full bg-white/20 blur-2xl" />
              <button
                onClick={onClose}
                aria-label="Close profile"
                className="absolute right-4 top-4 grid h-9 w-9 place-items-center rounded-xl border border-white/30 bg-white/20 text-white backdrop-blur-md transition hover:bg-white/30"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* identity — centred; relative + z-10 keeps it above the positioned cover */}
            <div className="relative z-10 flex-none px-6">
              <div className="-mt-12 flex flex-col items-center text-center">
                <motion.div
                  initial={{ scale: 0.7, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ type: 'spring', stiffness: 300, damping: 22, delay: 0.1 }}
                  className="relative"
                >
                  {avatar ? (
                    <img
                      src={avatar}
                      alt={name}
                      className="h-24 w-24 rounded-3xl border-[3px] border-white object-cover shadow-glow"
                    />
                  ) : (
                    <span className="grid h-24 w-24 place-items-center rounded-3xl border-[3px] border-white bg-gradient-to-br from-brand-500 to-brand-700 text-2xl font-extrabold text-white shadow-glow">
                      {initials}
                    </span>
                  )}

                  {/* change photo */}
                  <input
                    ref={fileRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => pickPhoto(e.target.files?.[0])}
                  />
                  <button
                    onClick={() => fileRef.current?.click()}
                    aria-label="Change profile photo"
                    className="absolute -bottom-1 -right-1 grid h-9 w-9 place-items-center rounded-xl border-2 border-white bg-gradient-to-br from-brand-500 to-brand-700 text-white shadow-glow transition hover:brightness-110"
                  >
                    <Camera className="h-4 w-4" />
                  </button>
                </motion.div>

                {avatar && (
                  <button
                    onClick={() => setAvatar(null)}
                    className="mt-2 inline-flex items-center gap-1 text-[11px] font-semibold text-ink-faint transition hover:text-rose-600"
                  >
                    <Trash2 className="h-3 w-3" /> Remove photo
                  </button>
                )}

                <div className="mt-3 text-xl font-extrabold leading-tight tracking-tight text-ink">{name}</div>
                <div className="mt-1.5 flex flex-wrap items-center justify-center gap-1.5">
                  <span className="rounded-full bg-rose-500/12 px-2 py-0.5 text-[10px] font-bold text-rose-600">Mother</span>
                  {/* the trimester was written here as "second" for everybody,
                      including the mothers who were not pregnant at all */}
                  {week !== null && (
                    <span className="text-[11px] font-semibold text-ink-muted">
                      Week {week}
                      {trimester ? ` · ${TRIMESTER[trimester]} trimester` : ''}
                    </span>
                  )}
                </div>

                {/* bio */}
                <div className="mt-3 w-full">
                  {editingBio ? (
                    <div>
                      <textarea
                        value={draftBio}
                        onChange={(e) => setDraftBio(e.target.value)}
                        rows={3}
                        maxLength={160}
                        autoFocus
                        placeholder="A line about you — how you're feeling, what you're hoping for…"
                        className="w-full resize-none rounded-2xl border border-white/60 bg-white/70 px-3.5 py-2.5 text-center text-[12px] font-medium text-ink outline-none transition placeholder:text-ink-faint focus:border-brand-400 focus:ring-2 focus:ring-brand-500/20"
                      />
                      <div className="mt-1.5 flex items-center justify-center gap-2">
                        <span className="text-[10px] font-semibold text-ink-faint">{draftBio.length}/160</span>
                        <button
                          onClick={() => { setBio(draftBio.trim()); setEditingBio(false); }}
                          className="inline-flex items-center gap-1 rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 px-3 py-1.5 text-[11px] font-bold text-white shadow-glow"
                        >
                          <Check className="h-3 w-3" /> Save
                        </button>
                        <button
                          onClick={() => { setDraftBio(bio); setEditingBio(false); }}
                          className="rounded-xl px-2 py-1.5 text-[11px] font-bold text-ink-muted transition hover:text-ink"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      onClick={() => setEditingBio(true)}
                      className={cn(
                        'w-full rounded-2xl border border-dashed px-3.5 py-2.5 text-[12px] leading-relaxed transition',
                        bio
                          ? 'border-transparent bg-white/50 font-medium italic text-ink-soft hover:bg-white/70'
                          : 'border-ink/15 font-semibold text-ink-faint hover:border-brand-300 hover:text-ink-muted',
                      )}
                    >
                      {bio || '+ Add a short bio'}
                    </button>
                  )}
                </div>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-6 pb-6">
              {/* wellbeing */}
              <div className="mt-5 flex items-center gap-3 rounded-2xl border border-white/60 bg-white/55 p-3.5">
                <span className="grid h-10 w-10 flex-none place-items-center rounded-xl" style={{ background: `${band.tone}1f`, color: band.tone }}>
                  <Sparkles className="h-5 w-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-ink-faint">Today’s wellbeing</span>
                    <span className="text-sm font-extrabold" style={{ color: band.tone }}>{band.label}</span>
                  </div>
                  <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-ink/[0.06]">
                    <motion.div
                      className="h-full rounded-full"
                      style={{ background: band.tone }}
                      initial={{ width: 0 }}
                      animate={{ width: `${score}%` }}
                      transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1], delay: 0.15 }}
                    />
                  </div>
                </div>
                <span className="text-xl font-extrabold tabular-nums text-ink">{score}</span>
              </div>

              {/* facts */}
              <div className="mt-3 grid grid-cols-4 gap-2">
                {facts.map((f, i) => (
                  <motion.div
                    key={f.label}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.12 + i * 0.05, duration: 0.35 }}
                    className="group relative rounded-2xl border border-white/60 bg-white/55 py-3 text-center transition hover:border-brand-300 hover:bg-white"
                  >
                    {editingFact === f.key && f.editable ? (
                      f.type === 'select' ? (
                        <select
                          autoFocus
                          value={bloodGroup}
                          onChange={(e) => { setDetail('bloodGroup', e.target.value); setEditingFact(null); }}
                          onBlur={() => setEditingFact(null)}
                          className="w-full bg-transparent text-center text-sm font-extrabold text-ink outline-none"
                        >
                          {BLOOD_GROUPS.map((g) => <option key={g} value={g}>{g}</option>)}
                        </select>
                      ) : (
                        <input
                          autoFocus
                          type={f.type}
                          min={f.min}
                          max={f.max}
                          defaultValue={f.value}
                          onBlur={(e) => {
                            const v = e.target.value.trim();
                            if (v) setDetail(f.key, (f.type === 'number' ? Number(v) : v) as never);
                            setEditingFact(null);
                          }}
                          onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
                          className="w-full bg-transparent text-center text-sm font-extrabold text-ink outline-none"
                        />
                      )
                    ) : f.editable ? (
                      <button onClick={() => setEditingFact(f.key)} className="w-full" aria-label={`Edit ${f.label}`}>
                        <f.icon className="mx-auto h-3.5 w-3.5 text-ink-faint" />
                        <span className="mt-1 block text-sm font-extrabold leading-none text-ink">{f.value}</span>
                        <span className="mt-1 block text-[9px] font-bold uppercase tracking-wider text-ink-faint">{f.label}</span>
                        <Pencil className="absolute right-1.5 top-1.5 h-2.5 w-2.5 text-ink-faint opacity-0 transition group-hover:opacity-100" />
                      </button>
                    ) : (
                      // derived from her record, so there is nothing here to edit
                      <div className="w-full">
                        <f.icon className="mx-auto h-3.5 w-3.5 text-ink-faint" />
                        <span className="mt-1 block text-sm font-extrabold leading-none text-ink">{f.value}</span>
                        <span className="mt-1 block text-[9px] font-bold uppercase tracking-wider text-ink-faint">{f.label}</span>
                      </div>
                    )}
                  </motion.div>
                ))}
              </div>

              <p className="mt-2 text-center text-[10px] font-semibold text-ink-faint">
                {week !== null
                  ? 'Tap your blood group or age to edit. Week and due date come from your record.'
                  : 'Tap any value to edit it'}
              </p>

              {/* care team */}
              <div className="mt-5">
                <div className="text-[11px] font-bold uppercase tracking-wider text-ink-faint">Your care team</div>
                <div className="mt-2.5 space-y-2">
                  {careTeam !== null && careTeam.length === 0 && (
                    <div className="rounded-2xl border border-dashed border-ink/15 px-3 py-4 text-center text-[11.5px] font-medium text-ink-faint">
                      No clinician yet — book an appointment and they will appear here.
                    </div>
                  )}
                  {(careTeam ?? []).map((m, i) => (
                    <div key={m.id} className="flex items-center gap-3 rounded-2xl border border-white/60 bg-white/55 px-3 py-2.5">
                      <span className="grid h-9 w-9 flex-none place-items-center rounded-full text-[11px] font-bold text-white" style={{ background: TINTS[i % TINTS.length] }}>
                        {initialsOf(m.name)}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-[13px] font-bold text-ink">{m.name}</div>
                        <div className="truncate text-[11px] font-medium text-ink-muted">
                          {m.role}{m.hospital ? ` · ${m.hospital}` : ''}
                        </div>
                      </div>
                      {/* the icon was a button that did nothing at all; it is a
                          label now, and messaging lives on the Doctor tab */}
                      <span
                        aria-hidden
                        className="grid h-8 w-8 flex-none place-items-center rounded-xl bg-white/70 text-ink-faint"
                      >
                        <Stethoscope className="h-4 w-4" />
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/*
                What she told the questionnaire. These answers were stored and
                then shown nowhere — a mother who wrote "penicillin" under
                allergies had no way to see it again, let alone change it.
                Each line reopens the form on its own question.
              */}
              <div className="mt-5">
                <div className="flex items-center justify-between">
                  <div className="text-[11px] font-bold uppercase tracking-wider text-ink-faint">Your background</div>
                  <button
                    onClick={() => editAnswer(history[0]?.id ?? 'dob')}
                    className="text-[11px] font-bold text-brand-600 hover:underline"
                  >
                    {history.length ? 'Update' : 'Answer'}
                  </button>
                </div>
                {history.length === 0 ? (
                  <button
                    onClick={() => editAnswer('dob')}
                    className="mt-2.5 w-full rounded-2xl border border-dashed border-ink/15 px-3 py-4 text-center text-[11.5px] font-medium text-ink-faint transition hover:bg-white/60"
                  >
                    Nothing recorded yet — a few questions help your clinician and your care plan.
                  </button>
                ) : (
                  <div className="mt-2.5 space-y-1.5">
                    {history.map((line) => (
                      <button
                        key={line.id}
                        onClick={() => editAnswer(line.id)}
                        className={cn(
                          'flex w-full items-center gap-3 rounded-2xl border px-3 py-2.5 text-left transition hover:bg-white',
                          line.tone === 'warn'
                            ? 'border-amber-500/25 bg-amber-500/8'
                            : 'border-white/60 bg-white/55',
                        )}
                      >
                        <span
                          aria-hidden
                          className={cn(
                            'grid h-8 w-8 flex-none place-items-center rounded-xl',
                            line.tone === 'warn' ? 'bg-amber-500/15 text-amber-700' : 'bg-white/70 text-ink-faint',
                          )}
                        >
                          {line.tone === 'warn' ? <AlertTriangle className="h-4 w-4" /> : <ClipboardList className="h-4 w-4" />}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block text-[10.5px] font-semibold uppercase tracking-wide text-ink-faint">{line.label}</span>
                          <span className="block truncate text-[12.5px] font-bold text-ink">{line.value}</span>
                        </span>
                        <Pencil className="h-3.5 w-3.5 flex-none text-ink-faint" />
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* menu */}
              <div className="mt-5 space-y-1.5">
                {MENU.map((m) => (
                  <button
                    key={m.label}
                    /* "Privacy & data" opens the same document she agreed to
                       at registration, on the section about who sees what */
                    onClick={m.label === 'Privacy & data' ? () => setTermsOpen(true) : undefined}
                    className="flex w-full items-center gap-3 rounded-2xl border border-white/60 bg-white/55 px-3 py-2.5 text-left transition hover:bg-white"
                  >
                    <span className="grid h-8 w-8 flex-none place-items-center rounded-xl bg-brand-500/10 text-brand-600">
                      <m.icon className="h-4 w-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="text-[13px] font-bold text-ink">{m.label}</div>
                      <div className="text-[11px] font-medium text-ink-muted">{m.hint}</div>
                    </div>
                    <ChevronRight className="h-4 w-4 flex-none text-ink-faint" />
                  </button>
                ))}
                {/* one row; the device list opens over the panel */}
                <SignedInDevices accent="blue" />
              </div>

              {/* her whole record as one document, from the place she comes to
                  when she is looking for her own details */}
              <div className="mt-5 rounded-2xl border border-white/60 bg-white/55 p-3.5">
                <div className="text-[13px] font-bold text-ink">Health report</div>
                <p className="mt-0.5 text-[11px] font-medium leading-relaxed text-ink-muted">
                  Your details, vitals, daily log, consultations and every filed prescription and
                  result — as one PDF to take to an appointment.
                </p>
                <ReportButton className="mt-2.5 w-full" />
              </div>


              {/* this used to be wired to onClose: it shut the panel and left
                  her signed in, on a medical record, on whatever device she
                  had just decided to walk away from */}
              <button
                onClick={signOut}
                disabled={signingOut}
                className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-rose-300/70 bg-rose-500/10 px-4 py-3 text-sm font-bold text-rose-600 transition hover:bg-rose-500/15 hover:text-rose-700 disabled:opacity-60"
              >
                <LogOut className="h-[18px] w-[18px]" /> {signingOut ? 'Signing out…' : 'Sign out'}
              </button>

              {/*
                Deliberately quiet, and deliberately present. Deleting an
                account is a right, not a feature to advertise — a plain link
                under the sign-out button is the convention, and hiding it
                inside a settings page nobody finds is how "you can delete your
                data whenever you like" stops being true.
              */}
              <button
                onClick={() => setDeleteOpen(true)}
                className="mt-3 w-full rounded-2xl px-4 py-2.5 text-[12.5px] font-semibold text-ink-faint underline decoration-ink-faint/40 underline-offset-4 transition hover:text-rose-600 hover:decoration-rose-400"
              >
                Delete my account
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
      <TermsModal
        open={termsOpen}
        onClose={() => setTermsOpen(false)}
        part="privacy"
        focus="who-can-see"
        accepted={{ version: account?.termsVersion ?? null, at: account?.termsAcceptedAt ?? null }}
      />
      <DeleteAccountModal
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        name={name}
        role={account?.role}
        /* the account is gone server-side; a full reload is the only honest
           way back to a signed-out application */
        onDeleted={() => { window.location.href = '/'; }}
      />
    </>,
    document.body,
  );
}
