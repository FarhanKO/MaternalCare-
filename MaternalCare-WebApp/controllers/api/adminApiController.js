/**
 * Admin API Controller — checking clinicians before mothers can book them.
 *
 * A clinician who registers is "pending": not in the directory, not bookable
 * and not able to moderate. An admin checks the licence number against the
 * medical council register, then verifies or rejects the account here.
 */
const doctorModel = require('../../models/doctorModel');

const STATES = ['pending', 'verified', 'rejected', 'all'];

/** The clinicians waiting on a decision (or every one, with ?state=all). */
exports.doctors = async (req, res, next) => {
  try {
    const state = STATES.includes(req.query.state) ? req.query.state : 'pending';
    const [list, pending] = await Promise.all([
      doctorModel.forReview({ state }),
      state === 'pending' ? null : doctorModel.forReview({ state: 'pending' }),
    ]);
    return res.json({ data: list, meta: { state, pending: (pending ?? list).length } });
  } catch (err) { return next(err); }
};

const idOf = (req) => (/^\d+$/.test(String(req.params.id)) ? req.params.id : null);

exports.verify = async (req, res, next) => {
  try {
    const id = idOf(req);
    const doctor = id && await doctorModel.verify(id, req.user.id);
    if (!doctor) return res.status(404).json({ error: 'Clinician not found' });
    return res.json({ data: doctor });
  } catch (err) { return next(err); }
};

exports.reject = async (req, res, next) => {
  try {
    const id = idOf(req);
    const doctor = id && await doctorModel.reject(id, req.user.id, req.body?.note);
    if (!doctor) return res.status(404).json({ error: 'Clinician not found' });
    return res.json({ data: doctor });
  } catch (err) {
    if (err.code === 'INVALID_REGISTRATION') {
      return res.status(400).json({ error: err.message, field: err.field });
    }
    return next(err);
  }
};
