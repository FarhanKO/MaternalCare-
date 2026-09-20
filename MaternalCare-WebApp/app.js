/**
 * MaternalCare+ — application entry point (MVC architecture)
 *   Models      → /models       (data access + domain logic, PostgreSQL-backed)
 *   Views       → /frontend     (React client)
 *   Controllers → /controllers  (request handling, wired via /routes)
 *
 * This process is the Model and Controller layers plus the API that carries
 * them to the View. It serves no pages of its own.
 *
 * It used to serve a second, server-rendered View from /views: the same
 * records as EJS pages, on the same port. They were written before there was
 * any authentication and never gained it — an anonymous GET /vitals returned a
 * patient's name, her glucose reading and a clinical alert, straight past the
 * guard that protects every /api route. They are gone rather than retrofitted;
 * one View is one place for that mistake to be made.
 */
const express = require('express');
const path = require('path');
const fs = require('fs');
const http = require('http');
const https = require('https');
const apiRoutes = require('./routes/api');

const session = require('./middleware/session');
const enforceTls = require('./middleware/tls');
const securityHeaders = require('./middleware/headers');
const cors = require('./middleware/cors');
const csrf = require('./middleware/csrf');
const origins = require('./config/origins');
const pushModel = require('./models/pushModel');
const vapid = require('./config/vapid');

const app = express();
const PORT = process.env.PORT || 3000;
const production = process.env.NODE_ENV === 'production';

/*
 * Who the server believes about where a request came from.
 *
 * Behind a proxy that terminates TLS — Render, nginx, a load balancer — the
 * connection this process sees is plain http from the proxy, and the real
 * scheme and address arrive as X-Forwarded-* headers. `trust proxy` says
 * how many such hops to believe; without it TLS enforcement would redirect
 * every request forever and the rate limiter would see one address for
 * everyone. One hop is right for every host named above. Set TRUST_PROXY
 * to 0 when this process terminates TLS itself (TLS_KEY_FILE below) or to
 * a higher number behind two proxies — anything a client can put in a
 * header, a trusted hop count too high would believe.
 */
const TRUST_PROXY = process.env.TRUST_PROXY ?? (production ? '1' : '0');
app.set('trust proxy', /^\d+$/.test(TRUST_PROXY) ? Number(TRUST_PROXY) : TRUST_PROXY);

// nothing in the response needs to say what framework wrote it
app.disable('x-powered-by');

/*
 * Query strings are parsed by Node's own querystring rather than `qs`. Every
 * ?limit=, ?date=, ?side= in the controllers is a flat value, and the nested
 * syntax qs adds (?a[b][c]=) is exactly where its published advisories live.
 * The urlencoded body parser is gone for the same reason: every client here
 * sends JSON, and a parser that nothing uses is attack surface with no user.
 */
app.set('query parser', 'simple');

/* in production, nothing else answers a request that arrived over plain http */
app.use(enforceTls());

/* Helmet, the Content-Security-Policy, and Cache-Control for the API */
app.use(securityHeaders());

// Normal JSON should stay small. Document, image and message uploads have
// their own model-level byte limits and are the only routes allowed above it.
const LARGE_JSON_PATH = /^\/api\/(?:documents(?:\/|$)|messages(?:\/|$)|community\/posts$|vaccinations\/\d+\/card$|voice\/transcribe$)/;
const smallJson = express.json({ limit: '256kb' });
const largeJson = express.json({ limit: '12mb' });
app.use((req, res, next) => {
  const isNormalApi = req.path.startsWith('/api/') && !LARGE_JSON_PATH.test(req.path);
  return (isNormalApi ? smallJson : largeJson)(req, res, next);
});

/*
 * Still served: the guardian APK that SosModal links to for download, under
 * public/downloads. The stylesheet and scripts that used to live here belonged
 * to the EJS pages and went with them.
 */
app.use(express.static(path.join(__dirname, 'public')));

/*
 * The built React client, when there is one.
 *
 * In development it is not here: Vite serves it on :5173 with hot reload, and
 * this process answers only /api. In a deployment there is no second server to
 * run, so the same process serves the client it already has the API for —
 * which also puts them on one origin, and a session cookie the browser will
 * actually send. `SPA fallback` below is the other half of that.
 */
const CLIENT_DIR = path.join(__dirname, 'frontend', 'dist');
const hasClient = fs.existsSync(path.join(CLIENT_DIR, 'index.html'));

/*
 * The page itself is not served as a plain file. Each response carries a
 * Content-Security-Policy nonce (middleware/headers), and the client needs
 * to know it — framer-motion's popLayout will not run without one — so
 * index.html is read and given a <meta> tag naming it on the way out. That
 * makes the HTML different on every request, so it is sent no-store; the
 * hashed assets under /assets are what browsers cache, and they still do.
 */
function sendClientPage(dir) {
  return (req, res) => {
    const html = fs.readFileSync(path.join(dir, 'index.html'), 'utf8')
      .replace('<head>', `<head><meta name="csp-nonce" content="${res.locals.cspNonce}" />`);
    res.setHeader('Cache-Control', 'no-store');
    res.type('html').send(html);
  };
}

if (hasClient) {
  // the page route first, so a request for the file by name is templated
  // too; index: false so "/" is not answered by the raw file either
  app.get(['/', '/index.html'], sendClientPage(CLIENT_DIR));
  /*
   * Vite names every bundle by its content hash, so a file under /assets
   * never changes — a new build is a new name. That is what lets a browser
   * keep it for a year and skip even the revalidation; without this the
   * default was max-age=0, and every visit re-fetched the dashboard bundle.
   * The page itself is no-store (above), so a new deploy is picked up on
   * the next load regardless.
   */
  app.use('/assets', express.static(path.join(CLIENT_DIR, 'assets'), {
    index: false, immutable: true, maxAge: '1y',
  }));
  app.use(express.static(CLIENT_DIR, { index: false }));
}

/*
 * The Guardian web companion, served from this origin so a browser
 * invitation works without a second dev server. It is its own project,
 * ../MaternalCare-Guardian; its build is read from there when the folder
 * sits beside this one, from GUARDIAN_DIR when it does not, and from
 * guardian-app/ here when a build has been copied in (a deployment).
 */
const GUARDIAN_DIR = [
  process.env.GUARDIAN_DIR,
  path.join(__dirname, 'guardian-app', 'dist'),
  path.join(__dirname, '..', 'MaternalCare-Guardian', 'dist'),
].filter(Boolean).find((dir) => fs.existsSync(path.join(dir, 'index.html')));
const hasGuardian = Boolean(GUARDIAN_DIR);
if (hasGuardian) {
  app.get(['/guardian-app', '/guardian-app/index.html'], sendClientPage(GUARDIAN_DIR));
  app.use('/guardian-app', express.static(GUARDIAN_DIR, { index: false }));
}

/*
 * Who may call the API from a browser (middleware/cors) and, of those, whose
 * requests may change anything (middleware/csrf). Both read config/origins.
 */
app.use('/api', cors(), csrf());

// Route alias: /guardian/* without the /api prefix, so links without it
// still work for the companion app. Same policy as the prefixed route.
app.use('/guardian', cors(), csrf(), (req, res, next) => {
  req.url = '/guardian' + req.url;
  return apiRoutes(req, res, next);
});

/*
 * Resolve the session before anything else looks at a request. It never
 * rejects — it only answers "who is this" — so the sign-in page and the
 * marketing site still render for nobody in particular.
 */
app.use(session.attach());

app.use('/api', apiRoutes);

/*
 * SPA fallback.
 *
 * React Router owns /mother, /doctor, /signin and the rest. Those paths exist
 * only in the browser, so a reload or a pasted link arrives here as a request
 * for a file that was never on disk. Handing back index.html lets the router
 * resolve it.
 *
 * Three things are deliberately excluded: anything under /api, which must
 * answer as an API and not as a page; anything but GET, so a mistyped POST
 * fails loudly instead of receiving HTML; and any path with a dot in it, so a
 * missing image 404s as a missing image rather than quietly returning markup.
 */
if (hasClient) {
  const page = sendClientPage(CLIENT_DIR);
  app.use((req, res, next) => {
    if (req.method !== 'GET') return next();
    if (req.path.startsWith('/api')) return next();
    if (req.path.includes('.')) return next();
    return page(req, res);
  });
}

if (hasGuardian) {
  const page = sendClientPage(GUARDIAN_DIR);
  app.get('/guardian-app/*', (req, res, next) => {
    if (req.path.includes('.')) return next();
    return page(req, res);
  });
}

/*
 * 404. JSON — what reaches here is an API call, a missing asset, or a request
 * to a deployment with no client built into it.
 */
app.use((req, res) => res.status(404).json({ error: 'Not found', code: 'NOT_FOUND' }));

/*
 * Global error handler.
 *
 * A 4xx that reaches here was raised by the body parser or by Express
 * itself, and its message is written for the caller. A 5xx is ours: the
 * message is a Postgres constraint, a missing file, a stack of our own
 * making — logged in full here, and in production replaced by a sentence
 * that says nothing about how the server is built.
 */
app.use((err, req, res, next) => {
  if (err.type === 'entity.too.large' || err.code === 'LIMIT_STRING') {
    return res.status(413).json({ error: 'That request is too large', code: 'PAYLOAD_TOO_LARGE' });
  }
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'That request was not valid JSON', code: 'BAD_JSON' });
  }
  const status = Number(err.status || err.statusCode) || 500;
  if (status >= 500) console.error('[server error]', err);
  const detail = status < 500 || !production;
  return res.status(status).json({
    error: detail ? (err.message || 'Internal Server Error') : 'Something went wrong on our side. Please try again.',
  });
});

/*
 * Deleted accounts do not delete themselves.
 *
 * The deletion screen promises a mother that her records are kept for seven
 * more days and then removed. That promise is only worth what this sweep is
 * worth, so it runs on boot and once a day afterwards.
 *
 * It only runs while the server does. On a host that sleeps — Render's free
 * tier idles after inactivity — schedule `npm run db:purge` as well, or a
 * long enough sleep means an account sits past its seven days. `unref()` so a
 * pending timer never keeps the process alive on its own.
 */
const PURGE_EVERY_MS = 24 * 60 * 60 * 1000;

async function sweepDeletedAccounts() {
  try {
    const accountModel = require('./models/accountModel');
    const { purged, accounts } = await accountModel.purgeDue();
    if (purged) {
      console.log(`  [purge] ${purged} account(s) past their seven days, removed: `
        + accounts.map((a) => `#${a.id} (${a.posts} posts, ${a.files} files)`).join(', '));
    }
    // sessions past their expiry or their idle limit are refused already;
    // this is the row going too
    const sessions = await require('./models/authModel').purgeExpired();
    if (sessions) console.log(`  [purge] ${sessions} expired or idle session(s) removed`);
  } catch (err) {
    // never take the server down over housekeeping; say so and carry on
    console.error('  [purge] sweep failed:', err.message);
  }
}

/*
 * This process can terminate TLS itself, for a deployment with no proxy in
 * front of it — a college server on a LAN, say. Point TLS_KEY_FILE and
 * TLS_CERT_FILE at the PEM files and it listens for https on PORT; leave
 * them unset and it listens for http, which in production means a proxy
 * had better be doing the https (see `trust proxy` above).
 */
const TLS_KEY_FILE = process.env.TLS_KEY_FILE;
const TLS_CERT_FILE = process.env.TLS_CERT_FILE;
const nativeTls = Boolean(TLS_KEY_FILE && TLS_CERT_FILE);
const server = nativeTls
  ? https.createServer({ key: fs.readFileSync(TLS_KEY_FILE), cert: fs.readFileSync(TLS_CERT_FILE) }, app)
  : http.createServer(app);

const scheme = nativeTls ? 'https' : 'http';

server.listen(PORT, () => {
  console.log(`\n  MaternalCare+ running →  ${scheme}://localhost:${PORT}`);
  /*
   * The security posture, in one line, so it can be read off the console
   * rather than reconstructed from environment variables.
   */
  const tls = production
    ? (nativeTls ? 'enforced (this process terminates it)' : 'enforced (trusting the proxy for X-Forwarded-Proto)')
    : 'not enforced (development)';
  console.log(`  headers: helmet + CSP  ·  TLS: ${tls}`);
  console.log(`  CORS: ${origins.describe()}  ·  CSRF: origin-checked writes  ·  cookie: ${session.COOKIE}`);
  console.log('  sessions: 14 days, idle 7 days (clinicians 12 hours)  ·  sign-in: rate-limited');
  console.log(`  push: reminders every ${pushModel.EVERY_MS / 1000}s  ·  ${vapid.describe()}\n`);
  sweepDeletedAccounts();
  setInterval(sweepDeletedAccounts, PURGE_EVERY_MS).unref();
  /*
   * Reminders reach the device from here. The pass is idempotent (each
   * occurrence is claimed in the database before it is sent), so a second
   * instance running the same loop would not double-send.
   */
  pushModel.start();
});

/*
 * Why the process is made to say something before it goes.
 *
 * Node ends the process on an unhandled promise rejection, and an Express app
 * is almost nothing but promises. Left alone it exits with no output at all:
 * the server is simply gone between one request and the next. A browser can
 * only see a connection that refused, so it reports "Failed to fetch" - which
 * reads like a fault in the page, and sends whoever is debugging into the
 * wrong half of the codebase. These handlers cost nothing, and mean a crash
 * always leaves a reason behind it.
 */
server.on('error', (err) => {
  console.error('');
  if (err.code === 'EADDRINUSE') {
    console.error(`  [fatal] port ${PORT} is already in use - another copy of the`);
    console.error('          server is probably still running. Stop it, or set PORT.');
  } else {
    console.error('  [fatal] the server could not start:', err.message);
  }
  console.error('');
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  console.error('');
  console.error('  [fatal] unhandled promise rejection - the server is stopping:');
  console.error(reason instanceof Error ? reason.stack : reason);
  console.error('');
  process.exit(1);
});

process.on('uncaughtException', (err) => {
  console.error('');
  console.error('  [fatal] uncaught exception - the server is stopping:');
  console.error(err.stack || err.message);
  console.error('');
  process.exit(1);
});
