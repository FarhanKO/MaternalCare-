/**
 * Session middleware.
 *
 * Reads the session token, resolves the user, and runs the rest of the
 * request inside a context that `userModel.current()` can see.
 *
 * The token arrives one of two ways:
 *
 *   A browser sends it as the cookie below, which it set on sign-in and
 *   attaches on its own. httpOnly, so script never sees it.
 *
 *   The mobile app sends it as `Authorization: Bearer`. Its WebView is a
 *   different site from the API (https://localhost, in Capacitor's case),
 *   and a cookie set across sites is exactly what SameSite exists to
 *   refuse — so the app is handed the same token in the sign-in response,
 *   keeps it in storage only the app can read, and sends it by hand.
 *
 * The app announces itself with `X-Client: android` (or ios) on every
 * request, signed in or not — it is how the sign-in response knows to put
 * the token in the body rather than in a cookie. A request from the app,
 * by either sign, is answered on the bearer token alone; a cookie beside it
 * is never read. That is what lets such requests through without a CSRF
 * check (middleware/csrf) and from the app's own origin (middleware/cors):
 * nothing the browser attaches by itself takes part, so there is nothing
 * for another site to borrow.
 *
 * The cookie is parsed by hand rather than with `cookie-parser`. It is six
 * lines for the one cookie this app sets, and a dependency that exists to
 * split a string on ';' is a dependency that still has to be audited and
 * updated.
 */
const authModel = require('../models/authModel');
const context = require('../config/context');

/*
 * The token is 32 random bytes as base64url — 43 characters of [A-Za-z0-9_-].
 * Anything else in the header is not ours and is treated as absent, which
 * matters: csrf and cors ask the same question, and "absent" must mean the
 * same thing to all three.
 */
const BEARER = /^Bearer\s+([A-Za-z0-9_-]{32,128})\s*$/;

const APP_CLIENTS = new Set(['android', 'ios']);

/** The bearer token on a request, or null. */
function bearerToken(req) {
  const m = BEARER.exec(String(req.headers.authorization || ''));
  return m ? m[1] : null;
}

/** Which app sent this — 'android' or 'ios' — or null for a browser. */
function appClient(req) {
  const client = String(req.headers['x-client'] || '').trim().toLowerCase();
  return APP_CLIENTS.has(client) ? client : null;
}

/**
 * True when this request is the app's, by either sign. Such a request is
 * never answered on a cookie — see the top of the file.
 */
function fromApp(req) {
  return appClient(req) !== null || bearerToken(req) !== null;
}

/*
 * Production means https (middleware/tls enforces it), and over https the
 * cookie can carry the __Host- prefix. A browser will only accept a cookie
 * with that name when it is Secure, has Path=/ and names no Domain — which
 * means no page on a subdomain, and nothing arriving over plain http, can
 * ever plant one under this name. In development there is no https, so
 * the prefix would make the cookie impossible to set at all.
 */
const secure = process.env.NODE_ENV === 'production';
const COOKIE = secure ? '__Host-mc_session' : 'mc_session';

/** `a=1; b=2` → { a: '1', b: '2' }. Values are URL-encoded on the way out. */
function parseCookies(header) {
  const out = {};
  for (const part of String(header || '').split(';')) {
    const eq = part.indexOf('=');
    if (eq < 1) continue;
    const key = part.slice(0, eq).trim();
    if (!key) continue;
    try {
      out[key] = decodeURIComponent(part.slice(eq + 1).trim());
    } catch {
      /* a malformed cookie is not a reason to fail the request */
    }
  }
  return out;
}

/**
 * Cookie flags.
 *
 *   httpOnly  script cannot read it, so an XSS bug cannot steal the session
 *   sameSite  the browser will not send it on a cross-site request — the
 *             first CSRF defence; middleware/csrf is the second
 *   secure    only over HTTPS — off in development, where there is none
 *   path      the whole application; __Host- requires exactly this
 *
 * No Domain, deliberately: a cookie with one is sent to every subdomain.
 */
function cookieOptions() {
  return {
    httpOnly: true,
    sameSite: 'lax',
    secure,
    maxAge: authModel.SESSION_DAYS * 24 * 60 * 60 * 1000,
    path: '/',
  };
}

/**
 * To clear a cookie the browser must be sent the same name with the same
 * attributes — a __Host- cookie in particular is ignored unless the clearing
 * header is also Secure with Path=/.
 */
function clearOptions() {
  const { maxAge, ...rest } = cookieOptions();
  return rest;
}

module.exports = {
  COOKIE,
  cookieOptions,
  clearOptions,
  bearerToken,
  appClient,
  fromApp,

  /**
   * Attach the session to every request.
   *
   * Never rejects. Deciding what an anonymous request may do is the guards'
   * job below — this only answers "who is this", and "nobody" is a valid
   * answer for the sign-in page and the marketing site.
   */
  attach() {
    return async (req, res, next) => {
      // the app is answered on its header alone; the cookie is not even
      // read for it — see the top of the file for why
      const token = fromApp(req)
        ? bearerToken(req)
        : (parseCookies(req.headers.cookie)[COOKIE] || null);
      let user = null;
      try {
        user = token ? await authModel.userForSession(token) : null;
      } catch {
        user = null;                       // database trouble is not a login
      }
      req.user = user;
      req.sessionId = token;
      context.run({ user, sessionId: token }, () => next());
    };
  },

  /** Reject anything without a signed-in user. */
  requireUser(req, res, next) {
    if (!req.user) {
      return res.status(401).json({ error: 'Please sign in', code: 'NO_SESSION' });
    }
    return next();
  },

  /**
   * Reject anything not signed in as one of these roles.
   *
   * Coarse on purpose: the finer question — may *this* clinician read *that*
   * patient — belongs with the patient model, which already checks the
   * caseload.
   */
  requireRole(...roles) {
    return (req, res, next) => {
      if (!req.user) {
        return res.status(401).json({ error: 'Please sign in', code: 'NO_SESSION' });
      }
      if (!roles.includes(req.user.role)) {
        return res.status(403).json({ error: 'This is not available to your account', code: 'WRONG_ROLE' });
      }
      return next();
    };
  },
};
