/**
 * The VAPID key pair that signs every push message this server sends.
 *
 * A browser's push subscription is bound to the public key it was created
 * with: change the key and every subscription on record stops working. So
 * the pair has to outlive restarts. In a deployment it comes from the
 * environment (VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY, made once with
 * `npx web-push generate-vapid-keys`). In development, where nobody sets
 * environment variables for a feature they are trying out, one is generated
 * on first boot and kept in data/vapid.json — the same gitignored folder the
 * uploads live in — so the second boot signs with the first boot's key.
 *
 * VAPID_SUBJECT is who the push service may contact about abuse: a mailto:
 * or an https: URL. It is a claim in every message, so it is required.
 */
const fs = require('fs');
const path = require('path');
const webPush = require('web-push');

const FILE = path.join(__dirname, '..', 'data', 'vapid.json');
const DEFAULT_SUBJECT = 'mailto:hello@maternalcare.app';

function load() {
  const fromEnv = process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY
    ? { publicKey: process.env.VAPID_PUBLIC_KEY, privateKey: process.env.VAPID_PRIVATE_KEY, source: 'env' }
    : null;
  if (fromEnv) return fromEnv;

  try {
    const saved = JSON.parse(fs.readFileSync(FILE, 'utf8'));
    if (saved.publicKey && saved.privateKey) return { ...saved, source: FILE };
  } catch { /* first boot, or unreadable — generate below */ }

  const fresh = webPush.generateVAPIDKeys();
  fs.mkdirSync(path.dirname(FILE), { recursive: true });
  fs.writeFileSync(FILE, JSON.stringify({ ...fresh, generatedAt: new Date().toISOString() }, null, 2));
  return { ...fresh, source: `${FILE} (generated)` };
}

const keys = load();
const subject = process.env.VAPID_SUBJECT || DEFAULT_SUBJECT;

webPush.setVapidDetails(subject, keys.publicKey, keys.privateKey);

module.exports = {
  publicKey: keys.publicKey,
  subject,
  /** for the boot line */
  describe: () => (keys.source === 'env' ? 'VAPID from environment' : `VAPID from ${path.relative(process.cwd(), keys.source.replace(' (generated)', ''))}`),
  webPush,
};
