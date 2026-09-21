/**
 * Child symptom lexicon — the baby's half of the symptom journal.
 *
 * Separate from the mother's for two reasons. The words differ: a mother says
 * "nausea", a parent says "not keeping feeds down". And the urgency differs
 * far more sharply with age — a fever that is unremarkable in a two-year-old
 * is an emergency in a three-week-old, so several entries here carry an age
 * below which they are treated as urgent no matter how mild they look.
 *
 * The danger signs follow WHO IMCI: unable to feed, vomiting everything,
 * convulsions, lethargy, fast or difficult breathing. They are marked urgent
 * unconditionally.
 */
import type { Intensity, LexiconEntry, Symptom } from '@/data/symptoms';

export interface ChildLexiconEntry extends LexiconEntry {
  /**
   * Below this age in months the symptom is escalated to urgent whatever the
   * intensity. A newborn has almost no reserve, and the usual reassuring
   * explanations do not apply to one.
   */
  urgentUnderMonths?: number;
  /** shown in place of the ordinary staging note when the child is that young */
  youngNote?: string;
}

export const CHILD_SYMPTOM_LEXICON: ChildLexiconEntry[] = [
  /* ------------------------------------------------ WHO danger signs */
  {
    label: 'Not feeding', keywords: ['not feeding', 'wont feed', "won't feed", 'refusing feed', 'refusing milk', 'not drinking', 'not eating', 'off feeds'], urgent: true,
    effect: 'A child who will not feed at all needs to be seen the same day.',
    causes: ['Infection anywhere in the body', 'Blocked nose making sucking impossible', 'Mouth thrush or ulcers making feeding painful', 'Serious illness — which is why this is never watched at home'],
    relief: ['Go to a clinic or hospital today — do not wait for morning', 'Offer small amounts by spoon or cup on the way', 'Take a note of when the last full feed was'],
  },
  {
    label: 'Vomiting everything', keywords: ['vomiting everything', 'vomits everything', 'throws up everything', 'cant keep anything down', "can't keep anything down", 'projectile'], urgent: true,
    effect: 'Nothing staying down means fluids are not going in at all.',
    causes: ['Gut infection', 'Pyloric stenosis in a young baby (forceful, after every feed)', 'A more general infection making the child sick'],
    relief: ['Seek care today — dehydration in a small child moves fast', 'Offer oral rehydration solution in teaspoons on the way', 'Note how many times and whether the vomit is green or bloody'],
  },
  {
    label: 'Convulsions', keywords: ['convulsion', 'convulsions', 'fit', 'fits', 'seizure', 'shaking uncontrollably', 'jerking'], urgent: true,
    effect: 'A fit in a child always needs emergency assessment.',
    causes: ['High fever (febrile convulsion)', 'Infection of the brain lining', 'Low blood sugar or low calcium', 'Epilepsy'],
    relief: ['Emergency care now — call for transport', 'Lay the child on their side, nothing in the mouth', 'Time how long it lasts; that is the first thing you will be asked'],
  },
  {
    label: 'Unusually sleepy', keywords: ['very sleepy', 'unusually sleepy', 'hard to wake', 'wont wake', "won't wake", 'floppy', 'lethargic', 'not responding', 'unresponsive'], urgent: true,
    effect: 'Being hard to rouse is a danger sign at any age.',
    causes: ['Serious infection', 'Dehydration', 'Low blood sugar', 'Anything that would make an adult confused rather than sleepy'],
    relief: ['Go to hospital now', 'Keep the child warm and on their side while you travel', 'Do not wait to see whether they perk up'],
  },
  {
    label: 'Fast or difficult breathing', keywords: ['fast breathing', 'difficult breathing', 'breathing fast', 'struggling to breathe', 'chest indrawing', 'grunting', 'wheezing', 'ribs pulling in'], urgent: true,
    effect: 'Ribs drawing in or grunting means the effort of breathing is too high.',
    causes: ['Pneumonia', 'Bronchiolitis (common under one year)', 'Asthma in an older child', 'Something inhaled'],
    relief: ['Go for care now — count the breaths in a minute and take the number with you', 'Keep the child upright rather than lying flat', 'Loosen tight clothing around the chest'],
  },

  /* ---------------------------------------------- common, age-dependent */
  {
    label: 'Fever', keywords: ['fever', 'temperature', 'hot', 'burning up', 'feverish'],
    urgentUnderMonths: 3,
    youngNote: 'Under three months a fever is investigated in hospital, not managed at home. Go today.',
    effect: 'Usually infection. In the first three months it is treated as an emergency.',
    causes: ['Viral infection — the commonest cause by far', 'Ear, chest or urine infection', 'Reaction in the day or two after a vaccination', 'Being overwrapped in hot weather'],
    relief: ['Measure it rather than guessing, and write the number down', 'Offer feeds or fluids more often than usual', 'Remove a layer of clothing; do not sponge with cold water', 'Paracetamol at the weight-based dose if the child is uncomfortable'],
  },
  {
    label: 'Diarrhoea', keywords: ['diarrhoea', 'diarrhea', 'loose motion', 'loose stools', 'watery stool', 'runny poo'],
    urgentUnderMonths: 6,
    youngNote: 'In a baby under six months, diarrhoea dehydrates quickly. Have them seen today.',
    effect: 'The risk is fluid loss, not the stools themselves.',
    causes: ['Viral gut infection (rotavirus)', 'Contaminated water or food', 'Antibiotics', 'A new food'],
    relief: ['Oral rehydration solution after every loose stool — this is the treatment', 'Keep breastfeeding; it does not make diarrhoea worse', 'Zinc for 14 days shortens it — ask at the pharmacy', 'Blood in the stool, or no wet nappy for 6 hours, means go now'],
  },
  {
    label: 'Vomiting', keywords: ['vomiting', 'vomit', 'throwing up', 'threw up', 'being sick', 'posseting'],
    effect: 'Small posseting after feeds is normal; repeated vomiting is not.',
    causes: ['Reflux — very common and usually harmless if weight is climbing', 'Overfeeding or feeding too fast', 'Gut infection', 'Coughing hard enough to bring a feed up'],
    relief: ['Smaller feeds, more often, with a pause to wind halfway', 'Hold upright for 20 minutes after a feed', 'Watch wet nappies — that is the real measure of whether fluids are going in'],
  },
  {
    label: 'Fewer wet nappies', keywords: ['fewer wet nappies', 'dry nappy', 'not weeing', 'less wee', 'no wet nappy', 'fewer nappies'],
    urgent: true,
    effect: 'The clearest sign of dehydration a parent can see at home.',
    causes: ['Not enough fluid going in', 'Losing fluid through vomiting, diarrhoea or fever', 'Poor feeding'],
    relief: ['Offer fluids now and seek care today', 'Fewer than four wet nappies in 24 hours in a baby needs review', 'Look also for a sunken soft spot, no tears, and a dry mouth'],
  },
  {
    label: 'Jaundice', keywords: ['jaundice', 'yellow skin', 'yellow eyes', 'looking yellow'],
    urgentUnderMonths: 1,
    youngNote: 'Jaundice in the first day of life, or lasting past two weeks, needs a bilirubin test.',
    effect: 'Common in the first week; the timing is what matters.',
    causes: ['Normal newborn jaundice, peaking around day 3–5', 'Breast-milk jaundice, which lingers harmlessly', 'Blood group incompatibility', 'Liver or thyroid problems if it persists past two weeks'],
    relief: ['Feed often — clearing it depends on feeding, not on sunlight', 'Press gently on the nose or chest in daylight to judge the colour', 'Yellow palms and soles, or a sleepy baby who will not feed, means go now'],
  },
  {
    label: 'Persistent crying', keywords: ['crying', 'wont stop crying', "won't stop crying", 'inconsolable', 'colic', 'crying all night'],
    effect: 'Exhausting, and usually colic — but a change in the cry matters.',
    causes: ['Colic, peaking around six weeks and easing by four months', 'Hunger or a wet nappy', 'Reflux', 'A hair wrapped around a finger or toe — always worth checking'],
    relief: ['Hold skin to skin, or carry in a sling — motion and warmth settle most babies', 'White noise, or a warm bath', 'Hand the baby to someone else and step outside for five minutes; that is allowed', 'A weak, high-pitched or moaning cry is different from colic — have it checked'],
  },
  {
    label: 'Cough or cold', keywords: ['cough', 'coughing', 'cold', 'runny nose', 'blocked nose', 'stuffy nose', 'snuffles'],
    effect: 'Usually viral. Watch the breathing, not the cough.',
    causes: ['Common cold — small children get eight to ten a year', 'Bronchiolitis under one year', 'Post-nasal drip'],
    relief: ['Saline drops and a gentle nasal aspirator before feeds', 'Feeds smaller and more often while the nose is blocked', 'Prop the head of the cot slightly; never a pillow in the cot', 'No cough medicine under six years — it does not help and can harm'],
  },
  {
    label: 'Rash', keywords: ['rash', 'spots', 'red patches', 'hives', 'bumps on skin'],
    effect: 'Most childhood rashes are viral. One test tells the dangerous ones apart.',
    causes: ['Viral rash following a fever', 'Heat rash', 'Eczema', 'Allergic reaction'],
    relief: ['Press a clear glass to the rash: if it does not fade, go to hospital now', 'Keep the skin cool and loosely dressed', 'Unscented emollient for dry, itchy patches', 'A rash with fever and a stiff neck or drowsiness is an emergency'],
  },
  {
    label: 'Nappy rash', keywords: ['nappy rash', 'diaper rash', 'sore bottom', 'red bottom'],
    effect: 'Skin irritation from moisture — nearly always settles with air and barrier cream.',
    causes: ['A nappy left wet or soiled too long', 'Diarrhoea', 'Thrush, if the rash is beefy red with satellite spots', 'Reaction to wipes'],
    relief: ['Nappy-free time on a towel, as much as you can manage', 'Thick barrier cream at every change', 'Plain water and cotton rather than scented wipes', 'If it is bright red with spots at the edges, ask about an antifungal cream'],
  },
  {
    label: 'Constipation', keywords: ['constipation', 'constipated', 'hard stool', 'straining', 'not passing stool'],
    effect: 'Hard, painful stools. Breastfed babies can go days between soft stools — that is not constipation.',
    causes: ['Formula made too strong', 'Not enough fluid, especially in hot weather', 'Starting solids', 'Holding on after one painful stool'],
    relief: ['Check the formula scoop measure is level, not heaped', 'Extra water between feeds once over six months', 'Bicycle the legs and massage the tummy clockwise', 'Pears, prunes and apricots once on solids'],
  },
  {
    label: 'Poor weight gain', keywords: ['not gaining weight', 'losing weight', 'poor weight gain', 'not growing', 'too thin'],
    effect: 'The growth chart, not one weighing, is what answers this.',
    causes: ['Feeding difficulty or poor attachment', 'Not enough feeds in 24 hours', 'Reflux losing much of each feed', 'An underlying illness'],
    relief: ['Bring the growth chart to the clinic — a trend is readable, a single point is not', 'Ask for a feeding assessment; most causes are fixable', 'Count feeds and wet nappies for two days before the appointment'],
  },
  {
    label: 'Ear pain', keywords: ['ear pain', 'earache', 'pulling ear', 'tugging ear', 'ear discharge'],
    effect: 'Common after a cold. Discharge means the drum has perforated.',
    causes: ['Middle ear infection after a cold', 'Fluid behind the drum', 'Teething pain referred to the ear'],
    relief: ['Paracetamol or ibuprofen at the weight-based dose for the pain', 'Upright position, especially for sleep', 'Nothing in the ear canal — no oil, no cotton buds', 'Discharge, or pain lasting over two days, needs review'],
  },
  {
    label: 'Teething', keywords: ['teething', 'drooling', 'chewing everything', 'sore gums'],
    effect: 'Sore gums and dribbling. Teething does not cause fever or diarrhoea.',
    causes: ['Teeth coming through, usually from around six months'],
    relief: ['A chilled — not frozen — teething ring', 'Clean finger to rub the gum firmly', 'Wipe the chin often to stop a dribble rash', 'If there is a fever, look for another cause; do not put it down to teeth'],
  },
  {
    label: 'Cord infection', keywords: ['cord', 'umbilical', 'belly button red', 'cord smells', 'cord discharge'], urgent: true,
    effect: 'Redness spreading onto the belly around the cord is a newborn emergency.',
    causes: ['Infection at the cord stump', 'Something applied to the stump'],
    relief: ['Go today — cord infection in a newborn becomes bloodstream infection quickly', 'Keep the stump clean, dry, and outside the nappy', 'Nothing applied to it: no oil, ash, powder or herb'],
  },
  {
    label: 'Poor sleep', keywords: ['not sleeping', 'wont sleep', "won't sleep", 'waking all night', 'baby not sleeping', 'sleep problems'],
    effect: 'Wearing on the whole household, and usually developmental rather than medical.',
    causes: ['Normal night waking — most babies still wake at a year', 'A developmental leap or new skill', 'Hunger, teething or a blocked nose', 'Too much daytime sleep too late'],
    relief: ['Same short routine every night — the order matters more than the length', 'Dark, cool room; light in the morning', 'Share the nights if there is anyone to share them with', 'Snoring with pauses in breathing is worth mentioning to a doctor'],
  },
];

export const URGENT_CHILD_LABELS = new Set(
  CHILD_SYMPTOM_LEXICON.filter((s) => s.urgent).map((s) => s.label),
);

export const childLexiconFor = (label: string) =>
  CHILD_SYMPTOM_LEXICON.find((s) => s.label === label);

/**
 * Whether this symptom is urgent for a child of this age.
 *
 * Age unknown is treated as young. Refusing to guess downward is the whole
 * point of the age rule: getting it wrong in that direction is the expensive
 * mistake.
 */
export function childUrgent(label: string, ageMonths?: number | null): boolean {
  const entry = childLexiconFor(label);
  if (!entry) return false;
  if (entry.urgent) return true;
  if (entry.urgentUnderMonths === undefined) return false;
  return ageMonths === null || ageMonths === undefined || ageMonths < entry.urgentUnderMonths;
}

export const CHILD_GENERIC_ADVICE = {
  causes: [
    'A common childhood infection',
    'Feeding, teething or sleep changes at this age',
    'Something unrelated that is worth describing to a clinician',
  ],
  relief: [
    'Note when it started and whether it is getting worse',
    'Keep feeds and fluids going, and watch wet nappies',
    'Bring this log to the next clinic visit',
  ],
};

export const CHILD_COMMON_SYMPTOMS = [
  'Fever', 'Cough or cold', 'Diarrhoea', 'Vomiting', 'Persistent crying',
  'Rash', 'Poor sleep', 'Constipation',
];

/** Same keyword matching as the mother's parser, against the child lexicon. */
export function parseChildTranscript(raw: string): { matches: Symptom[]; unmatched: boolean } {
  const text = ` ${raw.toLowerCase().replace(/[^a-z' ]/g, ' ').replace(/\s+/g, ' ')} `;
  const severe = /\b(unbearable|excruciating|worst|severe|extreme)\b/.test(text);
  const high = /\b(really bad|very bad|terrible|awful|intense|bad|strong)\b/.test(text);
  const mild = /\b(mild|slight|a bit|a little|light|slightly)\b/.test(text);
  const intensity: Intensity = severe ? 'severe' : high ? 'high' : mild ? 'mild' : 'mid';

  const seen = new Set<string>();
  const matches: Symptom[] = [];
  for (const entry of CHILD_SYMPTOM_LEXICON) {
    if (seen.has(entry.label)) continue;
    if (entry.keywords.some((k) => text.includes(` ${k} `) || text.includes(`${k} `))) {
      seen.add(entry.label);
      matches.push({
        id: `c-${entry.label}-${Date.now()}-${matches.length}`,
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
