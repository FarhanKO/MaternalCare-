/**
 * Cross-site request forgery.
 *
 * The attack: a page on some other site makes the browser send a request
 * here — a form post, a fetch — and the browser attaches the session cookie
 * because it always does. The request arrives signed in as her, from a page
 * she never saw.
 *
 * The session cookie is already SameSite=Lax, which stops that from another
 * *site*. It does not stop it from the same site on a different port, and a
 * university server running several projects on one hostname is exactly
 * that. So the second layer, here, asks the browser where the request came
 * from and refuses what did not come from us.
 *
 * Every current browser sends Sec-Fetch-Site on every request, and no page
 * can change it. Its four values decide almost everything:
 *
 *   same-origin   the application itself                       allowed
 *   none          not from a page at all — typed, bookmarked   allowed
 *   same-site     another port or subdomain of this host       trusted origins only
 *   cross-site    another site                                 trusted origins only
 *
 * "Trusted origins" is config/origins: the Vite dev server on :5173, which
 * really is a different origin, and CLIENT_ORIGIN in a split deployment.
 *
 * A browser too old to send Sec-Fetch-Site still sends Origin on every
 * request that is not a GET, and that has to be ours or trusted. `null` —
 * what a sandboxed frame or a data: page sends — is neither.
 *
 * A request with neither header did not come from a browser at all: a
 * script, curl, the API audit. There is nothing to forge, because there is
 * no victim whose browser is being borrowed. It goes through. That is the
 * design of Go's net/http CrossOriginProtection, and it is what lets this
 * work with no token to mint, store, rotate and send back.
 *
 * Only requests that change something are checked. Nothing here changes
 * anything on a GET — the route table is POST/PUT/PATCH/DELETE for every
 * write — and a GET that did would be a bug a CSRF check cannot fix.
 */
const origins = require('../config/origins');
const session = require('./session');

const SAFE = new Set(['GET', 'HEAD', 'OPTIONS']);

/* the guardian companion runs inside an Android WebView, whose origin is not
   a web origin; its requests are authorised by the link token, not a cookie */
const EXEMPT = /^\/(?:api\/)?guardian\//;

function hostOf(origin) {
  try { return new URL(origin).host; } catch { return null; }
}

function refuse(req, res, why) {
  console.warn(`  [csrf] refused ${req.method} ${req.baseUrl}${req.path} — ${why}`);
  return res.status(403).json({
    error: 'This request did not come from MaternalCare+ and was refused',
    code: 'CROSS_SITE_REQUEST',
  });
}

module.exports = function csrf() {
  return (req, res, next) => {
    if (SAFE.has(req.method)) return next();
    if (EXEMPT.test(req.baseUrl + req.path)) return next();
    /*
     * The mobile app marks its requests as its own, and middleware/session
     * answers such a request on its bearer token alone — never on the
     * cookie. A forged request is one the browser signed on the victim's
     * behalf; nothing the browser attaches by itself is used here, so there
     * is no victim, and nothing to check.
     */
    if (session.fromApp(req)) return next();

    const site = req.headers['sec-fetch-site'];
    const origin = req.headers.origin;

    if (site === 'same-origin' || site === 'none') return next();
    if (site === 'same-site' || site === 'cross-site') {
      if (origins.isTrusted(origin)) return next();
      return refuse(req, res, `Sec-Fetch-Site ${site}, Origin ${origin ?? 'absent'}`);
    }

    if (origin !== undefined) {
      if (origins.isTrusted(origin)) return next();
      const host = hostOf(origin);
      if (host && host === req.headers.host) return next();
      return refuse(req, res, `Origin ${origin} is not this host`);
    }

    return next();                        // not a browser
  };
};
