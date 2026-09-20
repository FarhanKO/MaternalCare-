/**
 * Puts the freshly built APK where the mother's SOS screen links to it: the
 * Webapp's public/downloads, served at /downloads/guardian.apk. The Webapp
 * is the sibling folder ../MaternalCare-Webapp, or WEBAPP_DIR.
 */
import { copyFileSync, mkdirSync, existsSync, statSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const webapp = resolve(here, '..', process.env.WEBAPP_DIR ?? '../MaternalCare-Webapp');
const from = resolve(here, '../android/app/build/outputs/apk/debug/app-debug.apk');
const to = resolve(webapp, 'public/downloads/guardian.apk');

if (!existsSync(from)) {
  console.error('No APK found. Run `npm run apk` from guardian-app/.');
  process.exit(1);
}
mkdirSync(dirname(to), { recursive: true });
copyFileSync(from, to);
console.log(`APK copied → ${to} (${(statSync(to).size / 1024 / 1024).toFixed(2)} MB)`);
