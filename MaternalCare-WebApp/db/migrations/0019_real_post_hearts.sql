-- Likes that correspond to people.
--
-- `posts.hearts` was a bare integer the endpoint incremented. Nothing recorded
-- WHO liked a post, so:
--
--   * the same person could like the same post forever — the client kept her
--     "liked" state in React state alone, so a reload handed her a fresh vote;
--   * the seeded figures answered to nobody. Eight of nine posts claimed more
--     likes than there are accounts in the whole system: 33, 61, 73, 113 —
--     against 13 registered users in total. A demo cannot show 113 people
--     liking something when 113 people do not exist.
--
-- One row per person per post, so the count is the number of people and the
-- unique constraint makes a second vote impossible rather than merely
-- discouraged.

CREATE TABLE IF NOT EXISTS post_hearts (
  id         SERIAL PRIMARY KEY,
  post_id    INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (post_id, user_id)
);

-- the board reads "how many hearts has this post" and "has she hearted it"
CREATE INDEX IF NOT EXISTS post_hearts_post_idx ON post_hearts (post_id);
CREATE INDEX IF NOT EXISTS post_hearts_user_idx ON post_hearts (user_id);

-- The old counter is no longer read. Left at zero rather than dropped so a
-- rollback is a code change and not a data loss; drop it in a later migration
-- once nothing anywhere refers to it.
UPDATE posts SET hearts = 0;
