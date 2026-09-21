/**
 * Voice Model — turning a recording of her voice into words.
 *
 * The symptom logger has always had a microphone button, driven by the
 * browser's own SpeechRecognition. That works, but it has two limits that
 * matter here: it is Chrome and Edge only, and its Bangla recognition is
 * patchy to absent on most devices — which is the wrong way round for this
 * product, since a woman who would rather speak than type is exactly the one
 * least likely to be typing English.
 *
 * This sends the audio to a transcription service instead, when one is
 * configured. It is deliberately optional: with no key the endpoint says so
 * plainly and the client keeps using the browser, in the same way the risk
 * assessment carries on without the model service.
 *
 * No audio is stored. It is held in memory for the length of one request and
 * then dropped — a recording of a woman describing her symptoms is not
 * something to keep on a disk without a reason to.
 */
const MAX_BYTES = 8 * 1024 * 1024;        // ~8 minutes of opus; far past a symptom list
const TIMEOUT_MS = Number(process.env.VOICE_TIMEOUT_MS) || 30_000;

/** Which service to call, and with what. All of it from the environment. */
function provider() {
  const key = process.env.OPENAI_API_KEY || process.env.VOICE_API_KEY;
  if (!key) return null;
  return {
    key,
    url: process.env.VOICE_API_URL || 'https://api.openai.com/v1/audio/transcriptions',
    model: process.env.VOICE_MODEL || 'whisper-1',
  };
}

/** BCP-47 for the tag we store on her account. */
const LANGUAGE = { en: 'en', bn: 'bn' };

module.exports = {
  /** Whether a service is configured, for the client to ask before recording. */
  available() {
    return Boolean(provider());
  },

  /**
   * @param {string} dataUrl  a `data:audio/...;base64,...` recording
   * @param {'en'|'bn'} language  what she reads the app in, as a hint
   */
  async transcribe(dataUrl, language = 'en') {
    const cfg = provider();
    if (!cfg) {
      const err = new Error('No transcription service is configured on this server');
      err.code = 'NOT_CONFIGURED';
      throw err;
    }

    const m = /^data:(audio\/[\w.+-]+);base64,(.+)$/s.exec(String(dataUrl || ''));
    if (!m) throw new Error('That does not look like an audio recording');

    const [, mime, b64] = m;
    const bytes = Buffer.from(b64, 'base64');
    if (!bytes.length) throw new Error('The recording was empty');
    if (bytes.length > MAX_BYTES) throw new Error('That recording is too long');

    // the API infers the container from the filename, so it has to match
    const ext = mime.includes('webm') ? 'webm'
      : mime.includes('ogg') ? 'ogg'
        : mime.includes('mp4') || mime.includes('m4a') ? 'm4a'
          : mime.includes('wav') ? 'wav'
            : 'webm';

    const form = new FormData();
    form.append('file', new Blob([bytes], { type: mime }), `speech.${ext}`);
    form.append('model', cfg.model);
    if (LANGUAGE[language]) form.append('language', LANGUAGE[language]);
    /*
     * Steering the model toward the vocabulary it is about to hear. Without it
     * "braxton hicks" and "pre-eclampsia" come back as approximate nonsense,
     * and the symptom matcher then finds nothing.
     */
    form.append('prompt', 'Symptoms described by a pregnant woman or a new mother: '
      + 'nausea, heartburn, back ache, swelling, fatigue, headache, cramps, poor sleep, '
      + 'dizziness, bleeding, reduced movement, blurred vision, fever, contractions.');

    const abort = new AbortController();
    const timer = setTimeout(() => abort.abort(), TIMEOUT_MS);
    try {
      const res = await fetch(cfg.url, {
        method: 'POST',
        headers: { Authorization: `Bearer ${cfg.key}` },
        body: form,
        signal: abort.signal,
      });

      if (!res.ok) {
        const body = await res.text().catch(() => '');
        /*
         * Never let the upstream body through untouched: an auth failure from
         * this API echoes part of the key back, and this message ends up in a
         * log and on her screen.
         */
        const reason = res.status === 401 ? 'the transcription key was rejected'
          : res.status === 429 ? 'the transcription service is rate limiting us'
            : `the transcription service answered ${res.status}`;
        const err = new Error(`Could not transcribe — ${reason}`);
        err.code = 'UPSTREAM';
        err.detail = body.slice(0, 200).replace(/sk-[A-Za-z0-9_-]+/g, 'sk-***');
        throw err;
      }

      const json = await res.json();
      return { text: String(json.text || '').trim(), model: cfg.model };
    } catch (err) {
      if (err.name === 'AbortError') {
        const e = new Error('Transcription took too long — please try again or type it');
        e.code = 'TIMEOUT';
        throw e;
      }
      throw err;
    } finally {
      clearTimeout(timer);
    }
  },
};
