/**
 * Intake Model — what the questionnaire learned about her, read back.
 *
 * Onboarding stores its stage-specific answers as `users.intake`, keyed by
 * the question id the client uses ("first", "complications", "folic"…),
 * and allergies in their own column. Both were written faithfully and then
 * read by nothing: not the profile panel, not the clinician's record, not
 * the risk rules, not the care plan, not the PDF. Sixteen questions whose
 * answers went into the database and stopped there.
 *
 * This is the one place those raw answers are interpreted. Everything that
 * wants them — the profile, the caseload, the risk engine, the guidance,
 * the report — asks here, so "Not sure" means the same thing everywhere
 * and a renamed option is fixed once.
 *
 * Three views of the same answers:
 *
 *   historyFor(user)       typed, normalised — for rules to reason over
 *   linesFor(history, stage)   label/value pairs — for a screen or a page
 *   concernsFor(history, ctx)  what deserves a nudge — for the care plan
 */

/* --------------------------------------------------------- normalise */

const yesNo = (v) => (v === 'Yes' ? true : v === 'No' || v === 'Not yet' ? false : null);
const num = (v) => {
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? Math.round(n) : null;
};
const list = (v) => (Array.isArray(v) ? v : typeof v === 'string' && v ? [v] : [])
  .map((s) => String(s).trim()).filter((s) => s && s !== 'None');

const THREE = { Yes: 'yes', No: 'no', 'Not sure': 'unsure' };
const MOOD = { Rarely: 'rarely', Sometimes: 'sometimes', Often: 'often' };
const TRYING = {
  'Just starting': 'starting', 'Under 6 months': 'under-6', '6–12 months': '6-12', 'Over a year': 'over-12',
};
const CYCLE = { Regular: 'regular', Irregular: 'irregular', 'Not sure': 'unsure' };
const FOLIC = { Yes: 'yes', No: 'no', 'Not yet': 'not-yet' };
const MULTIPLES = { No: 'none', Twins: 'twins', 'Triplets or more': 'triplets' };
const GROWTH = { No: 'no', Some: 'some', 'Not sure': 'unsure' };

const pickFrom = (table, v) => (v in table ? table[v] : null);

/**
 * Her history, typed. Every field is null when she was never asked or did
 * not answer — a null is "unknown", never "no".
 */
function historyFor(user) {
  const raw = user?.intake && typeof user.intake === 'object' ? user.intake : {};
  const complications = list(raw.complications);
  return {
    allergies: String(user?.allergies || '').trim() || null,

    /* pregnant */
    firstPregnancy: yesNo(raw.first),
    previousPregnancies: num(raw.prev),
    complications,
    hadPreeclampsia: complications.some((c) => /pre-?eclampsia/i.test(c)),
    hadGdm: complications.some((c) => /gestational diabetes/i.test(c)),
    hadPreterm: complications.some((c) => /preterm/i.test(c)),
    hadMiscarriage: complications.some((c) => /miscarriage/i.test(c)),
    hadCsection: complications.some((c) => /c-section|caesarean/i.test(c)),
    underCare: raw.care === 'Yes' ? true : raw.care === 'Not yet' ? false : null,
    multiples: pickFrom(MULTIPLES, raw.multiples),

    /* new mother */
    babyVaccinated: pickFrom(THREE, raw.baby_vax),
    mood: pickFrom(MOOD, raw.mood),

    /* planning */
    trying: pickFrom(TRYING, raw.trying),
    cycle: pickFrom(CYCLE, raw.cycle),
    folicAcid: pickFrom(FOLIC, raw.folic),
    previousPregnancy: yesNo(raw.prev_preg),

    /* parent */
    children: num(raw.num_children),
    growthConcern: pickFrom(GROWTH, raw.growth),
    milestonesOnTrack: pickFrom(THREE, raw.milestones),
    childVaccinated: pickFrom(THREE, raw.child_vax),
  };
}

/* ---------------------------------------------------------- describe */

const THREE_WORD = { yes: 'Yes', no: 'No', unsure: 'Not sure' };
const TRYING_WORD = {
  starting: 'Just starting', 'under-6': 'Under 6 months', '6-12': '6–12 months', 'over-12': 'Over a year',
};
const CYCLE_WORD = { regular: 'Regular', irregular: 'Irregular', unsure: 'Not sure' };
const FOLIC_WORD = { yes: 'Yes', no: 'No', 'not-yet': 'Not yet' };
const MULT_WORD = { none: 'No', twins: 'Twins', triplets: 'Triplets or more' };
const MOOD_WORD = { rarely: 'Rarely', sometimes: 'Sometimes', often: 'Often' };
const GROWTH_WORD = { no: 'No', some: 'Some', unsure: 'Not sure' };

/**
 * What she said, as label/value lines for the stage she is in. `id` is the
 * questionnaire's field id, so a screen can reopen the form on that very
 * question. Lines she never answered are left out rather than shown blank.
 */
function linesFor(history, stage) {
  const h = history;
  const out = [];
  const add = (id, label, value, tone = 'neutral') => {
    if (value === null || value === undefined || value === '') return;
    out.push({ id, label, value: String(value), tone });
  };

  add('allergies', 'Allergies', h.allergies, h.allergies ? 'warn' : 'neutral');

  switch (stage) {
    case 'pregnant':
      add('first', 'First pregnancy', h.firstPregnancy === null ? null : h.firstPregnancy ? 'Yes' : 'No');
      add('prev', 'Previous pregnancies', h.previousPregnancies);
      add('complications', 'Past complications',
        h.complications.length ? h.complications.join(', ') : null, 'warn');
      add('care', 'Under a doctor’s care', h.underCare === null ? null : h.underCare ? 'Yes' : 'Not yet',
        h.underCare === false ? 'warn' : 'neutral');
      add('multiples', 'Expecting multiples', h.multiples ? MULT_WORD[h.multiples] : null,
        h.multiples && h.multiples !== 'none' ? 'info' : 'neutral');
      break;
    case 'new-mother':
      add('baby_vax', 'Baby’s vaccinations up to date', h.babyVaccinated ? THREE_WORD[h.babyVaccinated] : null,
        h.babyVaccinated && h.babyVaccinated !== 'yes' ? 'warn' : 'neutral');
      add('mood', 'Felt down or anxious lately', h.mood ? MOOD_WORD[h.mood] : null,
        h.mood === 'often' ? 'warn' : 'neutral');
      break;
    case 'planning':
      add('trying', 'Trying for', h.trying ? TRYING_WORD[h.trying] : null);
      add('cycle', 'Cycles', h.cycle ? CYCLE_WORD[h.cycle] : null,
        h.cycle === 'irregular' ? 'info' : 'neutral');
      add('folic', 'Taking folic acid', h.folicAcid ? FOLIC_WORD[h.folicAcid] : null,
        h.folicAcid && h.folicAcid !== 'yes' ? 'warn' : 'neutral');
      add('prev_preg', 'Previous pregnancies', h.previousPregnancy === null ? null : h.previousPregnancy ? 'Yes' : 'No');
      break;
    case 'parent':
      add('num_children', 'Children', h.children);
      add('growth', 'Concerns about growth', h.growthConcern ? GROWTH_WORD[h.growthConcern] : null,
        h.growthConcern === 'some' ? 'warn' : 'neutral');
      add('milestones', 'Milestones on track', h.milestonesOnTrack ? THREE_WORD[h.milestonesOnTrack] : null,
        h.milestonesOnTrack === 'no' ? 'warn' : 'neutral');
      add('child_vax', 'Immunisations up to date', h.childVaccinated ? THREE_WORD[h.childVaccinated] : null,
        h.childVaccinated && h.childVaccinated !== 'yes' ? 'warn' : 'neutral');
      break;
    default:
      break;
  }
  return out;
}

/* ---------------------------------------------------------- concerns */

/**
 * The answers that call for a nudge, as care-plan items.
 *
 * Each says what she told us and what to do about it; none is a diagnosis.
 * The thresholds are the ordinary ones — twelve months of trying (six from
 * 35) before a fertility review, folic acid before conception, two weeks of
 * low mood after a birth as the point to speak to someone.
 */
function concernsFor(history, { stage, age } = {}) {
  const h = history;
  const out = [];
  const item = (domain, priority, title, text, why, field) => out.push({
    domain, priority, title, text, why, field,
  });

  if (h.allergies) {
    item('lifestyle', 'normal',
      'Make sure every prescriber knows your allergies',
      `You have told us: ${h.allergies}. Say it at every booking and before anything is given — it is the one thing a busy clinic can miss.`,
      'From your questionnaire.', 'allergies');
  }

  if (stage === 'pregnant') {
    if (h.underCare === false) {
      item('lifestyle', 'high',
        'Book your first antenatal visit',
        'Your first appointment sets the dates, the blood tests and the scan schedule everything else follows from. Sooner is better; the booking desk here can find someone.',
        'You said you are not yet under a doctor’s care.', 'care');
    }
    if (h.multiples && h.multiples !== 'none') {
      item('lifestyle', 'high',
        `A ${h.multiples === 'twins' ? 'twin' : 'multiple'} pregnancy is monitored more closely`,
        'Expect scans more often and an earlier conversation about delivery. Energy and iron needs are higher too — ask for a plan rather than a general figure.',
        `You are expecting ${MULT_WORD[h.multiples].toLowerCase()}.`, 'multiples');
    }
    if (h.hadPreeclampsia) {
      item('lifestyle', 'high',
        'Tell your clinician about the previous pre-eclampsia',
        'A past episode raises the chance of another. Low-dose aspirin from early pregnancy is offered for exactly this history, and blood pressure will be watched more closely — but only if the team knows.',
        'Pre-eclampsia is on your history.', 'complications');
    }
    if (h.hadGdm) {
      item('nutrition', 'high',
        'Ask for an early glucose test',
        'Gestational diabetes tends to return. Testing early rather than at the usual 24–28 weeks catches it before it has had time to matter.',
        'Gestational diabetes is on your history.', 'complications');
    }
    if (h.hadPreterm) {
      item('lifestyle', 'normal',
        'Mention the previous preterm birth',
        'Cervical length checks and, for some, progesterone are offered on the strength of this history alone.',
        'Preterm birth is on your history.', 'complications');
    }
  }

  if (stage === 'new-mother') {
    if (h.mood === 'often') {
      item('lifestyle', 'high',
        'Feeling low most days for two weeks is worth saying out loud',
        'This is common after a birth and it is treatable. Tell your midwife, doctor or someone you trust this week — it is not a failing, and you do not have to wait for a check-up.',
        'You said you have often felt down or anxious in the past two weeks.', 'mood');
    } else if (h.mood === 'sometimes') {
      item('lifestyle', 'normal',
        'Keep an eye on how you are feeling',
        'Some low days are expected. If they become most days, or you stop enjoying anything, that is the point to talk to someone.',
        'You said you have sometimes felt down or anxious lately.', 'mood');
    }
    if (h.babyVaccinated && h.babyVaccinated !== 'yes') {
      item('lifestyle', 'normal',
        'Check the baby’s vaccination schedule',
        'The Vaccinations tab lists each dose and when it is due. Anything missed can be caught up — the schedule is designed for it.',
        h.babyVaccinated === 'no' ? 'You said the vaccinations are not up to date.' : 'You were not sure whether the vaccinations are up to date.',
        'baby_vax');
    }
  }

  if (stage === 'parent') {
    if (h.growthConcern === 'some') {
      item('lifestyle', 'normal',
        'Add a measurement so the growth curve can answer',
        'A weight and a height today, against the WHO curve, is what turns a worry into a centile a clinician can act on. Two points make a direction.',
        'You said you have some concerns about growth.', 'child_weight_now');
    }
    if (h.milestonesOnTrack === 'no') {
      item('lifestyle', 'high',
        'Raise the milestones with your clinician',
        'Tick off what your child does on the Milestones list and bring it to the next visit. Early support makes the most difference early.',
        'You said milestones are not on track.', 'milestones');
    }
    if (h.childVaccinated && h.childVaccinated !== 'yes') {
      item('lifestyle', 'normal',
        'Check the immunisation schedule',
        'The Vaccinations tab lists each dose and when it was due. Catch-up is always possible.',
        h.childVaccinated === 'no' ? 'You said immunisations are not up to date.' : 'You were not sure whether immunisations are up to date.',
        'child_vax');
    }
  }

  if (stage === 'planning') {
    if (h.folicAcid && h.folicAcid !== 'yes') {
      item('nutrition', 'high',
        'Start folic acid now — 400 micrograms a day',
        'It has to be in your system before conception and through the first twelve weeks to protect the baby’s spine and brain. Start today, not when the test is positive.',
        h.folicAcid === 'no' ? 'You said you are not taking folic acid.' : 'You said you are not yet taking folic acid.',
        'folic');
    }
    const long = h.trying === 'over-12' || (h.trying === '6-12' && age >= 35);
    if (long) {
      item('lifestyle', 'high',
        'Ask for a fertility review',
        age >= 35
          ? 'After six months of trying from 35, a clinician would want to look — for both of you. It is a conversation, not a verdict.'
          : 'After a year of trying, a clinician would want to look — for both of you. It is a conversation, not a verdict.',
        `You have been trying for ${TRYING_WORD[h.trying].toLowerCase()}${age >= 35 ? ` at ${age}` : ''}.`,
        'trying');
    }
    if (h.cycle === 'irregular') {
      item('lifestyle', 'normal',
        'Mention the irregular cycles',
        'Irregular cycles make timing harder and are sometimes a sign of something treatable — thyroid or PCOS, both of which a simple test finds.',
        'You said your cycles are irregular.', 'cycle');
    }
  }

  return out;
}

module.exports = { historyFor, linesFor, concernsFor };
