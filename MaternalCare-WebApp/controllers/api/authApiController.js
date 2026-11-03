/**
 * Auth API Controller — signing in, signing out, and who am I.
 *
 * For a browser the session lives in an httpOnly cookie, so the token never
 * reaches JavaScript and an XSS bug cannot carry it away. For the mobile app
 * it cannot (middleware/session says why), so the app is handed the token in
 * the sign-in response instead — see `issue` below. Nothing here puts a
 * password in a response, a log line or an error message.
 */
const authModel = require('../../models/authModel');
const userModel = require('../../models/userModel');
const context = require('../../config/context');
const session = require('../../middleware/session');

/* `X-Client: android` (or ios) — how a client says it is the app */
const { appClient } = session;

/**
 * What the sessions list will call this device.
 *
 * The WebView's user agent reads as "Chrome on Android", which is true and
 * useless — it is the one string that cannot tell the app apart from the
 * site in the phone's browser. So the app's sessions are labelled as such.
 */
const agentFor = (req) => {
  const client = appClient(req);
  const ua = req.headers['user-agent'];
  return client ? `MaternalCare+ app (${client}) ${ua || ''}`.trim() : ua;
};

/**
 * Hand a new session to the client that just earned it.
 *
 * A browser gets the cookie and nothing in the body. The app gets the token
 * in the body and no cookie — never both: a token that is in the body has
 * no business also sitting in a cookie jar the app does not read.
 */
function issue(req, res, token) {
  if (appClient(req)) return { token };
  res.cookie(session.COOKIE, token, session.cookieOptions());
  return {};
}

/** The shape the client is allowed to see. Never the hash. */
const publicUser = (u) => ({
  id: String(u.id),
  name: u.name,
  role: u.role,
  stage: u.stage,
  email: u.email,
  language: u.language,
  // what she agreed to at registration, so the profile can show it beside
  // the current version; null on accounts older than the record
  termsVersion: u.terms_version ?? null,
  termsAcceptedAt: u.terms_accepted_at ?? null,
});

exports.login = async (req, res, next) => {
  const { email, password } = req.body || {};
  try {
    const user = await authModel.authenticate(email, password);
    const token = await authModel.startSession(user.id, agentFor(req));

    const handed = issue(req, res, token);
    // so anything else this request touches is already her
    context.setUser(user);

    return res.json({ data: { user: publicUser(user), ...handed } });
  } catch (err) {
    if (err instanceof authModel.AuthError) {
      /*
       * 401 with one message for every failure mode. Saying "no such account"
       * separately from "wrong password" turns this form into a way of asking
       * whether a particular woman is a patient here.
       */
      return res.status(401).json({ error: err.message, code: 'BAD_LOGIN' });
    }
    return next(err);
  }
};

/** Create a mother account, sign her in, then let onboarding finish the profile. */
exports.register = async (req, res, next) => {
  try {
    const user = await userModel.registerMother(req.body || {});
    const token = await authModel.startSession(user.id, agentFor(req));
    const handed = issue(req, res, token);
    context.setUser(user);
    return res.status(201).json({ data: { user: publicUser(user), ...handed } });
  } catch (err) {
    if (err.code === 'INVALID_REGISTRATION' || err instanceof authModel.AuthError) {
      return res.status(400).json({ error: err.message, field: err.field, code: err.code });
    }
    return next(err);
  }
};

exports.logout = async (req, res, next) => {
  try {
    await authModel.endSession(req.sessionId);
    // the same attributes the cookie was set with, or the browser keeps it
    res.clearCookie(session.COOKIE, session.clearOptions());
    return res.status(204).end();
  } catch (err) { return next(err); }
};

/*
 * Where this account is signed in.
 *
 * Every live session, this one marked, so she can see a phone she no
 * longer has and end it from here. The list is what the session table
 * already knew — it stored the user agent from the start "so a user can be
 * shown where they are signed in", and then nothing showed it.
 */
exports.sessions = async (req, res, next) => {
  try {
    const sessions = await authModel.sessionsFor(req.user.id, req.sessionId);
    return res.json({
      data: sessions,
      // her own limits, so the screen can say "12 hours" to a clinician and
      // "7 days" to a mother rather than describing the rule in general
      meta: {
        idle: authModel.SESSION_IDLE[req.user.role] ?? authModel.SESSION_IDLE.default,
        absoluteDays: authModel.SESSION_DAYS,
      },
    });
  } catch (err) { return next(err); }
};

/** End one other session. The id is the one the list gave out. */
exports.revokeSession = async (req, res, next) => {
  try {
    if (req.params.id === authModel.sessionKey(req.sessionId)) {
      return res.status(400).json({
        error: 'To end this session, sign out', code: 'CURRENT_SESSION',
      });
    }
    const ended = await authModel.endSessionByKey(req.user.id, req.params.id);
    if (!ended) return res.status(404).json({ error: 'That session has already ended', code: 'NO_SESSION' });
    return res.status(204).end();
  } catch (err) { return next(err); }
};

/** Sign out everywhere else, and stay signed in here. */
exports.revokeOtherSessions = async (req, res, next) => {
  try {
    const ended = await authModel.endOtherSessions(req.user.id, req.sessionId);
    return res.json({ data: { ended } });
  } catch (err) { return next(err); }
};

/** Who is signed in. 200 with null rather than 401 — the client asks on load. */
exports.session = async (req, res) => {
  res.json({ data: { user: req.user ? publicUser(req.user) : null } });
};

/**
 * Change a password.
 *
 * Requires the current one even though the caller is already signed in: it is
 * what stops an unattended screen becoming a permanent account takeover.
 * Succeeding ends every other session, which is the point of changing it.
 */
exports.changePassword = async (req, res, next) => {
  const { currentPassword, newPassword } = req.body || {};
  try {
    await authModel.authenticate(req.user.email, currentPassword);
    await authModel.setPassword(req.user.id, newPassword);

    // she stays signed in here; every other device does not
    const token = await authModel.startSession(req.user.id, agentFor(req));
    const handed = issue(req, res, token);

    return res.json({ data: { changed: true, ...handed } });
  } catch (err) {
    if (err instanceof authModel.AuthError) {
      const status = err.code === 'BAD_LOGIN' ? 401 : 400;
      return res.status(status).json({
        error: err.code === 'BAD_LOGIN' ? 'Your current password is not right' : err.message,
        code: err.code,
      });
    }
    return next(err);
  }
};

/**
 * The demo accounts, for the sign-in screen.
 *
 * Names and emails only — never the passwords, which live in the seed script
 * and in the README where a person can read them, not in an endpoint the
 * whole internet can. It exists so somebody demonstrating this does not have
 * to memorise four addresses.
 */
const DEMO_DOMAIN = /@(example\.com|stage\.demo|demo\.maternalcare\.app)$/i;

exports.demoAccounts = async (req, res, next) => {
  try {
    if (process.env.NODE_ENV === 'production') {
      return res.status(404).json({ error: 'Not available' });
    }
    const mothers = await userModel.mothers();
    return res.json({
      data: mothers
        // only the seeded demo people — this list used to include every real
        // mother who registered, with her conditions, on any server not
        // started with NODE_ENV=production
        .filter((m) => DEMO_DOMAIN.test(m.email || ''))
        .map((m) => ({
          name: m.name, email: m.email, stage: m.stage, conditions: m.conditions || '',
        })),
      meta: { note: 'Demo accounts. Passwords are in the project README.' },
    });
  } catch (err) { return next(err); }
};

/* --------------------------------------------------------- password reset */

const passwordResetModel = require('../../models/passwordResetModel');

/**
 * Where the reset link points. PUBLIC_URL when set — never the request's own
 * Host header in production, which anyone can forge to send a mother a link
 * to their own site.
 */
function siteUrl(req) {
  if (process.env.PUBLIC_URL) return process.env.PUBLIC_URL;
  if (process.env.NODE_ENV === 'production') {
    const first = (process.env.CLIENT_ORIGIN || '').split(',')[0].trim();
    return first || null;
  }
  return `${req.protocol}://${req.get('host')}`;
}

/** POST /auth/forgot { email } — always the same answer, account or not. */
exports.forgotPassword = async (req, res, next) => {
  try {
    const base = siteUrl(req);
    if (!base) {
      console.warn('  [reset] PUBLIC_URL is not set — cannot build a reset link');
    } else {
      await passwordResetModel.request(req.body?.email, base);
    }
    return res.json({
      data: {
        sent: true,
        message: `If that email has an account, a reset link is on its way. It works for ${passwordResetModel.TTL_MINUTES} minutes.`,
      },
    });
  } catch (err) { return next(err); }
};

/** GET /auth/reset?token= — lets the page say "expired" before she types a password. */
exports.checkReset = async (req, res, next) => {
  try {
    const valid = await passwordResetModel.check(String(req.query.token || ''));
    if (!valid) {
      return res.status(400).json({ error: 'This reset link has expired or was already used. Ask for a new one.', code: 'BAD_TOKEN' });
    }
    return res.json({ data: { valid: true } });
  } catch (err) { return next(err); }
};

/** POST /auth/reset { token, password } — sets it, then she signs in fresh. */
exports.resetPassword = async (req, res, next) => {
  try {
    await passwordResetModel.confirm(String(req.body?.token || ''), req.body?.password);
    return res.json({ data: { reset: true } });
  } catch (err) {
    if (err instanceof passwordResetModel.ResetError) {
      return res.status(400).json({ error: err.message, code: err.code });
    }
    if (err instanceof authModel.AuthError) {
      return res.status(400).json({ error: err.message, code: err.code, field: 'password' });
    }
    return next(err);
  }
};
