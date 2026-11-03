/**
 * Password reset by email.
 *
 * The link carries a random 32-byte token; only its SHA-256 hash is stored,
 * it works once, and it expires after an hour. Asking for a reset answers the
 * same way whether or not the address has an account, so the form cannot be
 * used to find out who is a patient here.
 */
const { randomBytes } = require('crypto');
const db = require('../config/db');
const authModel = require('./authModel');
const mail = require('../config/mail');

const TTL_MINUTES = 60;

const escapeHtml = (s) => String(s).replace(/[&<>"']/g, (c) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
}[c]));

class ResetError extends Error {
  constructor(message, code) { super(message); this.code = code; }
}

module.exports = {
  ResetError,
  TTL_MINUTES,

  /**
   * Start a reset. Resolves the same way for unknown addresses.
   * @param {string} email
   * @param {string} baseUrl  the site's own origin, e.g. https://maternalcare.example
   */
  async request(email, baseUrl) {
    const address = String(email || '').trim().toLowerCase();
    if (!address || address.length > 254) return;
    const user = await db.one(
      'SELECT id, name, email FROM users WHERE lower(email) = $1 AND deleted_at IS NULL',
      [address],
    );
    if (!user) return;

    const token = randomBytes(32).toString('base64url');
    await db.tx(async (t) => {
      // only the newest link works
      await t.run('UPDATE password_resets SET used_at = now() WHERE user_id = $1 AND used_at IS NULL', [user.id]);
      await t.run(
        `INSERT INTO password_resets (user_id, token_hash, expires_at)
         VALUES ($1, $2, now() + ($3 || ' minutes')::interval)`,
        [user.id, authModel.sessionKey(token), String(TTL_MINUTES)],
      );
    });

    const link = `${baseUrl.replace(/\/+$/, '')}/reset-password?token=${encodeURIComponent(token)}`;
    const first = (user.name || '').split(' ')[0] || 'there';
    await mail.send({
      to: user.email,
      subject: 'Reset your MaternalCare+ password',
      text: `Hi ${first},\n\nSomeone (hopefully you) asked to reset the password for your MaternalCare+ account.\n\nChoose a new password here — the link works once, for ${TTL_MINUTES} minutes:\n${link}\n\nIf you did not ask for this, ignore this email; your password stays the same.\n`,
      html: `<p>Hi ${escapeHtml(first)},</p><p>Someone (hopefully you) asked to reset the password for your MaternalCare+ account.</p><p><a href="${escapeHtml(link)}">Choose a new password</a> — the link works once, for ${TTL_MINUTES} minutes.</p><p>If you did not ask for this, ignore this email; your password stays the same.</p>`,
      devNote: `reset link: ${link}`,
    });
  },

  /** Is this token still usable? For the reset page, before she types anything. */
  async check(token) {
    const row = await this.find(token);
    return Boolean(row);
  },

  async find(token) {
    if (typeof token !== 'string' || token.length < 20 || token.length > 100) return null;
    return db.one(
      `SELECT * FROM password_resets
        WHERE token_hash = $1 AND used_at IS NULL AND expires_at > now()`,
      [authModel.sessionKey(token)],
    );
  },

  /** Set the new password, spend the token, sign out every device. */
  async confirm(token, password) {
    const row = await this.find(token);
    if (!row) throw new ResetError('This reset link has expired or was already used. Ask for a new one.', 'BAD_TOKEN');
    await authModel.setPassword(row.user_id, password); // throws AuthError when too weak
    await db.run('UPDATE password_resets SET used_at = now() WHERE user_id = $1 AND used_at IS NULL', [row.user_id]);
    return row.user_id;
  },
};
