/**
 * Profile API Controller — her name, photo, bio and clinical basics.
 * These used to live only in the browser, so a changed photo never reached
 * the doctor and was lost on refresh.
 */
const userModel = require('../../models/userModel');
const symptomModel = require('../../models/symptomModel');
const dailyLogModel = require('../../models/dailyLogModel');
const pregnancyModel = require('../../models/pregnancyModel');

const childModel = require('../../models/childModel');
const { sendUpload } = require('../../config/uploads');
const { badRequest } = require('../respond');

exports.show = async (req, res, next) => {
  try {
    const me = await userModel.current();
    res.json({ data: await userModel.profile(me.id) });
  } catch (err) { next(err); }
};

/**
 * Everything the onboarding questionnaire asked for, written down.
 *
 * The questionnaire has always collected a date of birth, a blood group, a
 * height and weight, ongoing conditions, a last menstrual period and a child's
 * date of birth — and then discarded every one of them on the way to the
 * dashboard. "Edit due date" sent her back through the same questions to the
 * same end. That is why a registered mother's dashboard never changed: there
 * was nothing of hers in the database for it to read.
 *
 * Each answer is optional on its own, so a partly-finished questionnaire saves
 * what it has instead of failing whole. A rejected value names itself, because
 * "That is not a real date" is no use when six of the answers are dates.
 */
/**
 * What she has already answered, in the questionnaire's own field ids, so
 * "Edit due date" and "Update your details" reopen it filled in rather
 * than blank — a blank form re-asked everything and, left blank, changed
 * nothing, which read as the answers having been lost.
 */
exports.onboarding = async (req, res, next) => {
  try {
    const { id } = await userModel.current();
    const [mine, pregnancy, child, symptoms] = await Promise.all([
      userModel.intakeFor(id), pregnancyModel.forUser(id), childModel.forUser(id),
      symptomModel.all(id).catch(() => []),
    ]);
    const sexWord = child?.gender === 'female' ? 'Girl' : child?.gender === 'male' ? 'Boy' : undefined;
    const cap = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : undefined);
    const childDob = child?.dob ? String(child.dob).slice(0, 10) : undefined;
    res.json({
      data: {
        ...mine,
        lmp: pregnancy?.lmp ? String(pregnancy.lmp).slice(0, 10) : undefined,
        // both step sets ask the same things under their own ids
        baby_name: child?.name, child_name: child?.name,
        baby_dob: childDob, child_dob: childDob,
        baby_sex: sexWord, child_sex: sexWord,
        feeding: cap(child?.feeding),
        delivery: child?.delivery === 'c-section' ? 'C-section' : cap(child?.delivery),
        // "any symptoms lately?" became journal entries; reopening the form
        // shows the journal, so it does not read as if the answer was lost
        symptoms: symptoms.length ? symptoms.map((s) => s.name) : undefined,
      },
    });
  } catch (err) { next(err); }
};

exports.saveOnboarding = async (req, res) => {
  const {
    dob, bloodGroup, age, heightCm, weightKg, conditions, allergies,
    lmp, childName, childDob, childGender, childFeeding, childDelivery, childBirthWeightKg,
    childWeightKg, childHeightCm,
    intake, symptoms,
  } = req.body || {};

  try {
    const { id, stage } = await userModel.current();
    const saved = [];

    if ([bloodGroup, age, dob, conditions, heightCm, weightKg, allergies].some((v) => v !== undefined)) {
      // a date of birth answers the age question more durably than an age does
      const derived = dob && /^\d{4}-\d{2}-\d{2}$/.test(String(dob))
        ? Math.floor((Date.now() - new Date(`${dob}T00:00:00`).getTime()) / 31557600000)
        : undefined;
      await userModel.setDetails(id, {
        bloodGroup,
        age: age ?? (Number.isFinite(derived) ? derived : undefined),
        conditions,
        dob,
        // her own height and weight, whatever her stage — the pregnancy row
        // below keeps its own copy as the pre-pregnancy baseline
        heightCm,
        weightKg,
        allergies,
      });
      saved.push('profile');
    }

    if (intake && typeof intake === 'object') {
      await userModel.saveIntake(id, intake);
      saved.push('intake');
    }

    if (lmp) {
      await pregnancyModel.save(id, { lmp, heightCm, preWeightKg: weightKg });
      saved.push('pregnancy');
    }

    /*
     * "Any symptoms lately?" becomes real symptom entries — the ones the
     * logger shows, the causes-and-relief cards explain and the clinician
     * sees — rather than a list that was read once and forgotten. Only the
     * ones not already in her journal, so reopening the questionnaire does
     * not double them.
     */
    if (Array.isArray(symptoms)) {
      const existing = new Set((await symptomModel.all(id)).map((s) => s.name.toLowerCase()));
      for (const name of symptoms.map((s) => String(s || '').trim()).filter(Boolean).slice(0, 12)) {
        if (name.toLowerCase() === 'none' || existing.has(name.toLowerCase())) continue;
        await symptomModel.create(id, { name, intensity: 'mid', daysPresent: 1 });
        saved.push(`symptom:${name}`);
      }
    }

    if (childDob) {
      await childModel.save(id, {
        name: childName,
        dob: childDob,
        gender: childGender,
        feeding: childFeeding,
        weightKg: childWeightKg,
        heightCm: childHeightCm,
        delivery: childDelivery,
        birthWeightKg: childBirthWeightKg,
      });
      saved.push('child');
    }

    res.json({
      data: {
        saved,
        profile: await userModel.profile(id),
        pregnancy: await pregnancyModel.forUser(id),
        child: await childModel.forUser(id),
        stage,
      },
    });
  } catch (err) {
    return badRequest(res, err);
  }
};

/** One PATCH handles whichever fields the panel changed. */
exports.update = async (req, res) => {
  const { name, bio, avatar, bloodGroup, age, stage } = req.body || {};
  try {
    const { id } = await userModel.current();
    if (name !== undefined) await userModel.setName(id, name);
    if (bio !== undefined) await userModel.setBio(id, bio);
    if (avatar !== undefined) await userModel.setAvatar(id, avatar);
    if (stage !== undefined) await userModel.setStage(id, stage);
    if (bloodGroup !== undefined || age !== undefined) {
      await userModel.setDetails(id, { bloodGroup, age });
    }
    res.json({ data: await userModel.profile(id) });
  } catch (err) {
    return badRequest(res, err);
  }
};

/**
 * Weight gain against the range recommended for her starting BMI — the
 * reason pre-pregnancy weight and height are recorded at booking.
 */
exports.weightGain = async (req, res, next) => {
  try {
    const me = await userModel.current();
    res.json({ data: await pregnancyModel.weightGain(me.id) });
  } catch (err) { next(err); }
};

/** Serving bytes off disk stayed synchronous — there is no query behind it. */
exports.avatar = (req, res) => {
  const full = userModel.avatarPath(req.params.file);
  if (!full) return res.status(404).json({ error: 'Photo not found' });
  return sendUpload(res, full);
};

/* ------------------------------------------------- daily self-reporting */

exports.dailyLog = async (req, res, next) => {
  try {
    const { id } = await userModel.current();
    const [today, history, summary] = await Promise.all([
      dailyLogModel.forDate(id),
      dailyLogModel.history(id, 14),
      dailyLogModel.summary(id, 7),
    ]);
    res.json({ data: { today, history, summary } });
  } catch (err) { next(err); }
};

exports.saveDailyLog = async (req, res) => {
  try {
    const { id } = await userModel.current();
    const saved = await dailyLogModel.save(id, {
      mood: req.body?.mood,
      kicks: req.body?.kicks,
      waterLitres: req.body?.waterLitres,
      sleepHours: req.body?.sleepHours,
    });
    const [history, summary] = await Promise.all([
      dailyLogModel.history(id, 14),
      dailyLogModel.summary(id, 7),
    ]);
    res.json({ data: { today: saved, history, summary } });
  } catch (err) {
    return badRequest(res, err);
  }
};
