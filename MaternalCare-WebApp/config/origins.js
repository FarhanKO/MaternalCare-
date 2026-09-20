/**
 * Which browser origins this server trusts.
 *
 * One answer, asked from two places: the CORS layer (may a page on that
 * origin read our responses?) and the CSRF layer (may a page on that origin
 * make a request that changes something?). They used to be separate lists
 * in separate files, which is how the two drift apart.
 *
 * In development the answer is the two Vite dev servers and, so the guardian
 * app can be opened on a real phone, any private-network address on those
 * ports. In production the answer is exactly what CLIENT_ORIGIN says — and
 * when it says nothing, nothing: the built client is served by this process,
 * on this origin, and a same-origin page needs no CORS at all. The old
 * behaviour, where an unset CLIENT_ORIGIN left the dev allowances on in
 * production, is the sort of default that is never noticed until it is.
 */
const production = process.env.NODE_ENV === 'production';

const DEV_ORIGINS = ['http://localhost:5173', 'http://localhost:5174'];
const LAN_DEV = /^http:\/\/(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)[\d.]+:(5173|5174)$/;

/**
 * "https://app.example.org, https://app.example.org/" → one origin.
 *
 * An origin is scheme://host[:port] and nothing else. A trailing slash or a
 * path would match nothing, silently — so each entry is put through the URL
 * parser and anything it would not print back as an origin is refused aloud.
 */
function parseConfigured(raw) {
  if (raw === undefined || raw.trim() === '') return null;
  const origins = [];
  for (const entry of raw.split(',').map((s) => s.trim()).filter(Boolean)) {
    let url = null;
    try { url = new URL(entry.replace(/\/+$/, '')); } catch { /* not a URL */ }
    const bare = url && url.origin !== 'null' && url.pathname === '/' && !url.search && !url.hash
      && !url.username && !url.password;
    if (!bare) {
      console.warn(`  [origins] ignoring CLIENT_ORIGIN entry "${entry}" — an origin is scheme://host[:port]`);
      continue;
    }
    const origin = url.origin;               // normalised: lower-case host, default port dropped
    if (production && origin.startsWith('http:')) {
      console.warn(`  [origins] CLIENT_ORIGIN "${origin}" is plain http; the session cookie is Secure in production and will never reach it`);
    }
    origins.push(origin);
  }
  return origins;
}

const configured = parseConfigured(process.env.CLIENT_ORIGIN);
const CLIENT_ORIGINS = configured ?? (production ? [] : DEV_ORIGINS);
const lanAllowed = configured === null && !production;

/*
 * Where the mobile app's pages come from.
 *
 * Capacitor serves the bundle to its WebView from a local origin — the first
 * on Android, the second on iOS; the third is what Ionic's older shell used.
 * These are not trusted the way CLIENT_ORIGINS are: a page here is never
 * sent a cookie and never acts as anyone by itself. It may call the API only
 * with a bearer token it holds (middleware/session), which a stranger's page
 * on "https://localhost" — a dev server with a certificate, say — does not.
 */
const APP_ORIGINS = ['https://localhost', 'capacitor://localhost', 'ionic://localhost'];

module.exports = {
  CLIENT_ORIGINS,
  APP_ORIGINS,

  /** True when a page on `origin` may read our responses and act as the user. */
  isTrusted(origin) {
    if (typeof origin !== 'string') return false;
    if (CLIENT_ORIGINS.includes(origin)) return true;
    return lanAllowed && LAN_DEV.test(origin);
  },

  /** True when `origin` is the mobile app's own WebView. */
  isApp(origin) {
    return typeof origin === 'string' && APP_ORIGINS.includes(origin);
  },

  /** One line for the boot log, so the posture is visible without reading env. */
  describe() {
    if (CLIENT_ORIGINS.length === 0) return 'same-origin only';
    const list = CLIENT_ORIGINS.map((o) => o.replace(/^https?:\/\//, '')).join(', ');
    return lanAllowed ? `${list} + private-network dev ports` : list;
  },
};
