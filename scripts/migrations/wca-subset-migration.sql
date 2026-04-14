-- =============================================================================
-- ONE-TIME DATA MIGRATION: Legacy cube_type -> WCA + scramble_subset
-- =============================================================================
--
-- Context:
--   Old system had direct WCA cube_types (333, 222, 444, ...) without subsets.
--   New system introduced a parent 'wca' category with WCA events as subsets.
--   This script migrates existing solves (and related tables) to the new model.
--
-- Mapping:
--   Pure WCA puzzles -> cube_type='wca', scramble_subset=<old_id>
--     333, 222, 444, 555, 666, 777, sq1, pyram, clock, skewb, minx
--
--   Old variants -> parent cube + subset
--     333mirror -> (333, 333mirror)
--     222oh     -> (222, 222oh)
--     333oh     -> (333, 333oh)
--     333bl     -> (333, 333ni)       -- id was renamed in new system
--
--   Untouched:
--     other, 333cfop, 333roux, 333mehta, 333zz, 444yau, 333sub, wca, custom ids
--
-- Safety:
--   - No DELETEs. UPDATE only.
--   - Guarded by WHERE clauses that match only legacy rows.
--   - Run inside a transaction; rollback if anything looks wrong.
--   - Idempotent: running it twice is a no-op (second run matches 0 rows).
--
-- HOW TO RUN:
--   psql $DATABASE_URL -f scripts/migrations/wca-subset-migration.sql
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- 1) SOLVE TABLE
-- -----------------------------------------------------------------------------

-- Pure WCA puzzles -> cube_type='wca' + subset
UPDATE solve SET cube_type='wca', scramble_subset='333'   WHERE cube_type='333'   AND scramble_subset IS NULL;
UPDATE solve SET cube_type='wca', scramble_subset='222'   WHERE cube_type='222'   AND scramble_subset IS NULL;
UPDATE solve SET cube_type='wca', scramble_subset='444'   WHERE cube_type='444'   AND scramble_subset IS NULL;
UPDATE solve SET cube_type='wca', scramble_subset='555'   WHERE cube_type='555'   AND scramble_subset IS NULL;
UPDATE solve SET cube_type='wca', scramble_subset='666'   WHERE cube_type='666'   AND scramble_subset IS NULL;
UPDATE solve SET cube_type='wca', scramble_subset='777'   WHERE cube_type='777'   AND scramble_subset IS NULL;
UPDATE solve SET cube_type='wca', scramble_subset='sq1'   WHERE cube_type='sq1'   AND scramble_subset IS NULL;
UPDATE solve SET cube_type='wca', scramble_subset='pyram' WHERE cube_type='pyram' AND scramble_subset IS NULL;
UPDATE solve SET cube_type='wca', scramble_subset='clock' WHERE cube_type='clock' AND scramble_subset IS NULL;
UPDATE solve SET cube_type='wca', scramble_subset='skewb' WHERE cube_type='skewb' AND scramble_subset IS NULL;
UPDATE solve SET cube_type='wca', scramble_subset='minx'  WHERE cube_type='minx'  AND scramble_subset IS NULL;

-- Old variants -> parent + subset
UPDATE solve SET cube_type='333', scramble_subset='333mirror' WHERE cube_type='333mirror' AND scramble_subset IS NULL;
UPDATE solve SET cube_type='222', scramble_subset='222oh'     WHERE cube_type='222oh'     AND scramble_subset IS NULL;
UPDATE solve SET cube_type='333', scramble_subset='333oh'     WHERE cube_type='333oh'     AND scramble_subset IS NULL;
UPDATE solve SET cube_type='333', scramble_subset='333ni'     WHERE cube_type='333bl'     AND scramble_subset IS NULL;

-- -----------------------------------------------------------------------------
-- 2) TOP_SOLVE TABLE (leaderboard singles)
-- -----------------------------------------------------------------------------

UPDATE top_solve SET cube_type='wca', scramble_subset='333'   WHERE cube_type='333'   AND scramble_subset IS NULL;
UPDATE top_solve SET cube_type='wca', scramble_subset='222'   WHERE cube_type='222'   AND scramble_subset IS NULL;
UPDATE top_solve SET cube_type='wca', scramble_subset='444'   WHERE cube_type='444'   AND scramble_subset IS NULL;
UPDATE top_solve SET cube_type='wca', scramble_subset='555'   WHERE cube_type='555'   AND scramble_subset IS NULL;
UPDATE top_solve SET cube_type='wca', scramble_subset='666'   WHERE cube_type='666'   AND scramble_subset IS NULL;
UPDATE top_solve SET cube_type='wca', scramble_subset='777'   WHERE cube_type='777'   AND scramble_subset IS NULL;
UPDATE top_solve SET cube_type='wca', scramble_subset='sq1'   WHERE cube_type='sq1'   AND scramble_subset IS NULL;
UPDATE top_solve SET cube_type='wca', scramble_subset='pyram' WHERE cube_type='pyram' AND scramble_subset IS NULL;
UPDATE top_solve SET cube_type='wca', scramble_subset='clock' WHERE cube_type='clock' AND scramble_subset IS NULL;
UPDATE top_solve SET cube_type='wca', scramble_subset='skewb' WHERE cube_type='skewb' AND scramble_subset IS NULL;
UPDATE top_solve SET cube_type='wca', scramble_subset='minx'  WHERE cube_type='minx'  AND scramble_subset IS NULL;

UPDATE top_solve SET cube_type='333', scramble_subset='333mirror' WHERE cube_type='333mirror' AND scramble_subset IS NULL;
UPDATE top_solve SET cube_type='222', scramble_subset='222oh'     WHERE cube_type='222oh'     AND scramble_subset IS NULL;
UPDATE top_solve SET cube_type='333', scramble_subset='333oh'     WHERE cube_type='333oh'     AND scramble_subset IS NULL;
UPDATE top_solve SET cube_type='333', scramble_subset='333ni'     WHERE cube_type='333bl'     AND scramble_subset IS NULL;

-- -----------------------------------------------------------------------------
-- 3) TOP_AVERAGE TABLE (leaderboard ao5)
-- -----------------------------------------------------------------------------

UPDATE top_average SET cube_type='wca', scramble_subset='333'   WHERE cube_type='333'   AND scramble_subset IS NULL;
UPDATE top_average SET cube_type='wca', scramble_subset='222'   WHERE cube_type='222'   AND scramble_subset IS NULL;
UPDATE top_average SET cube_type='wca', scramble_subset='444'   WHERE cube_type='444'   AND scramble_subset IS NULL;
UPDATE top_average SET cube_type='wca', scramble_subset='555'   WHERE cube_type='555'   AND scramble_subset IS NULL;
UPDATE top_average SET cube_type='wca', scramble_subset='666'   WHERE cube_type='666'   AND scramble_subset IS NULL;
UPDATE top_average SET cube_type='wca', scramble_subset='777'   WHERE cube_type='777'   AND scramble_subset IS NULL;
UPDATE top_average SET cube_type='wca', scramble_subset='sq1'   WHERE cube_type='sq1'   AND scramble_subset IS NULL;
UPDATE top_average SET cube_type='wca', scramble_subset='pyram' WHERE cube_type='pyram' AND scramble_subset IS NULL;
UPDATE top_average SET cube_type='wca', scramble_subset='clock' WHERE cube_type='clock' AND scramble_subset IS NULL;
UPDATE top_average SET cube_type='wca', scramble_subset='skewb' WHERE cube_type='skewb' AND scramble_subset IS NULL;
UPDATE top_average SET cube_type='wca', scramble_subset='minx'  WHERE cube_type='minx'  AND scramble_subset IS NULL;

UPDATE top_average SET cube_type='333', scramble_subset='333mirror' WHERE cube_type='333mirror' AND scramble_subset IS NULL;
UPDATE top_average SET cube_type='222', scramble_subset='222oh'     WHERE cube_type='222oh'     AND scramble_subset IS NULL;
UPDATE top_average SET cube_type='333', scramble_subset='333oh'     WHERE cube_type='333oh'     AND scramble_subset IS NULL;
UPDATE top_average SET cube_type='333', scramble_subset='333ni'     WHERE cube_type='333bl'     AND scramble_subset IS NULL;

-- -----------------------------------------------------------------------------
-- 4) SETTING TABLE (user's current picker state)
-- -----------------------------------------------------------------------------
-- If a user's current cube_type is a legacy id AND they don't already have a
-- scramble_subset set, migrate their active picker too.

UPDATE setting SET cube_type='wca', scramble_subset='333'   WHERE cube_type='333'   AND (scramble_subset IS NULL OR scramble_subset = '');
UPDATE setting SET cube_type='wca', scramble_subset='222'   WHERE cube_type='222'   AND (scramble_subset IS NULL OR scramble_subset = '');
UPDATE setting SET cube_type='wca', scramble_subset='444'   WHERE cube_type='444'   AND (scramble_subset IS NULL OR scramble_subset = '');
UPDATE setting SET cube_type='wca', scramble_subset='555'   WHERE cube_type='555'   AND (scramble_subset IS NULL OR scramble_subset = '');
UPDATE setting SET cube_type='wca', scramble_subset='666'   WHERE cube_type='666'   AND (scramble_subset IS NULL OR scramble_subset = '');
UPDATE setting SET cube_type='wca', scramble_subset='777'   WHERE cube_type='777'   AND (scramble_subset IS NULL OR scramble_subset = '');
UPDATE setting SET cube_type='wca', scramble_subset='sq1'   WHERE cube_type='sq1'   AND (scramble_subset IS NULL OR scramble_subset = '');
UPDATE setting SET cube_type='wca', scramble_subset='pyram' WHERE cube_type='pyram' AND (scramble_subset IS NULL OR scramble_subset = '');
UPDATE setting SET cube_type='wca', scramble_subset='clock' WHERE cube_type='clock' AND (scramble_subset IS NULL OR scramble_subset = '');
UPDATE setting SET cube_type='wca', scramble_subset='skewb' WHERE cube_type='skewb' AND (scramble_subset IS NULL OR scramble_subset = '');
UPDATE setting SET cube_type='wca', scramble_subset='minx'  WHERE cube_type='minx'  AND (scramble_subset IS NULL OR scramble_subset = '');

UPDATE setting SET cube_type='333', scramble_subset='333mirror' WHERE cube_type='333mirror' AND (scramble_subset IS NULL OR scramble_subset = '');
UPDATE setting SET cube_type='222', scramble_subset='222oh'     WHERE cube_type='222oh'     AND (scramble_subset IS NULL OR scramble_subset = '');
UPDATE setting SET cube_type='333', scramble_subset='333oh'     WHERE cube_type='333oh'     AND (scramble_subset IS NULL OR scramble_subset = '');
UPDATE setting SET cube_type='333', scramble_subset='333ni'     WHERE cube_type='333bl'     AND (scramble_subset IS NULL OR scramble_subset = '');

-- -----------------------------------------------------------------------------
-- 5) DAILY_GOAL TABLE (per-cube daily solve target)
-- -----------------------------------------------------------------------------
-- scramble_subset column is String @default("") — never null. Only migrate rows
-- where subset is still empty (i.e., legacy rows).

UPDATE daily_goal SET cube_type='wca', scramble_subset='333'   WHERE cube_type='333'   AND scramble_subset = '';
UPDATE daily_goal SET cube_type='wca', scramble_subset='222'   WHERE cube_type='222'   AND scramble_subset = '';
UPDATE daily_goal SET cube_type='wca', scramble_subset='444'   WHERE cube_type='444'   AND scramble_subset = '';
UPDATE daily_goal SET cube_type='wca', scramble_subset='555'   WHERE cube_type='555'   AND scramble_subset = '';
UPDATE daily_goal SET cube_type='wca', scramble_subset='666'   WHERE cube_type='666'   AND scramble_subset = '';
UPDATE daily_goal SET cube_type='wca', scramble_subset='777'   WHERE cube_type='777'   AND scramble_subset = '';
UPDATE daily_goal SET cube_type='wca', scramble_subset='sq1'   WHERE cube_type='sq1'   AND scramble_subset = '';
UPDATE daily_goal SET cube_type='wca', scramble_subset='pyram' WHERE cube_type='pyram' AND scramble_subset = '';
UPDATE daily_goal SET cube_type='wca', scramble_subset='clock' WHERE cube_type='clock' AND scramble_subset = '';
UPDATE daily_goal SET cube_type='wca', scramble_subset='skewb' WHERE cube_type='skewb' AND scramble_subset = '';
UPDATE daily_goal SET cube_type='wca', scramble_subset='minx'  WHERE cube_type='minx'  AND scramble_subset = '';

UPDATE daily_goal SET cube_type='333', scramble_subset='333mirror' WHERE cube_type='333mirror' AND scramble_subset = '';
UPDATE daily_goal SET cube_type='222', scramble_subset='222oh'     WHERE cube_type='222oh'     AND scramble_subset = '';
UPDATE daily_goal SET cube_type='333', scramble_subset='333oh'     WHERE cube_type='333oh'     AND scramble_subset = '';
UPDATE daily_goal SET cube_type='333', scramble_subset='333ni'     WHERE cube_type='333bl'     AND scramble_subset = '';

-- -----------------------------------------------------------------------------
-- VERIFICATION (optional — run manually to inspect before COMMIT)
-- -----------------------------------------------------------------------------
-- SELECT cube_type, scramble_subset, COUNT(*) FROM solve GROUP BY cube_type, scramble_subset ORDER BY 3 DESC;
-- SELECT cube_type, scramble_subset, COUNT(*) FROM top_solve GROUP BY cube_type, scramble_subset;
-- SELECT cube_type, scramble_subset, COUNT(*) FROM top_average GROUP BY cube_type, scramble_subset;
-- SELECT cube_type, scramble_subset, COUNT(*) FROM setting GROUP BY cube_type, scramble_subset;
-- SELECT cube_type, scramble_subset, COUNT(*) FROM daily_goal GROUP BY cube_type, scramble_subset;

COMMIT;
