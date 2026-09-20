/**
 * Files a user uploaded, on their way back out.
 *
 * Avatars, community images, chat photographs and filed documents all live
 * under data/uploads as `<uuid>.<ext>`, and four routes stream them back by
 * name. Each of those used to check the name with `/^[\w.-]+$/` — which
 * admits `.` and `..`. Either resolves to a directory, `existsSync` says
 * yes, and `createReadStream` then raises EISDIR on a stream nobody was
 * listening to. Node turns an unhandled stream error into an uncaught
 * exception, and app.js (rightly) ends the process on one of those — so
 * `GET /api/community/images/..`, a public route, took the whole server
 * down with a single request.
 *
 * Two rules now, in one place: a name is looked up only if it is shaped
 * like something a model wrote, and the stream is always given an error
 * handler before it is piped.
 */
const fs = require('fs');
const path = require('path');

const UPLOAD_ROOT = path.join(__dirname, '..', 'data', 'uploads');

/* a UUID (or any random token), one dot, a short extension — and nothing
   that could name a directory, a hidden file or a path */
const STORED_NAME = /^[A-Za-z0-9_-]+\.[A-Za-z0-9]{1,8}$/;

/**
 * The absolute path of a stored file, or null when the name is not one of
 * ours or the bytes are gone. Never a directory.
 */
function resolveUpload(dir, fileName) {
  const name = String(fileName || '');
  if (!STORED_NAME.test(name)) return null;
  const full = path.join(dir, name);
  try {
    return fs.statSync(full).isFile() ? full : null;
  } catch {
    return null;
  }
}

/**
 * Stream a stored file into a response.
 *
 * A file that vanishes between the stat and the read — a purge sweep, a
 * redeploy on an ephemeral disk — answers 404 like any other missing file
 * rather than surfacing as a crash. Once bytes have started flowing the
 * only honest thing left is to cut the connection.
 */
function sendUpload(res, full, { mime, cacheSeconds = 3600, nosniff = false } = {}) {
  if (mime) res.setHeader('Content-Type', mime);
  if (nosniff) res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Cache-Control', `private, max-age=${cacheSeconds}`);

  const stream = fs.createReadStream(full);
  stream.on('error', (err) => {
    if (res.headersSent) {
      res.destroy(err);
      return;
    }
    res.setHeader('Cache-Control', 'no-store');
    res.status(err.code === 'ENOENT' ? 404 : 500).json({
      error: err.code === 'ENOENT' ? 'File not found' : 'That file could not be read',
    });
  });
  stream.pipe(res);
}

module.exports = { UPLOAD_ROOT, STORED_NAME, resolveUpload, sendUpload };
