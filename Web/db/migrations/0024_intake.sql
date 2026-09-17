-- 0024 — everything the questionnaire asks has somewhere to go
--
-- Onboarding asked a dozen things it then dropped: date of birth (only an
-- age was derived), height and weight for anyone not pregnant, allergies,
-- and every stage-specific answer — first pregnancy, complications,
-- multiples, how long she has been trying, folic acid, whether milestones
-- are on track. A question whose answer vanishes is worse than no question.
--
-- The four with a plain meaning get columns. The rest — the answers that
-- describe her situation rather than measure her — live in `intake`, keyed
-- by the question id the client uses, so the questionnaire can be reopened
-- with her answers already in it and changed.

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS dob       DATE,
  ADD COLUMN IF NOT EXISTS height_cm REAL CHECK (height_cm IS NULL OR (height_cm BETWEEN 100 AND 230)),
  ADD COLUMN IF NOT EXISTS weight_kg REAL CHECK (weight_kg IS NULL OR (weight_kg BETWEEN 25 AND 250)),
  ADD COLUMN IF NOT EXISTS allergies TEXT,
  ADD COLUMN IF NOT EXISTS intake    JSONB NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN users.intake IS
  'Stage-specific questionnaire answers, keyed by question id (e.g. first_pregnancy, trying). Merged on each save.';
