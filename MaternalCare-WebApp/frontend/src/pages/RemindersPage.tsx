import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import {
  AlarmClock,
  ArrowRight,
  BellRing,
  CalendarCheck,
  Dumbbell,
  FileCheck2,
  Paperclip,
  Pill,
  Sparkles,
  Stethoscope,
  Syringe,
  TestTube,
  UserRoundCheck,
  Wand2,
  type LucideIcon,
} from 'lucide-react';
import { Navbar } from '@/components/landing/Navbar';
import { Footer } from '@/components/landing/Footer';
import { SectionHeading } from '@/components/landing/SectionHeading';
import { Badge } from '@/components/ui/Badge';
import { GlassCard } from '@/components/ui/GlassCard';
import { LiquidButton } from '@/components/ui/LiquidButton';
import { Reveal } from '@/components/ui/Reveal';
import { revealVariants, staggerContainer } from '@/lib/motion';

/**
 * The public page for the Reminders feature.
 *
 * Same reason as the trends page: the footer link pointed at a signed-in
 * route, so the one place that was meant to introduce reminders showed a
 * login form instead.
 *
 * The five kinds, the four groups and the vaccination card behaviour below
 * are the ones the application actually implements.
 */

/** The palette the app already uses for each reminder kind. */
const KIND = {
  doctor: '#3f66f0',
  test: '#22b8c4',
  medicine: '#f2789f',
  exercise: '#2fbf9b',
  vaccination: '#f6b93b',
};

const GROUPS: { icon: LucideIcon; title: string; sub: string; tint: string; examples: string[] }[] = [
  {
    icon: Stethoscope, tint: KIND.doctor,
    title: 'Doctor appointments',
    sub: 'Check-ups, scans and reviews',
    examples: ['Antenatal check-up', 'Growth ultrasound', 'Six-week postnatal check'],
  },
  {
    icon: TestTube, tint: KIND.test,
    title: 'Tests',
    sub: 'Screenings and lab work',
    examples: ['Glucose screening', 'Haemoglobin check', 'Urine culture'],
  },
  {
    icon: Pill, tint: KIND.medicine,
    title: 'Medicines & exercises',
    sub: 'The daily routine, the part that is easiest to lose',
    examples: ['Iron tablet with vitamin C', 'Prenatal vitamin', 'Pelvic floor exercises'],
  },
  {
    icon: Syringe, tint: KIND.vaccination,
    title: 'Vaccinations',
    sub: 'Hers and her child’s, on one schedule',
    examples: ['Tetanus (TT)', 'BCG · single dose', 'Pentavalent · dose 1'],
  },
];

const SOURCES: { icon: LucideIcon; title: string; body: string; tint: string }[] = [
  {
    icon: UserRoundCheck, tint: KIND.doctor,
    title: 'She adds it herself',
    body: 'A time, a note, and whether it repeats daily or weekly. The things only she knows about her own week.',
  },
  {
    icon: Wand2, tint: KIND.exercise,
    title: 'The app suggests it',
    body: 'Each kind carries a list of what is usually due at her stage, so setting up a schedule is a few taps rather than a blank form she has to fill from memory.',
  },
  {
    icon: Stethoscope, tint: KIND.vaccination,
    title: 'Her clinician schedules it',
    body: 'A doctor can place an appointment or a test directly onto her account. It appears in her list, already dated, without a phone call that has to be remembered.',
  },
];

/* ------------------------------------------------------------ diagrams */

/**
 * Where a reminder comes from, and where it ends up.
 *
 * Three sources feeding one schedule. Drawn because the interesting claim is
 * not that the app has reminders — everything has reminders — but that she is
 * not the only person who can put one there.
 */
function SourcesDiagram() {
  const items = [
    { at: '08:30', kind: 'medicine', title: 'Iron tablet', note: 'With orange juice', repeat: 'Daily' },
    { at: '10:15', kind: 'doctor', title: 'Growth ultrasound', note: 'Dr. Ortiz · Room 204', repeat: '' },
    { at: '18:00', kind: 'exercise', title: 'Prenatal yoga', note: 'Community centre', repeat: 'Weekly' },
    { at: '09:00', kind: 'test', title: 'Glucose screening', note: 'Fast for 8 hours before', repeat: '' },
  ] as const;

  const ICONS: Record<string, LucideIcon> = {
    medicine: Pill, doctor: Stethoscope, exercise: Dumbbell, test: TestTube, vaccination: Syringe,
  };

  return (
    <GlassCard strong glow className="p-7 sm:p-9">
      <div className="grid gap-8 lg:grid-cols-[0.85fr_auto_1.15fr] lg:items-center">
        {/* three sources */}
        <div className="space-y-2.5">
          <div className="text-[11px] font-bold uppercase tracking-wider text-ink-faint">
            Three ways in
          </div>
          {SOURCES.map((s, i) => (
            <motion.div
              key={s.title}
              initial={{ opacity: 0, x: -14 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1, duration: 0.45 }}
              className="flex items-center gap-3 rounded-2xl border border-white/60 bg-white/60 px-4 py-3"
            >
              <span className="grid h-9 w-9 flex-none place-items-center rounded-xl"
                style={{ background: `${s.tint}1f`, color: s.tint }}>
                <s.icon className="h-[18px] w-[18px]" strokeWidth={2.1} />
              </span>
              <span className="text-[13.5px] font-bold leading-tight text-ink">{s.title}</span>
            </motion.div>
          ))}
        </div>

        {/* converging arrow */}
        <div className="hidden place-items-center lg:grid">
          <div className="grid h-12 w-12 place-items-center rounded-2xl bg-peach-500/12 text-peach-600">
            <ArrowRight className="h-5 w-5" strokeWidth={2.4} />
          </div>
        </div>

        {/* one schedule */}
        <div>
          <div className="flex items-center justify-between">
            <div className="text-[11px] font-bold uppercase tracking-wider text-ink-faint">
              One schedule
            </div>
            <span className="rounded-full bg-brand-500/12 px-2.5 py-1 text-[10.5px] font-bold uppercase tracking-wide text-brand-700">
              Her week
            </span>
          </div>

          <div className="mt-3.5 space-y-2">
            {items.map((r, i) => {
              const Icon = ICONS[r.kind];
              const tint = KIND[r.kind as keyof typeof KIND];
              return (
                <motion.div
                  key={r.title}
                  initial={{ opacity: 0, y: 10 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: 0.25 + i * 0.09, duration: 0.45 }}
                  className="flex items-center gap-3 rounded-2xl border border-white/60 bg-white/70 px-3.5 py-2.5"
                >
                  <span className="w-11 flex-none font-mono text-[11.5px] font-bold text-ink-faint">
                    {r.at}
                  </span>
                  <span className="grid h-9 w-9 flex-none place-items-center rounded-xl"
                    style={{ background: `${tint}1f`, color: tint }}>
                    <Icon className="h-[17px] w-[17px]" strokeWidth={2.1} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13.5px] font-bold text-ink">{r.title}</span>
                    <span className="block truncate text-[11px] font-medium text-ink-muted">{r.note}</span>
                  </span>
                  {r.repeat && (
                    <span className="flex-none rounded-full bg-ink/[0.05] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-ink-faint">
                      {r.repeat}
                    </span>
                  )}
                </motion.div>
              );
            })}
          </div>
        </div>
      </div>
    </GlassCard>
  );
}

/**
 * The vaccination record: a claim and the paper that proves it, on one row.
 */
function VaccinationDiagram() {
  const rows = [
    { name: 'Tetanus (TT)', dose: 'TT2', who: 'For you', state: 'done', when: 'given Fri, Aug 7', card: false },
    { name: 'BCG', dose: 'Single dose', who: 'For baby', state: 'done', when: 'given Wed, Aug 26', card: true },
    { name: 'Pentavalent', dose: 'Dose 2', who: 'For baby', state: 'due', when: 'due Sat, Sep 20', card: false },
  ] as const;

  return (
    <GlassCard strong className="p-7 sm:p-8">
      <div className="flex flex-wrap items-center gap-4">
        <div className="min-w-[8rem] flex-1">
          <div className="flex items-baseline gap-1.5">
            <span className="text-3xl font-extrabold tracking-tight text-gradient">67%</span>
            <span className="text-[11px] font-bold uppercase tracking-wide text-ink-faint">complete</span>
          </div>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-ink/[0.07]">
            <motion.div
              className="h-full rounded-full bg-gradient-to-r from-mint-400 to-emerald-500"
              style={{ background: 'linear-gradient(90deg,#2fbf9b,#22b8c4)' }}
              initial={{ width: 0 }}
              whileInView={{ width: '67%' }}
              viewport={{ once: true }}
              transition={{ duration: 1.1, ease: [0.22, 1, 0.36, 1] }}
            />
          </div>
        </div>
        <div className="flex gap-6 text-center">
          <div>
            <div className="text-xl font-extrabold text-ink">2</div>
            <div className="text-[10px] font-bold uppercase tracking-wide text-ink-faint">done</div>
          </div>
          <div>
            <div className="text-xl font-extrabold text-ink">1</div>
            <div className="text-[10px] font-bold uppercase tracking-wide text-ink-faint">due</div>
          </div>
          <div>
            <div className="text-xl font-extrabold text-ink">1</div>
            <div className="text-[10px] font-bold uppercase tracking-wide text-ink-faint">card filed</div>
          </div>
        </div>
      </div>

      <div className="mt-5 space-y-2">
        {rows.map((r, i) => (
          <motion.div
            key={r.name}
            initial={{ opacity: 0, y: 8 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: i * 0.09, duration: 0.4 }}
            className="rounded-2xl border border-white/60 bg-white/60 p-3"
          >
            <div className="flex items-center gap-3">
              <span className="grid h-10 w-10 flex-none place-items-center rounded-2xl bg-amber-500/15 text-amber-600">
                <Syringe className="h-[18px] w-[18px]" strokeWidth={2} />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-[13.5px] font-extrabold text-ink">{r.name}</span>
                  <span className="text-[11px] font-semibold text-ink-muted">{r.dose}</span>
                  <span className={
                    r.state === 'done'
                      ? 'rounded-full bg-emerald-500/15 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-emerald-700'
                      : 'rounded-full bg-amber-500/15 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-amber-700'
                  }>
                    {r.state}
                  </span>
                </div>
                <div className="mt-0.5 text-[11px] font-semibold text-ink-faint">
                  {r.who} · {r.when}
                </div>
              </div>
              <span className="flex-none rounded-xl border border-white/70 bg-white/70 px-2.5 py-1.5 text-[11px] font-bold text-ink-soft">
                <Paperclip className="mr-1 inline h-3.5 w-3.5" />Card
              </span>
            </div>

            {r.card && (
              <div className="mt-2.5 flex items-center gap-2 border-t border-white/60 pt-2.5">
                <span className="grid h-8 w-8 flex-none place-items-center rounded-lg bg-ink/5 text-ink-faint">
                  <FileCheck2 className="h-3.5 w-3.5" />
                </span>
                <span className="text-[11px] font-bold text-ink">BCG · Single dose card</span>
                <span className="text-[9.5px] font-semibold text-ink-faint">filed Wed, Aug 26</span>
              </div>
            )}
          </motion.div>
        ))}
      </div>

      <p className="mt-4 text-[13px] leading-relaxed text-ink-muted">
        A photograph of the paper card is enough. It is stored with the rest of her documents
        and appears in her health report — so the proof travels with the claim, and a dose
        ticked by mistake can be put back.
      </p>
    </GlassCard>
  );
}

/* --------------------------------------------------------------- page */

export function RemindersPage() {
  const navigate = useNavigate();

  return (
    <>
      <Navbar />
      <main>
        {/* hero */}
        <section className="px-4 pt-24 sm:pt-28">
          <div className="mx-auto max-w-6xl">
            <div className="mx-auto max-w-3xl text-center">
              <Reveal className="flex justify-center">
                <Badge icon={<BellRing className="h-3.5 w-3.5" />}>Reminders</Badge>
              </Reveal>
              <Reveal delay={0.05}>
                <h1 className="mt-5 text-balance text-4xl font-extrabold leading-[1.06] tracking-tight text-ink sm:text-5xl lg:text-[3.4rem]">
                  The visit she misses is rarely{' '}
                  <span className="font-serif italic font-medium text-peach-600">the one she forgot</span>
                </h1>
              </Reveal>
              <Reveal delay={0.1}>
                <p className="mx-auto mt-5 max-w-2xl text-lg leading-relaxed text-ink-soft">
                  It is the one nobody told her about, or the tablet that slipped on the third
                  day, or the booster due in four months that lived on a card in a drawer.
                  MaternalCare+ keeps all of it in one place — and lets her doctor put things
                  there too.
                </p>
              </Reveal>
              <Reveal delay={0.15}>
                <div className="mt-8 flex flex-wrap justify-center gap-3">
                  <LiquidButton size="lg" variant="peach" onClick={() => navigate('/register')} iconRight={<ArrowRight className="h-[18px] w-[18px]" />}>
                    Set up a schedule
                  </LiquidButton>
                  <LiquidButton size="lg" variant="glass" onClick={() => navigate('/trends')}>
                    See health trends
                  </LiquidButton>
                </div>
              </Reveal>
            </div>

            <Reveal delay={0.1} className="mt-14">
              <SourcesDiagram />
            </Reveal>
          </div>
        </section>

        {/* the four groups */}
        <section className="px-4 py-16 sm:py-20">
          <div className="mx-auto max-w-6xl">
            <SectionHeading
              eyebrow="What she can be reminded about"
              icon={<AlarmClock className="h-3.5 w-3.5" />}
              title={<>Four groups, because a tablet<br className="hidden sm:block" /> is not an ultrasound</>}
              description="Each kind carries its own colour, its own timing and its own sense of urgency, so a glance at the list tells her what today actually holds."
            />
            <motion.div
              variants={staggerContainer(0.08)}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: '-80px' }}
              className="mt-14 grid gap-5 sm:grid-cols-2"
            >
              {GROUPS.map((g) => (
                <motion.div key={g.title} variants={revealVariants}>
                  <GlassCard float className="h-full p-6">
                    <div className="flex items-start gap-4">
                      <span className="grid h-12 w-12 flex-none place-items-center rounded-2xl"
                        style={{ background: `${g.tint}1f`, color: g.tint }}>
                        <g.icon className="h-[22px] w-[22px]" strokeWidth={2} />
                      </span>
                      <div>
                        <h3 className="text-lg font-bold tracking-tight text-ink">{g.title}</h3>
                        <p className="mt-1 text-[14px] leading-relaxed text-ink-soft">{g.sub}</p>
                      </div>
                    </div>
                    <ul className="mt-4 flex flex-wrap gap-2">
                      {g.examples.map((e) => (
                        <li key={e}
                          className="rounded-full border border-white/60 bg-white/60 px-3 py-1 text-[11.5px] font-semibold text-ink-soft">
                          {e}
                        </li>
                      ))}
                    </ul>
                  </GlassCard>
                </motion.div>
              ))}
            </motion.div>
          </div>
        </section>

        {/* where they come from */}
        <section className="px-4 py-16 sm:py-20">
          <div className="mx-auto max-w-6xl">
            <SectionHeading
              eyebrow="Where a reminder comes from"
              icon={<Sparkles className="h-3.5 w-3.5" />}
              title={<>She is not the only person<br className="hidden sm:block" /> who can put one there</>}
              description="Most apps make the patient responsible for remembering what she was never told. This one lets the suggestion and the clinician carry some of that weight."
            />
            <motion.div
              variants={staggerContainer(0.08)}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: '-80px' }}
              className="mt-14 grid gap-5 md:grid-cols-3"
            >
              {SOURCES.map((s) => (
                <motion.div key={s.title} variants={revealVariants}>
                  <GlassCard float className="h-full p-7">
                    <span className="grid h-12 w-12 place-items-center rounded-2xl"
                      style={{ background: `${s.tint}1f`, color: s.tint }}>
                      <s.icon className="h-[22px] w-[22px]" strokeWidth={2} />
                    </span>
                    <h3 className="mt-5 text-lg font-bold tracking-tight text-ink">{s.title}</h3>
                    <p className="mt-2.5 text-[15px] leading-relaxed text-ink-soft">{s.body}</p>
                  </GlassCard>
                </motion.div>
              ))}
            </motion.div>
          </div>
        </section>

        {/* the vaccination record */}
        <section className="px-4 py-16 sm:py-20">
          <div className="mx-auto max-w-6xl">
            <div className="grid items-center gap-10 lg:grid-cols-[1fr_1.05fr]">
              <div>
                <Reveal>
                  <Badge icon={<Syringe className="h-3.5 w-3.5" />}>Vaccination record</Badge>
                </Reveal>
                <Reveal delay={0.05}>
                  <h2 className="mt-5 text-4xl font-bold tracking-tight text-ink sm:text-[2.75rem]">
                    The card, on the same row as the claim
                  </h2>
                </Reveal>
                <Reveal delay={0.1}>
                  <p className="mt-4 text-lg leading-relaxed text-ink-soft">
                    A vaccination record is only worth what its evidence is worth. Every dose
                    can carry a photograph of the paper card it came from, filed against that
                    exact dose — so when a new clinic asks what her child has had, the answer
                    is not a memory.
                  </p>
                </Reveal>
                <Reveal delay={0.15}>
                  <ul className="mt-6 space-y-3">
                    {[
                      'Her doses and her child’s, on one schedule',
                      'Mark a dose given, and undo it if it was ticked by mistake',
                      'Cards appear in her health report alongside everything else',
                    ].map((t) => (
                      <li key={t} className="flex gap-3 text-[15px] leading-relaxed text-ink-soft">
                        <CalendarCheck className="mt-0.5 h-[18px] w-[18px] flex-none text-peach-600" strokeWidth={2.2} />
                        {t}
                      </li>
                    ))}
                  </ul>
                </Reveal>
              </div>

              <Reveal delay={0.1}>
                <VaccinationDiagram />
              </Reveal>
            </div>
          </div>
        </section>

        {/* closing */}
        <section className="px-4 py-20 text-center sm:py-24">
          <Reveal>
            <p className="mx-auto max-w-3xl text-balance font-serif text-3xl italic leading-snug text-ink sm:text-4xl">
              Care that is scheduled gets taken.{' '}
              <span className="text-gradient not-italic">Care that is remembered does not.</span>
            </p>
          </Reveal>
          <Reveal delay={0.1}>
            <div className="mt-9 flex flex-wrap justify-center gap-3">
              <LiquidButton size="lg" variant="peach" onClick={() => navigate('/register')} iconRight={<ArrowRight className="h-[18px] w-[18px]" />}>
                Create an account
              </LiquidButton>
              <LiquidButton size="lg" variant="glass" onClick={() => navigate('/community')}>
                Visit the community
              </LiquidButton>
            </div>
          </Reveal>
        </section>
      </main>
      <Footer />
    </>
  );
}
