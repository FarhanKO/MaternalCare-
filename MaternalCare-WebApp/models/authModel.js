/**
 * Auth Model — password hashing and server-side sessions.
 *
 * Replaces the demo shim in `userModel.current()`, which returned the first
 * mother by id: every request was that woman, /doctor was reachable by anyone
 * who typed it, and GET /api/patients/2 handed a patient record to a stranger.
 *
 * Hashing is scrypt from Node's own crypto, at OWASP's recommended minimum
 * (N=2^17, r=8, p=1). No native dependency, no build step, and about 200 ms per
 * verification — slow enough that a stolen table is expensive to attack, fast
 * enough that nobody notices signing in.
 *
 * Nothing in this file stores, returns or logs a password. `verify` takes one
 * and gives back a boolean; the plaintext never leaves the function.
 *
 * Sessions get the same treatment. The cookie carries a random 256-bit
 * token; the table holds its SHA-256. A copy of the sessions table — a
 * backup left somewhere, a read-only injection — used to be a set of working
 * logins, and now is a set of hashes that unlock nothing. The lookup is one
 * hash per request, which is nothing next to the query it precedes.
 *
 * A session also ends when it goes unused. Fourteen days is the outer wall;
 * inside it, a mother who has not opened the app for a week signs in again,
 * and a clinician who has not for twelve hours does — a caseload on a
 * clinic machine is not a thing to leave open overnight.
 */
const {
  randomBytes, scrypt, timingSafeEqual, createHash,
} = require('crypto');
const { promisify } = require('util');
const db = require('../config/db');

const scryptAsync = promisify(scrypt);

/**
 * Cost parameters, written into every hash so they can be raised later without
 * stranding accounts created at the old cost.
 */
const PARAMS = { N: 131072, r: 8, p: 1 };
const KEY_LEN = 64;
/* scrypt needs roughly 128*N*r bytes; Node's default cap is below that at
   these parameters, so it is stated explicitly rather than left to fail */
const maxmem = () => 256 * PARAMS.N * PARAMS.r * PARAMS.p * 2;

const SESSION_DAYS = 14;
/** Idle limits by role, as Postgres intervals. `default` is everyone else. */
const SESSION_IDLE = { clinician: '12 hours', default: '7 days' };
/** last_seen_at is written at most this often, not on every request. */
const TOUCH_EVERY = '5 minutes';
const MAX_PASSWORD_LENGTH = 200;
const MAX_EMAIL_LENGTH = 254;

/**
 * "Mozilla/5.0 (Windows NT 10.0; Win64; x64) ... Chrome/128.0.0.0 Safari/537.36"
 * → "Chrome on Windows". Enough to recognise your own phone in a list, and
 * nothing a screen needs to parse further.
 */
function describeAgent(ua) {
  const s = String(ua || '');
  if (!s) return 'Unknown device';
  // the app labels its own sessions (authApiController.agentFor); the
  // WebView's user agent behind the label would only read "Chrome on Android"
  const app = /^MaternalCare\+ app \((android|ios)\)/.exec(s);
  if (app) return `MaternalCare+ app on ${app[1] === 'ios' ? 'iOS' : 'Android'}`;
  const browser = /Edg\//.test(s) ? 'Edge'
    : /OPR\//.test(s) ? 'Opera'
      : /Firefox\//.test(s) ? 'Firefox'
        : /Chrome\//.test(s) ? 'Chrome'
          : /Safari\//.test(s) ? 'Safari'
            : null;
  const os = /Android/.test(s) ? 'Android'
    : /iPhone|iPad/.test(s) ? 'iOS'
      : /Windows/.test(s) ? 'Windows'
        : /Mac OS X/.test(s) ? 'macOS'
          : /Linux/.test(s) ? 'Linux'
            : null;
  if (browser && os) return `${browser} on ${os}`;
  return browser || os || s.split(' ')[0].split('/')[0] || 'Unknown device';
}

class AuthError extends Error {
  constructor(message, code) {
    super(message);
    this.code = code;
  }
}

module.exports = {
  AuthError,
  PARAMS,
  SESSION_DAYS,
  SESSION_IDLE,
  MAX_PASSWORD_LENGTH,

  /**
   * What the sessions table stores for a cookie token.
   *
   * Plain SHA-256, not scrypt: the token is 256 random bits, so there is no
   * dictionary to run against it and nothing for a slow hash to slow down.
   */
  sessionKey(token) {
    return createHash('sha256').update(String(token)).digest('hex');
  },

  /** `scrypt$N$r$p$salt$hash`, all base64. Self-describing on purpose. */
  async hash(password) {
    if (typeof password !== 'string' || password.length < 8) {
      throw new AuthError('A password needs to be at least 8 characters', 'WEAK');
    }
    if (password.length > MAX_PASSWORD_LENGTH) {
      // scrypt cost is independent of input length, but an unbounded body is
      // still a way to make the server do unbounded work
      throw new AuthError('That password is too long', 'TOO_LONG');
    }
    const salt = randomBytes(16);
    const key = await scryptAsync(password, salt, KEY_LEN, { ...PARAMS, maxmem: maxmem() });
    return [
      'scrypt', PARAMS.N, PARAMS.r, PARAMS.p,
      salt.toString('base64'), key.toString('base64'),
    ].join('$');
  },

  /**
   * Check a password against a stored hash.
   *
   * Compared with `timingSafeEqual`, so the time taken cannot tell an attacker
   * how many leading bytes they guessed correctly.
   */
  async verify(password, stored) {
    if (typeof password !== 'string' || typeof stored !== 'string') return false;
    const [scheme, N, r, p, saltB64, hashB64] = stored.split('$');
    if (scheme !== 'scrypt') return false;

    const salt = Buffer.from(saltB64, 'base64');
    const expected = Buffer.from(hashB64, 'base64');
    const opts = {
      N: Number(N), r: Number(r), p: Number(p),
      maxmem: 256 * Number(N) * Number(r) * Number(p) * 2,
    };

    let actual;
    try {
      actual = await scryptAsync(password, salt, expected.length, opts);
    } catch {
      return false;                       // unreadable hash: not a match
    }
    return actual.length === expected.length && timingSafeEqual(actual, expected);
  },

  /**
   * Sign in.
   *
   * One message for "no such account" and "wrong password", deliberately.
   * Distinguishing them turns the login form into a way of finding out which
   * of your patients has an account here, which for a maternity service is
   * itself sensitive.
   */
  async authenticate(email, password) {
    const address = String(email || '').trim().toLowerCase();
    if (address.length > MAX_EMAIL_LENGTH
      || typeof password !== 'string'
      || password.length > MAX_PASSWORD_LENGTH) {
      throw new AuthError('That email and password do not match an account', 'BAD_LOGIN');
    }
    const user = address
      ? await db.one('SELECT * FROM users WHERE lower(email) = $1', [address])
      : null;

    /*
     * Hash even when the account does not exist, against a throwaway value.
     * Returning early would make a missing account measurably faster to
     * reject than a wrong password, which is how account lists get harvested.
     */
    const stored = user?.password_hash
      || 'scrypt$131072$8$1$AAAAAAAAAAAAAAAAAAAAAA==$AAAAAAAAAAAAAAAAAAAAAA==';
    const ok = await this.verify(password, stored);

    if (!user || !user.password_hash || !ok) {
      throw new AuthError('That email and password do not match an account', 'BAD_LOGIN');
    }

    /*
     * An account inside its deletion window is closed, whatever the password
     * says. Checked after the hash comparison on purpose: answering "this
     * account is being deleted" to anyone who types the address would tell a
     * stranger that the address is registered.
     */
    if (user.deleted_at) {
      throw new AuthError(
        'This account has been deleted and can no longer be signed in to.',
        'ACCOUNT_DELETED',
      );
    }

    return user;
  },

  /**
   * Start a session and return the token that belongs in the cookie.
   *
   * The token is minted fresh for every sign-in — there is no session before
   * authentication that could be fixed in advance and inherited afterwards.
   */
  async startSession(userId, userAgent) {
    const token = randomBytes(32).toString('base64url');
    await db.run(
      `INSERT INTO sessions (id, user_id, expires_at, user_agent)
       VALUES ($1, $2, now() + ($3 || ' days')::interval, $4)`,
      [this.sessionKey(token), userId, String(SESSION_DAYS), String(userAgent || '').slice(0, 300) || null],
    );
    await db.run('UPDATE users SET last_login_at = now() WHERE id = $1', [userId]);
    return token;
  },

  /**
   * The user behind a session token, or null.
   *
   * Three ways to be nobody: the session is past its fourteen days, it has
   * gone unused for longer than its role allows, or the account behind it
   * has been deleted — deletion drops every session, but a cookie already in
   * flight must not outlive it.
   *
   * A session that answers is marked seen, at most once every few minutes,
   * so a dashboard polling every few seconds is not a write every few
   * seconds.
   */
  async userForSession(token) {
    if (!token || typeof token !== 'string') return null;
    const key = this.sessionKey(token);
    const user = await db.one(
      `SELECT u.*, s.last_seen_at < now() - $4::interval AS stale
         FROM sessions s
         JOIN users u ON u.id = s.user_id
        WHERE s.id = $1
          AND s.expires_at > now()
          AND s.last_seen_at > now() - (CASE WHEN u.role = 'clinician' THEN $2 ELSE $3 END)::interval
          AND u.deleted_at IS NULL`,
      [key, SESSION_IDLE.clinician, SESSION_IDLE.default, TOUCH_EVERY],
    );
    if (!user) return null;
    if (user.stale) {
      await db.run('UPDATE sessions SET last_seen_at = now() WHERE id = $1', [key]);
    }
    delete user.stale;
    return user;
  },

  async endSession(token) {
    if (!token) return 0;
    return db.run('DELETE FROM sessions WHERE id = $1', [this.sessionKey(token)]);
  },

  /** Every session for one account — used when a password changes. */
  async endAllSessions(userId) {
    return db.run('DELETE FROM sessions WHERE user_id = $1', [userId]);
  },

  /**
   * Every other device this account is signed in on. The one making the
   * request stays — "sign out everywhere else" should not sign out here.
   */
  async endOtherSessions(userId, currentToken) {
    return db.run(
      'DELETE FROM sessions WHERE user_id = $1 AND id <> $2',
      [userId, this.sessionKey(currentToken)],
    );
  },

  /**
   * End one session by its key — the id the list below hands out. Scoped to
   * the owner, so a key that belongs to somebody else deletes nothing.
   */
  async endSessionByKey(userId, key) {
    return db.run(
      'DELETE FROM sessions WHERE user_id = $1 AND id = $2',
      [userId, String(key || '')],
    );
  },

  /**
   * Where this account is signed in.
   *
   * The key is the hash, which is safe to show: it cannot be turned back
   * into the cookie, and it is what a revoke needs. The user agent is
   * reduced to a phrase a person can read — "Chrome on Windows" — because
   * the raw string is a hundred characters of version numbers.
   */
  async sessionsFor(userId, currentToken) {
    const current = currentToken ? this.sessionKey(currentToken) : null;
    const rows = await db.sql(
      `SELECT id, created_at, last_seen_at, expires_at, user_agent
         FROM sessions
        WHERE user_id = $1 AND expires_at > now()
          AND last_seen_at > now() - $2::interval
        ORDER BY last_seen_at DESC`,
      [userId, SESSION_IDLE.default],
    );
    return rows.map((r) => ({
      id: r.id,
      device: describeAgent(r.user_agent),
      createdAt: r.created_at,
      lastSeenAt: r.last_seen_at,
      expiresAt: r.expires_at,
      current: r.id === current,
    }));
  },

  /**
   * Housekeeping: expired and idle rows are dead weight and a small privacy
   * leak — the lookup above already refuses them, this just removes them.
   */
  async purgeExpired() {
    return db.run(
      `DELETE FROM sessions s
        USING users u
        WHERE u.id = s.user_id
          AND (s.expires_at <= now()
               OR s.last_seen_at <= now() - (CASE WHEN u.role = 'clinician' THEN $1 ELSE $2 END)::interval)`,
      [SESSION_IDLE.clinician, SESSION_IDLE.default],
    );
  },

  async setPassword(userId, password) {
    const hash = await this.hash(password);
    await db.run('UPDATE users SET password_hash = $2 WHERE id = $1', [userId, hash]);
    // a password change ends every existing session, which is the whole point
    // of changing it after a device is lost
    await this.endAllSessions(userId);
    return true;
  },

  /**
   * A short, stable fingerprint of a hash, safe to log or show in a test.
   *
   * The hash itself is still secret material — it is what an offline attack
   * runs against — so anything that wants to prove "this is hashed, and these
   * two differ" gets this instead.
   */
  fingerprint(stored) {
    if (!stored) return null;
    return createHash('sha256').update(stored).digest('hex').slice(0, 12);
  },
};
