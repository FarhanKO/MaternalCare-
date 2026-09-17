/**
 * Rate limiting for the handful of routes where guessing pays.
 *
 * A password check costs scrypt about 200 ms, which makes one guess slow and
 * ten thousand guesses an afternoon — unless something counts them. This
 * does. It watches the routes that verify a password (signing in, changing
 * it, closing the account) and the two that create accounts, and after a
 * bounded number of attempts in a window it answers 429 with a Retry-After.
 *
 * Failures are what count, for the password routes: a mother who signs in
 * and out of four demo accounts during a presentation is not an attack, and
 * a limiter that thought so would fire in the middle of the demonstration.
 * The registration routes count every attempt, since each one succeeds.
 *
 * Two keys, both checked: the calling address, and the account being tried.
 * Per-address stops one machine walking a password list. Per-account stops
 * many machines sharing one target, which is what a real attempt looks like.
 *
 * It lives in this process's memory. A restart forgets it, and two instances
 * would each keep their own count. Neither matters at one instance, and
 * moving the counters to the database is a small change when it does.
 */
const WINDOW_SWEEP_MS = 60 * 1000;

function limiter({ name, windowMs, max, key, count = 'failures' }) {
  /** key → timestamps of counted attempts inside the window */
  const hits = new Map();

  const prune = (list, now) => {
    const cutoff = now - windowMs;
    while (list.length && list[0] <= cutoff) list.shift();
    return list;
  };

  // drop keys that have gone quiet, so the map does not grow with every
  // address that ever tried once
  const sweep = setInterval(() => {
    const now = Date.now();
    for (const [k, list] of hits) {
      if (prune(list, now).length === 0) hits.delete(k);
    }
  }, WINDOW_SWEEP_MS);
  sweep.unref();

  const record = (k, now) => {
    const list = prune(hits.get(k) ?? [], now);
    list.push(now);
    hits.set(k, list);
  };

  const middleware = (req, res, next) => {
    const k = key(req);
    if (!k) return next();

    const now = Date.now();
    const list = prune(hits.get(k) ?? [], now);
    if (list.length >= max) {
      const retryAfter = Math.ceil((list[0] + windowMs - now) / 1000);
      res.setHeader('Retry-After', String(retryAfter));
      console.warn(`  [rate-limit] ${name}: ${k} — ${list.length} in ${windowMs / 60000} min`);
      return res.status(429).json({
        error: `Too many attempts. Please wait ${Math.max(1, Math.ceil(retryAfter / 60))} minute(s) and try again.`,
        code: 'RATE_LIMITED',
        retryAfter,
      });
    }

    if (count === 'all') {
      record(k, now);
    } else {
      // counted only once the handler has answered, and only when it said no
      res.once('finish', () => {
        if (res.statusCode >= 400 && res.statusCode !== 429) record(k, Date.now());
      });
    }
    return next();
  };

  /** For tests and for the boot log. */
  middleware.reset = () => hits.clear();
  middleware.describe = () => `${max} ${count === 'all' ? 'attempts' : 'failures'} / ${windowMs / 60000} min`;
  return middleware;
}

/** The address the request came from — the real one, once `trust proxy` is set. */
const byAddress = (req) => `ip:${req.ip}`;

/** The account a sign-in is aimed at, however it was capitalised. */
const byEmail = (req) => {
  const email = req.body?.email;
  return typeof email === 'string' && email.trim() ? `account:${email.trim().toLowerCase()}` : null;
};

/** The signed-in user, for the routes that re-check her password. */
const byUser = (req) => (req.user ? `user:${req.user.id}` : null);

const FIFTEEN_MINUTES = 15 * 60 * 1000;
const ONE_HOUR = 60 * 60 * 1000;

module.exports = {
  limiter,

  /** POST /auth/login — 30 wrong guesses per address, 10 per account, per quarter hour. */
  login: [
    limiter({ name: 'login by address', windowMs: FIFTEEN_MINUTES, max: 30, key: byAddress }),
    limiter({ name: 'login by account', windowMs: FIFTEEN_MINUTES, max: 10, key: byEmail }),
  ],

  /** Routes that verify the current password of an account already signed in. */
  password: [
    limiter({ name: 'password check', windowMs: FIFTEEN_MINUTES, max: 10, key: byUser }),
  ],

  /** Account creation — every attempt counts, twenty an hour from one address. */
  register: [
    limiter({ name: 'registration', windowMs: ONE_HOUR, max: 20, key: byAddress, count: 'all' }),
  ],
};
