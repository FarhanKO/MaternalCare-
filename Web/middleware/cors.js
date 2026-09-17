/**
 * Cross-origin access to the API.
 *
 * Who may call it from a browser is decided once, in config/origins — the
 * dev servers in development, CLIENT_ORIGIN in production, nobody else. This
 * only writes that decision into headers.
 *
 * Three things this is careful about:
 *
 *   The guardian routes are called from the companion app, which runs from
 *   an Android WebView (origin "capacitor://localhost", or none at all), so
 *   they answer any origin — but *without* credentials. The link token in
 *   the URL is the guardian's whole credential; the session cookie plays no
 *   part. The old code echoed whatever origin arrived together with
 *   Allow-Credentials: true, which is the textbook CORS misconfiguration,
 *   and it did so on routes that never needed either.
 *
 *   The mother/doctor app is the same story on every other route. Its
 *   WebView is one of config/origins' APP_ORIGINS and it marks its requests
 *   as the app's (middleware/session: X-Client, or a bearer token), so it
 *   is answered — again without credentials, because the cookie is not its
 *   credential and must never become one. A request from that origin
 *   *without* those marks is refused like any other stranger: the origin
 *   alone earns nothing.
 *
 *   A preflight from an origin that is not trusted is refused with a 403
 *   rather than a 204 missing the allow header. The browser blocks the call
 *   either way; the 403 says why in the console instead of leaving someone
 *   to guess at a blank error.
 */
const origins = require('../config/origins');
const session = require('./session');

const GUARDIAN = /^\/(?:api\/)?guardian\//;

/**
 * Whether this request is, or is the preflight for, one of the app's.
 *
 * A preflight carries neither of the app's headers itself — it asks
 * permission to send them — so for one the question has to be read off what
 * it is asking for.
 */
function wantsApp(req) {
  if (session.fromApp(req)) return true;
  if (req.method !== 'OPTIONS') return false;
  return /\b(?:authorization|x-client)\b/i.test(String(req.headers['access-control-request-headers'] || ''));
}

module.exports = function cors() {
  return (req, res, next) => {
    // the answer depends on the Origin header, and a cache must know that
    res.vary('Origin');

    const origin = req.headers.origin;
    const route = req.baseUrl + req.path;

    if (GUARDIAN.test(route)) {
      res.setHeader('Access-Control-Allow-Origin', '*');
    } else if (origins.isTrusted(origin)) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      // the session lives in a cookie, and a cross-origin fetch will neither
      // send nor store one without this
      res.setHeader('Access-Control-Allow-Credentials', 'true');
    } else if (origins.isApp(origin) && wantsApp(req)) {
      // the app: its origin may read the answer, and the token in its own
      // header is what earns it — deliberately no Allow-Credentials
      res.setHeader('Access-Control-Allow-Origin', origin);
    } else if (origin !== undefined && req.method === 'OPTIONS') {
      return res.status(403).json({
        error: 'This origin may not call the MaternalCare+ API',
        code: 'ORIGIN_NOT_ALLOWED',
      });
    }

    if (req.method === 'OPTIONS') {
      res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
      // Authorization and X-Client are what the app sends; a browser client
      // sends neither and is not affected by their being allowed
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Client');
      // ten minutes between preflights for the same call, not one per call
      res.setHeader('Access-Control-Max-Age', '600');
      return res.sendStatus(204);
    }

    // the report download reads its filename off this header; without it a
    // cross-origin fetch cannot see it and every report saves under one name
    res.setHeader('Access-Control-Expose-Headers', 'Content-Disposition');
    return next();
  };
};
