-- 0021 — session hardening
--
-- Two changes to how a signed-in session is kept.
--
-- 1. The cookie token is no longer stored. `id` becomes the SHA-256 of the
--    token, hex. A copy of this table used to be a set of working logins;
--    now it unlocks nothing. Every row written before this holds a raw
--    token that the new lookup can never match, so they go now rather than
--    sitting here for fourteen days. Everyone signs in again once.
--
-- 2. `last_seen_at`, so a session that goes unused ends before its absolute
--    expiry: seven days idle for a mother, twelve hours for a clinician.
--    Written at most once every few minutes, not on every request.

DELETE FROM sessions;

ALTER TABLE sessions
  ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now();

CREATE INDEX IF NOT EXISTS sessions_last_seen_idx ON sessions (last_seen_at);

COMMENT ON COLUMN sessions.id IS
  'SHA-256 of the cookie token, as hex. The token itself is never stored.';
COMMENT ON COLUMN sessions.last_seen_at IS
  'Last request on this session, to within a few minutes. Idle sessions end before expires_at.';
