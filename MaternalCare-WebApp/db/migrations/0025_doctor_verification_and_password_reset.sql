-- 0025 — doctors are checked before mothers can book them, and passwords can
-- be reset by email.
--
-- Until now anyone could register as a clinician with any licence number and
-- was listed, bookable and able to moderate the community straight away.
-- A doctor is now "pending" until an admin verifies the licence.

ALTER TABLE doctors
  ADD COLUMN IF NOT EXISTS verified_at    TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS verified_by    INTEGER REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS rejected_at    TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS rejection_note TEXT;

-- Everyone already on the roster keeps working. An admin can still reject any
-- of them from the admin page if a licence turns out to be wrong.
UPDATE doctors SET verified_at = now() WHERE verified_at IS NULL AND rejected_at IS NULL;

-- One-time password reset links. Only a SHA-256 hash of the token is stored,
-- so a leaked table cannot be used to reset anyone's password.
CREATE TABLE IF NOT EXISTS password_resets (
  id          INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id     INTEGER     NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash  TEXT        NOT NULL UNIQUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at  TIMESTAMPTZ NOT NULL,
  used_at     TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS password_resets_user_idx ON password_resets (user_id);

-- same lock-down as every other table (see 0002)
ALTER TABLE password_resets ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON password_resets FROM anon, authenticated;
