/**
 * Push Model — reaching her device when the application is closed.
 *
 * Reminders lived inside the app: on the dashboard, and in the bell, while
 * the tab was open. A reminder for a tablet at nine is not much use if it can
 * only be seen by someone already looking. This is the other half — a
 * subscription per device that has agreed, and a scheduler that sends each
 * reminder as it falls due.
 *
 * How a push message travels: this server encrypts the payload with keys
 * the browser minted (p256dh + auth) and posts it to the push service the
 * browser named (Google's, Mozilla's, Apple's). The service cannot read it;
 * it wakes the service worker on the device, which decrypts it and shows the
 * notification. The web-push library does the encryption and the VAPID
 * signature that proves the message came from this server.
 *
 * What is sent is small on purpose: the reminder's title and note, when it
 * was due as an ISO timestamp, and where to open. The service worker
 * formats the time in the device's own zone — the server does not know it.
 */
const db = require('../config/db');
const vapid = require('../config/vapid');

const { webPush } = vapid;

/** How far behind now() a due occurrence is still worth sending. */
const CATCH_UP = '30 minutes';
/** Push services keep an undelivered message this long before dropping it. */
const TTL_SECONDS = 60 * 60;
/** How often the scheduler looks. */
const EVERY_MS = 60 * 1000;

const toDTO = (r) => ({
  id: String(r.id),
  endpoint: r.endpoint,
  device: r.user_agent || null,
  createdAt: r.created_at,
  lastUsedAt: r.last_used_at,
});

module.exports = {
  publicKey: vapid.publicKey,
  EVERY_MS,

  /* ------------------------------------------------------ subscriptions */

  /**
   * Record a device. The endpoint is unique per browser profile, so a device
   * that subscribes twice — after a reinstall, say — updates its row rather
   * than doubling every notification.
   */
  async subscribe(userId, subscription, userAgent) {
    const endpoint = String(subscription?.endpoint || '');
    const p256dh = String(subscription?.keys?.p256dh || '');
    const auth = String(subscription?.keys?.auth || '');
    if (!/^https:\/\//.test(endpoint) || endpoint.length > 2000 || !p256dh || !auth) {
      const err = new Error('That is not a push subscription'); err.code = 'BAD_SUBSCRIPTION'; throw err;
    }
    const row = await db.one(
      `INSERT INTO push_subscriptions (user_id, endpoint, p256dh, auth, user_agent)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (endpoint) DO UPDATE
         SET user_id = EXCLUDED.user_id, p256dh = EXCLUDED.p256dh,
             auth = EXCLUDED.auth, user_agent = EXCLUDED.user_agent
       RETURNING *`,
      [userId, endpoint, p256dh, auth, String(userAgent || '').slice(0, 300) || null],
    );
    return toDTO(row);
  },

  /** Scoped to the owner: another account's endpoint deletes nothing. */
  async unsubscribe(userId, endpoint) {
    return db.run(
      'DELETE FROM push_subscriptions WHERE user_id = $1 AND endpoint = $2',
      [userId, String(endpoint || '')],
    );
  },

  async subscriptionsFor(userId) {
    const rows = await db.sql(
      'SELECT * FROM push_subscriptions WHERE user_id = $1 ORDER BY created_at', [userId],
    );
    return rows.map(toDTO);
  },

  /** Is this exact endpoint on record for this account? The client asks on load. */
  async has(userId, endpoint) {
    return Boolean(await db.one(
      'SELECT 1 FROM push_subscriptions WHERE user_id = $1 AND endpoint = $2',
      [userId, String(endpoint || '')],
    ));
  },

  /* ------------------------------------------------------------ sending */

  /**
   * Send one payload to every device on an account.
   *
   * A 404 or 410 from the push service means the browser has unsubscribed —
   * she turned it off, cleared the site, or the browser was uninstalled —
   * and the row is removed so the next send does not try again. Any other
   * failure is logged and the row kept: the service being briefly down is
   * not a reason to forget her phone.
   */
  async sendToUser(userId, payload) {
    const rows = await db.sql('SELECT * FROM push_subscriptions WHERE user_id = $1', [userId]);
    let delivered = 0;
    for (const row of rows) {
      const ok = await this.sendToSubscription(row, payload);
      if (ok) delivered += 1;
    }
    return { devices: rows.length, delivered };
  },

  async sendToSubscription(row, payload) {
    const subscription = { endpoint: row.endpoint, keys: { p256dh: row.p256dh, auth: row.auth } };
    try {
      await webPush.sendNotification(subscription, JSON.stringify(payload), {
        TTL: TTL_SECONDS,
        urgency: 'high',
      });
      await db.run('UPDATE push_subscriptions SET last_used_at = now() WHERE id = $1', [row.id]);
      return true;
    } catch (err) {
      if (err.statusCode === 404 || err.statusCode === 410) {
        await db.run('DELETE FROM push_subscriptions WHERE id = $1', [row.id]);
        console.log(`  [push] subscription #${row.id} gone (${err.statusCode}), removed`);
      } else {
        console.error(`  [push] send to #${row.id} failed: ${err.statusCode || ''} ${err.message}`);
      }
      return false;
    }
  },

  /* --------------------------------------------------------- reminders */

  /**
   * Every reminder occurrence that has fallen due and has not been sent.
   *
   * "Occurrence" is what makes a repeating reminder work: a daily tablet
   * set once for 9:00 is due again at 9:00 every day after, so the latest
   * occurrence at or before now is computed from how many whole periods have
   * passed since due_at. Only accounts with at least one device are
   * considered — no point computing a schedule nobody can receive.
   *
   * The window is (now − CATCH_UP, now]: a scheduler that was down for
   * ten minutes still sends what fell due meanwhile, but one down since
   * yesterday does not fire a day of stale reminders at once.
   */
  async due() {
    return db.sql(
      `WITH occ AS (
         SELECT r.id, r.user_id, r.kind, r.title, r.note, r.repeat,
                /* truncated to the millisecond: the occurrence goes out to
                   JavaScript as a Date and comes back to claim the row, and a
                   Date cannot carry the microseconds Postgres keeps — left
                   as they were, the claim never matched and every occurrence
                   was sent again each minute until the window closed */
                date_trunc('milliseconds', CASE r.repeat
                  WHEN 'daily'  THEN r.due_at + (floor(extract(epoch FROM (now() - r.due_at)) / 86400)  * interval '1 day')
                  WHEN 'weekly' THEN r.due_at + (floor(extract(epoch FROM (now() - r.due_at)) / 604800) * interval '1 week')
                  ELSE r.due_at
                END) AS occurrence_at
           FROM reminders r
          WHERE r.due_at <= now()
            AND EXISTS (SELECT 1 FROM push_subscriptions s WHERE s.user_id = r.user_id)
       )
       SELECT o.*
         FROM occ o
        WHERE o.occurrence_at > now() - $1::interval
          AND o.occurrence_at <= now()
          AND NOT EXISTS (SELECT 1 FROM reminder_pushes p
                           WHERE p.reminder_id = o.id AND p.occurrence_at = o.occurrence_at)
        ORDER BY o.occurrence_at`,
      [CATCH_UP],
    );
  },

  /** What a reminder looks like on the lock screen. */
  payloadFor(r) {
    const KIND_WORD = {
      medicine: 'Time for your medicine', doctor: 'Appointment', test: 'Test due',
      exercise: 'Time to move', vaccination: 'Vaccination due',
    };
    return {
      title: r.title,
      body: r.note || KIND_WORD[r.kind] || 'Reminder',
      kind: r.kind,
      at: new Date(r.occurrence_at).toISOString(),
      tag: `reminder-${r.id}-${new Date(r.occurrence_at).getTime()}`,
      url: '/mother?tab=reminders',
    };
  },

  /**
   * One pass: send everything due, and record it as sent whether or not a
   * device accepted it — the row marks the occurrence as handled, so a phone
   * that was off does not get yesterday's tablet at breakfast.
   */
  async deliverDue() {
    const rows = await this.due();
    let sent = 0;
    for (const r of rows) {
      // claim the occurrence first; two schedulers (or one restarted mid-pass)
      // then cannot both send it
      const claimed = await db.run(
        `INSERT INTO reminder_pushes (reminder_id, occurrence_at) VALUES ($1, $2)
         ON CONFLICT DO NOTHING`,
        [r.id, r.occurrence_at],
      );
      if (!claimed) continue;
      const { delivered } = await this.sendToUser(r.user_id, this.payloadFor(r));
      await db.run(
        'UPDATE reminder_pushes SET devices = $3 WHERE reminder_id = $1 AND occurrence_at = $2',
        [r.id, r.occurrence_at, delivered],
      );
      sent += 1;
    }
    return { due: rows.length, sent };
  },

  /**
   * The scheduler. Runs a pass now and every minute after; never throws out
   * of the interval — a database hiccup is logged and the next minute tries
   * again. `unref()` so it never keeps the process alive on its own.
   */
  start() {
    const pass = async () => {
      try {
        const { sent } = await this.deliverDue();
        if (sent) console.log(`  [push] ${sent} reminder(s) sent`);
      } catch (err) {
        console.error('  [push] scheduler pass failed:', err.message);
      }
    };
    pass();
    const timer = setInterval(pass, EVERY_MS);
    timer.unref();
    return timer;
  },
};
