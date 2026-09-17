/**
 * TLS enforcement.
 *
 * In production nothing is served over plain http. A request that arrives
 * that way is sent to the https address of the same page if it is a GET, and
 * refused if it is anything else — a redirected POST arrives at the other
 * end without its body, so "use https" as a 403 is the honest answer.
 *
 * "Arrives over plain http" is read from the connection when this process
 * terminates TLS itself (TLS_KEY_FILE / TLS_CERT_FILE), and from
 * X-Forwarded-Proto when a proxy does — which needs Express's `trust proxy`
 * set, and app.js sets it. Without that, every request behind a proxy looks
 * like http and this middleware would redirect forever.
 *
 * Development is left alone: there is no certificate on localhost, and the
 * cookie is not Secure there either. Production means https; a deployment
 * that cannot offer it should not be called production.
 */
const production = process.env.NODE_ENV === 'production';

module.exports = function enforceTls() {
  if (!production) return (req, res, next) => next();

  return (req, res, next) => {
    if (req.secure) return next();

    const host = req.headers.host;
    if (!host) {
      return res.status(400).json({ error: 'A Host header is required', code: 'NO_HOST' });
    }
    if (req.method === 'GET' || req.method === 'HEAD') {
      // 301 rather than 302: the answer never changes, and browsers remember it
      return res.redirect(301, `https://${host}${req.originalUrl}`);
    }
    return res.status(403).json({
      error: 'MaternalCare+ is only served over https',
      code: 'HTTPS_REQUIRED',
    });
  };
};
