/**
 * Account deletion — the request, the export, and the purge.
 *
 * Deletion here is a two-stage thing. Confirming it locks the account out
 * immediately and schedules the data for destruction seven days later; the
 * sweep then destroys it. Both halves live in this file so the promise made
 * on screen and the code that keeps it cannot drift apart.
 *
 * The seven days are not a grace period for changing her mind — there is no
 * undelete, and the screen does not offer one. They exist because this holds
 * a maternity record: if an account goes during a clinical episode, a care
 * team and an auditor need somewhere to look before it stops existing.
 */
const fs = require('fs');
const path = require('path');
const db = require('../config/db');

/** How long the rows survive after she confirms. */
const GRACE_DAYS = 7;

const UPLOAD_DIR = path.join(__dirname, '..', 'data', 'uploads');

/**
 * Everything of hers, as one object.
 *
 * Offered before deleting so that "delete everything" is not the same as
 * "lose everything". Documents are listed rather than embedded — the bytes
 * are files, and a JSON export with several megabytes of base64 in it is not
 * a thing anyone can open.
 */
async function exportFor(userId) {
  const one = (sql, args = [userId]) => db.one(sql, args);
  const many = (sql, args = [userId]) => db.sql(sql, args);

  const [
    user, pregnancy, children, vitals, dailyLogs, symptoms, reminders,
    appointments, vaccinations, documents, posts, comments, contacts, growth,
  ] = await Promise.all([
    one(`SELECT id, name, email, phone, role, stage, age, blood_group, conditions,
                bio, language, last_login_at
           FROM users WHERE id = $1`),
    one('SELECT lmp, height_cm, pre_weight_kg FROM pregnancies WHERE user_id = $1'),
    many('SELECT id, name, dob, gender, feeding, delivery FROM children WHERE user_id = $1'),
    many('SELECT date, systolic, diastolic, sugar, weight_kg, temp_c, fetal_bpm FROM vitals WHERE user_id = $1 ORDER BY date'),
    many('SELECT date, mood, kicks, water_litres, sleep_hours FROM daily_logs WHERE user_id = $1 ORDER BY date'),
    many('SELECT name, intensity, days_present, logged_at, child_id FROM symptoms WHERE user_id = $1'),
    many('SELECT kind, title, note, due_at, repeat FROM reminders WHERE user_id = $1 ORDER BY due_at'),
    many('SELECT date, time, reason, status, fee_bdt, plan FROM appointments WHERE user_id = $1 ORDER BY date'),
    many('SELECT subject, name, dose, due_date, status, completed_on FROM vaccinations WHERE user_id = $1'),
    many('SELECT title, kind, original_name, mime, size, taken_on FROM documents WHERE user_id = $1'),
    many('SELECT title, body, topic, created_at FROM posts WHERE user_id = $1 ORDER BY created_at'),
    many('SELECT body, created_at FROM post_comments WHERE user_id = $1 ORDER BY created_at'),
    many('SELECT name, relation, phone FROM emergency_contacts WHERE user_id = $1'),
    many(`SELECT g.date, g.age_months, g.weight_kg, g.height_cm, g.head_cm
            FROM growth_records g JOIN children c ON c.id = g.child_id
           WHERE c.user_id = $1 ORDER BY g.age_months`),
  ]);

  return {
    exportedAt: new Date().toISOString(),
    note: 'Every record MaternalCare+ holds for this account. Documents are '
      + 'listed by name; the files themselves are downloaded separately.',
    account: user,
    pregnancy,
    children,
    growthRecords: growth,
    vitals,
    dailyLogs,
    symptoms,
    reminders,
    appointments,
    vaccinations,
    documents,
    communityPosts: posts,
    communityComments: comments,
    emergencyContacts: contacts,
  };
}

module.exports = {
  GRACE_DAYS,
  exportFor,

  /** Whether this account is in its window, and when it goes. */
  async deletionState(userId) {
    const u = await db.one(
      'SELECT deleted_at, purge_after FROM users WHERE id = $1', [userId],
    );
    if (!u?.deleted_at) return null;
    return { deletedAt: u.deleted_at, purgeAfter: u.purge_after };
  },

  /**
   * Mark the account deleted and schedule the purge.
   *
   * Every session is dropped in the same transaction, so she is signed out
   * everywhere the moment she confirms rather than staying live on whatever
   * other device happens to be open.
   */
  async requestDeletion(userId, { role, reason, feedback }) {
    const why = String(reason || '').trim() || 'unspecified';
    const words = String(feedback || '').trim().slice(0, 2000) || null;

    return db.tx(async (t) => {
      const existing = await t.one(
        'SELECT deleted_at FROM users WHERE id = $1', [userId],
      );
      if (!existing) throw new Error('That account no longer exists');
      if (existing.deleted_at) throw new Error('This account is already scheduled for deletion');

      const row = await t.one(
        `UPDATE users
            SET deleted_at  = now(),
                purge_after = now() + ($2 || ' days')::interval
          WHERE id = $1
        RETURNING deleted_at, purge_after`,
        [userId, GRACE_DAYS],
      );

      await t.run(
        `INSERT INTO account_deletions (user_id, role, reason, feedback, purge_after)
         VALUES ($1, $2, $3, $4, $5)`,
        [userId, role || 'mother', why, words, row.purge_after],
      );

      // signed out everywhere, immediately — and no more notifications: a
      // reminder arriving on the phone of someone who has just deleted her
      // account is the opposite of what she asked for
      await t.run('DELETE FROM sessions WHERE user_id = $1', [userId]);
      await t.run('DELETE FROM push_subscriptions WHERE user_id = $1', [userId]);

      return { deletedAt: row.deleted_at, purgeAfter: row.purge_after };
    });
  },

  /**
   * Destroy everything belonging to accounts whose window has closed.
   *
   * Most tables cascade from `users.id`, but four do not — posts,
   * post_comments, content_reports and doctors are all ON DELETE SET NULL.
   * Left alone, deleting the user would strip the link and leave her display
   * name and her words sitting on the public board for ever. Those are
   * removed by hand first, and her uploaded files are unlinked from disk,
   * because a row disappearing does not delete a JPEG.
   *
   * Returns what it destroyed, so the caller can say so rather than guess.
   */
  async purgeDue({ now = new Date() } = {}) {
    const due = await db.sql(
      `SELECT id, role FROM users
        WHERE purge_after IS NOT NULL AND purge_after <= $1`,
      [now.toISOString()],
    );
    if (!due.length) return { purged: 0, accounts: [] };

    const done = [];
    for (const u of due) {
      /*
       * The files first. They are named in the database, so once the rows go
       * there is nothing left to say which JPEGs on disk were hers.
       */
      const files = await db.sql(
        'SELECT file_name FROM documents WHERE user_id = $1', [u.id],
      );
      const images = await db.sql(
        'SELECT image_file FROM posts WHERE user_id = $1 AND image_file IS NOT NULL', [u.id],
      );
      const avatar = await db.one('SELECT avatar_file FROM users WHERE id = $1', [u.id]);

      let unlinked = 0;
      for (const name of [
        ...files.map((f) => f.file_name),
        ...images.map((i) => i.image_file),
        avatar?.avatar_file,
      ].filter(Boolean)) {
        try {
          const full = path.join(UPLOAD_DIR, name);
          if (fs.existsSync(full)) { fs.unlinkSync(full); unlinked += 1; }
        } catch { /* a file already gone is the state we wanted */ }
      }

      const counts = await db.tx(async (t) => {
        // the four that would otherwise only be unlinked
        const posts = await t.sql('DELETE FROM posts WHERE user_id = $1 RETURNING id', [u.id]);
        const comments = await t.sql('DELETE FROM post_comments WHERE user_id = $1 RETURNING id', [u.id]);
        await t.run('DELETE FROM content_reports WHERE reporter_id = $1', [u.id]);
        await t.run('DELETE FROM doctors WHERE user_id = $1', [u.id]);

        /*
         * The deletion record outlives the account, so sever the link before
         * the row goes rather than relying on SET NULL — and stamp it, so the
         * sweep can prove it ran.
         */
        await t.run(
          `UPDATE account_deletions
              SET user_id = NULL, purged_at = now()
            WHERE user_id = $1`,
          [u.id],
        );

        // everything else cascades from here
        await t.run('DELETE FROM users WHERE id = $1', [u.id]);
        return { posts: posts.length, comments: comments.length };
      });

      done.push({ id: u.id, role: u.role, files: unlinked, ...counts });
    }

    return { purged: done.length, accounts: done };
  },

  /** What is still waiting, for a status line or a report. */
  async pending() {
    return db.sql(
      `SELECT id, role, purge_after,
              GREATEST(0, CEIL(EXTRACT(EPOCH FROM (purge_after - now())) / 86400))::int AS days_left
         FROM users
        WHERE purge_after IS NOT NULL
        ORDER BY purge_after`,
    );
  },
};
