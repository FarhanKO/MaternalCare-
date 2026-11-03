/**
 * Creates (or resets) an admin account — the person who checks a new
 * clinician's licence before mothers can book them.
 *
 *   ADMIN_PASSWORD='a long password' npm run admin:create -- admin@example.org "Site Admin"
 *
 * The password comes from the environment, never the command line, so it is
 * not left in your shell history. Running it again for the same email resets
 * that admin's password and signs out their other sessions.
 */
const db = require('../config/db');
const authModel = require('../models/authModel');

(async () => {
  const [emailArg, ...nameParts] = process.argv.slice(2);
  const email = String(emailArg || '').trim().toLowerCase();
  const name = nameParts.join(' ').trim() || 'Admin';
  const password = process.env.ADMIN_PASSWORD || '';

  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    console.error('\n  Usage: ADMIN_PASSWORD=\'...\' npm run admin:create -- <email> "<name>"\n');
    process.exit(1);
  }

  let hash;
  try { hash = await authModel.hash(password); }
  catch (err) {
    console.error(`\n  ${err.message} (set ADMIN_PASSWORD)\n`);
    process.exit(1);
  }

  const existing = await db.one('SELECT id, role FROM users WHERE lower(email) = $1', [email]);
  if (existing && existing.role !== 'admin') {
    console.error(`\n  ${email} already belongs to a ${existing.role} account. Use another email.\n`);
    await db.pool.end();
    process.exit(1);
  }

  if (existing) {
    await db.run('UPDATE users SET password_hash = $2, name = $3 WHERE id = $1', [existing.id, hash, name]);
    await db.run('DELETE FROM sessions WHERE user_id = $1', [existing.id]);
    console.log(`\n  Admin ${email} updated; other sessions signed out.\n`);
  } else {
    await db.run(
      `INSERT INTO users (name, role, email, stage, password_hash) VALUES ($1, 'admin', $2, 'general', $3)`,
      [name, email, hash],
    );
    console.log(`\n  Admin ${email} created. Sign in at /signin to open /admin.\n`);
  }
  await db.pool.end();
})().catch(async (err) => {
  console.error(`\n  ${err.message}\n`);
  await db.pool.end().catch(() => {});
  process.exit(1);
});
