/**
 * Sending email — used only for password reset links.
 *
 * Goes through Resend's HTTP API with Node's own fetch, so there is no new
 * dependency. Set on the server (Render → Environment):
 *
 *   RESEND_API_KEY   from https://resend.com/api-keys
 *   MAIL_FROM        e.g. "MaternalCare+ <no-reply@yourdomain.com>" (a domain verified in Resend)
 *
 * Without a key the message is not sent. Outside production the link is
 * printed to the server log instead, so the reset flow can be tested locally;
 * in production nothing secret is ever logged.
 */
const RESEND_URL = 'https://api.resend.com/emails';

function configured() {
  return Boolean(process.env.RESEND_API_KEY && process.env.MAIL_FROM);
}

/**
 * @param {{to: string, subject: string, text: string, html: string, devNote?: string}} msg
 * @returns {Promise<boolean>} true when the provider accepted it
 */
async function send({ to, subject, text, html, devNote }) {
  if (!configured()) {
    if (process.env.NODE_ENV === 'production') {
      console.warn('  [mail] RESEND_API_KEY / MAIL_FROM not set — reset email not sent');
    } else {
      console.log(`  [mail] (not sent — no RESEND_API_KEY) to ${to}: ${subject}${devNote ? `\n         ${devNote}` : ''}`);
    }
    return false;
  }
  try {
    const res = await fetch(RESEND_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ from: process.env.MAIL_FROM, to: [to], subject, text, html }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) {
      console.warn(`  [mail] provider answered ${res.status}`);
      return false;
    }
    return true;
  } catch (err) {
    console.warn(`  [mail] send failed: ${err.message}`);
    return false;
  }
}

module.exports = { send, configured };
