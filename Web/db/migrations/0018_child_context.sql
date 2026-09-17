-- What the app already asks about a child, given somewhere to live.
--
-- Onboarding asks a new mother for her baby's date of birth, delivery type,
-- feeding method and birth weight, and asks a parent about growth and
-- immunisation. Only the date of birth had a column, so the rest was collected
-- and dropped. Two of them are not decoration:
--
--   feeding      decides whether the "extra energy" figure on her dashboard
--                applies at all — it is the additional intake for
--                breastfeeding, and it is wrong for a formula-fed baby.
--   birth weight is the first point on the growth curve, and without it the
--                curve starts wherever the first clinic visit happened to be.
--
-- Symptoms gain a child. The logger has only ever recorded the mother's, so a
-- mother of a one-year-old had nowhere to say the child had a fever — she had
-- to log it as her own or not at all, and the guidance then read it as hers.
-- Nullable, because a pregnant woman's symptoms belong to nobody else.

ALTER TABLE children
  ADD COLUMN IF NOT EXISTS feeding TEXT
    CHECK (feeding IS NULL OR feeding IN ('breastfeeding', 'formula', 'mixed')),
  ADD COLUMN IF NOT EXISTS delivery TEXT
    CHECK (delivery IS NULL OR delivery IN ('vaginal', 'c-section'));

ALTER TABLE symptoms
  ADD COLUMN IF NOT EXISTS child_id INTEGER REFERENCES children(id) ON DELETE CASCADE;

-- the logger reads one person's list at a time, and almost always the mother's
CREATE INDEX IF NOT EXISTS symptoms_child_idx
  ON symptoms (child_id, logged_at DESC) WHERE child_id IS NOT NULL;
