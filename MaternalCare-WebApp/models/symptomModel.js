/**
 * Symptom Model — data access + domain logic for the symptom journal.
 * Consumed by both the EJS views and the JSON API behind the React
 * dashboard.
 */
const db = require('../config/db');

/** Symptoms that always warrant same-day clinical review. */
const URGENT = new Set([
  'Shortness of breath', 'Blurred vision', 'Severe headache', 'Bleeding',
  'Reduced movement', 'Fever', 'Abdominal pain', 'Contractions',
]);

/**
 * The child equivalent — WHO IMCI danger signs plus the two age-gated ones
 * the client escalates for a young baby. Kept here as well as in the client
 * so a guardian summary or a report, which never runs the client code, still
 * flags them.
 */
const URGENT_CHILD = new Set([
  'Not feeding', 'Vomiting everything', 'Convulsions', 'Unusually sleepy',
  'Fast or difficult breathing', 'Fewer wet nappies', 'Cord infection',
]);

const INTENSITY_WEIGHT = { mild: 5, mid: 10, high: 17, severe: 25 };

const toDTO = (r) => ({
  id: String(r.id),
  name: r.name,
  intensity: r.intensity,
  daysPresent: r.days_present,
  confirmedToday: r.confirmed_today,
  fromVoice: r.from_voice,
  loggedAt: r.logged_at,
  childId: r.child_id ? String(r.child_id) : null,
});

module.exports = {
  URGENT,
  URGENT_CHILD,

  /**
   * The mother's own symptoms.
   *
   * `child_id IS NULL` is the important half. The child's symptoms live in
   * this same table, and every caller of this function — her wellbeing score,
   * her risk flag on the clinician's caseload, the guardian summary, the PDF
   * report — is asking about her. A baby's nappy rash counted into her
   * wellbeing score would be a wrong number, not a generous one.
   */
  async all(userId) {
    const rows = await db.sql(
      `SELECT * FROM symptoms WHERE user_id = $1 AND child_id IS NULL
        ORDER BY days_present DESC, id ASC`,
      [userId],
    );
    return rows.map(toDTO);
  },

  /** The child's, by the same shape. */
  async forChild(childId) {
    const rows = await db.sql(
      'SELECT * FROM symptoms WHERE child_id = $1 ORDER BY days_present DESC, id ASC',
      [childId],
    );
    return rows.map(toDTO);
  },

  async create(userId, {
    name, intensity = 'mid', daysPresent = 1, confirmedToday = true, fromVoice = false,
    childId = null,
  }) {
    const label = String(name || '').trim();
    if (!label) throw new Error('A symptom name is required');
    if (label.length > 80) throw new Error('Symptom names must be 80 characters or fewer');
    const row = await db.insert(
      `INSERT INTO symptoms
         (user_id, name, intensity, days_present, confirmed_today, from_voice, logged_at, child_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [userId, label, intensity, daysPresent, confirmedToday, fromVoice,
        new Date().toISOString(), childId],
    );
    return toDTO(row);
  },

  async find(id) {
    const row = await db.one('SELECT * FROM symptoms WHERE id = $1', [id]);
    return row ? toDTO(row) : null;
  },

  /**
   * Whether this symptom is on this user's journal.
   *
   * The update and delete routes take an id from the URL and never checked
   * it belonged to the caller, so any signed-in account could edit or delete
   * a stranger's entry by guessing a number. The controllers now ask this
   * first.
   */
  async ownedBy(id, userId) {
    const row = await db.one(
      'SELECT id FROM symptoms WHERE id = $1 AND user_id = $2', [id, userId],
    );
    return Boolean(row);
  },

  /** COALESCE keeps the fields the caller did not send. */
  async update(id, { intensity, daysPresent, confirmedToday }) {
    const row = await db.one(
      `UPDATE symptoms SET
         intensity       = COALESCE($2, intensity),
         days_present    = COALESCE($3, days_present),
         confirmed_today = COALESCE($4, confirmed_today)
       WHERE id = $1 RETURNING *`,
      [id, intensity ?? null, daysPresent ?? null, confirmedToday ?? null],
    );
    return row ? toDTO(row) : null;
  },

  async remove(id) {
    await db.run('DELETE FROM symptoms WHERE id = $1', [id]);
  },

  /**
   * Replace the whole journal for a user — how the React logger saves.
   * One transaction, so a failure part-way cannot leave her with half a
   * journal and the other half deleted.
   */
  async replaceAll(userId, list) {
    if (list.length > 50) throw new Error('You can record at most 50 symptoms at once');
    await db.tx(async (t) => {
      // her own rows only — deleting the child's here would silently empty
      // the other list every time she saved this one
      await t.run('DELETE FROM symptoms WHERE user_id = $1 AND child_id IS NULL', [userId]);
      for (const s of list) {
        await t.run(
          `INSERT INTO symptoms
             (user_id, name, intensity, days_present, confirmed_today, from_voice, logged_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7)`,
          [userId, s.name, s.intensity || 'mid', s.daysPresent || 1,
            Boolean(s.confirmedToday), Boolean(s.fromVoice),
            s.loggedAt || new Date().toISOString()],
        );
      }
    });
    return this.all(userId);
  },

  /** The same, for one child. Scoped to the owner so a stray id writes nothing. */
  async replaceAllForChild(userId, childId, list) {
    if (list.length > 50) throw new Error('You can record at most 50 symptoms at once');
    await db.tx(async (t) => {
      await t.run('DELETE FROM symptoms WHERE user_id = $1 AND child_id = $2', [userId, childId]);
      for (const s of list) {
        await t.run(
          `INSERT INTO symptoms
             (user_id, name, intensity, days_present, confirmed_today, from_voice, logged_at, child_id)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
          [userId, s.name, s.intensity || 'mid', s.daysPresent || 1,
            Boolean(s.confirmedToday), Boolean(s.fromVoice),
            s.loggedAt || new Date().toISOString(), childId],
        );
      }
    });
    return this.forChild(childId);
  },

  /** Mark every symptom as needing a "still there?" check on the next entry. */
  async clearConfirmations(userId) {
    await db.run(
      'UPDATE symptoms SET confirmed_today = FALSE WHERE user_id = $1 AND child_id IS NULL',
      [userId],
    );
    return this.all(userId);
  },

  async clearChildConfirmations(childId) {
    await db.run('UPDATE symptoms SET confirmed_today = FALSE WHERE child_id = $1', [childId]);
    return this.forChild(childId);
  },

  /**
   * How heavily a journal weighs on the wellbeing score.
   *
   * Pure, taking the list rather than a user id, so a caller that already
   * holds the symptoms — the clinician caseload fetches everyone's in one
   * query — can score them without going back to the database per patient.
   */
  burdenOf(list) {
    return list.reduce((total, s) => {
      const persistence = Math.min(2, 1 + (s.daysPresent - 1) * 0.12);
      return total + (INTENSITY_WEIGHT[s.intensity] || 10) * persistence
        + (URGENT.has(s.name) ? 14 : 0);
    }, 0);
  },

  async burden(userId) {
    return this.burdenOf(await this.all(userId));
  },
};
