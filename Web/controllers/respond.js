/**
 * The one answer a controller gives when a model refuses a request.
 *
 * Most models validate by throwing — "Blood group must be one of…", "A
 * reminder needs a title" — and the controller answers 400 with the
 * message, which is what the form shows under the field. Twenty-eight
 * handlers did that as `res.status(400).json({ error: err.message })` in a
 * catch that caught *everything*, so a database error took the same path:
 * a dropped connection, a constraint the seed left half-applied, a column
 * a migration had not added yet — each answered 400, blaming the caller,
 * with Postgres's own wording ("null value in column "user_id" violates
 * not-null constraint") as the message on her screen.
 *
 * Those are ours, not hers. They go to the global handler in app.js as a
 * 500, logged, with nothing of the schema in the response.
 */
const { DatabaseError } = require('../config/db');

/**
 * 400 with the model's message — or, for a database failure, the 500 it
 * really is. `next` is optional for the handlers written without one.
 */
function badRequest(res, err, next) {
  if (err instanceof DatabaseError) {
    if (next) return next(err);
    console.error('[server error]', err);
    return res.status(500).json({ error: 'Something went wrong on our side. Please try again.' });
  }
  const body = { error: err.message };
  if (err.code) body.code = err.code;
  if (err.field) body.field = err.field;
  return res.status(400).json(body);
}

module.exports = { badRequest };
