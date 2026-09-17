-- One pregnancy row per mother.
--
-- The application has always assumed this: `pregnancyModel.forUser` reads with
-- `db.one`, so a second row for the same woman would be silently ignored and
-- the dashboard would derive her week from whichever the database happened to
-- return first. Nothing enforced it, because until now nothing could write a
-- pregnancy at all — the six that exist came from the seed.
--
-- Now that onboarding and "Edit due date" write here, correcting a date has to
-- update the row rather than add another, which is what ON CONFLICT needs this
-- constraint for.
--
-- Verified before writing this: no mother currently has more than one row.

ALTER TABLE pregnancies
  ADD CONSTRAINT pregnancies_user_key UNIQUE (user_id);
