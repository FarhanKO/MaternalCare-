/**
 * The native shell.
 *
 * The same bundle runs in a browser tab and inside the Android app (a
 * Capacitor WebView — see capacitor.config.ts). In a browser this file is
 * inert: `isNative` is false, the session is a cookie the browser keeps, and
 * the API is wherever the page came from.
 *
 * In the app neither of those is available. The WebView's own origin is
 * https://localhost, which makes every call to the server cross-site, and a
 * cross-site cookie is what SameSite exists to refuse — so the server hands
 * the app its session token in the sign-in response instead
 * (middleware/session.js says why that is safe), and it is kept here. And
 * "localhost" inside the APK is the phone itself, so the server's address
 * cannot be assumed either; it is compiled in (VITE_API_URL, set by
 * MaternalCare-App's build from its .env) so the app connects on its own.
 * A build made without one asks for the address on the sign-in screen.
 *
 * Both live in Capacitor's Preferences: app-private storage the OS does not
 * clear the way it may clear a WebView's localStorage under pressure. They
 * are read once, before anything renders, and mirrored in memory so the API
 * layer can ask synchronously.
 */
import { Capacitor } from '@capacitor/core';
import { Preferences } from '@capacitor/preferences';

export const isNative = Capacitor.isNativePlatform();

/** What the server is told in `X-Client` — 'android' | 'ios' in the app. */
export const platform = Capacitor.getPlatform() as 'android' | 'ios' | 'web';

const TOKEN_KEY = 'session.token';
const SERVER_KEY = 'server.url';

let token: string | null = null;
let server: string | null = null;

/** Read what the app kept, before the first render. A no-op in a browser. */
export async function restoreNative(): Promise<void> {
  if (!isNative) return;
  const [t, s] = await Promise.all([
    Preferences.get({ key: TOKEN_KEY }),
    Preferences.get({ key: SERVER_KEY }),
  ]);
  token = t.value;
  server = s.value;
}

/* ------------------------------------------------------------ session */

export const sessionToken = () => token;

/** Keep (or, with null, forget) the token the server handed back. */
export async function setSessionToken(value: string | null): Promise<void> {
  token = value;
  if (!isNative) return;
  if (value) await Preferences.set({ key: TOKEN_KEY, value });
  else await Preferences.remove({ key: TOKEN_KEY });
}

/* ------------------------------------------------------------- server */

/**
 * "192.168.0.12:3000", "https://care.example.org/", "http://host/api" — all
 * become an API base of the form scheme://host[:port]/api.
 *
 * A bare address gets http when it looks like a machine on the LAN (an IP,
 * or a hostname with no dot) and https otherwise: a laptop running `npm
 * start` has no certificate, and a real host had better have one.
 */
export function normaliseServerUrl(input: string): string | null {
  let s = input.trim();
  if (!s) return null;
  if (!/^https?:\/\//i.test(s)) {
    const host = s.split('/')[0].split(':')[0];
    const lan = /^\d{1,3}(\.\d{1,3}){3}$/.test(host) || !host.includes('.');
    s = `${lan ? 'http' : 'https'}://${s}`;
  }
  let url: URL;
  try { url = new URL(s); } catch { return null; }
  const path = url.pathname.replace(/\/+$/, '');
  return `${url.origin}${path.endsWith('/api') ? path : `${path}/api`}`;
}

/**
 * The API base the app talks to, or null when none has been set.
 *
 * An address compiled into the build (MaternalCare-App sets VITE_API_URL)
 * wins over one a previous build kept in storage: the sign-in screen no
 * longer offers to change it, so a stale saved address would otherwise
 * point every request at a server that moved.
 */
export const serverUrl = (): string | null =>
  (import.meta.env.VITE_API_URL as string | undefined) ?? server ?? null;

/**
 * The address as a person would type it: "192.168.0.12:3000",
 * "care.example.org". The scheme and the /api are dropped only when
 * `normaliseServerUrl` would put the same ones back.
 */
export const serverLabel = (): string | null => {
  const url = serverUrl();
  if (!url) return null;
  try {
    const { host } = new URL(url);
    return normaliseServerUrl(host) === url ? host : url.replace(/\/api$/, '');
  } catch {
    return url;
  }
};

export async function setServerUrl(value: string | null): Promise<void> {
  server = value;
  if (!isNative) return;
  if (value) await Preferences.set({ key: SERVER_KEY, value });
  else await Preferences.remove({ key: SERVER_KEY });
}
