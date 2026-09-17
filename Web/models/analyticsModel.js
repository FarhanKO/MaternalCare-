/**
 * Practice analytics — counted from the tables, never asserted.
 *
 * The clinician's insights tab drew four charts from fixtures in
 * `frontend/src/data/doctor.ts`:
 *
 *   trimester split   claimed 9 / 17 / 12 — thirty-eight pregnancies against
 *                     six that exist
 *   clinic week       claimed 61 seen against 69 booked across Mon–Sat, on a
 *                     database holding fourteen appointments in total
 *   screening         claimed 82%, 94%, 68%, 100%, 76% completion for items
 *                     the application does not track
 *   outcomes          claimed a hundred and twenty term and fourteen preterm
 *                     births — and there is no births table at all
 *
 * The first three are computable, so they are computed here. The fourth is
 * not, and no amount of care in this file could make it so: it was removed
 * from the screen rather than estimated, because a birth outcome a clinician
 * reads as real and which nobody recorded is the worst thing that could be on
 * the page.
 *
 * Every figure below is scoped to one doctor's own caseload.
 */
const db = require('../config/db');

/** Mon–Sat labels, matching the bar chart the clinic week feeds. */
const DAY_LABEL = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/**
 * Whose caseload a mother is on.
 *
 * There is no doctor column on `users` — the relationship lives in the
 * appointments table, which is what `patientModel.allForDoctor` reads too.
 * Written once here so the three queries below cannot drift from it.
 */
const ON_CASELOAD = `
  EXISTS (
    SELECT 1 FROM appointments a
     WHERE a.user_id = u.id AND a.doctor_id = $1
       AND a.status IN ('requested', 'accepted', 'completed')
  )`;

module.exports = {
  /**
   * How her week actually looked: booked against seen, by day.
   *
   * "Booked" is every appointment placed on that day whatever became of it;
   * "seen" is the ones marked completed. A cancelled appointment stays in the
   * booked bar on purpose — a day where half the list cancelled is a fact
   * about the week, and hiding it would flatter the chart.
   */
  async clinicWeek(doctorId) {
    const rows = await db.sql(
      `SELECT EXTRACT(DOW FROM date)::int AS dow,
              COUNT(*)::int                AS booked,
              COUNT(*) FILTER (WHERE status = 'completed')::int AS seen
         FROM appointments
        WHERE doctor_id = $1
          AND date >= date_trunc('week', CURRENT_DATE)::date
          AND date <  (date_trunc('week', CURRENT_DATE) + INTERVAL '7 days')::date
        GROUP BY 1`,
      [doctorId],
    );

    const byDow = new Map(rows.map((r) => [r.dow, r]));
    // Monday to Saturday, because Sunday is not a clinic day here
    return [1, 2, 3, 4, 5, 6].map((dow) => ({
      d: DAY_LABEL[dow],
      booked: byDow.get(dow)?.booked ?? 0,
      seen: byDow.get(dow)?.seen ?? 0,
    }));
  },

  /**
   * Her caseload by trimester, from each mother's own last menstrual period.
   *
   * Boundaries are the usual ones: up to 13 weeks, 14–27, 28 onwards. A
   * pregnancy past 42 weeks is left in the third rather than dropped, since
   * the row existing at all is what matters to the person reading this.
   */
  async trimesterSplit(doctorId) {
    const row = await db.one(
      `SELECT
         COUNT(*) FILTER (WHERE wk <= 13)             ::int AS first,
         COUNT(*) FILTER (WHERE wk > 13 AND wk < 28)  ::int AS second,
         COUNT(*) FILTER (WHERE wk >= 28)             ::int AS third
       FROM (
         SELECT FLOOR((CURRENT_DATE - p.lmp) / 7.0) AS wk
           FROM pregnancies p
           JOIN users u ON u.id = p.user_id
          WHERE u.role = 'mother' AND ${ON_CASELOAD}
       ) q`,
      [doctorId],
    );
    return {
      first: row?.first ?? 0,
      second: row?.second ?? 0,
      third: row?.third ?? 0,
      total: (row?.first ?? 0) + (row?.second ?? 0) + (row?.third ?? 0),
    };
  },

  /**
   * Vaccination coverage across her caseload, by dose.
   *
   * This replaces a "screening" chart that quoted completion rates for an
   * anomaly scan and a glucose screening — neither of which the application
   * records anywhere, so neither of which could have had a rate. Vaccinations
   * do have one, because every dose carries a status a mother sets herself.
   */
  async vaccineCoverage(doctorId) {
    const rows = await db.sql(
      `SELECT v.name,
              COUNT(*)::int AS total,
              COUNT(*) FILTER (WHERE v.status = 'done')::int AS done
         FROM vaccinations v
         JOIN users u ON u.id = v.user_id
        WHERE u.role = 'mother' AND ${ON_CASELOAD}
        GROUP BY v.name
        HAVING COUNT(*) > 0
        ORDER BY COUNT(*) DESC, v.name ASC
        LIMIT 6`,
      [doctorId],
    );
    return rows.map((r) => ({
      name: r.name,
      done: r.total ? Math.round((r.done / r.total) * 100) : 0,
      /* the denominator travels with the percentage — "100%" of one dose and
         "100%" of forty are different facts and should not look the same */
      of: r.total,
    }));
  },

  /** Everything the insights tab needs, in one round trip. */
  async forDoctor(doctorId) {
    const [clinicWeek, trimesters, vaccineCoverage] = await Promise.all([
      this.clinicWeek(doctorId),
      this.trimesterSplit(doctorId),
      this.vaccineCoverage(doctorId),
    ]);
    return { clinicWeek, trimesters, vaccineCoverage };
  },
};
