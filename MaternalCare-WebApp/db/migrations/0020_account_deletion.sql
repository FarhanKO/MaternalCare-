-- Account deletion, with a seven-day window before the data actually goes.
--
-- Two things have to be true at once, and they pull against each other:
--
--   * she asked for her account to be deleted, so from her side it must be
--     gone immediately — she cannot sign in, and nothing of hers is served;
--   * a maternity record is not a shopping cart. If an account is deleted
--     during a clinical episode, the seven days give a care team and an
--     auditor somewhere to look before the record stops existing.
--
-- So deletion is a state, not an event. `deleted_at` locks the account out the
-- moment she confirms; `purge_after` is when the rows are actually destroyed.
--
-- The purge is a real delete, not a flag. Most tables cascade from users.id,
-- but four do not — posts, post_comments, content_reports and doctors all SET
-- NULL, which would leave her name and her words on the public board attached
-- to no account. The purge removes those explicitly; see models/accountModel.js.

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS deleted_at  TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS purge_after TIMESTAMPTZ;

-- the sweep asks "what is due" on a schedule, so it wants an index
CREATE INDEX IF NOT EXISTS users_purge_after_idx
  ON users (purge_after) WHERE purge_after IS NOT NULL;

/*
 * Why people leave.
 *
 * Deliberately NOT cascaded from users: the whole point is that this outlives
 * the account. `user_id` is SET NULL by the purge, so after seven days the row
 * is a reason and a date belonging to nobody — which is what makes it safe to
 * keep. No name, no email, no phone is copied here at any point.
 */
CREATE TABLE IF NOT EXISTS account_deletions (
  id           SERIAL PRIMARY KEY,
  user_id      INTEGER REFERENCES users(id) ON DELETE SET NULL,
  /** 'mother' or 'clinician' — which side of the app is being left */
  role         TEXT NOT NULL,
  /** one of the offered reasons, or 'other' */
  reason       TEXT NOT NULL,
  /** whatever she chose to write, in her own words. Optional. */
  feedback     TEXT,
  requested_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  purge_after  TIMESTAMPTZ NOT NULL,
  /** set by the sweep when the rows were actually destroyed */
  purged_at    TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS account_deletions_purge_idx
  ON account_deletions (purge_after) WHERE purged_at IS NULL;
