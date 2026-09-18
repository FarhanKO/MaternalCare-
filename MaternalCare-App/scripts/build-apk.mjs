/**
 * Build the Android APK.
 *
 *   npm run apk              build the web client, sync it in, run Gradle,
 *                            copy the APK next door for the site to serve
 *   npm run web              only the web client (into the Webapp's dist-native)
 *   npm run sync             web client + `cap sync`, no Gradle — then open
 *                            android/ in Android Studio to run on a device
 *
 * The server address is compiled in, so the app connects on its own and the
 * sign-in screen asks for email and password only. It comes from .env in
 * this folder (API_URL=…), or `--api <url>` on the command line. Change it
 * — from a laptop on the wifi to the deployed host — and build again; the
 * APK is what carries it.
 *
 * Needs the Android SDK and a JDK. Both are found where Android Studio puts
 * them when ANDROID_HOME / JAVA_HOME are not set.
 */
import { spawnSync } from 'node:child_process';
import {
  copyFileSync, existsSync, mkdirSync, readFileSync, statSync, writeFileSync,
} from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');
const android = join(root, 'android');
const windows = process.platform === 'win32';

const args = process.argv.slice(2);
const webOnly = args.includes('--web-only');
const syncOnly = args.includes('--sync-only');

/* ------------------------------------------------------------ settings */

/** KEY=value lines from .env, nothing fancier. */
function dotenv(file) {
  if (!existsSync(file)) return {};
  const out = {};
  for (const line of readFileSync(file, 'utf8').split('\n')) {
    const m = /^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*?)\s*$/.exec(line);
    if (m && !line.trim().startsWith('#')) out[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
  return out;
}

const env0 = { ...dotenv(join(root, '.env')), ...process.env };
const webapp = resolve(root, env0.WEBAPP_DIR ?? '../MaternalCare-Webapp');
const frontend = join(webapp, 'frontend');

const apiAt = args.indexOf('--api');
const apiRaw = apiAt >= 0 ? args[apiAt + 1] : env0.API_URL;
if (!apiRaw) {
  fail([
    'No server address. The app connects on its own, so it has to be told where:',
    '',
    '  copy .env.example to .env and set API_URL, or pass --api <url>',
    '',
    '  API_URL=http://192.168.0.249:3000/api     a laptop on the same wifi',
    '  API_URL=https://maternalcare.onrender.com/api   the deployed site',
  ].join('\n  '));
}
const api = normaliseApi(apiRaw);
if (!api) fail(`"${apiRaw}" is not an address the app can use.`);

if (!existsSync(join(frontend, 'package.json'))) {
  fail(`No web client at ${frontend}. Put MaternalCare-Webapp beside this folder, or set WEBAPP_DIR in .env.`);
}

/* ------------------------------------------------------------ toolchain */

const javaHome = env0.JAVA_HOME
  || [
    'C:\\Program Files\\Android\\Android Studio\\jbr',
    '/Applications/Android Studio.app/Contents/jbr/Contents/Home',
    '/opt/android-studio/jbr',
  ].find((p) => existsSync(p));

const sdk = env0.ANDROID_HOME || env0.ANDROID_SDK_ROOT
  || [
    env0.LOCALAPPDATA && join(env0.LOCALAPPDATA, 'Android', 'Sdk'),
    env0.HOME && join(env0.HOME, 'Library', 'Android', 'sdk'),
    env0.HOME && join(env0.HOME, 'Android', 'Sdk'),
  ].filter(Boolean).find((p) => existsSync(p));

if (!webOnly) {
  if (!javaHome) fail('No JDK found. Install Android Studio, or set JAVA_HOME.');
  if (!sdk) fail('No Android SDK found. Install it with Android Studio, or set ANDROID_HOME.');
  if (!existsSync(android)) fail('No android/ project in this folder.');

  // gradle reads the SDK path from here; it is machine-specific and gitignored
  const localProps = join(android, 'local.properties');
  if (!existsSync(localProps)) {
    // a properties file reads "\" as an escape, so Windows paths double them
    writeFileSync(localProps, `sdk.dir=${sdk.replace(/\\/g, '\\\\')}\n`);
  }
}

/* ------------------------------------------------------------------ run */

const env = {
  ...process.env,
  ...(javaHome ? { JAVA_HOME: javaHome } : {}),
  ...(sdk ? { ANDROID_HOME: sdk } : {}),
  VITE_API_URL: api,
  WEBAPP_DIR: webapp,
};
const npm = windows ? 'npm.cmd' : 'npm';

console.log(`\n  server:  ${api}`);
console.log(`  web:     ${frontend}`);
if (!webOnly) console.log(`  JDK:     ${javaHome}\n  SDK:     ${sdk}`);
console.log('');

if (!existsSync(join(frontend, 'node_modules'))) run(npm, ['install'], frontend);
run(npm, ['run', 'build:native'], frontend);
if (webOnly) done('Web client built. `npm run sync` puts it into android/.');

run(windows ? 'npx.cmd' : 'npx', ['cap', 'sync', 'android'], root);
if (syncOnly) done('Synced. Open android/ in Android Studio, or `npm run apk` to build the APK here.');

// by full path: cmd.exe does not look in the working directory for a .bat
run(`"${join(android, windows ? 'gradlew.bat' : 'gradlew')}"`, ['assembleDebug'], android);

/* ----------------------------------------------------------------- copy */

const from = join(android, 'app', 'build', 'outputs', 'apk', 'debug', 'app-debug.apk');
if (!existsSync(from)) fail(`Gradle finished but ${from} is not there.`);
// where the site offers it for download (public/downloads is served by app.js)
const to = join(webapp, 'public', 'downloads', 'maternalcare.apk');
mkdirSync(dirname(to), { recursive: true });
copyFileSync(from, to);
done(`APK → ${to} (${(statSync(to).size / 1024 / 1024).toFixed(2)} MB)`);

/* -------------------------------------------------------------- helpers */

/** "192.168.0.249:3000", "https://host/", "http://host/api" → scheme://host[:port]/api */
function normaliseApi(input) {
  let s = String(input).trim();
  if (!s) return null;
  if (!/^https?:\/\//i.test(s)) {
    const host = s.split('/')[0].split(':')[0];
    const lan = /^\d{1,3}(\.\d{1,3}){3}$/.test(host) || !host.includes('.');
    s = `${lan ? 'http' : 'https'}://${s}`;
  }
  let url;
  try { url = new URL(s); } catch { return null; }
  const path = url.pathname.replace(/\/+$/, '');
  return `${url.origin}${path.endsWith('/api') ? path : `${path}/api`}`;
}

function run(cmd, cmdArgs, cwd) {
  const r = spawnSync(cmd, cmdArgs, { cwd, env, stdio: 'inherit', shell: windows });
  if (r.status !== 0) fail(`${cmd} ${cmdArgs.join(' ')} failed`);
}

function done(message) {
  console.log(`\n  ${message}\n`);
  process.exit(0);
}

function fail(message) {
  console.error(`\n  ${message}\n`);
  process.exit(1);
}
