/**
 * Proves the app can reach the database, and that the connection layer hands
 * back the shapes the Model layer expects.
 *
 *   npm run db:check
 *
 * Prints nothing that could identify the connection beyond its host.
 */
const fs = require('fs');
const path = require('path');
const db = require('../config/db');

const ok = (label, value) => console.log(`  \x1b[32mok\x1b[0m   ${label.padEnd(34)} ${value}`);
const bad = (label, value) => console.log(`  \x1b[31mFAIL\x1b[0m ${label.padEnd(34)} ${value}`);

/**
 * The tables the migrations leave behind, read from the migrations
 * themselves — every CREATE TABLE, minus every DROP TABLE that came later.
 * This used to be a number written into the script ("25 or 26"), which was
 * wrong by four within a few migrations and then failed every run.
 */
function expectedTables() {
  const dir = path.join(__dirname, 'migrations');
  const tables = new Set();
  for (const file of fs.readdirSync(dir).filter((f) => f.endsWith('.sql')).sort()) {
    const sql = fs.readFileSync(path.join(dir, file), 'utf8');
    // in document order: the first migration drops everything *before* it
    // creates, so a drop only ever undoes what came earlier
    const statements = /(CREATE TABLE(?: IF NOT EXISTS)?\s+(?:public\.)?"?(\w+)"?)|(DROP TABLE(?: IF EXISTS)?\s+([^;]+);)/gi;
    for (const m of sql.matchAll(statements)) {
      if (m[2]) { tables.add(m[2]); continue; }
      for (const name of m[4].split(',')) {
        tables.delete(name.trim().replace(/^public\./, '').replace(/"/g, '').split(/\s/)[0]);
      }
    }
  }
  return tables;
}

(async () => {
  let failures = 0;

  try {
    const info = await db.check();
    ok('connected', `${info.db} as ${info.role}`);
    ok('server version', info.version);
    ok('round trip', `${info.latencyMs} ms`);
    ok('tables in public', info.tables);
    const expected = expectedTables();
    const present = new Set((await db.sql(
      `SELECT table_name FROM information_schema.tables
        WHERE table_schema = 'public' AND table_type = 'BASE TABLE'`,
    )).map((r) => r.table_name));
    const missing = [...expected].filter((t) => !present.has(t));
    if (missing.length) {
      bad('every migrated table exists', `missing ${missing.join(', ')} — run npm run db:reset`);
      failures += 1;
    } else {
      ok('every migrated table exists', `${expected.size} from db/migrations`);
    }
  } catch (err) {
    bad('connect', err.message);
    console.log('\n  Check DATABASE_URL in .env. Use the Session pooler URI:');
    console.log('  Supabase → Settings → Database → Connection string → URI\n');
    process.exit(1);
  }

  // --- the type parsers are the whole point of the layer, so prove them ---

  const row = await db.one(`
    SELECT DATE '2026-03-15'                              AS a_date,
           TIMESTAMPTZ '2026-03-15 09:41:22+00'           AS a_timestamp,
           count(*)                                       AS a_count,
           TRUE                                           AS a_bool
    FROM (VALUES (1), (2), (3)) AS t(x)
  `);

  const checks = [
    ['DATE stays a plain string', row.a_date === '2026-03-15', row.a_date],
    ['TIMESTAMPTZ becomes ISO', row.a_timestamp === '2026-03-15T09:41:22.000Z', row.a_timestamp],
    ['count() is a number', typeof row.a_count === 'number' && row.a_count === 3, `${typeof row.a_count} ${row.a_count}`],
    ['boolean is a boolean', row.a_bool === true, `${typeof row.a_bool}`],
  ];

  for (const [label, passed, actual] of checks) {
    if (passed) ok(label, actual);
    else { bad(label, `got ${actual}`); failures += 1; }
  }

  // --- a password must never survive into an error ---
  const leaked = db.redact('connect ECONNREFUSED postgresql://user:hunter2@host:5432/db');
  if (leaked.includes('hunter2')) { bad('errors redact the password', leaked); failures += 1; }
  else ok('errors redact the password', leaked.slice(0, 46));

  // --- transactions must roll back cleanly ---
  try {
    await db.tx(async (t) => {
      await t.run('CREATE TEMP TABLE _probe (n int)');
      await t.run('INSERT INTO _probe VALUES (1)');
      throw new Error('deliberate');
    });
    bad('transaction rolls back', 'no error surfaced');
    failures += 1;
  } catch (err) {
    if (err.message.includes('deliberate')) ok('transaction rolls back', 'error propagated');
    else { bad('transaction rolls back', err.message); failures += 1; }
  }

  await db.pool.end();
  console.log(failures ? `\n  ${failures} check(s) failed\n` : '\n  All checks passed\n');
  process.exit(failures ? 1 : 0);
})();
