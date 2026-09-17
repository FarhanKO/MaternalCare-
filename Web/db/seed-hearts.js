/**
 * Demo likes — as rows, from accounts that exist.
 *
 * The seeded board used to carry a heart count typed into the post itself:
 * 33, 61, 73, 113. There are thirteen accounts in the whole system, so eight
 * of the nine posts claimed more likes than there are people to give them.
 *
 * This writes one row per person per post instead. The count on screen is then
 * the number of real accounts that liked it, and it cannot exceed the number of
 * accounts, because every like is a foreign key to somebody.
 *
 * Deterministic: the same accounts like the same posts on every run, so a demo
 * looks the same twice and the numbers do not drift between rehearsal and
 * presentation.
 *
 *   node db/seed-hearts.js
 */
const db = require('../config/db');

/** A small stable hash, so "who liked what" is fixed without storing a table. */
const pick = (postId, userId) => ((postId * 31 + userId * 17) % 100);

(async () => {
  const users = await db.sql("SELECT id, role FROM users WHERE role IN ('mother','clinician') ORDER BY id");
  const posts = await db.sql('SELECT id, user_id, author FROM posts WHERE hidden_at IS NULL ORDER BY id');

  if (!users.length || !posts.length) {
    console.log('nothing to seed — no users or no posts');
    await db.pool.end();
    return;
  }

  await db.run('DELETE FROM post_hearts');

  let written = 0;
  for (const post of posts) {
    for (const user of users) {
      // nobody likes their own post, and the threshold varies per post so the
      // board does not show the same number on every card
      if (String(post.user_id) === String(user.id)) continue;
      const threshold = 35 + ((post.id * 13) % 40);   // 35–74
      if (pick(post.id, user.id) < threshold) {
        await db.run(
          `INSERT INTO post_hearts (post_id, user_id) VALUES ($1, $2)
           ON CONFLICT (post_id, user_id) DO NOTHING`,
          [post.id, user.id],
        );
        written += 1;
      }
    }
  }

  const rows = await db.sql(`
    SELECT p.id, p.author,
           (SELECT COUNT(*)::int FROM post_hearts h WHERE h.post_id = p.id) AS hearts
      FROM posts p WHERE p.hidden_at IS NULL ORDER BY p.id`);

  console.log(`${written} likes written, from ${users.length} accounts\n`);
  console.log('post  likes  (of a possible ' + (users.length - 1) + ')  author');
  for (const r of rows) console.log(`  ${String(r.id).padStart(2)}   ${String(r.hearts).padStart(3)}                     ${r.author}`);

  const max = Math.max(...rows.map((r) => r.hearts));
  console.log(`\nhighest count is ${max}; there are ${users.length} accounts, so every like is a real person.`);
  await db.pool.end();
})().catch(async (e) => {
  console.error('failed:', e.message);
  try { await db.pool.end(); } catch { /* noop */ }
  process.exit(1);
});
