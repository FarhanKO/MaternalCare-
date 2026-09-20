/**
 * Push API Controller — a device saying "tell me here", and the server
 * proving it can.
 *
 * The browser does most of the work: it asks permission, mints the keys and
 * gets an endpoint from its push service. This receives that subscription,
 * keeps it against the signed-in account, and offers a test message so she
 * can see a notification arrive before trusting a 6 a.m. tablet to it.
 */
const pushModel = require('../../models/pushModel');

/** The VAPID public key the browser subscribes with. Public by nature. */
exports.key = (req, res) => {
  res.json({ data: { publicKey: pushModel.publicKey } });
};

/** Is this device (its endpoint) on record, and how many devices are? */
exports.status = async (req, res, next) => {
  try {
    const endpoint = String(req.query.endpoint || '');
    const devices = await pushModel.subscriptionsFor(req.user.id);
    res.json({
      data: {
        thisDevice: endpoint ? devices.some((d) => d.endpoint === endpoint) : false,
        devices: devices.length,
      },
    });
  } catch (err) { next(err); }
};

exports.subscribe = async (req, res, next) => {
  try {
    const saved = await pushModel.subscribe(req.user.id, req.body?.subscription, req.headers['user-agent']);
    const devices = await pushModel.subscriptionsFor(req.user.id);
    res.status(201).json({ data: { id: saved.id, devices: devices.length } });
  } catch (err) {
    if (err.code === 'BAD_SUBSCRIPTION') return res.status(400).json({ error: err.message, code: err.code });
    return next(err);
  }
};

exports.unsubscribe = async (req, res, next) => {
  try {
    await pushModel.unsubscribe(req.user.id, req.body?.endpoint);
    const devices = await pushModel.subscriptionsFor(req.user.id);
    res.json({ data: { devices: devices.length } });
  } catch (err) { next(err); }
};

/** A message now, to every device on the account, so she can see it work. */
exports.test = async (req, res, next) => {
  try {
    const result = await pushModel.sendToUser(req.user.id, {
      title: 'MaternalCare+ can reach you here',
      body: 'This is what a reminder will look like. You can turn this off any time.',
      kind: 'test',
      at: new Date().toISOString(),
      tag: 'push-test',
      url: '/mother?tab=reminders',
    });
    if (result.devices === 0) {
      return res.status(409).json({ error: 'No device is set up for notifications yet', code: 'NO_DEVICE' });
    }
    return res.json({ data: result });
  } catch (err) { return next(err); }
};
