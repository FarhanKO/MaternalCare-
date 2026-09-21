export type Intensity = 'mild' | 'mid' | 'high' | 'severe';

export const INTENSITIES: Intensity[] = ['mild', 'mid', 'high', 'severe'];
export const INTENSITY_LABEL: Record<Intensity, string> = {
  mild: 'Mild', mid: 'Mid', high: 'High', severe: 'Severe',
};
export const INTENSITY_WEIGHT: Record<Intensity, number> = {
  mild: 5, mid: 10, high: 17, severe: 25,
};

export interface Symptom {
  id: string;
  name: string;
  intensity: Intensity;
  /** consecutive days this symptom has been reported as still present */
  daysPresent: number;
  /** confirmed as still present during the current logging session */
  confirmedToday?: boolean;
  /** captured from the voice transcript */
  fromVoice?: boolean;
}

/** The four stages a mother can be at. 'general' falls back to pregnancy. */
export type CauseStage = 'planning' | 'pregnant' | 'new-mother' | 'parent';

export interface LexiconEntry {
  label: string;
  keywords: string[];
  urgent?: boolean;
  effect?: string;
  /**
   * Why this happens, when nothing more specific is known about her stage.
   * Written for pregnancy, because that is the stage the list started from.
   */
  causes: string[];
  /**
   * Why this happens *at her stage*.
   *
   * The relief steps below are shared deliberately — a warm compress, fluids
   * and rest help whoever is asking. Causes are not shareable in the same way.
   * A woman planning a pregnancy who logs nausea was being told it was
   * "pregnancy hormones (hCG and oestrogen)", which is not an explanation she
   * can do anything with and is not true of her.
   */
  causesByStage?: Partial<Record<CauseStage, string[]>>;
  relief: string[];
}

export const SYMPTOM_LEXICON: LexiconEntry[] = [
  {
    label: 'Back ache', keywords: ['back ache', 'backache', 'back pain', 'lower back', 'my back'],
    effect: 'Common as the uterus grows and posture shifts.',
    causes: ['Growing uterus shifting your centre of gravity', 'Relaxin loosening pelvic ligaments', 'Long periods standing or sitting', 'Weakened abdominal support'],
    causesByStage: {
      planning: ['Posture, lifting, or long periods sitting', 'Period cramping felt in the lower back', 'Weak core or back muscles', 'An old injury flaring up'],
      'new-mother': ['Carrying and feeding in awkward positions', 'Abdominal muscles still knitting back together', 'Relaxin keeps ligaments loose for months after birth', 'A tender epidural or caesarean site'],
      parent: ['Lifting and carrying a growing child', 'Hunching to feed, bathe or play', 'Core muscles that never fully recovered', 'Long periods on the floor or in low chairs'],
    },
    relief: ['Warm compress on the lower back for 15 minutes', 'Sleep on your side with a pillow between the knees', 'Short, frequent walks instead of long standing', 'Flat supportive shoes; avoid heels'],
  },
  {
    label: 'Nausea', keywords: ['nausea', 'nauseous', 'queasy', 'sick to my stomach', 'morning sickness'],
    effect: 'Can reduce appetite — watch hydration and small frequent meals.',
    causes: ['Pregnancy hormones (hCG and oestrogen)', 'Empty stomach or long gaps between meals', 'Strong smells', 'Low blood sugar'],
    causesByStage: {
      planning: ['A stomach bug or something you ate', 'Anxiety or stress', 'Low blood sugar after a long gap between meals', 'Some fertility medicines and supplements', 'Early pregnancy — worth a test if a period is late'],
      'new-mother': ['Exhaustion and meals skipped around the baby', 'Pain medication taken on an empty stomach', 'Dehydration, which comes fast while breastfeeding', 'A stomach bug'],
      parent: ['A stomach bug — young children bring them home', 'Skipped meals or not drinking enough', 'Anxiety or exhaustion', 'Something you ate'],
    },
    relief: ['Small, dry snacks every 2 hours (crackers, toast)', 'Ginger tea or a slice of fresh ginger', 'Sip fluids between meals rather than with them', 'Fresh air and avoid trigger smells'],
  },
  {
    label: 'Vomiting', keywords: ['vomit', 'vomiting', 'throwing up', 'threw up'],
    effect: 'Raises dehydration risk; replace fluids and electrolytes.',
    causes: ['Severe morning sickness', 'Food intolerance or infection', 'Reflux or an over-full stomach'],
    causesByStage: {
      planning: ['Gut infection', 'Food poisoning', 'Migraine', 'Early pregnancy — worth a test if a period is late'],
      'new-mother': ['Gut infection', 'Pain medication on an empty stomach', 'Severe dehydration or exhaustion'],
      parent: ['Gut infection passed on by a child', 'Food poisoning', 'Migraine'],
    },
    relief: ['Rehydrate with small sips every 10 minutes', 'Oral rehydration salts if repeated', 'Rest upright after eating'],
  },
  {
    label: 'Headache', keywords: ['headache', 'head ache', 'migraine', 'head hurts'],
    effect: 'Often dehydration or fatigue — persistent ones need review.',
    causes: ['Dehydration', 'Poor sleep or skipped meals', 'Caffeine change', 'Tension in neck and shoulders'],
    causesByStage: {
      planning: ['Dehydration', 'Poor sleep or skipped meals', 'A change in caffeine', 'The hormonal shift around your period', 'Tension in the neck and shoulders'],
      'new-mother': ['Broken sleep', 'Dehydration, especially while feeding', 'A change in caffeine', 'Rarely, a headache after a spinal or epidural — tell your midwife if it is worse sitting up'],
      parent: ['Dehydration', 'Broken sleep', 'Skipped meals', 'Tension from carrying and lifting'],
    },
    relief: ['Drink 500 ml of water now', 'Rest in a dark, quiet room', 'Cool compress on the forehead', 'Paracetamol is generally considered safe — confirm with your doctor'],
  },
  {
    label: 'Dizziness', keywords: ['dizzy', 'dizziness', 'light headed', 'lightheaded', 'faint'],
    effect: 'May signal low blood pressure, low iron or low fluids.',
    causes: ['Blood pressure drops as vessels relax', 'Standing up too quickly', 'Low iron (anaemia)', 'Low blood sugar or dehydration'],
    causesByStage: {
      planning: ['Low iron, which heavy periods make common', 'Standing up too quickly', 'Low blood sugar or dehydration', 'An inner-ear problem'],
      'new-mother': ['Blood loss at birth leaving iron low', 'Standing up too quickly', 'Not eating or drinking enough while feeding', 'Sheer exhaustion'],
      parent: ['Low iron (anaemia)', 'Standing up too quickly', 'Low blood sugar or dehydration'],
    },
    relief: ['Stand up slowly, sit if the room spins', 'Eat something small with iron and protein', 'Never stand still for long — keep moving gently'],
  },
  {
    label: 'Swelling', keywords: ['swelling', 'swollen', 'puffy', 'oedema', 'edema'],
    effect: 'Mild ankle swelling is normal; sudden face/hand swelling is not.',
    causes: ['Extra fluid volume in pregnancy', 'Pressure from the uterus slowing return flow', 'Heat or long standing', 'High salt intake'],
    causesByStage: {
      planning: ['Heat, or long periods standing', 'A lot of salt', 'Fluid retention before a period', 'Rarely, a circulation or thyroid problem'],
      'new-mother': ['Fluid given during labour, which takes a week or two to clear', 'Long stretches sitting while feeding', 'Heat', 'Sudden face or hand swelling still matters — pre-eclampsia can begin after birth'],
      parent: ['Heat or long periods standing', 'A lot of salt', 'Rarely, a circulation, kidney or thyroid problem'],
    },
    relief: ['Elevate feet above hip level for 20 minutes', 'Left-side lying improves circulation', 'Reduce added salt; keep drinking water', 'Compression stockings if standing a lot'],
  },
  {
    label: 'Heartburn', keywords: ['heartburn', 'acid reflux', 'reflux', 'indigestion'],
    effect: 'Very common in the second and third trimester.',
    causes: ['Progesterone relaxing the valve at the top of the stomach', 'Uterus pressing upward on the stomach', 'Large, spicy or fatty meals', 'Lying down soon after eating'],
    causesByStage: {
      planning: ['Large, spicy or fatty meals', 'Lying down soon after eating', 'Caffeine, alcohol or smoking', 'Reflux that has nothing to do with pregnancy'],
      'new-mother': ['Meals eaten fast and late, around the baby', 'Lying down soon after eating', 'Stress'],
      parent: ['Large, spicy or fatty meals', 'Eating late or lying down afterwards', 'Caffeine or stress'],
    },
    relief: ['Smaller meals, more often', 'Stay upright for 1 hour after eating', 'Raise the head of your bed slightly', 'Avoid spicy, fried and citrus foods late in the day'],
  },
  {
    label: 'Cramps', keywords: ['cramp', 'cramps', 'cramping'],
    effect: 'Often linked to dehydration or low magnesium.',
    causes: ['Dehydration', 'Low magnesium or calcium', 'Extra weight on leg muscles', 'Poor circulation at night'],
    causesByStage: {
      planning: ['Dehydration', 'Low magnesium or calcium', 'Exercise', 'Period cramps, if they are low in the abdomen'],
      'new-mother': ['Dehydration, which breastfeeding accelerates', 'Low magnesium or calcium', 'Afterpains as the uterus contracts back — these settle within a fortnight'],
      parent: ['Dehydration', 'Low magnesium or calcium', 'Standing or carrying for long stretches'],
    },
    relief: ['Flex the foot upward and massage the calf', 'Drink water — dehydration is the usual trigger', 'Gentle calf stretches before bed'],
  },
  {
    label: 'Fatigue', keywords: ['tired', 'fatigue', 'exhausted', 'no energy', 'worn out'],
    effect: 'Rest is protective — persistent fatigue may mean low iron.',
    causes: ['Energy going into building the placenta and baby', 'Low iron (anaemia)', 'Broken sleep', 'Dehydration'],
    causesByStage: {
      planning: ['Low iron, which heavy periods make common', 'Poor sleep', 'Thyroid problems', 'Stress — and trying to conceive is its own kind'],
      'new-mother': ['Broken sleep, which is the usual answer', 'Blood loss at birth leaving iron low', 'Feeding through the night', 'Low mood, which often shows as exhaustion first'],
      parent: ['Broken nights and early mornings', 'Low iron', 'Thyroid problems', 'Doing too much without a break'],
    },
    relief: ['Short 20-minute rests rather than long naps', 'Iron-rich foods with vitamin C to absorb them', 'Ask about an iron check if it persists'],
  },
  {
    label: 'Poor sleep', keywords: ['cant sleep', "can't sleep", 'insomnia', 'not sleeping', 'sleepless'],
    effect: 'Sleep debt raises stress hormones and blood pressure.',
    causes: ['Discomfort finding a position', 'Night-time bathroom trips', 'Anxiety or racing thoughts', 'Heartburn or leg cramps'],
    causesByStage: {
      planning: ['Anxiety or racing thoughts', 'Caffeine late in the day', 'Screens before bed', 'Temperature changes across your cycle'],
      'new-mother': ['A baby who wakes to feed — the usual cause', 'Staying alert for the baby even when they sleep', 'Anxiety', 'Discomfort while healing'],
      parent: ['A child who wakes in the night', 'Anxiety or racing thoughts', 'Caffeine late in the day'],
    },
    relief: ['Pillow between knees, left-side lying', 'Stop fluids 1 hour before bed (not earlier)', 'Wind-down routine without screens'],
  },
  {
    label: 'Constipation', keywords: ['constipation', 'constipated', 'cannot go', 'bowel'],
    effect: 'Improves with fluids and fibre.',
    causes: ['Progesterone slowing the gut', 'Iron supplements', 'Not enough fibre or fluid'],
    causesByStage: {
      planning: ['Not enough fibre or fluid', 'Iron supplements', 'Not moving much'],
      'new-mother': ['Dreading the first bowel movement after birth — very common', 'Iron supplements', 'Pain medication, codeine especially', 'Meals and water missed while busy'],
      parent: ['Not enough fibre or fluid', 'Iron supplements', 'Ignoring the urge while busy with a child'],
    },
    relief: ['More water — this matters most', 'Fibre: oats, pears, prunes, beans', 'Gentle daily walking'],
  },
  {
    label: 'Shortness of breath', keywords: ['short of breath', 'shortness of breath', 'breathless', 'cant breathe', "can't breathe", 'hard to breathe'], urgent: true,
    effect: 'Needs review — especially if sudden or at rest.',
    causes: ['Uterus pressing on the diaphragm', 'Increased oxygen demand', 'Anaemia', 'Rarely: clot or heart strain — which is why it is checked'],
    causesByStage: {
      planning: ['Anaemia', 'Asthma or a chest infection', 'Anxiety or panic', 'Rarely a clot or heart problem — which is why it is checked'],
      'new-mother': ['Anaemia after blood loss at birth', 'A clot — the risk is at its highest in the six weeks after birth, which is why this is urgent', 'Chest infection', 'Anxiety'],
      parent: ['Anaemia', 'Asthma or a chest infection', 'Anxiety', 'Rarely a clot or heart problem'],
    },
    relief: ['Sit upright and slow your breathing', 'Raise your arms overhead to open the chest', 'If sudden, at rest, or with chest pain — seek urgent care now'],
  },
  {
    label: 'Blurred vision', keywords: ['blurred vision', 'blurry vision', 'seeing spots', 'vision changes', 'flashing lights'], urgent: true,
    effect: 'A recognised pre-eclampsia warning sign.',
    causes: ['Raised blood pressure / pre-eclampsia', 'Fluid changes affecting the eye', 'Low blood sugar'],
    causesByStage: {
      planning: ['Migraine aura', 'Low blood sugar', 'An eye problem that needs testing', 'Raised blood pressure'],
      'new-mother': ['Raised blood pressure — pre-eclampsia can begin or worsen after birth', 'Migraine', 'Exhaustion', 'Low blood sugar'],
      parent: ['Migraine aura', 'Low blood sugar', 'Raised blood pressure', 'An eye problem that needs testing'],
    },
    relief: ['Have your blood pressure checked today', 'Do not drive while vision is affected', 'Contact your doctor or maternity unit now'],
  },
  {
    label: 'Severe headache', keywords: ['severe headache', 'worst headache', 'terrible headache', 'pounding headache'], urgent: true,
    effect: 'With swelling or vision changes, this needs urgent review.',
    causes: ['Raised blood pressure / pre-eclampsia', 'Severe dehydration', 'Migraine'],
    causesByStage: {
      planning: ['Migraine', 'Raised blood pressure', 'Severe dehydration'],
      'new-mother': ['Raised blood pressure — pre-eclampsia after birth is real and easily missed', 'A headache after a spinal or epidural, typically worse sitting up', 'Severe dehydration', 'Migraine'],
      parent: ['Migraine', 'Raised blood pressure', 'Severe dehydration'],
    },
    relief: ['Contact your maternity unit today for a blood pressure check', 'Rest in a dark room while you arrange it'],
  },
  {
    label: 'Bleeding', keywords: ['bleeding', 'blood', 'spotting'], urgent: true,
    effect: 'Any bleeding in pregnancy should be assessed promptly.',
    causes: ['Placental causes', 'Cervical irritation', 'Infection'],
    causesByStage: {
      planning: ['A heavy or irregular period', 'Spotting around ovulation', 'Infection', 'Early pregnancy loss — worth a test and a review'],
      'new-mother': ['Normal lochia, which fades over the weeks after birth', 'Bleeding that turns heavy again or smells offensive — infection, or placenta left behind', 'Periods returning'],
      parent: ['Heavy or irregular periods', 'Infection', 'Bleeding related to contraception', 'Anything unexplained needs review'],
    },
    relief: ['Contact your maternity unit now — do not wait', 'Note how much and what colour to tell them', 'Avoid intercourse until reviewed'],
  },
  {
    label: 'Reduced movement', keywords: ['not moving', 'less movement', 'reduced movement', 'baby is quiet', 'no kicks', 'fewer kicks'], urgent: true,
    effect: 'Reduced fetal movement always warrants same-day review.',
    causes: ['Baby sleeping cycle (usually 20–40 min)', 'Your position or activity masking movement', 'Reduced placental function — which is why it is checked'],
    causesByStage: {
      planning: ['This one is about a baby moving in the womb. If you are not pregnant, describe what you have noticed to your doctor instead — it will mean something different.'],
      'new-mother': ['A baby who is moving less, feeding less or harder to wake is a danger sign — log it under your baby’s symptoms so the guidance is about them, and seek care today.'],
      parent: ['A child who is moving less or is harder to rouse needs seeing today — log it under their symptoms so the guidance is about them.'],
    },
    relief: ['Lie on your left side and count for 2 hours', 'Cold drink and a quiet room to prompt movement', 'If still reduced — call your maternity unit immediately'],
  },
  {
    label: 'Fever', keywords: ['fever', 'temperature', 'chills', 'hot and cold'], urgent: true,
    effect: 'Infection can affect both mother and baby.',
    causes: ['Infection (urine, chest, viral)', 'Dehydration'],
    causesByStage: {
      planning: ['Infection — urine, chest or viral', 'Dehydration'],
      'new-mother': ['Infection of the womb, a wound, a breast or the urine — all common after birth and all needing same-day review', 'Mastitis, if a breast is red, hot and painful', 'A viral infection'],
      parent: ['A viral infection, often brought home by a child', 'Urine or chest infection', 'Mastitis, if you are still breastfeeding'],
    },
    relief: ['Take your temperature and note it', 'Fluids and paracetamol', 'Contact your care team the same day if above 38°C'],
  },
  {
    label: 'Abdominal pain', keywords: ['stomach pain', 'abdominal pain', 'belly pain', 'tummy pain', 'sharp pain'], urgent: true,
    effect: 'Persistent or sharp pain needs clinical assessment.',
    causes: ['Round ligament stretching (usually brief)', 'Braxton Hicks tightening', 'Urine infection', 'Rarely placental problems'],
    causesByStage: {
      planning: ['Period pain', 'Ovulation pain', 'Urine infection', 'Bowel causes', 'Ectopic pregnancy — urgent if a period is late'],
      'new-mother': ['Afterpains as the uterus contracts back down', 'Infection of a wound or the womb', 'Constipation', 'Anything severe, or with a fever, needs same-day review'],
      parent: ['Period pain', 'Urine infection', 'Bowel causes', 'Anything severe or persistent needs review'],
    },
    relief: ['Rest and change position', 'If constant, severe, or with bleeding — seek review now'],
  },
  {
    label: 'Contractions', keywords: ['contraction', 'contractions', 'tightening'], urgent: true,
    effect: 'Regular tightening before 37 weeks needs urgent review.',
    causes: ['Braxton Hicks practice contractions', 'Dehydration can trigger them', 'Preterm labour — which is why timing matters'],
    causesByStage: {
      planning: ['Period cramps can feel like tightening. If you are not pregnant, describe the pattern to your doctor rather than timing it as labour.'],
      'new-mother': ['Afterpains — the uterus contracting back down, strongest while feeding, easing within a fortnight.'],
      parent: ['Tightening in the abdomen means something else once pregnancy is behind you. Describe it to your doctor.'],
    },
    relief: ['Drink water and rest — Braxton Hicks usually settle', 'Time them: if regular and under 37 weeks, call now'],
  },
  {
    label: 'Anxiety', keywords: ['anxious', 'anxiety', 'worried', 'panic', 'stressed', 'stress'],
    effect: 'Maternal stress affects sleep, blood pressure and appetite.',
    causes: ['Normal worry about birth and baby', 'Sleep deprivation', 'Hormonal shifts', 'Life or financial pressure'],
    causesByStage: {
      planning: ['The strain of trying to conceive, which is its own kind of pressure', 'Sleep deprivation', 'Life or financial pressure', 'An anxiety condition that predates all of this'],
      'new-mother': ['Broken sleep', 'The weight of being responsible for a newborn', 'Hormonal shifts after birth', 'Postnatal anxiety — common, and treatable'],
      parent: ['Sleep deprivation', 'Work, life or financial pressure', 'Worry about a child', 'An anxiety condition that deserves support'],
    },
    relief: ['Slow breathing: 4 in, 6 out, for 2 minutes', 'Name it to someone you trust today', 'Gentle movement outdoors', 'Ask your doctor about perinatal mental health support'],
  },
  {
    label: 'Low mood', keywords: ['sad', 'low mood', 'depressed', 'crying', 'tearful', 'down'],
    effect: 'Persistent low mood deserves support — please tell your doctor.',
    causes: ['Hormonal changes', 'Exhaustion', 'Isolation or lack of support', 'Antenatal depression — common and treatable'],
    causesByStage: {
      planning: ['Disappointment month after month', 'Hormonal changes', 'Isolation', 'Depression, which is common and treatable'],
      'new-mother': ['Baby blues in the first fortnight — very common, and usually passing', 'Postnatal depression, if it lasts beyond two weeks — common, and treatable', 'Exhaustion', 'Isolation or lack of support'],
      parent: ['Exhaustion', 'Isolation', 'Life or financial pressure', 'Depression, which is common and treatable'],
    },
    relief: ['Tell your doctor — this is a routine, supported conversation', 'Daylight and gentle activity each day', 'Stay connected; do not carry it alone'],
  },
];

export const URGENT_LABELS = new Set(SYMPTOM_LEXICON.filter((s) => s.urgent).map((s) => s.label));
export const lexiconFor = (label: string) => SYMPTOM_LEXICON.find((s) => s.label === label);

/**
 * The causes to show a woman at this stage.
 *
 * Falls back to the pregnancy list only when a symptom has nothing specific
 * for her stage — which is the right default for 'general' and for anyone
 * whose stage we do not know.
 */
export function causesFor(label: string, stage?: string): string[] | undefined {
  const entry = lexiconFor(label);
  if (!entry) return undefined;
  const key = stage as CauseStage;
  return entry.causesByStage?.[key] ?? entry.causes;
}

export const GENERIC_ADVICE = {
  causes: ['Pregnancy-related changes in circulation, hormones or posture', 'Fatigue, dehydration or diet', 'Something unrelated to pregnancy'],
  relief: ['Rest, fluids and note when it happens', 'Track whether it worsens or eases over 24 hours', 'Mention it at your next appointment'],
};

export const COMMON_SYMPTOMS = [
  'Back ache', 'Nausea', 'Heartburn', 'Swelling', 'Fatigue', 'Headache', 'Cramps', 'Poor sleep',
];

/** Extract symptoms from a spoken sentence by keyword matching (not a medical AI). */
export function parseTranscript(raw: string): { matches: Symptom[]; unmatched: boolean } {
  const text = ` ${raw.toLowerCase().replace(/[^a-z' ]/g, ' ').replace(/\s+/g, ' ')} `;
  const severe = /\b(unbearable|excruciating|worst|severe|extreme)\b/.test(text);
  const high = /\b(really bad|very bad|terrible|awful|intense|bad|strong)\b/.test(text);
  const mild = /\b(mild|slight|a bit|a little|light|slightly)\b/.test(text);
  const intensity: Intensity = severe ? 'severe' : high ? 'high' : mild ? 'mild' : 'mid';

  const seen = new Set<string>();
  const matches: Symptom[] = [];
  for (const entry of SYMPTOM_LEXICON) {
    if (seen.has(entry.label)) continue;
    if (entry.keywords.some((k) => text.includes(` ${k} `) || text.includes(`${k} `))) {
      seen.add(entry.label);
      matches.push({
        id: `${entry.label}-${Date.now()}-${matches.length}`,
        name: entry.label,
        intensity: entry.urgent && intensity === 'mild' ? 'mid' : intensity,
        daysPresent: 1,
        confirmedToday: true,
        fromVoice: true,
      });
    }
  }
  return { matches, unmatched: matches.length === 0 && raw.trim().length > 0 };
}
