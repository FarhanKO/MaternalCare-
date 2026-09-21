import type { LifeStage } from '@/data/reading';

/**
 * The small messages the home-screen widget rotates through.
 *
 * One sentence each, warm without being saccharine, and never advice she
 * would need a clinician to confirm — the kind of thing a good friend who
 * happened to be a midwife might text. Each carries when it fits: a time of
 * day, a stage, a span of weeks. `pick` narrows the list to her; the widget
 * itself chooses the one to show (lib/widget.ts explains the split).
 *
 * The icon names are resolved on the native side (res/drawable) — the
 * widget cannot draw Lucide from a font, so the handful it needs are
 * shipped as vector drawables under the same names.
 */
export type MessageIcon =
  | 'droplet' | 'heart' | 'moon' | 'sun' | 'leaf' | 'sparkles' | 'footprints' | 'wind' | 'smile' | 'ear';

export type TimeOfDay = 'morning' | 'afternoon' | 'evening' | 'night' | 'any';

export interface SweetMessage {
  text: string;
  icon: MessageIcon;
  when: TimeOfDay;
  /** omitted: every stage */
  stages?: LifeStage[];
  /** gestational weeks this holds for, inclusive; pregnant only */
  weeks?: [number, number];
}

export const SWEET_MESSAGES: SweetMessage[] = [
  /* ---------------------------------------------------- any time, any stage */
  { text: 'Don’t forget to drink water — a glass now is an easy win.', icon: 'droplet', when: 'any' },
  { text: 'Small sips through the day beat one big glass at night.', icon: 'droplet', when: 'afternoon' },
  { text: 'Rest is not falling behind. Rest is part of the work.', icon: 'moon', when: 'any' },
  { text: 'Unclench your jaw, drop your shoulders, breathe out slowly.', icon: 'wind', when: 'any' },
  { text: 'A short walk counts. Ten minutes is a real thing.', icon: 'footprints', when: 'afternoon' },
  { text: 'Something with iron and something with vitamin C — they work better together.', icon: 'leaf', when: 'any' },
  { text: 'You do not have to feel grateful every minute. Tired is allowed.', icon: 'heart', when: 'any' },
  { text: 'Whatever today was, you got through it. That is enough.', icon: 'heart', when: 'evening' },
  { text: 'Stand up, stretch, and roll your ankles a few times.', icon: 'sparkles', when: 'afternoon' },
  { text: 'Text someone who makes you laugh.', icon: 'smile', when: 'any' },
  { text: 'A snack with protein will carry you further than a sweet one.', icon: 'leaf', when: 'afternoon' },
  { text: 'Fresh air, even from a window, resets more than you would think.', icon: 'wind', when: 'any' },

  /* ------------------------------------------------------------- mornings */
  { text: 'Good morning. Water first, then everything else.', icon: 'sun', when: 'morning' },
  { text: 'Breakfast with some protein keeps the mid-morning dip away.', icon: 'sun', when: 'morning' },
  { text: 'Before the day starts: what is one kind thing you can do for yourself today?', icon: 'sparkles', when: 'morning' },

  /* ------------------------------------------------------------- evenings */
  { text: 'Screens off a little earlier tonight — your sleep will thank you.', icon: 'moon', when: 'evening' },
  { text: 'A warm shower and a slow breath before bed. You have earned a quiet evening.', icon: 'moon', when: 'evening' },
  { text: 'Lay out tomorrow’s vitamins tonight so the morning is one decision lighter.', icon: 'leaf', when: 'evening' },
  { text: 'Still awake? Dim the lights and let your body catch up.', icon: 'moon', when: 'night' },

  /* --------------------------------------------------------------- pregnant */
  { text: 'Nausea often eases around week 14 — you are closer than it feels.', icon: 'heart', when: 'any', stages: ['pregnant'], weeks: [5, 13] },
  { text: 'Dry crackers before you sit up can take the edge off the morning.', icon: 'sun', when: 'morning', stages: ['pregnant'], weeks: [5, 14] },
  { text: 'Folic acid every day still matters right now.', icon: 'leaf', when: 'morning', stages: ['pregnant'], weeks: [0, 12] },
  { text: 'Your baby can hear your voice now. Talking counts as bonding.', icon: 'ear', when: 'any', stages: ['pregnant'], weeks: [18, 42] },
  { text: 'Get to know your baby’s pattern of movement — it is the pattern that matters, not a count.', icon: 'heart', when: 'any', stages: ['pregnant'], weeks: [24, 42] },
  { text: 'From 28 weeks, settling to sleep on your side is the safer habit.', icon: 'moon', when: 'evening', stages: ['pregnant'], weeks: [27, 42] },
  { text: 'Heartburn tonight? A smaller supper, eaten earlier, usually helps.', icon: 'moon', when: 'evening', stages: ['pregnant'], weeks: [20, 42] },
  { text: 'Swollen ankles love a few minutes with your feet up.', icon: 'footprints', when: 'evening', stages: ['pregnant'], weeks: [24, 42] },
  { text: 'Pack a little of your hospital bag today — a few things at a time is fine.', icon: 'sparkles', when: 'afternoon', stages: ['pregnant'], weeks: [32, 38] },
  { text: 'Nearly there. Rest when you can; you will not regret it.', icon: 'heart', when: 'any', stages: ['pregnant'], weeks: [36, 42] },
  { text: 'A headache that will not shift, or blurred vision, is a call — not a wait.', icon: 'heart', when: 'any', stages: ['pregnant'], weeks: [20, 42] },

  /* ------------------------------------------------------------- new mother */
  { text: 'Feed the baby, feed yourself. Both are the job.', icon: 'leaf', when: 'any', stages: ['new-mother'] },
  { text: 'Sleep when the baby sleeps is easier said than done — but even lying down helps.', icon: 'moon', when: 'afternoon', stages: ['new-mother'] },
  { text: 'A big glass of water every time you feed.', icon: 'droplet', when: 'any', stages: ['new-mother'] },
  { text: 'Low mood past two weeks is worth a conversation, not a brave face.', icon: 'heart', when: 'any', stages: ['new-mother'] },
  { text: 'Nobody has this figured out at three in the morning. You are doing fine.', icon: 'moon', when: 'night', stages: ['new-mother'] },

  /* ----------------------------------------------------------------- parent */
  { text: 'Five minutes on the floor at their level is the best toy there is.', icon: 'smile', when: 'afternoon', stages: ['parent'] },
  { text: 'Growth is a direction, not a single reading.', icon: 'sparkles', when: 'any', stages: ['parent'] },
  { text: 'A boring dinner they will eat beats an exciting one they will not.', icon: 'leaf', when: 'evening', stages: ['parent'] },
  { text: 'You are allowed to be bored by the same book for the fortieth time.', icon: 'smile', when: 'evening', stages: ['parent'] },

  /* --------------------------------------------------------------- planning */
  { text: 'Folic acid before conception is the one that matters most.', icon: 'leaf', when: 'morning', stages: ['planning'] },
  { text: 'Tracking your cycle is useful; worrying about it every day is not.', icon: 'heart', when: 'any', stages: ['planning'] },
  { text: 'Two of you, one plan. Talk about what you are both hoping for.', icon: 'smile', when: 'evening', stages: ['planning'] },
];

/**
 * The messages that fit her — her stage, and for a pregnancy the week she
 * is in. Time of day is left in, because the widget picks by the hour on
 * the phone when it draws, not by the hour the app last opened.
 */
export function pick(stage: LifeStage, week: number | null): SweetMessage[] {
  return SWEET_MESSAGES.filter((m) => {
    if (m.stages && !m.stages.includes(stage)) return false;
    if (m.weeks) {
      if (stage !== 'pregnant' || week === null) return false;
      if (week < m.weeks[0] || week > m.weeks[1]) return false;
    }
    return true;
  });
}
