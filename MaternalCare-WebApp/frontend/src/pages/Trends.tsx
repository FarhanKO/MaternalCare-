import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import {
  Activity,
  ArrowRight,
  Baby,
  Brain,
  Droplets,
  Eye,
  HeartPulse,
  LineChart,
  Moon,
  Ruler,
  Scale,
  ShieldCheck,
  Smile,
  Stethoscope,
  TrendingUp,
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
 * The public page for the Health trends feature.
 *
 * The footer used to send a visitor here to /mother?tab=vitals, which is
 * behind the sign-in wall — so the one link meant to explain the feature
 * bounced them to a login form instead. This page explains it without an
 * account.
 *
 * Everything stated here is something the application does. The charts listed
 * are the charts that exist, the five risk factors are the five that are
 * scored, and there are no outcome figures, because we have measured none.
 */

const C = {
  brand: '#3f66f0',
  aqua: '#22b8c4',
  mint: '#2fbf9b',
  amber: '#f6b93b',
  rose: '#e5484d',
};

/* ------------------------------------------------------------ the charts */

const CHARTS: { icon: LucideIcon; title: string; body: string; tint: string }[] = [
  {
    icon: HeartPulse, tint: C.rose,
    title: 'Blood pressure',
    body: 'Systolic and diastolic on one axis, so a slow climb is visible as a slope rather than as five numbers on five different pieces of paper.',
  },
  {
    icon: Scale, tint: C.brand,
    title: 'Weight gain',
    body: 'Her own curve against the range recommended for her starting weight — not a single target everyone is measured against.',
  },
  {
    icon: Activity, tint: C.aqua,
    title: 'Blood glucose',
    body: 'Readings around the screening window, where a pattern matters more than any one fasting result.',
  },
  {
    icon: Baby, tint: '#f2789f',
    title: 'Baby’s movements',
    body: 'Counted over the week. What is watched is a change in her baby’s own pattern, which is why no daily target is shown.',
  },
  {
    icon: Moon, tint: '#7c6cf0',
    title: 'Sleep',
    body: 'Hours a night, because sleep debt raises blood pressure and appetite, and is the first thing to go unrecorded.',
  },
  {
    icon: Droplets, tint: C.aqua,
    title: 'Hydration',
    body: 'Intake against the daily goal. Low fluid shows up as cramps and fatigue long before anyone connects the two.',
  },
  {
    icon: Smile, tint: C.amber,
    title: 'Mood',
    body: 'Logged over the last fortnight — the same window a clinician asks about when screening for antenatal depression.',
  },
  {
    icon: Ruler, tint: C.mint,
    title: 'Child growth',
    body: 'Weight and height against the WHO curves for the child’s age and sex. When the sex is unknown the app declines to state a centile rather than guessing one.',
  },
];

/* ---------------------------------------------------- the five factors */

const FACTORS: { label: string; detail: string }[] = [
  { label: 'Blood pressure', detail: 'Both numbers, against the thresholds a clinician uses' },
  { label: 'Blood glucose', detail: 'Fasting readings and the screening window' },
  { label: 'Age', detail: 'Which brings its own baseline risk at both ends' },
  { label: 'Body temperature', detail: 'Because infection changes the picture quickly' },
  { label: 'Heart rate', detail: 'Read alongside the rest, never on its own' },
];

const AUDIENCE: { icon: LucideIcon; title: string; body: string; tint: string }[] = [
  {
    icon: Eye, tint: C.brand,
    title: 'She sees the whole of it',
    body: 'Every chart, every reading she has entered, and the plain-language reason behind her current risk tier. Nothing about her is hidden from her.',
  },
  {
    icon: Stethoscope, tint: C.mint,
    title: 'Her clinician sees the trend',
    body: 'The caseload screen shows each patient’s blood-pressure trend and risk tier, so the person who needs reviewing first is visible before anyone opens a file.',
  },
  {
    icon: ShieldCheck, tint: C.amber,
    title: 'Nobody else sees the detail',
    body: 'A guardian is told she needs help and where she is. They are not shown her readings. Access follows the role, not the account.',
  },
];

/* ------------------------------------------------------------ diagrams */

/**
 * The argument for the whole feature, drawn.
 *
 * Left: three readings as they arrive — each one unremarkable on its own.
 * Right: the same three in order, where the slope is the finding. No clinical
 * judgement is claimed here; the point is only that the second picture holds
 * information the first cannot.
 */
function TrendDiagram() {
  const readings = [
    { visit: 'Visit 1', sys: 118, dia: 76 },
    { visit: 'Visit 2', sys: 128, dia: 82 },
    { visit: 'Visit 3', sys: 141, dia: 91 },
  ];

  // chart geometry
  const W = 320; const H = 150;
  const padL = 34; const padR = 12; const padT = 14; const padB = 26;
  const lo = 105; const hi = 150;
  const x = (i: number) => padL + (i * (W - padL - padR)) / (readings.length - 1);
  const y = (v: number) => padT + ((hi - v) / (hi - lo)) * (H - padT - padB);
  const line = readings.map((r, i) => `${i ? 'L' : 'M'} ${x(i).toFixed(1)} ${y(r.sys).toFixed(1)}`).join(' ');

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {/* --------------------------------------------- readings in isolation */}
      <GlassCard className="p-6">
        <div className="flex items-center gap-2">
          <span className="grid h-8 w-8 place-items-center rounded-xl bg-ink/5 text-ink-faint">
            <span className="text-[15px] font-bold">?</span>
          </span>
          <div className="text-[13px] font-bold uppercase tracking-wider text-ink-faint">
            Read one visit at a time
          </div>
        </div>

        <div className="mt-5 space-y-2.5">
          {readings.map((r) => (
            <div key={r.visit} className="flex items-center gap-3 rounded-2xl border border-white/60 bg-white/60 px-4 py-3">
              <span className="w-14 flex-none text-[11px] font-bold uppercase tracking-wide text-ink-faint">
                {r.visit}
              </span>
              <span className="text-lg font-extrabold tracking-tight text-ink">
                {r.sys}/{r.dia}
              </span>
              <span className="ml-auto rounded-full bg-emerald-500/12 px-2.5 py-1 text-[10.5px] font-bold uppercase tracking-wide text-emerald-700">
                Fine today
              </span>
            </div>
          ))}
        </div>

        <p className="mt-5 text-[13px] leading-relaxed text-ink-muted">
          Each of these was recorded weeks apart, on a different page, and read on its own.
          Nothing here asks to be acted on.
        </p>
      </GlassCard>

      {/* ------------------------------------------------ the same, in order */}
      <GlassCard strong glow className="p-6">
        <div className="flex items-center gap-2">
          <span className="grid h-8 w-8 place-items-center rounded-xl bg-brand-500/15 text-brand-600">
            <TrendingUp className="h-4 w-4" strokeWidth={2.4} />
          </span>
          <div className="text-[13px] font-bold uppercase tracking-wider text-brand-700">
            Read in order
          </div>
        </div>

        <svg viewBox={`0 0 ${W} ${H}`} className="mt-4 w-full overflow-visible" role="img"
          aria-label="The same three blood-pressure readings plotted in sequence, rising out of the usual range by the third visit">
          <defs>
            <linearGradient id="trendFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={C.brand} stopOpacity="0.22" />
              <stop offset="100%" stopColor={C.brand} stopOpacity="0" />
            </linearGradient>
          </defs>

          {/* the band a clinician reads against */}
          <rect x={padL} y={y(140)} width={W - padL - padR} height={y(lo) - y(140)}
            fill={C.mint} opacity="0.09" rx="4" />
          <text x={padL + 4} y={y(140) - 5} fontSize="8.5" fontWeight="700" fill="#2fbf9b" opacity="0.9">
            usual range
          </text>

          {/* axis ticks */}
          {[110, 125, 140].map((v) => (
            <g key={v}>
              <line x1={padL} x2={W - padR} y1={y(v)} y2={y(v)} stroke="#9aa3ba" strokeOpacity="0.16" strokeDasharray="3 4" />
              <text x={padL - 7} y={y(v) + 3} fontSize="8.5" fontWeight="700" fill="#9aa3ba" textAnchor="end">{v}</text>
            </g>
          ))}

          <path d={`${line} L ${x(2)} ${H - padB} L ${x(0)} ${H - padB} Z`} fill="url(#trendFill)" />
          <motion.path
            d={line}
            fill="none"
            stroke={C.brand}
            strokeWidth="2.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            initial={{ pathLength: 0 }}
            whileInView={{ pathLength: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 1.3, ease: [0.22, 1, 0.36, 1] }}
          />

          {readings.map((r, i) => {
            const over = r.sys > 140;
            return (
              <g key={r.visit}>
                <circle cx={x(i)} cy={y(r.sys)} r={over ? 6.5 : 4.5}
                  fill="#fff" stroke={over ? C.rose : C.brand} strokeWidth="2.6" />
                {over && <circle cx={x(i)} cy={y(r.sys)} r="11" fill="none" stroke={C.rose} strokeWidth="1.4" opacity="0.35" />}
                <text x={x(i)} y={H - padB + 13} fontSize="8.5" fontWeight="700" fill="#9aa3ba" textAnchor="middle">
                  {r.visit.replace('Visit ', 'V')}
                </text>
              </g>
            );
          })}
        </svg>

        <p className="mt-2 text-[13px] leading-relaxed text-ink-soft">
          The same three numbers. Nothing new was measured — only the order was kept, and the
          third reading now has the two before it to be read against.
        </p>
      </GlassCard>
    </div>
  );
}

/** How a risk tier is arrived at: five scored factors, summed, banded. */
function ScoringDiagram() {
  const bands = [
    { label: 'Low', tint: C.mint, width: '33%' },
    { label: 'Medium', tint: C.amber, width: '34%' },
    { label: 'High', tint: C.rose, width: '33%' },
  ];
  return (
    <GlassCard strong className="p-7 sm:p-9">
      <div className="grid gap-8 lg:grid-cols-[1.1fr_auto_1fr] lg:items-center">
        {/* the inputs */}
        <div>
          <div className="text-[11px] font-bold uppercase tracking-wider text-ink-faint">
            Five factors, each scored
          </div>
          <ul className="mt-3.5 space-y-2">
            {FACTORS.map((f, i) => (
              <motion.li
                key={f.label}
                initial={{ opacity: 0, x: -12 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.07, duration: 0.4 }}
                className="rounded-2xl border border-white/60 bg-white/60 px-4 py-2.5"
              >
                <div className="text-[13.5px] font-bold text-ink">{f.label}</div>
                <div className="text-[11.5px] font-medium text-ink-muted">{f.detail}</div>
              </motion.li>
            ))}
          </ul>
        </div>

        {/* the arrow */}
        <div className="hidden place-items-center lg:grid">
          <div className="grid h-12 w-12 place-items-center rounded-2xl bg-brand-500/12 text-brand-600">
            <ArrowRight className="h-5 w-5" strokeWidth={2.4} />
          </div>
        </div>

        {/* the output */}
        <div>
          <div className="text-[11px] font-bold uppercase tracking-wider text-ink-faint">
            One score, three tiers
          </div>

          <div className="mt-4 flex h-3.5 overflow-hidden rounded-full">
            {bands.map((b) => (
              <div key={b.label} style={{ width: b.width, background: b.tint, opacity: 0.85 }} />
            ))}
          </div>
          <div className="mt-2 flex justify-between text-[11px] font-bold uppercase tracking-wide">
            {bands.map((b) => (
              <span key={b.label} style={{ color: b.tint }}>{b.label}</span>
            ))}
          </div>

          <div className="mt-5 rounded-2xl border border-white/60 bg-white/60 p-4">
            <div className="flex items-center gap-2 text-[13px] font-bold text-ink">
              <Brain className="h-4 w-4 text-brand-600" strokeWidth={2.2} />
              Never a number on its own
            </div>
            <p className="mt-1.5 text-[12.5px] leading-relaxed text-ink-soft">
              Every tier opens to show which readings produced it and how much each one
              contributed — so a clinician can disagree with the model in one glance,
              instead of having to trust it.
            </p>
          </div>
        </div>
      </div>
    </GlassCard>
  );
}

/* --------------------------------------------------------------- page */

export function Trends() {
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
                <Badge icon={<LineChart className="h-3.5 w-3.5" />}>Health trends</Badge>
              </Reveal>
              <Reveal delay={0.05}>
                <h1 className="mt-5 text-balance text-4xl font-extrabold leading-[1.06] tracking-tight text-ink sm:text-5xl lg:text-[3.4rem]">
                  One reading is a number.{' '}
                  <span className="font-serif italic font-medium text-brand-600">Six is a warning.</span>
                </h1>
              </Reveal>
              <Reveal delay={0.1}>
                <p className="mx-auto mt-5 max-w-2xl text-lg leading-relaxed text-ink-soft">
                  A blood pressure of 141 over 91 means one thing on its own and something
                  else entirely after two lower readings. MaternalCare+ keeps every reading
                  in order, so the shape of a pregnancy is visible while there is still time
                  to act on it.
                </p>
              </Reveal>
              <Reveal delay={0.15}>
                <div className="mt-8 flex flex-wrap justify-center gap-3">
                  <LiquidButton size="lg" onClick={() => navigate('/register')} iconRight={<ArrowRight className="h-[18px] w-[18px]" />}>
                    Start tracking free
                  </LiquidButton>
                  <LiquidButton size="lg" variant="glass" onClick={() => navigate('/reminders')}>
                    See reminders
                  </LiquidButton>
                </div>
              </Reveal>
            </div>

            <Reveal delay={0.1} className="mt-14">
              <TrendDiagram />
            </Reveal>
          </div>
        </section>

        {/* what is tracked */}
        <section className="px-4 py-16 sm:py-20">
          <div className="mx-auto max-w-6xl">
            <SectionHeading
              eyebrow="What gets plotted"
              icon={<Activity className="h-3.5 w-3.5" />}
              title={<>Eight charts, and not one<br className="hidden sm:block" /> of them decorative</>}
              description="Each one exists because a clinician asks about it. Where nothing has been logged, the chart says so rather than drawing a line through invented points."
            />
            <motion.div
              variants={staggerContainer(0.07)}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: '-80px' }}
              className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-4"
            >
              {CHARTS.map((c) => (
                <motion.div key={c.title} variants={revealVariants}>
                  <GlassCard float className="h-full p-6">
                    <span className="grid h-11 w-11 place-items-center rounded-2xl"
                      style={{ background: `${c.tint}1f`, color: c.tint }}>
                      <c.icon className="h-5 w-5" strokeWidth={2} />
                    </span>
                    <h3 className="mt-4 text-[17px] font-bold tracking-tight text-ink">{c.title}</h3>
                    <p className="mt-2 text-[14px] leading-relaxed text-ink-soft">{c.body}</p>
                  </GlassCard>
                </motion.div>
              ))}
            </motion.div>
          </div>
        </section>

        {/* the risk tier */}
        <section className="px-4 py-16 sm:py-20">
          <div className="mx-auto max-w-6xl">
            <SectionHeading
              eyebrow="How the risk tier is worked out"
              icon={<ShieldCheck className="h-3.5 w-3.5" />}
              title={<>A score you can argue with</>}
              description="The tier is not a verdict handed down by a model. It is five readings, scored against thresholds a clinician would recognise, and shown with its working."
            />
            <Reveal className="mt-14">
              <ScoringDiagram />
            </Reveal>
          </div>
        </section>

        {/* who sees what */}
        <section className="px-4 py-16 sm:py-20">
          <div className="mx-auto max-w-6xl">
            <SectionHeading
              eyebrow="Who sees it"
              icon={<Eye className="h-3.5 w-3.5" />}
              title={<>Three people, three<br className="hidden sm:block" /> different views</>}
              description="Her trends are hers. What reaches anyone else is only what that person needs in order to help."
            />
            <motion.div
              variants={staggerContainer(0.08)}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: '-80px' }}
              className="mt-14 grid gap-5 md:grid-cols-3"
            >
              {AUDIENCE.map((a) => (
                <motion.div key={a.title} variants={revealVariants}>
                  <GlassCard float className="h-full p-7">
                    <span className="grid h-12 w-12 place-items-center rounded-2xl"
                      style={{ background: `${a.tint}1f`, color: a.tint }}>
                      <a.icon className="h-[22px] w-[22px]" strokeWidth={2} />
                    </span>
                    <h3 className="mt-5 text-lg font-bold tracking-tight text-ink">{a.title}</h3>
                    <p className="mt-2.5 text-[15px] leading-relaxed text-ink-soft">{a.body}</p>
                  </GlassCard>
                </motion.div>
              ))}
            </motion.div>
          </div>
        </section>

        {/* closing */}
        <section className="px-4 py-20 text-center sm:py-24">
          <Reveal>
            <p className="mx-auto max-w-3xl text-balance font-serif text-3xl italic leading-snug text-ink sm:text-4xl">
              The reading that matters is rarely the alarming one.{' '}
              <span className="text-gradient not-italic">It is the third one in a row.</span>
            </p>
          </Reveal>
          <Reveal delay={0.1}>
            <div className="mt-9 flex flex-wrap justify-center gap-3">
              <LiquidButton size="lg" onClick={() => navigate('/register')} iconRight={<ArrowRight className="h-[18px] w-[18px]" />}>
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
