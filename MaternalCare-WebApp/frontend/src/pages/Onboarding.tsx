import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Activity, ArrowLeft, ArrowRight, Check, Sparkles } from 'lucide-react';
import { LiquidButton } from '@/components/ui/LiquidButton';
import { GlassDatePicker } from '@/components/ui/GlassDatePicker';
import { cn } from '@/lib/cn';
import { spring } from '@/lib/motion';
import { api } from '@/lib/api';
import { useProfile } from '@/context/ProfileContext';
import { useAuth } from '@/lib/auth';
import {
  normalizeStage, stepsFor, stepIndexFor, isIntakeField, STAGE_LABEL, type Field,
} from '@/data/onboarding';

type Answers = Record<string, string | string[]>;

const inputClass =
  'h-14 w-full rounded-2xl border border-ink/10 bg-white/70 px-4 text-[15px] font-medium text-ink outline-none transition-all focus:border-brand-500 focus:bg-white focus:ring-4 focus:ring-brand-500/15';

/** Selectable pills — single-select or multi-select (chips). */
function PillGroup({
  options,
  isSelected,
  onPick,
}: {
  options: string[];
  isSelected: (o: string) => boolean;
  onPick: (o: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => {
        const none = o === 'None';
        const sel = isSelected(o);
        return (
          <button
            key={o}
            type="button"
            onClick={() => onPick(o)}
            className={cn(
              'rounded-full border px-4 py-2.5 text-sm font-semibold transition-all duration-200',
              sel && none && 'border-transparent bg-gradient-to-br from-emerald-400 to-emerald-600 text-white shadow-soft',
              sel && !none && 'border-transparent bg-gradient-to-br from-brand-500 to-brand-700 text-white shadow-soft',
              !sel && none && 'border-emerald-300 bg-emerald-50 text-emerald-700 hover:border-emerald-400',
              !sel && !none && 'border-ink/10 bg-white/70 text-ink-soft hover:border-brand-300 hover:text-ink',
            )}
          >
            {o}
          </button>
        );
      })}
    </div>
  );
}

/** A simple labeled number field used by the body-metrics step. */
function MetricField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <div className="mb-2.5 text-sm font-semibold text-ink-soft">{label}</div>
      <input type="number" value={value} onChange={(e) => onChange(e.target.value)} className={inputClass} />
    </div>
  );
}

/** Body metrics with a glassmorphic metric/imperial unit toggle. */
function BodyMetrics({ answers, set }: { answers: Answers; set: (id: string, v: string) => void }) {
  const system = (answers['bm_system'] as string) || 'metric';
  const v = (id: string) => (answers[id] as string) ?? '';
  return (
    <div className="space-y-5">
      <div className="inline-flex rounded-full border border-white/60 bg-white/50 p-1 shadow-soft backdrop-blur-md">
        {(['metric', 'imperial'] as const).map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => set('bm_system', s)}
            className={cn(
              'rounded-full px-4 py-1.5 text-xs font-bold transition-all duration-200',
              system === s ? 'bg-gradient-to-br from-brand-500 to-brand-700 text-white shadow-soft' : 'text-ink-muted hover:text-ink',
            )}
          >
            {s === 'metric' ? 'cm · kg' : 'ft · in · lb'}
          </button>
        ))}
      </div>

      {system === 'metric' ? (
        <>
          <MetricField label="Height (cm)" value={v('height_cm')} onChange={(x) => set('height_cm', x)} />
          <MetricField label="Weight (kg)" value={v('weight_kg')} onChange={(x) => set('weight_kg', x)} />
        </>
      ) : (
        <>
          <div>
            <div className="mb-2.5 text-sm font-semibold text-ink-soft">Height (ft / in)</div>
            <div className="grid grid-cols-2 gap-3">
              <input type="number" placeholder="Feet" value={v('height_ft')} onChange={(e) => set('height_ft', e.target.value)} className={inputClass} />
              <input type="number" placeholder="Inches" value={v('height_in')} onChange={(e) => set('height_in', e.target.value)} className={inputClass} />
            </div>
          </div>
          <MetricField label="Weight (lb)" value={v('weight_lb')} onChange={(x) => set('weight_lb', x)} />
        </>
      )}
    </div>
  );
}

export function Onboarding() {
  const [params] = useSearchParams();
  const { user } = useAuth();
  /*
   * Which questions: the stage in the URL (registration passes it), else
   * the signed-in account's own. The dashboard's buttons used to arrive
   * with neither, and "general" is three questions that never mention a
   * due date — so "Edit due date" could not.
   */
  const stage = normalizeStage(params.get('stage') ?? user?.stage ?? null);
  const steps = useMemo(() => stepsFor(stage), [stage]);
  const navigate = useNavigate();
  const { setStage, reload: reloadProfile } = useProfile();
  /* opened from the dashboard to change one thing: start on that step */
  const focus = params.get('focus');
  const editing = Boolean(user) && (focus !== null || params.get('edit') !== null);

  const [index, setIndex] = useState(() => stepIndexFor(steps, focus));
  const [dir, setDir] = useState(1);
  const [answers, setAnswers] = useState<Record<string, string | string[]>>({});
  const [prefilled, setPrefilled] = useState(!user);
  const [done, setDone] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  /*
   * Her current answers, so the form opens filled in. Left blank, a
   * question means "keep what I said", not "forget it" — the server only
   * touches what is sent.
   */
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    api.getOnboarding()
      .then((current) => {
        if (cancelled) return;
        const next: Record<string, string | string[]> = {};
        for (const [k, v] of Object.entries(current)) {
          if (v === undefined || v === null) continue;
          next[k] = Array.isArray(v) ? v.map(String) : String(v);
        }
        setAnswers((a) => ({ ...next, ...a }));
      })
      .catch(() => { /* a blank form is still usable */ })
      .finally(() => { if (!cancelled) setPrefilled(true); });
    return () => { cancelled = true; };
  }, [user]);

  // the answer to "I am currently" decides which reading, news and
  // questions the dashboard shows from here on
  useEffect(() => {
    if (done && stage !== 'general') setStage(stage);
  }, [done, stage]);

  /*
   * Write the answers down.
   *
   * This questionnaire used to end at `navigate('/mother')` with every answer
   * still sitting in React state, so the last menstrual period she had just
   * typed — the date her week, her due date and her whole dashboard are
   * derived from — was discarded on the way out. A registered mother reached a
   * dashboard with no pregnancy behind it, and "Edit due date" walked her back
   * through the same questions to the same effect.
   */
  useEffect(() => {
    if (!done) return;
    const one = (id: string) => {
      const v = answers[id];
      return typeof v === 'string' && v.trim() ? v.trim() : undefined;
    };
    const num = (id: string) => {
      const v = one(id);
      const n = v === undefined ? NaN : Number(v);
      return Number.isFinite(n) ? n : undefined;
    };
    const many = (id: string) => {
      const v = answers[id];
      return Array.isArray(v) && v.length ? v : undefined;
    };

    /*
     * The body-metrics step offers feet/inches/pounds as well, and stores them
     * under their own keys. Converting here rather than ignoring them means an
     * imperial answer is not silently dropped — the column is centimetres and
     * kilograms, and the weight-gain band depends on both.
     */
    const ft = num('height_ft');
    const inch = num('height_in');
    const imperialHeight = ft !== undefined || inch !== undefined
      ? Math.round(((ft ?? 0) * 12 + (inch ?? 0)) * 2.54 * 10) / 10
      : undefined;
    const lb = num('weight_lb');
    const imperialWeight = lb !== undefined ? Math.round(lb * 0.45359237 * 10) / 10 : undefined;

    const blood = one('blood');
    // the stage-specific answers, whatever this stage asked
    const intake: Record<string, string | string[]> = {};
    for (const [k, v] of Object.entries(answers)) {
      if (!isIntakeField(k)) continue;
      if (Array.isArray(v) ? v.length : String(v).trim()) intake[k] = v;
    }
    api.saveOnboarding({
      intake,
      allergies: one('allergies'),
      symptoms: many('symptoms'),
      dob: one('dob'),
      // "Not sure" is an answer about her knowledge, not a blood group
      bloodGroup: blood && blood !== 'Not sure' ? blood : undefined,
      heightCm: num('height') ?? num('height_cm') ?? imperialHeight,
      weightKg: num('weight') ?? num('weight_kg') ?? imperialWeight,
      conditions: many('conditions'),
      lmp: one('lmp'),
      /*
       * The child, for a new mother or a parent. Both step sets ask the same
       * things under their own ids, so both are read here.
       *
       * Sex is mapped rather than passed through: the question offers "Girl",
       * "Boy" and "Prefer not to say", and the last of those has to arrive as
       * nothing at all — the growth comparator refuses to state a centile
       * without a sex, which is the honest answer, and a guess would be worse
       * than the refusal.
       */
      childName: one('baby_name') ?? one('child_name'),
      childDob: one('baby_dob') ?? one('child_dob'),
      childGender: ((v) => (v === 'Girl' ? 'female' : v === 'Boy' ? 'male' : undefined))(
        one('baby_sex') ?? one('child_sex'),
      ),
      childFeeding: (one('feeding') || '').toLowerCase() || undefined,
      childWeightKg: num('child_weight_now'),
      childHeightCm: num('child_height_now'),
      childDelivery: (one('delivery') || '').toLowerCase() || undefined,
      childBirthWeightKg: num('birth_weight'),
    })
      // the profile panel loaded its details at sign-in; make it look again
      .then(() => reloadProfile())
      .catch((err) => {
        setSaveError(err instanceof Error ? err.message : 'Your answers could not be saved');
      });
  }, [done]);

  const total = steps.length;
  const step = steps[index];
  const set = (id: string, v: string | string[]) => setAnswers((a) => ({ ...a, [id]: v }));

  const next = () => {
    if (index < total - 1) {
      setDir(1);
      setIndex((i) => i + 1);
    } else setDone(true);
  };
  const back = () => {
    if (index > 0) {
      setDir(-1);
      setIndex((i) => i - 1);
    }
  };

  // animate the card body height between steps so nothing snaps
  const innerRef = useRef<HTMLDivElement>(null);
  const [h, setH] = useState<number | 'auto'>('auto');
  useLayoutEffect(() => {
    const el = innerRef.current;
    if (!el) return;
    const update = () => setH(el.offsetHeight);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const renderField = (field: Field) => {
    const val = answers[field.id];
    const labelText = field.unit ? `${field.label} (${field.unit})` : field.label;

    if (field.type === 'date') {
      return (
        <div key={field.id}>
          <GlassDatePicker label={field.label} value={val as string} onChange={(vv) => set(field.id, vv)} />
        </div>
      );
    }

    return (
      <div key={field.id}>
        <div className="mb-2.5 text-sm font-semibold text-ink-soft">
          {labelText}
          {field.optional && <span className="font-medium text-ink-faint"> · optional</span>}
        </div>
        {field.type === 'select' && (
          <PillGroup
            options={field.options!}
            isSelected={(o) => answers[field.id] === o}
            onPick={(o) => set(field.id, o)}
          />
        )}
        {field.type === 'chips' && (
          <PillGroup
            options={field.options!}
            isSelected={(o) => ((answers[field.id] as string[]) || []).includes(o)}
            onPick={(o) =>
              setAnswers((a) => {
                const arr = (a[field.id] as string[]) || [];
                if (o === 'None') return { ...a, [field.id]: ['None'] };
                const base = arr.filter((x) => x !== 'None');
                return { ...a, [field.id]: base.includes(o) ? base.filter((x) => x !== o) : [...base, o] };
              })
            }
          />
        )}
        {(field.type === 'text' || field.type === 'number') && (
          <input
            type={field.type}
            value={(val as string) ?? ''}
            placeholder={field.placeholder}
            onChange={(e) => set(field.id, e.target.value)}
            className={inputClass}
          />
        )}
      </div>
    );
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center px-4 py-10">
      <motion.div
        initial={{ opacity: 0, y: 24, filter: 'blur(10px)' }}
        animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
        transition={spring}
        className="glass-strong ring-gradient w-full max-w-xl rounded-[2rem] p-7 shadow-glass-lg sm:p-9"
      >
        {/* header */}
        <div className="mb-6 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2.5">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 shadow-glow">
              <Activity className="h-[18px] w-[18px] text-white" strokeWidth={2.4} />
            </span>
            <span className="text-[16px] font-bold tracking-tight text-ink">
              Maternal<span className="text-gradient">Care+</span>
            </span>
          </Link>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-50 px-3 py-1 text-xs font-semibold text-brand-600">
            <Sparkles className="h-3.5 w-3.5" /> {STAGE_LABEL[stage]}{editing ? ' · updating' : ''}
          </span>
        </div>

        {!done && (
          <>
            <div className="mb-2 flex items-center justify-between text-xs font-semibold text-ink-muted">
              <span>
                Question {index + 1} of {total}
              </span>
              <span>{Math.round(((index + 1) / total) * 100)}%</span>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-ink/10">
              <motion.div
                className="h-full rounded-full bg-gradient-to-r from-brand-500 to-aqua-500"
                animate={{ width: `${((index + 1) / total) * 100}%` }}
                transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
              />
            </div>
          </>
        )}

        {/* animated, resizing body */}
        <motion.div
          animate={{ height: h }}
          transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
          className="overflow-hidden"
        >
          <div ref={innerRef} className={done ? '' : 'pt-7'}>
            <motion.div
              key={done ? 'done' : index}
              initial={{ opacity: 0, x: done ? 0 : dir * 60, scale: done ? 0.94 : 1 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              transition={{ duration: 0.42, ease: [0.22, 1, 0.36, 1] }}
            >
              {!prefilled ? (
                <div className="py-10 text-center text-sm font-semibold text-ink-muted">Loading your answers…</div>
              ) : done ? (
                <div className="py-6 text-center">
                  <motion.div
                    initial={{ scale: 0.4, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ ...spring, delay: 0.1 }}
                    className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-gradient-to-br from-brand-500 to-brand-700 shadow-glow"
                  >
                    <Check className="h-8 w-8 text-white" strokeWidth={3} />
                  </motion.div>
                  <h2 className="mt-5 text-2xl font-extrabold tracking-tight text-ink">
                    {editing ? <>Details <span className="font-serif italic text-brand-600">updated</span></> : <>You’re all <span className="font-serif italic text-brand-600">set</span></>}
                  </h2>
                  <p className="mx-auto mt-2 max-w-sm text-ink-soft">
                    {editing
                      ? 'Your dashboard and profile now read from what you just told us.'
                      : 'Your care space is personalised and ready. Welcome to MaternalCare+.'}
                  </p>
                  {/* if the answers did not reach the server, say so here rather
                      than send her to a dashboard that quietly has none of them */}
                  {saveError && (
                    <p className="mx-auto mt-3 max-w-sm rounded-2xl bg-rose-500/10 px-3.5 py-2.5 text-[13px] font-semibold text-rose-700 ring-1 ring-rose-500/25">
                      {saveError} — your answers were not saved. You can add them from your profile.
                    </p>
                  )}
                  <LiquidButton
                    size="lg"
                    className="mt-7 w-full"
                    onClick={() => navigate('/mother')}
                    iconRight={<ArrowRight className="h-[18px] w-[18px]" />}
                  >
                    Enter MaternalCare+
                  </LiquidButton>
                </div>
              ) : (
                <div>
                  <div className="flex items-start gap-3.5">
                    <span className="grid h-11 w-11 flex-none place-items-center rounded-2xl bg-gradient-to-br from-brand-400 to-brand-600 shadow-glow">
                      <step.icon className="h-5 w-5 text-white" strokeWidth={2} />
                    </span>
                    <div>
                      <h2 className="text-xl font-bold tracking-tight text-ink">{step.title}</h2>
                      {step.subtitle && <p className="mt-1 text-sm leading-relaxed text-ink-soft">{step.subtitle}</p>}
                    </div>
                  </div>
                  <div className="mt-6 space-y-5">
                    {step.custom === 'body-metrics' ? <BodyMetrics answers={answers} set={set} /> : step.fields.map(renderField)}
                  </div>
                </div>
              )}
            </motion.div>
          </div>
        </motion.div>

        {/* nav */}
        {!done && (
          <div className="mt-8 flex items-center justify-between">
            {index > 0 ? (
              <button
                type="button"
                onClick={back}
                className="inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-semibold text-ink-muted transition-colors hover:text-ink"
              >
                <ArrowLeft className="h-4 w-4" /> Back
              </button>
            ) : (
              <span />
            )}
            <LiquidButton size="lg" onClick={next} iconRight={<ArrowRight className="h-[18px] w-[18px]" />}>
              {index < total - 1 ? 'Continue' : 'Finish'}
            </LiquidButton>
          </div>
        )}
      </motion.div>
    </div>
  );
}
