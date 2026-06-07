-- =============================================================================
-- ONE-TIME DATA MIGRATION: standalone 333 random-state -> wca::333
-- =============================================================================
--
-- Context:
--   The standalone "3x3" cube type's "WCA Standart" (random-state, empty/null
--   subset) entry was removed from the picker — it duplicated the wca::333
--   bucket (same puzzle, same random-state scramble). This consolidates any
--   leftover (cube_type='333', subset NULL/'') rows into wca::333.
--
--   Note: the client already migrates these solves on load (migrate_wca_subset
--   Faz 1). This script cleans the SERVER side (Pro reads / write-only users /
--   leaderboards) and user settings stuck on the removed bucket.
--
-- Scope guard:
--   ONLY rows with empty/null subset are moved. Real 333 subsets (333oh, 333ni,
--   2gen, roux, ...) stay under '333' — they are genuine non-WCA practice.
--
-- Conflict handling:
--   - solve / top_solve / top_average -> no @@unique on bucket -> plain UPDATE.
--   - setting -> one row per user -> plain UPDATE.
--   - daily_goal -> @@unique(user_id, cube_type, scramble_subset): drop the
--     333::'' goal when a wca::333 goal already exists, then rename the rest.
--
-- Safety: idempotent, runs in a transaction.
--
-- HOW TO RUN (production):
--   docker exec -i zkt-timer-postgres-1 psql -U postgres -d <db> -f - < scripts/migrations/333null-to-wca333-consolidation.sql
--   (or: psql $DATABASE_URL -f scripts/migrations/333null-to-wca333-consolidation.sql)
-- =============================================================================

BEGIN;

UPDATE solve       SET cube_type='wca', scramble_subset='333'
 WHERE cube_type='333' AND (scramble_subset IS NULL OR scramble_subset='');

UPDATE top_solve   SET cube_type='wca', scramble_subset='333'
 WHERE cube_type='333' AND (scramble_subset IS NULL OR scramble_subset='');

UPDATE top_average SET cube_type='wca', scramble_subset='333'
 WHERE cube_type='333' AND (scramble_subset IS NULL OR scramble_subset='');

UPDATE setting     SET cube_type='wca', scramble_subset='333'
 WHERE cube_type='333' AND (scramble_subset IS NULL OR scramble_subset='');

-- daily_goal: resolve the composite-unique collision before renaming.
-- (daily_goal.scramble_subset is String @default('') — never NULL.)
DELETE FROM daily_goal g
 USING daily_goal w
 WHERE g.cube_type='333' AND g.scramble_subset=''
   AND w.cube_type='wca' AND w.scramble_subset='333'
   AND w.user_id = g.user_id;

UPDATE daily_goal SET cube_type='wca', scramble_subset='333'
 WHERE cube_type='333' AND scramble_subset='';

-- -----------------------------------------------------------------------------
-- VERIFICATION (optional — run before COMMIT; all should be 0)
-- -----------------------------------------------------------------------------
-- SELECT COUNT(*) FROM solve       WHERE cube_type='333' AND (scramble_subset IS NULL OR scramble_subset='');
-- SELECT COUNT(*) FROM top_solve   WHERE cube_type='333' AND (scramble_subset IS NULL OR scramble_subset='');
-- SELECT COUNT(*) FROM top_average WHERE cube_type='333' AND (scramble_subset IS NULL OR scramble_subset='');
-- SELECT COUNT(*) FROM setting     WHERE cube_type='333' AND (scramble_subset IS NULL OR scramble_subset='');
-- SELECT COUNT(*) FROM daily_goal  WHERE cube_type='333' AND scramble_subset='';

COMMIT;
