-- 0022 — which terms an account agreed to, and when
--
-- The registration form always had "I agree to the Terms and Privacy
-- Policy" as a required box, and nothing recorded that it was ticked, or
-- to which version. The document is versioned now (frontend/src/data/terms.ts),
-- registration refuses to proceed without a version, and the profile shows
-- the one agreed to beside the current one.

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS terms_version     TEXT,
  ADD COLUMN IF NOT EXISTS terms_accepted_at TIMESTAMPTZ;

COMMENT ON COLUMN users.terms_version IS
  'The terms version shown at registration, e.g. 2026-09. Null for accounts that predate it.';
