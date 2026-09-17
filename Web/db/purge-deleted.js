/**
 * Destroy the accounts whose seven days are up.
 *
 * The deletion screen tells a mother her records are kept for seven more days
 * and then removed. This is the code that removes them. If it never runs, the
 * screen is lying — so it runs two ways:
 *
 *   * automatically, from app.js, on boot and once a day while the server is
 *     up (see sweepDeletedAccounts there);
 *   * by hand or from a scheduler, with `npm run db:purge`, which is what to
 *     use on a host that restarts rarely or sleeps.
 *
 * Safe to run as often as you like: it only touches rows whose `purge_after`
 * has already passed.
 *
 *   node db/purge-deleted.js            destroy what is due
 *   node db/purge-deleted.js --dry-run  list it without touching anything
 */
const db = require('../config/db');
const accountModel = require('../models/accountModel');

const dryRun = process.argv.includes('--dry-run');

(async () => {
  const pending = await accountModel.pending();

  if (!pending.length) {
    console.log('Nothing scheduled for deletion.');
    await db.pool.end();
    return;
  }

  console.log(`${pending.length} account(s) scheduled:`);
  for (const p of pending) {
    const when = String(p.purge_after).slice(0, 16).replace('T', ' ');
    console.log(`   #${p.id}  ${p.role.padEnd(10)} purge after ${when}  `
      + (p.days_left > 0 ? `${p.days_left} day(s) left` : 'DUE NOW'));
  }

  if (dryRun) {
    console.log('\n--dry-run: nothing was deleted.');
    await db.pool.end();
    return;
  }

  const result = await accountModel.purgeDue();
  if (!result.purged) {
    console.log('\nNone are due yet.');
  } else {
    console.log(`\nPurged ${result.purged} account(s):`);
    for (const a of result.accounts) {
      console.log(`   #${a.id}  ${a.role}  — ${a.posts} post(s), ${a.comments} comment(s), `
        + `${a.files} file(s) removed; every other table cascaded.`);
    }
  }

  await db.pool.end();
})().catch(async (e) => {
  console.error('purge failed:', e.message);
  try { await db.pool.end(); } catch { /* noop */ }
  process.exit(1);
});
