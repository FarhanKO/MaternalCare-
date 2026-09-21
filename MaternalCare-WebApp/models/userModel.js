/**
 * User Model — the account, and the profile details attached to it.
 *
 * Name, photo and bio used to live only in React state, so every edit was
 * lost on refresh and the doctor never saw the same name the mother did.
 * They are columns now. The photo follows the documents rule: bytes on disk,
 * file name in the row.
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const db = require('../config/db');
const context = require('../config/context');
const authModel = require('./authModel');
const intakeModel = require('./intakeModel');
const { resolveUpload } = require('../config/uploads');

const UPLOAD_DIR = path.join(__dirname, '..', 'data', 'uploads');
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const MAX_AVATAR_BYTES = 3 * 1024 * 1024;
const MIME_EXT = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };
const MAX_BIO = 280;

module.exports = {
  async registerMother({ name, email, phone, password, stage, acceptedTerms } = {}) {
    const cleanName = String(name || '').trim();
    const termsVersion = this.termsVersionFrom(acceptedTerms);
    const cleanEmail = String(email || '').trim().toLowerCase();
    const cleanPhone = String(phone || '').trim();
    const cleanStage = String(stage || 'pregnant').trim();
    if (cleanName.length < 2 || cleanName.length > 60) {
      const err = new Error('Please give your full name'); err.code = 'INVALID_REGISTRATION'; err.field = 'name'; throw err;
    }
    if (cleanEmail.length > 254 || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(cleanEmail)) {
      const err = new Error('That does not look like an email address'); err.code = 'INVALID_REGISTRATION'; err.field = 'email'; throw err;
    }
    if (!this.STAGES.includes(cleanStage)) {
      const err = new Error('Choose your current stage'); err.code = 'INVALID_REGISTRATION'; err.field = 'stage'; throw err;
    }
    if (cleanPhone && cleanPhone.replace(/\D/g, '').length < 6) {
      const err = new Error('Please give a valid phone number'); err.code = 'INVALID_REGISTRATION'; err.field = 'phone'; throw err;
    }
    const passwordHash = await authModel.hash(String(password || ''));
    try {
      const row = await db.insert(
        `INSERT INTO users (name, role, email, phone, stage, password_hash,
                            terms_version, terms_accepted_at)
         VALUES ($1, 'mother', $2, $3, $4, $5, $6, now()) RETURNING *`,
        [cleanName, cleanEmail, cleanPhone || null, cleanStage, passwordHash, termsVersion],
      );
      return row;
    } catch (err) {
      if (err.code === '23505') {
        const conflict = new Error('An account already exists with that email');
        conflict.code = 'INVALID_REGISTRATION'; conflict.field = 'email'; throw conflict;
      }
      throw err;
    }
  },

  /**
   * The terms version a registration says it agreed to.
   *
   * A version, not a boolean: "I agree" means nothing without knowing what
   * was on the screen. The client sends the version of the document it
   * showed; the shape is checked so a stray `true` cannot pass for one.
   */
  termsVersionFrom(acceptedTerms) {
    const v = String(acceptedTerms || '').trim();
    if (!/^\d{4}-\d{2}$/.test(v)) {
      const err = new Error('Please agree to the terms and privacy policy to continue');
      err.code = 'INVALID_REGISTRATION'; err.field = 'terms'; throw err;
    }
    return v;
  },

  async find(id) {
    return db.one('SELECT * FROM users WHERE id = $1', [id]);
  },

  /**
   * The signed-in user.
   *
   * Was `SELECT * FROM users WHERE role='mother' ORDER BY id LIMIT 1` — every
   * request was the same woman, and there was nothing to sign in to. It reads
   * the session context now, which the session middleware populates per
   * request.
   *
   * Outside a request — a seed script, a test, the model suite — there is no
   * context, and it falls back to the first mother so those keep working.
   * That fallback is explicitly *not* reachable from an HTTP request: the
   * middleware always establishes a context, so a browser with no cookie gets
   * a null user and a 401, not somebody else's records.
   */
  async current() {
    const signedIn = context.user();
    if (signedIn) return signedIn;

    if (process.env.NODE_ENV === 'production') return null;
    return db.one("SELECT * FROM users WHERE role = 'mother' ORDER BY id LIMIT 1");
  },

  /** Every mother on the platform. */
  async mothers() {
    return db.sql(
      `SELECT id, name, stage, age, conditions, email FROM users
        WHERE role = 'mother' ORDER BY id`,
    );
  },

  /** Life stage drives which reading and news the client shows. */
  STAGES: ['pregnant', 'new-mother', 'parent', 'planning', 'general'],

  /** The languages the app is translated into. */
  LANGUAGES: ['en', 'bn'],

  /**
   * Her reading language.
   *
   * Stored on the account rather than only in her browser because the care
   * plan and the risk assessment are composed as sentences on the server —
   * the server has to know which language to compose them in, and a
   * localStorage value in one browser cannot tell it.
   */
  async setLanguage(id, language) {
    if (!this.LANGUAGES.includes(language)) {
      throw new Error(`Unknown language: ${language}`);
    }
    await db.run('UPDATE users SET language = $2 WHERE id = $1', [id, language]);
    return language;
  },

  async language(id) {
    const row = await db.one('SELECT language FROM users WHERE id = $1', [id]);
    return row?.language ?? 'en';
  },

  async setStage(id, stage) {
    if (!this.STAGES.includes(stage)) throw new Error(`Unknown stage: ${stage}`);
    await db.run('UPDATE users SET stage = $2 WHERE id = $1', [id, stage]);
    return this.find(id);
  },

  /** Shape the client reads — the avatar as a URL, not a raw file name. */
  async profile(id) {
    const u = await this.find(id);
    if (!u) return null;
    return {
      id: String(u.id),
      name: u.name,
      stage: u.stage,
      bio: u.bio || '',
      avatar: u.avatar_file ? `/api/profile/avatar/${u.avatar_file}` : null,
      bloodGroup: u.blood_group || null,
      age: u.age ?? null,
      /* she typed this at registration; the profile panel had no way to read it */
      conditions: u.conditions || '',
      emergencyNumber: u.emergency_number || '999',
      dob: u.dob ? String(u.dob).slice(0, 10) : null,
      heightCm: u.height_cm ?? null,
      weightKg: u.weight_kg ?? null,
      allergies: u.allergies || '',
      /* the stage-specific questionnaire answers, keyed by question id */
      intake: u.intake && typeof u.intake === 'object' ? u.intake : {},
      /* the same answers as label/value lines for her stage, each carrying
         the question id so the panel can reopen the form on it */
      history: intakeModel.linesFor(intakeModel.historyFor(u), u.stage || 'pregnant'),
    };
  },

  /**
   * The questionnaire answers she has already given, in the shape the
   * questionnaire uses, so it can be reopened with them filled in. Only
   * what lives on the users row: the pregnancy and the child are read by
   * their own models and merged by the controller.
   */
  async intakeFor(id) {
    const u = await this.find(id);
    if (!u) return {};
    const conditions = String(u.conditions || '').split(',').map((c) => c.trim()).filter(Boolean);
    return {
      dob: u.dob ? String(u.dob).slice(0, 10) : undefined,
      blood: u.blood_group || undefined,
      height: u.height_cm ?? undefined,
      weight: u.weight_kg ?? undefined,
      conditions: conditions.length ? conditions : ['None'],
      allergies: u.allergies || undefined,
      ...(u.intake && typeof u.intake === 'object' ? u.intake : {}),
    };
  },

  /**
   * Keep the stage-specific answers.
   *
   * The catalogue of questions lives with the questionnaire (the client
   * decides what to ask a woman planning a pregnancy versus one with a
   * toddler); what is checked here is the shape — sensible keys, short
   * answers, a bounded number of them — so the column cannot become a
   * dumping ground. Merged, not replaced: reopening the questionnaire to
   * change one answer must not blank the others.
   */
  async saveIntake(id, answers) {
    if (!answers || typeof answers !== 'object' || Array.isArray(answers)) return this.profile(id);
    const clean = {};
    const text = (v) => (typeof v === 'string' || typeof v === 'number') && String(v).trim().length <= 120
      ? String(v).trim() : null;
    for (const [key, value] of Object.entries(answers).slice(0, 30)) {
      if (!/^[a-z][a-z0-9_]{1,29}$/.test(key)) continue;
      if (Array.isArray(value)) {
        const list = value.map(text).filter(Boolean).slice(0, 12);
        if (list.length) clean[key] = list;
      } else {
        const t = text(value);
        if (t) clean[key] = t;
      }
    }
    if (Object.keys(clean).length) {
      await db.run('UPDATE users SET intake = intake || $2::jsonb WHERE id = $1', [id, JSON.stringify(clean)]);
    }
    return this.profile(id);
  },

  /**
   * The stored hash for this account.
   *
   * Only used to re-confirm a password before something irreversible. Kept
   * here rather than letting a controller read the column, so the one place
   * that knows how passwords are stored stays the one place.
   */
  async passwordHash(id) {
    const row = await db.one('SELECT password_hash FROM users WHERE id = $1', [id]);
    return row?.password_hash || null;
  },

  async setName(id, name) {
    const label = String(name || '').trim();
    if (!label) throw new Error('A name cannot be empty');
    if (label.length > 60) throw new Error('That name is too long');
    await db.run('UPDATE users SET name = $2 WHERE id = $1', [id, label]);
    return this.profile(id);
  },

  async setBio(id, bio) {
    const text = String(bio ?? '').trim();
    if (text.length > MAX_BIO) throw new Error(`A bio must be ${MAX_BIO} characters or fewer`);
    await db.run('UPDATE users SET bio = $2 WHERE id = $1', [id, text]);
    return this.profile(id);
  },

  /** `dataUrl` null removes the photo and falls back to initials. */
  async setAvatar(id, dataUrl) {
    const current = await this.find(id);
    const previous = current?.avatar_file;

    if (dataUrl === null || dataUrl === '') {
      await db.run('UPDATE users SET avatar_file = NULL WHERE id = $1', [id]);
      if (previous) this.removeFile(previous);
      return this.profile(id);
    }

    const match = /^data:([^;,]+);base64,(.+)$/s.exec(String(dataUrl || ''));
    if (!match) throw new Error('That photo could not be read');
    const mime = match[1].toLowerCase();
    if (!MIME_EXT[mime]) throw new Error('Use a JPG, PNG or WEBP photo');

    const buffer = Buffer.from(match[2], 'base64');
    if (!buffer.length) throw new Error('That photo is empty');
    if (buffer.length > MAX_AVATAR_BYTES) throw new Error('Photos must be 3 MB or smaller');

    const fileName = `${crypto.randomUUID()}.${MIME_EXT[mime]}`;
    fs.writeFileSync(path.join(UPLOAD_DIR, fileName), buffer);
    await db.run('UPDATE users SET avatar_file = $2 WHERE id = $1', [id, fileName]);

    // replacing a photo should not leave the old one on disk forever
    if (previous) this.removeFile(previous);
    return this.profile(id);
  },

  /** Editable clinical basics shown on the profile panel. */
  async setDetails(id, {
    bloodGroup, age, conditions, dob, heightCm, weightKg, allergies,
  }) {
    if (dob !== undefined) {
      const d = String(dob || '').trim();
      if (d && !/^\d{4}-\d{2}-\d{2}$/.test(d)) throw new Error('A date of birth is needed, as YYYY-MM-DD');
      if (d) {
        const years = (Date.now() - new Date(`${d}T00:00:00`).getTime()) / 31557600000;
        if (!(years >= 10 && years <= 70)) throw new Error('That date of birth looks wrong');
      }
      await db.run('UPDATE users SET dob = $2 WHERE id = $1', [id, d || null]);
    }
    const measure = (v, lo, hi, label) => {
      if (v === undefined) return undefined;
      if (v === null || v === '') return null;
      const n = Number(v);
      if (!Number.isFinite(n) || n < lo || n > hi) throw new Error(`That ${label} looks wrong`);
      return n;
    };
    const h = measure(heightCm, 100, 230, 'height');
    if (h !== undefined) await db.run('UPDATE users SET height_cm = $2 WHERE id = $1', [id, h]);
    const w = measure(weightKg, 25, 250, 'weight');
    if (w !== undefined) await db.run('UPDATE users SET weight_kg = $2 WHERE id = $1', [id, w]);
    if (allergies !== undefined) {
      await db.run('UPDATE users SET allergies = $2 WHERE id = $1',
        [id, String(allergies || '').trim().slice(0, 200) || null]);
    }
    if (conditions !== undefined) {
      // onboarding sends the chips as an array; the column is one line of text
      const list = Array.isArray(conditions) ? conditions : [conditions];
      const clean = list
        .map((c) => String(c || '').trim())
        .filter((c) => c && c.toLowerCase() !== 'none')
        .slice(0, 12)
        .join(', ')
        .slice(0, 300);
      await db.run('UPDATE users SET conditions = $2 WHERE id = $1', [id, clean || null]);
    }
    if (bloodGroup !== undefined) {
      if (String(bloodGroup).trim().length > 10) throw new Error('That blood group is too long');
      await db.run('UPDATE users SET blood_group = $2 WHERE id = $1',
        [id, String(bloodGroup).trim() || null]);
    }
    if (age !== undefined) {
      const n = Number(age);
      if (!Number.isFinite(n) || n < 10 || n > 70) throw new Error('That age looks wrong');
      await db.run('UPDATE users SET age = $2 WHERE id = $1', [id, n]);
    }
    return this.profile(id);
  },

  /** Absolute path of a stored photo, or null — see config/uploads. */
  avatarPath(fileName) {
    return resolveUpload(UPLOAD_DIR, fileName);
  },

  removeFile(fileName) {
    const full = this.avatarPath(fileName);
    if (full) { try { fs.unlinkSync(full); } catch { /* already gone */ } }
  },

  async emergencyContacts(userId) {
    return db.sql('SELECT * FROM emergency_contacts WHERE user_id = $1 ORDER BY id', [userId]);
  },
};
