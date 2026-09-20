/**
 * Account deletion and data export.
 *
 * The password is checked here rather than trusted from the client, because
 * this is the one action in the application that cannot be undone. A session
 * cookie proves the browser was signed in at some point; it does not prove the
 * person at the keyboard is her.
 */
const accountModel = require('../../models/accountModel');
const authModel = require('../../models/authModel');
const userModel = require('../../models/userModel');
const session = require('../../middleware/session');

/** Everything we hold, as a JSON file she can keep. */
exports.exportData = async (req, res, next) => {
  try {
    const user = await userModel.current();
    const data = await accountModel.exportFor(user.id);
    const stamp = new Date().toISOString().slice(0, 10);
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="maternalcare-${stamp}.json"`,
    );
    return res.send(JSON.stringify(data, null, 2));
  } catch (err) { return next(err); }
};

/**
 * Delete the account.
 *
 * Requires the password. A wrong one is answered the same way a wrong login
 * is — without saying whether the password or the account was the problem.
 */
exports.requestDeletion = async (req, res, next) => {
  const { password, reason, feedback } = req.body || {};
  try {
    const user = await userModel.current();

    if (!password) {
      return res.status(400).json({ error: 'Enter your password to confirm' });
    }
    const stored = await userModel.passwordHash(user.id);
    const ok = stored ? await authModel.verify(String(password), stored) : false;
    if (!ok) {
      return res.status(401).json({ error: 'That password does not match this account' });
    }

    const state = await accountModel.requestDeletion(user.id, {
      role: user.role, reason, feedback,
    });

    // the session is already gone server-side; clear the cookie too — by
    // the name and attributes it was set with, or a __Host- cookie in
    // production is left behind (a dead one, but one the browser keeps
    // sending until it expires)
    res.clearCookie(session.COOKIE, session.clearOptions());

    return res.json({
      data: {
        deletedAt: state.deletedAt,
        purgeAfter: state.purgeAfter,
        graceDays: accountModel.GRACE_DAYS,
      },
    });
  } catch (err) {
    if (/already scheduled|no longer exists/i.test(err.message)) {
      return res.status(409).json({ error: err.message });
    }
    return next(err);
  }
};
