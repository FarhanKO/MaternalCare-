/**
 * Security headers, on every response.
 *
 * Helmet is the one dependency this project takes for something it could
 * have written by hand — session.js parses its own cookie rather than pull in
 * cookie-parser, and the same argument applies here. The difference is what
 * the dependency knows. A cookie is a string split on ';'. These headers are
 * fifteen years of browser behaviour, some of which reverses: Helmet dropped
 * X-XSS-Protection when the header started causing the leaks it was meant to
 * stop. That is knowledge worth taking updates for.
 *
 * What Helmet does not decide is the Content-Security-Policy, because it
 * cannot: it depends on what this application loads. That is written out
 * below, directive by directive, with the reason each one is as wide as it is.
 */
const helmet = require('helmet');
const { randomBytes } = require('crypto');

const production = process.env.NODE_ENV === 'production';
const splitClient = Boolean(process.env.CLIENT_ORIGIN);

/*
 * The policy for the built React client and the guardian companion, which
 * this process serves in a deployment. Both are Vite builds: one external
 * module script, one stylesheet, no inline script anywhere — so script-src
 * can be 'self' with no nonce and no hash, which is the whole value of a CSP.
 *
 * Inline *styles* are not allowed either. React, framer-motion and recharts
 * set styles through the CSSOM, which a CSP does not govern — with one
 * exception, found by running the build under this policy rather than
 * assuming: framer-motion's popLayout inserts a <style> element to hold an
 * exiting list item in place. It supports a nonce for exactly that, so each
 * page load gets one — minted below, allowed here, handed to the client in a
 * <meta> tag by app.js, and passed to <MotionConfig> in main.tsx. Nothing
 * else may inline a style, and 'unsafe-inline' stays out.
 */
const nonceFor = (req, res) => `'nonce-${res.locals.cspNonce}'`;

const contentSecurityPolicy = {
  useDefaults: false,
  directives: {
    'default-src': ["'self'"],
    'base-uri': ["'self'"],
    'script-src': ["'self'"],
    /* the two typefaces come from Google Fonts: the stylesheet from one host,
       the font files from another */
    'style-src': ["'self'", nonceFor, 'https://fonts.googleapis.com'],
    'font-src': ["'self'", 'https://fonts.gstatic.com', 'data:'],
    /* data: for the SVG favicon and photo previews before upload;
       blob: for the object URL a downloaded report is handed to the tab as */
    'img-src': ["'self'", 'data:', 'blob:'],
    /* the hero video on the About page */
    'media-src': ["'self'"],
    /* the API is this origin; the risk model and the voice service are
       called by the server, never by the page */
    'connect-src': ["'self'"],
    /* a filed prescription or result opens in the browser's own PDF viewer,
       which is an <object> — the one place 'none' would have been wrong */
    'object-src': ["'self'"],
    'frame-src': ["'self'"],
    /* no other site may put this application in a frame — the clickjacking
       defence, stated here and again as X-Frame-Options for old browsers.
       'self' rather than 'none' because this header lands on every response,
       the PDF a mother filed included, and her own page shows that PDF in
       an <object> — a nested document, which 'none' would refuse. */
    'frame-ancestors': ["'self'"],
    'form-action': ["'self'"],
    /* the guardian app registers a service worker for its alarm */
    'worker-src': ["'self'"],
    'manifest-src': ["'self'"],
    /* in production every request the page makes is made over https, even
       one written as http — belt to the redirect's braces */
    ...(production ? { 'upgrade-insecure-requests': [] } : {}),
  },
};

/*
 * Cross-Origin-Resource-Policy decides who may *embed* our responses — an
 * <img> on another origin, say. Deployed on one origin, nobody may. In
 * development the client runs on :5173 and shows document photos straight
 * from :3000, which is a different origin on the same site. And a split
 * deployment (CLIENT_ORIGIN set) has a client on some other site altogether,
 * so it gets what it had before there was a policy at all; the session cookie
 * is SameSite and the CORS layer still decides who may read anything.
 */
const resourcePolicy = splitClient ? 'cross-origin' : (production ? 'same-origin' : 'same-site');

/*
 * Which browser features a page here may use. The symptom logger listens
 * (microphone), the SOS button locates her (geolocation); nothing needs the
 * camera — photographs come through a file input, which is not a permission.
 * Everything else is switched off, for this page and anything it embeds.
 */
const PERMISSIONS_POLICY = [
  'accelerometer=()', 'camera=()', 'geolocation=(self)', 'gyroscope=()',
  'magnetometer=()', 'microphone=(self)', 'payment=()', 'usb=()',
  'interest-cohort=()',
].join(', ');

module.exports = function securityHeaders() {
  const helmetMiddleware = helmet({
    contentSecurityPolicy,
    crossOriginResourcePolicy: { policy: resourcePolicy },
    /* COEP would also require every cross-origin resource — the fonts — to
       opt in. It buys SharedArrayBuffer, which nothing here uses. */
    crossOriginEmbedderPolicy: false,
    crossOriginOpenerPolicy: { policy: 'same-origin' },
    /* SAMEORIGIN, to match frame-ancestors above */
    frameguard: { action: 'sameorigin' },
    /* a year, and subdomains with it, but only once TLS is being enforced —
       sent over plain http the header is ignored, and in development a
       browser that remembered it for localhost would break every other
       project on this machine. No `preload`: that is a submission to a list
       browsers ship with, which is a decision to make deliberately. */
    strictTransportSecurity: production
      ? { maxAge: 365 * 24 * 60 * 60, includeSubDomains: true, preload: false }
      : false,
    /* the URL of a medical record is not a thing to send to the next site */
    referrerPolicy: { policy: 'no-referrer' },
  });

  return (req, res, next) => {
    // fresh per response; a nonce that repeats is a nonce an attacker knows
    res.locals.cspNonce = randomBytes(16).toString('base64');
    helmetMiddleware(req, res, (err) => {
      if (err) return next(err);
      res.setHeader('Permissions-Policy', PERMISSIONS_POLICY);
      /*
       * API responses are somebody's health record. `no-store` keeps them out
       * of every cache — a proxy's, the browser's, the one behind the back
       * button on a shared computer. The few endpoints that stream a file
       * she uploaded set their own, narrower value after this.
       */
      if (req.path.startsWith('/api/') || req.path.startsWith('/guardian/')) {
        res.setHeader('Cache-Control', 'no-store');
      }
      return next();
    });
  };
};
