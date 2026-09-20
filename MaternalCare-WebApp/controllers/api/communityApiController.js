/**
 * Community API Controller — posts and their comments.
 * Thin: paging, validation and image handling all live in postModel.
 */
const postModel = require('../../models/postModel');
const moderationModel = require('../../models/moderationModel');
const userModel = require('../../models/userModel');
const pregnancyModel = require('../../models/pregnancyModel');
const { sendUpload } = require('../../config/uploads');

exports.index = async (req, res, next) => {
  const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 20));
  const offset = Math.max(0, Number(req.query.offset) || 0);
  const topic = req.query.topic;

  try {
    const user = await userModel.current();
    const [data, total] = await Promise.all([
      // viewer id so each post knows whether she is one of the people who hearted it
      postModel.all({ limit, offset, topic, viewerId: user.id }),
      postModel.count(topic),
    ]);
    /*
     * Which of these she has already reported, so the button can say so
     * rather than failing when she presses it a second time. One extra query
     * for the page, not one per post.
     */
    const mine = await moderationModel.reportedBy(user.id, data.map((p) => p.id));
    for (const post of data) {
      post.reported = mine.has(`post:${post.id}`);
      for (const c of post.comments) c.reported = mine.has(`comment:${c.id}`);
    }
    res.json({
      data,
      meta: { total, limit, offset, reasons: moderationModel.reasons() },
    });
  } catch (err) { next(err); }
};

/**
 * The sidebar figures for the signed-in mother's week group.
 *
 * Her week comes from her own pregnancy, so the cohort is worked out per
 * caller rather than being a board-wide constant.
 */
exports.weekGroup = async (req, res, next) => {
  try {
    const user = await userModel.current();
    const pregnancy = await pregnancyModel.forUser(user.id).catch(() => null);
    res.json({ data: await postModel.weekGroup(pregnancy?.week) });
  } catch (err) { next(err); }
};

/** Report a post or one of its comments. */
exports.report = async (req, res, next) => {
  try {
    const user = await userModel.current();
    const target = req.params.target === 'comments' ? 'comment' : 'post';
    const created = await moderationModel.report({
      postId: target === 'post' ? req.params.id : null,
      commentId: target === 'comment' ? req.params.id : null,
      reporterId: user.id,
      reason: req.body?.reason,
      detail: req.body?.detail,
    });
    return res.status(201).json({ data: created });
  } catch (err) {
    if (err instanceof moderationModel.ReportError) {
      const status = err.code === 'NOT_FOUND' ? 404
        : err.code === 'ALREADY_REPORTED' ? 409 : 400;
      return res.status(status).json({ error: err.message, code: err.code });
    }
    return next(err);
  }
};

/** She posts as herself, at whatever week she is currently in. */
exports.create = async (req, res, next) => {
  try {
    const user = await userModel.current();
    const pregnancy = await pregnancyModel.forUser(user.id);
    const created = await postModel.create(user.id, {
      author: user.name,
      role: 'mother',
      week: pregnancy ? pregnancy.week : undefined,
      topic: req.body?.topic,
      title: req.body?.title,
      body: req.body?.body,
      imageDataUrl: req.body?.image,
    });
    res.status(201).json({ data: created });
  } catch (err) {
    if (err instanceof postModel.PostError) {
      return res.status(400).json({ error: err.message, code: err.code });
    }
    return next(err);
  }
};

exports.comment = async (req, res, next) => {
  try {
    const user = await userModel.current();
    res.status(201).json({
      data: await postModel.comment(req.params.id, user.id, {
        author: user.name,
        // accounts carry 'clinician'; the board's wire format says 'doctor'.
        // Comparing against 'doctor' alone matched nobody, so every clinician
        // who replied was filed as a mother and no post was ever marked answered.
        role: (user.role === 'clinician' || user.role === 'doctor') ? 'doctor' : 'mother',
        body: req.body?.body,
      }),
    });
  } catch (err) {
    if (err instanceof postModel.PostError) {
      const status = err.code === 'NOT_FOUND' ? 404 : 400;
      return res.status(status).json({ error: err.message, code: err.code });
    }
    return next(err);
  }
};

/**
 * Heart or un-heart a post, recorded against the person doing it.
 *
 * The body still carries a delta for the client that has always sent one, but
 * it is read as an intent rather than applied as arithmetic — the row either
 * exists for this user or it does not.
 */
exports.heart = async (req, res, next) => {
  const on = req.body?.delta !== -1;
  try {
    const user = await userModel.current();
    const updated = await postModel.heart(req.params.id, user.id, on);
    if (!updated) return res.status(404).json({ error: 'Post not found' });
    return res.json({ data: updated });
  } catch (err) { return next(err); }
};

const IMAGE_TYPES = { jpg: 'image/jpeg', png: 'image/png', webp: 'image/webp' };

/**
 * Post images, streamed from disk so list payloads stay small.
 *
 * The Content-Type used to be left off entirely, so every one of these
 * depended on the browser sniffing the bytes. It mostly worked in an <img>
 * tag and would not have worked anywhere else. `nosniff` goes with it: these
 * are files members uploaded, and the one thing that must never happen is a
 * browser deciding one of them is HTML.
 */
exports.image = (req, res) => {
  const full = postModel.imagePath(req.params.file);
  if (!full) return res.status(404).json({ error: 'Image not found' });
  const ext = req.params.file.split('.').pop().toLowerCase();
  return sendUpload(res, full, {
    mime: IMAGE_TYPES[ext] || 'application/octet-stream', nosniff: true, cacheSeconds: 86400,
  });
};
