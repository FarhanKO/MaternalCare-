/**
 * Voice API Controller — speech to text for the symptom logger.
 *
 * Thin, like the rest: it resolves who is asking so the transcription can be
 * done in her own reading language, and hands the audio to the model. The
 * recording is never written to disk and never reaches the database.
 */
const voiceModel = require('../../models/voiceModel');
const userModel = require('../../models/userModel');
const { badRequest } = require('../respond');

/**
 * Whether the client should record audio at all.
 *
 * Asked before the microphone is opened, so a deployment with no key set
 * quietly keeps using the browser's own recognition instead of recording
 * something it has nowhere to send.
 */
exports.capability = async (req, res) => {
  res.json({ data: { available: voiceModel.available() } });
};

exports.transcribe = async (req, res) => {
  const { audio } = req.body || {};
  try {
    const me = await userModel.current();
    const { text, model } = await voiceModel.transcribe(audio, me?.language || 'en');
    res.json({ data: { text, model } });
  } catch (err) {
    if (err.code === 'NOT_CONFIGURED') {
      // 501: the request was fine, this server just cannot do it
      return res.status(501).json({ error: err.message, code: 'NOT_CONFIGURED' });
    }
    if (err.code === 'TIMEOUT') return res.status(504).json({ error: err.message, code: 'TIMEOUT' });
    if (err.code === 'UPSTREAM') {
      console.error('[voice] upstream:', err.message, err.detail || '');
      return res.status(502).json({ error: err.message, code: 'UPSTREAM' });
    }
    return badRequest(res, err);
  }
};
