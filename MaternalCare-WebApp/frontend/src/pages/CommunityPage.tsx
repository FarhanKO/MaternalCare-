import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  Ban,
  Flag,
  Heart,
  MessageCircle,
  MessagesSquare,
  Moon,
  ShieldCheck,
  Stethoscope,
  Sun,
  UserRound,
  Users,
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
 * The public page for the Community feature.
 *
 * The rules quoted here are the five the composer shows verbatim, and the
 * moderation path described is the one the report endpoint actually follows.
 * A forum attached to a medical record needs to be honest about what it is
 * not, so that limit is stated on the page rather than buried in terms.
 */

const ROSE = '#f2789f';
const BRAND = '#3f66f0';
const MINT = '#2fbf9b';
const AMBER = '#f6b93b';

/** The five rules shown while composing a post — quoted, not paraphrased. */
const RULES = [
  'Be respectful — everyone here is going through something.',
  'Share your experience, not a prescription.',
  'Never tell someone to start or stop medication.',
  'Urgent symptoms belong with your care team, not the forum.',
  'Keep other people’s details private.',
];

const TOPICS: { icon: LucideIcon; label: string; blurb: string; tint: string }[] = [
  { icon: Moon, label: 'Sleep', blurb: 'The 3 a.m. questions nobody is awake to answer', tint: '#7c6cf0' },
  { icon: Heart, label: 'Feeding', blurb: 'What worked, what hurt, and what nobody warned you about', tint: ROSE },
  { icon: Sun, label: 'Recovery', blurb: 'The weeks after birth, which get the least attention', tint: AMBER },
  { icon: Users, label: 'First year', blurb: 'Milestones, teething, and whether this is normal', tint: MINT },
];

const SAFEGUARDS: { icon: LucideIcon; title: string; body: string; tint: string }[] = [
  {
    icon: UserRound, tint: BRAND,
    title: 'A first name and an initial',
    body: 'Posts carry a display name and, where she chooses, how many weeks along she is. Her readings, her documents and her risk tier never leave her own account.',
  },
  {
    icon: Flag, tint: AMBER,
    title: 'Anyone can report a post',
    body: 'One tap on a post or a comment, with a reason. The button then says she has already reported it, so she is not left wondering whether it went anywhere.',
  },
  {
    icon: Stethoscope, tint: MINT,
    title: 'A clinician reviews it',
    body: 'Reports land in a moderation queue inside the clinician portal — reviewed by someone medically qualified, not by whoever is on shift.',
  },
];

/* ------------------------------------------------------------ diagrams */

/** What the board actually looks like, drawn small. */
function BoardDiagram() {
  const posts = [
    {
      author: 'Nusrat J.', meta: 'Mother · week 27', topic: 'Sleep',
      body: 'Three nights of waking at 3 a.m. and not getting back down. Did anything help, or is this just the trimester?',
      hearts: 12, replies: 5, tint: '#7c6cf0',
    },
    {
      author: 'Dr. Lena Ortiz', meta: 'Obstetrician', topic: 'Recovery', clinician: true,
      body: 'Worth saying plainly: side-sleeping from the third trimester is the advice, and waking on your back is not a failure. Just settle back onto your side.',
      hearts: 41, replies: 9, tint: MINT,
    },
  ] as const;

  return (
    <div className="space-y-3">
      {posts.map((p, i) => (
        <motion.div
          key={p.author}
          initial={{ opacity: 0, y: 14 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: i * 0.12, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        >
          <GlassCard strong={i === 1} className="p-5">
            <div className="flex items-center gap-3">
              <span className="grid h-10 w-10 flex-none place-items-center rounded-2xl text-[13px] font-extrabold text-white"
                style={{ background: `linear-gradient(135deg, ${p.tint}, ${p.tint}bb)` }}>
                {p.author.split(' ').map((w) => w[0]).join('').slice(0, 2)}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-[13.5px] font-extrabold text-ink">{p.author}</span>
                  {'clinician' in p && p.clinician && (
                    <span className="rounded-full bg-emerald-500/15 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-emerald-700">
                      Clinician
                    </span>
                  )}
                </div>
                <div className="text-[11px] font-semibold text-ink-faint">{p.meta}</div>
              </div>
              <span className="flex-none rounded-full border border-white/60 bg-white/60 px-2.5 py-1 text-[10.5px] font-bold text-ink-soft">
                {p.topic}
              </span>
            </div>

            <p className="mt-3 text-[14px] leading-relaxed text-ink-soft">{p.body}</p>

            <div className="mt-3.5 flex items-center gap-4 border-t border-white/60 pt-3">
              <span className="flex items-center gap-1.5 text-[11.5px] font-bold text-ink-faint">
                <Heart className="h-3.5 w-3.5" style={{ color: ROSE }} strokeWidth={2.3} />
                {p.hearts}
              </span>
              <span className="flex items-center gap-1.5 text-[11.5px] font-bold text-ink-faint">
                <MessageCircle className="h-3.5 w-3.5" strokeWidth={2.3} />
                {p.replies} replies
              </span>
              <span className="ml-auto flex items-center gap-1.5 text-[11.5px] font-semibold text-ink-faint">
                <Flag className="h-3.5 w-3.5" strokeWidth={2.2} />
                Report
              </span>
            </div>
          </GlassCard>
        </motion.div>
      ))}
    </div>
  );
}

/**
 * What happens to a post that should not be there.
 *
 * Four steps, drawn as a path, because "it is moderated" is the sort of claim
 * that means nothing until you can see who does the moderating.
 */
function ModerationDiagram() {
  const steps = [
    { icon: MessagesSquare, label: 'A post goes up', body: 'Visible to other mothers on the board', tint: BRAND },
    { icon: Flag, label: 'Someone reports it', body: 'One tap, with a reason attached', tint: AMBER },
    { icon: Stethoscope, label: 'A clinician reviews', body: 'It enters the moderation queue in the doctor portal', tint: MINT },
    { icon: ShieldCheck, label: 'It is acted on', body: 'Kept, or taken down — by someone qualified to judge', tint: ROSE },
  ];

  return (
    <GlassCard strong className="p-7 sm:p-9">
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {steps.map((s, i) => (
          <motion.div
            key={s.label}
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: i * 0.11, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
            className="relative"
          >
            {/* the connecting run, on wide screens only */}
            {i < steps.length - 1 && (
              <span aria-hidden className="absolute -right-3 top-6 hidden h-px w-6 bg-gradient-to-r from-ink/15 to-transparent lg:block" />
            )}
            <span className="grid h-12 w-12 place-items-center rounded-2xl"
              style={{ background: `${s.tint}1f`, color: s.tint }}>
              <s.icon className="h-[22px] w-[22px]" strokeWidth={2} />
            </span>
            <div className="mt-4 flex items-baseline gap-2">
              <span className="text-[11px] font-bold tabular-nums text-ink-faint">0{i + 1}</span>
              <h3 className="text-[15px] font-bold tracking-tight text-ink">{s.label}</h3>
            </div>
            <p className="mt-1.5 text-[13.5px] leading-relaxed text-ink-soft">{s.body}</p>
          </motion.div>
        ))}
      </div>
    </GlassCard>
  );
}

/* --------------------------------------------------------------- page */

export function CommunityPage() {
  const navigate = useNavigate();

  return (
    <>
      <Navbar />
      <main>
        {/* hero */}
        <section className="px-4 pt-24 sm:pt-28">
          <div className="mx-auto max-w-6xl">
            <div className="grid items-center gap-10 lg:grid-cols-[1.05fr_1fr]">
              <div>
                <Reveal>
                  <Badge icon={<MessagesSquare className="h-3.5 w-3.5" />}>Community</Badge>
                </Reveal>
                <Reveal delay={0.05}>
                  <h1 className="mt-5 text-balance text-4xl font-extrabold leading-[1.06] tracking-tight text-ink sm:text-5xl lg:text-[3.4rem]">
                    Answers from people{' '}
                    <span className="font-serif italic font-medium" style={{ color: ROSE }}>
                      three weeks ahead of you
                    </span>
                  </h1>
                </Reveal>
                <Reveal delay={0.1}>
                  <p className="mt-5 max-w-xl text-lg leading-relaxed text-ink-soft">
                    Some questions are not for a doctor. They are for someone who was awake at
                    the same hour last month and came out the other side. MaternalCare+ puts
                    that conversation next to the record — with clinicians in the room, and
                    clear limits on what belongs here.
                  </p>
                </Reveal>
                <Reveal delay={0.15}>
                  <div className="mt-8 flex flex-wrap gap-3">
                    <LiquidButton size="lg" onClick={() => navigate('/register')} iconRight={<ArrowRight className="h-[18px] w-[18px]" />}>
                      Join the community
                    </LiquidButton>
                    <LiquidButton size="lg" variant="glass" onClick={() => navigate('/trends')}>
                      See health trends
                    </LiquidButton>
                  </div>
                </Reveal>
              </div>

              <Reveal delay={0.1}>
                <BoardDiagram />
              </Reveal>
            </div>
          </div>
        </section>

        {/* what it is not — stated early, deliberately */}
        <section className="px-4 pt-16 sm:pt-20">
          <div className="mx-auto max-w-6xl">
            <Reveal>
              <GlassCard strong className="overflow-hidden p-0">
                <div className="grid gap-0 md:grid-cols-[auto_1fr]">
                  <div className="flex items-center gap-3 bg-rose-500/[0.07] px-7 py-6 md:flex-col md:items-start md:justify-center md:px-8">
                    <span className="grid h-12 w-12 place-items-center rounded-2xl bg-rose-500/15 text-rose-600">
                      <Ban className="h-[22px] w-[22px]" strokeWidth={2.1} />
                    </span>
                    <div className="text-[13px] font-extrabold uppercase tracking-wider text-rose-700 md:mt-3">
                      What this is not
                    </div>
                  </div>
                  <div className="px-7 py-6 sm:px-8">
                    <p className="text-[15.5px] leading-relaxed text-ink-soft">
                      This board is not a substitute for a clinician, and it is not a place to
                      be diagnosed. Nobody here can see your readings, and nobody here should be
                      telling you to start or stop a medicine. If something is urgent, the app
                      puts your care team and the emergency button one tap away — use those, not
                      this.
                    </p>
                    <p className="mt-3 text-[13.5px] font-semibold text-ink-muted">
                      The forum is for company and experience. The record is for care. Keeping
                      those apart is the point.
                    </p>
                  </div>
                </div>
              </GlassCard>
            </Reveal>
          </div>
        </section>

        {/* topics */}
        <section className="px-4 py-16 sm:py-20">
          <div className="mx-auto max-w-6xl">
            <SectionHeading
              eyebrow="What people talk about"
              icon={<MessagesSquare className="h-3.5 w-3.5" />}
              title={<>The questions that arrive<br className="hidden sm:block" /> between appointments</>}
              description="Threads are grouped by the stage they belong to, so a first-time mother in week 27 is not scrolling through toddler feeding to find someone in the same fortnight."
            />
            <motion.div
              variants={staggerContainer(0.08)}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: '-80px' }}
              className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-4"
            >
              {TOPICS.map((t) => (
                <motion.div key={t.label} variants={revealVariants}>
                  <GlassCard float className="h-full p-6">
                    <span className="grid h-11 w-11 place-items-center rounded-2xl"
                      style={{ background: `${t.tint}1f`, color: t.tint }}>
                      <t.icon className="h-5 w-5" strokeWidth={2} />
                    </span>
                    <h3 className="mt-4 text-[17px] font-bold tracking-tight text-ink">{t.label}</h3>
                    <p className="mt-2 text-[14px] leading-relaxed text-ink-soft">{t.blurb}</p>
                  </GlassCard>
                </motion.div>
              ))}
            </motion.div>
          </div>
        </section>

        {/* the rules */}
        <section className="px-4 py-16 sm:py-20">
          <div className="mx-auto max-w-6xl">
            <div className="grid items-center gap-10 lg:grid-cols-[1fr_1.1fr]">
              <div>
                <Reveal>
                  <Badge icon={<ShieldCheck className="h-3.5 w-3.5" />}>House rules</Badge>
                </Reveal>
                <Reveal delay={0.05}>
                  <h2 className="mt-5 text-4xl font-bold tracking-tight text-ink sm:text-[2.75rem]">
                    Shown while you write, not buried in terms
                  </h2>
                </Reveal>
                <Reveal delay={0.1}>
                  <p className="mt-4 text-lg leading-relaxed text-ink-soft">
                    These five sit beside the composer every time someone starts a post. Rules
                    nobody reads are decoration; rules in front of you while you type are the
                    only kind that change what gets written.
                  </p>
                </Reveal>
              </div>

              <Reveal delay={0.1}>
                <GlassCard strong className="p-7 sm:p-8">
                  <ul className="space-y-3">
                    {RULES.map((r, i) => (
                      <motion.li
                        key={r}
                        initial={{ opacity: 0, x: 14 }}
                        whileInView={{ opacity: 1, x: 0 }}
                        viewport={{ once: true }}
                        transition={{ delay: i * 0.08, duration: 0.45 }}
                        className="flex gap-3.5 rounded-2xl border border-white/60 bg-white/60 px-4 py-3"
                      >
                        <span className="grid h-6 w-6 flex-none place-items-center rounded-lg bg-brand-500/12 text-[11px] font-extrabold text-brand-700">
                          {i + 1}
                        </span>
                        <span className="text-[14.5px] leading-relaxed text-ink-soft">{r}</span>
                      </motion.li>
                    ))}
                  </ul>
                </GlassCard>
              </Reveal>
            </div>
          </div>
        </section>

        {/* moderation */}
        <section className="px-4 py-16 sm:py-20">
          <div className="mx-auto max-w-6xl">
            <SectionHeading
              eyebrow="When something goes wrong"
              icon={<Flag className="h-3.5 w-3.5" />}
              title={<>Reported by a mother,<br className="hidden sm:block" /> reviewed by a clinician</>}
              description="A health forum moderated by nobody in particular becomes dangerous quickly. Here, reports go to the people qualified to judge what was said."
            />
            <Reveal className="mt-14">
              <ModerationDiagram />
            </Reveal>
          </div>
        </section>

        {/* privacy */}
        <section className="px-4 pb-4">
          <div className="mx-auto max-w-6xl">
            <motion.div
              variants={staggerContainer(0.08)}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: '-80px' }}
              className="grid gap-5 md:grid-cols-3"
            >
              {SAFEGUARDS.map((s) => (
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

        {/* closing */}
        <section className="px-4 py-20 text-center sm:py-24">
          <Reveal>
            <p className="mx-auto max-w-3xl text-balance font-serif text-3xl italic leading-snug text-ink sm:text-4xl">
              No mother should have to work it out alone at 3 a.m.{' '}
              <span className="text-gradient not-italic">Somebody else is awake too.</span>
            </p>
          </Reveal>
          <Reveal delay={0.1}>
            <div className="mt-9 flex flex-wrap justify-center gap-3">
              <LiquidButton size="lg" onClick={() => navigate('/register')} iconRight={<ArrowRight className="h-[18px] w-[18px]" />}>
                Create an account
              </LiquidButton>
              <LiquidButton size="lg" variant="glass" onClick={() => navigate('/reminders')}>
                See reminders
              </LiquidButton>
            </div>
          </Reveal>
        </section>
      </main>
      <Footer />
    </>
  );
}
