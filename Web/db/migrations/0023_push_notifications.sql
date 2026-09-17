-- 0023 — browser push notifications for reminders
--
-- A reminder used to exist only inside the application: it showed on the
-- dashboard, and in the bell, when she had the tab open. These two tables
-- let the server reach the device when she does not.
--
-- push_subscriptions is one row per device that said yes. The endpoint is
-- the push service's URL for that browser (Google's for Chrome, Mozilla's
-- for Firefox); p256dh and auth are the keys the browser minted, which the
-- server encrypts each message with so the push service cannot read it.
-- A row goes when she turns notifications off, when the push service says
-- the subscription is gone (404/410), or with the account.
--
-- reminder_pushes records each occurrence already sent, so a scheduler that
-- runs every minute — or restarts halfway through one — cannot send the
-- same 9 o'clock tablet twice. A daily reminder has one row per day.

CREATE TABLE IF NOT EXISTS push_subscriptions (
  id           INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  endpoint     TEXT    NOT NULL UNIQUE,
  p256dh       TEXT    NOT NULL,
  auth         TEXT    NOT NULL,
  user_agent   TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_used_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS push_subscriptions_user_idx ON push_subscriptions (user_id);

CREATE TABLE IF NOT EXISTS reminder_pushes (
  reminder_id   INTEGER NOT NULL REFERENCES reminders(id) ON DELETE CASCADE,
  occurrence_at TIMESTAMPTZ NOT NULL,
  sent_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  devices       INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (reminder_id, occurrence_at)
);

-- the same lockdown every other table has (see 0002): PostgREST gets nothing
ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE reminder_pushes    ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON push_subscriptions, reminder_pushes FROM anon, authenticated;
