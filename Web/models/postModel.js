/**
 * Post Model — the community board.
 *
 * Replaces what the React client held in `useState`, where every post,
 * comment and image disappeared the moment the tab closed. Comments are rows
 * now rather than an integer count, which is why the old `replies` column
 * could never be read back.
 *
 * Images follow the same rule as documents: bytes on disk under data/uploads,
 * only the file name in the row. Base64 in a text column would bloat every
 * list query with data no list ever displays.
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const db = require('../config/db');
const { resolveUpload } = require('../config/uploads');

const UPLOAD_DIR = path.join(__dirname, '..', 'data', 'uploads');
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const ROLES = ['mother', 'doctor'];
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const MAX_COMMENT_BODY = 2000;
const MAX_POST_TITLE = 160;
const MAX_POST_BODY = 10000;
const MAX_TOPIC = 80;
const MAX_AUTHOR = 80;
const MIME_EXT = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };

class PostError extends Error {
  constructor(message, code) {
    super(message);
    this.code = code;
  }
}

/** "2 h ago" — the community reads in relative time, not timestamps. */
function ago(iso) {
  const secs = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
  if (secs < 60) return 'just now';
  const mins = Math.round(secs / 60);
  if (mins < 60) return `${mins} m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs} h ago`;
  const days = Math.round(hrs / 24);
  return days < 7 ? `${days} d ago` : `${Math.round(days / 7)} w ago`;
}

/*
 * A comment a moderator has taken down becomes a tombstone rather than
 * disappearing. Half a thread is harder to read than a thread with a gap in
 * it, and a reply that answers something no longer visible misleads everyone
 * who arrives afterwards.
 */
const toComment = (c) => (c.hidden_at ? {
  id: String(c.id),
  author: c.author,
  role: c.role,
  body: 'This reply was removed by a moderator.',
  removed: true,
  removedReason: c.hidden_reason || null,
  ago: ago(c.created_at),
} : {
  id: String(c.id),
  author: c.author,
  role: c.role,
  body: c.body,
  removed: false,
  ago: ago(c.created_at),
});

/**
 * An account role, as the community board names it.
 *
 * User accounts carry `clinician`; the board's wire format has always said
 * `doctor`. Both are accepted here because the seed wrote `doctor` rows
 * directly while the application writes what the session carries, and a badge
 * that depends on which of the two a row happens to hold is not a badge worth
 * showing.
 */
const CLINICIAN_ROLES = new Set(['doctor', 'clinician']);

/**
 * The two heart columns every post read needs.
 *
 * `param` is the placeholder holding the viewer's id, written out by the
 * caller as '$2' or '$3' — null for anyone not signed in, which makes
 * `hearted` false rather than erroring.
 */
const HEART_COLUMNS = (param) => `
  (SELECT COUNT(*) FROM post_hearts h WHERE h.post_id = p.id) AS heart_count,
  EXISTS (SELECT 1 FROM post_hearts h WHERE h.post_id = p.id AND h.user_id = ${param}::int) AS hearted`;
const isClinician = (role) => CLINICIAN_ROLES.has(String(role || '').toLowerCase());

function toPost(p, comments) {
  return {
    id: String(p.id),
    author: p.author,
    role: p.role || 'mother',
    week: p.week ?? undefined,
    topic: p.topic || undefined,
    title: p.title,
    body: p.body || '',
    image: p.image_file ? `/api/community/images/${p.image_file}` : undefined,
    /*
     * How many people have hearted this — counted, not accumulated.
     *
     * `posts.hearts` was an integer the endpoint incremented, so it answered
     * to nobody: eight of nine seeded posts claimed more likes than there are
     * accounts in the system, and one person reloading the page could vote
     * again for ever. It is a row per person now, so the number cannot exceed
     * the number of people and a second vote is refused by the database.
     */
    hearts: Number(p.heart_count ?? 0),
    /** whether the signed-in viewer is one of them; false when nobody asked */
    hearted: Boolean(p.hearted),
    /*
     * Answered means a clinician has replied — read from the replies, not
     * from a stored flag.
     *
     * `posts.clinician_answered` was a column set once and never cleared, so
     * it drifted: three seeded posts wore the badge with no clinician comment
     * at all, and a post that did have one went unbadged because the flag was
     * only written when `user.role === 'doctor'`, which no account is. Reading
     * the replies cannot drift, and a reply a moderator takes down retracts
     * the badge on its own.
     */
    clinicianAnswered: comments.some((c) => isClinician(c.role) && !c.removed),
    ago: ago(p.created_at),
    /* set only in the moderator's view; the public board never sees these */
    removed: Boolean(p.hidden_at),
    removedReason: p.hidden_at ? (p.hidden_reason || null) : undefined,
    comments,
  };
}

/** Pulls the payload out of a data: URL and checks it is an image we accept. */
function decodeImage(dataUrl) {
  const match = /^data:([^;,]+);base64,(.+)$/s.exec(String(dataUrl || ''));
  if (!match) throw new PostError('That image could not be read', 'BAD_IMAGE');
  const mime = match[1].toLowerCase();
  if (!MIME_EXT[mime]) throw new PostError('Use a JPG, PNG or WEBP image', 'BAD_TYPE');
  const buffer = Buffer.from(match[2], 'base64');
  if (!buffer.length) throw new PostError('That image is empty', 'EMPTY');
  if (buffer.length > MAX_IMAGE_BYTES) throw new PostError('Images must be 5 MB or smaller', 'TOO_LARGE');
  return { mime, buffer };
}

module.exports = {
  PostError,
  MAX_IMAGE_BYTES,

  /** Comments for a set of posts, fetched in one query rather than per post. */
  async commentsFor(postIds) {
    if (!postIds.length) return new Map();
    const rows = await db.sql(
      `SELECT * FROM post_comments WHERE post_id = ANY($1::int[])
       ORDER BY created_at ASC, id ASC`,
      [postIds.map(Number)],
    );

    const grouped = new Map(postIds.map((id) => [Number(id), []]));
    for (const r of rows) grouped.get(r.post_id)?.push(toComment(r));
    return grouped;
  },

  /**
   * Newest first. `limit`/`offset` drive the community's "load more" so the
   * client never pulls the whole board at once.
   */
  /**
   * Newest first, and never anything a moderator has taken down.
   *
   * A removed *post* is dropped rather than left as a tombstone — unlike a
   * comment it is not holding a conversation together, and a board of
   * "removed" cards is its own kind of noise. `includeHidden` exists for the
   * moderation queue, which has to see what it is deciding about.
   */
  async all({
    limit = 20, offset = 0, topic, includeHidden = false, viewerId = null,
  } = {}) {
    const where = [];
    const args = [limit, offset, viewerId];
    // qualified with p. because the query joins the heart counts alongside
    if (!includeHidden) where.push('p.hidden_at IS NULL');
    if (topic && topic !== 'All') {
      args.push(topic);
      where.push(`p.topic = ${args.length}`);
    }
    const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';

    const rows = await db.sql(
      `SELECT p.*, ${HEART_COLUMNS('$3')}
         FROM posts p ${clause}
        ORDER BY p.created_at DESC, p.id DESC LIMIT $1 OFFSET $2`,
      args,
    );

    const comments = await this.commentsFor(rows.map((r) => r.id));
    return rows.map((p) => toPost(p, comments.get(p.id) ?? []));
  },

  async count(topic, { includeHidden = false } = {}) {
    const where = [];
    const args = [];
    if (!includeHidden) where.push('hidden_at IS NULL');
    if (topic && topic !== 'All') {
      args.push(topic);
      where.push(`topic = $${args.length}`);
    }
    const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const row = await db.one(`SELECT count(*) AS c FROM posts ${clause}`, args);
    return row.c;
  },

  async find(id, viewerId = null) {
    const row = await db.one(
      `SELECT p.*, ${HEART_COLUMNS('$2')} FROM posts p WHERE p.id = $1`,
      [id, viewerId],
    );
    if (!row) return null;
    const comments = await this.commentsFor([row.id]);
    return toPost(row, comments.get(row.id) ?? []);
  },

  async create(userId, { author, role = 'mother', week, topic, title, body, imageDataUrl }) {
    const heading = String(title || '').trim();
    if (!heading) throw new PostError('A post needs a title', 'NO_TITLE');
    if (heading.length > MAX_POST_TITLE) throw new PostError('Post titles must be 160 characters or fewer', 'TOO_LONG');
    const postBody = String(body || '').trim();
    if (postBody.length > MAX_POST_BODY) throw new PostError('Post text must be 10,000 characters or fewer', 'TOO_LONG');
    const postTopic = String(topic || '').trim();
    if (postTopic.length > MAX_TOPIC) throw new PostError('Post topics must be 80 characters or fewer', 'TOO_LONG');
    const postAuthor = String(author || 'A mother').trim();
    if (postAuthor.length > MAX_AUTHOR) throw new PostError('Author names must be 80 characters or fewer', 'TOO_LONG');
    if (!ROLES.includes(role)) throw new PostError(`Unknown role: ${role}`, 'BAD_ROLE');

    let imageFile = null;
    if (imageDataUrl) {
      const { mime, buffer } = decodeImage(imageDataUrl);
      imageFile = `${crypto.randomUUID()}.${MIME_EXT[mime]}`;
      fs.writeFileSync(path.join(UPLOAD_DIR, imageFile), buffer);
    }

    const row = await db.insert(
      `INSERT INTO posts (user_id, author, role, week, topic, title, body, image_file,
                          hearts, clinician_answered, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,0,FALSE,now()) RETURNING *`,
      [userId ?? null, postAuthor || 'A mother', role,
        Number.isFinite(week) ? week : null, postTopic || null,
        heading, postBody || null, imageFile],
    );
    return toPost(row, []);
  },

  async comment(postId, userId, { author, role = 'mother', body }) {
    const text = String(body || '').trim();
    if (!text) throw new PostError('A comment cannot be empty', 'EMPTY');
    if (text.length > MAX_COMMENT_BODY) throw new PostError('Comments must be 2,000 characters or fewer', 'TOO_LONG');
    const commentAuthor = String(author || 'A mother').trim();
    if (commentAuthor.length > MAX_AUTHOR) throw new PostError('Author names must be 80 characters or fewer', 'TOO_LONG');
    const post = await db.one('SELECT hidden_at FROM posts WHERE id = $1', [postId]);
    if (!post) throw new PostError('That post no longer exists', 'NOT_FOUND');
    if (post.hidden_at) {
      throw new PostError('This post was removed by a moderator', 'REMOVED');
    }

    await db.tx(async (t) => {
      await t.run(
        `INSERT INTO post_comments (post_id, user_id, author, role, body, created_at)
         VALUES ($1,$2,$3,$4,$5,now())`,
        [postId, userId ?? null, commentAuthor || 'A mother', role, text],
      );
      /*
       * The flag this used to set is gone. "Answered" is now read from the
       * replies themselves, so writing a column nobody reads would only
       * recreate the drift that made the badge wrong on four of nine posts.
       * `posts.clinician_answered` is now unused and can be dropped whenever
       * a migration is convenient.
       */
    });

    // pass the commenter so her own heart state survives the refresh
    return this.find(postId, userId);
  },

  /**
   * The sidebar's "Your week group" figures, counted rather than asserted.
   *
   * The panel showed 1,284 mothers, 36 clinicians and 92% answered. All three
   * were literals in the markup, under a heading naming her gestational week
   * — so the app told every mother the same three numbers about a cohort that
   * was never counted.
   *
   * `week` is her gestational week; the cohort is everyone within `spread`
   * weeks of her, because a group of exactly one week is usually a group of
   * one person. Mothers with no pregnancy on file are not counted: there is no
   * week to place them in, and guessing one would put us back where we started.
   */
  async weekGroup(week, { spread = 4 } = {}) {
    const centre = Number(week);
    const known = Number.isFinite(centre) && centre > 0;

    /*
     * Who is counted: everyone taking part on the board, by role.
     *
     * Counting only clinicians who had *replied* gave 1, while three had
     * written posts — so the panel said the board had one clinician on it
     * while their posts were visible above. Posting is taking part. A person
     * who has written a post or a reply is counted once, whichever they did.
     *
     * Identity is the account where there is one, and the display name where
     * there is not, because the seeded rows predate user ids and counting
     * those as one anonymous person each would undercount just as badly.
     */
    const participants = (roles) => `
      SELECT COUNT(*)::int AS n FROM (
        SELECT COALESCE(user_id::text, 'name:' || author) AS who
          FROM posts WHERE hidden_at IS NULL AND LOWER(role) IN (${roles})
        UNION
        SELECT COALESCE(user_id::text, 'name:' || author) AS who
          FROM post_comments WHERE hidden_at IS NULL AND LOWER(role) IN (${roles})
      ) q`;

    const [cohort, clinicians, answered] = await Promise.all([
      db.one(participants("'mother'")),
      db.one(participants("'doctor', 'clinician'")),

      // share of visible posts carrying at least one visible clinician reply
      db.one(
        `SELECT COUNT(*)::int AS total,
                COUNT(*) FILTER (WHERE answered)::int AS answered
           FROM (
             SELECT p.id,
                    EXISTS (
                      SELECT 1 FROM post_comments c
                       WHERE c.post_id = p.id AND c.hidden_at IS NULL
                         AND LOWER(c.role) IN ('doctor', 'clinician')
                    ) AS answered
               FROM posts p WHERE p.hidden_at IS NULL
           ) q`,
      ),
    ]);

    const total = answered?.total ?? 0;
    return {
      /** null when she has no pregnancy — the panel then says so instead of a week */
      week: known ? Math.round(centre) : null,
      spread,
      mothers: cohort?.n ?? 0,
      clinicians: clinicians?.n ?? 0,
      posts: total,
      answeredPosts: answered?.answered ?? 0,
      /** null rather than 0% when there is nothing to take a percentage of */
      answeredPct: total ? Math.round(((answered?.answered ?? 0) / total) * 100) : null,
    };
  },

  /** Toggling is the client's business; the model just applies the delta. */
  /**
   * Heart or un-heart, as the person doing it.
   *
   * The old signature took a delta and applied it to a counter, which is why
   * the same person could like a post repeatedly: nothing recorded that she
   * already had. This writes a row keyed on (post, user), so liking twice is a
   * no-op the database enforces rather than something the client is trusted
   * to prevent.
   */
  async heart(postId, userId, on = true) {
    if (!userId) throw new PostError('Sign in to react to a post', 'NO_USER');
    const post = await db.one('SELECT id FROM posts WHERE id = $1 AND hidden_at IS NULL', [postId]);
    if (!post) return null;

    if (on) {
      await db.run(
        `INSERT INTO post_hearts (post_id, user_id) VALUES ($1, $2)
         ON CONFLICT (post_id, user_id) DO NOTHING`,
        [postId, userId],
      );
    } else {
      await db.run('DELETE FROM post_hearts WHERE post_id = $1 AND user_id = $2', [postId, userId]);
    }
    return this.find(postId, userId);
  },

  /** Absolute path for streaming a post image back — see config/uploads. */
  imagePath(fileName) {
    return resolveUpload(UPLOAD_DIR, fileName);
  },
};
