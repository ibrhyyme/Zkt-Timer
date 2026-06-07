-- =============================================================================
-- ONE-TIME DATA MIGRATION: cube_type '333zz' -> '333cfop'
-- =============================================================================
--
-- Context:
--   The '333zz' cube type ("3x3 ZZ") was removed. All of its subsets
--   (eoline, eocross, zzll, zbll, zbls) already exist under '333cfop',
--   so its solves are folded directly into the 333cfop bucket. The
--   scramble_subset value is preserved as-is.
--
-- Conflict handling:
--   - solve        -> no unique on bucket -> plain UPDATE.
--   - top_solve    -> no @@unique on (user_id, cube_type, subset) -> plain UPDATE.
--   - top_average  -> no @@unique on (user_id, cube_type, subset) -> plain UPDATE.
--   - setting      -> one row per user -> plain UPDATE.
--   - daily_goal   -> @@unique(user_id, cube_type, scramble_subset): a user could
--                     have BOTH 333zz::zbll and 333cfop::zbll goals. Drop the 333zz
--                     row when a 333cfop row already exists for the same
--                     (user_id, subset), then rename the rest.
--
-- Safety:
--   - Idempotent: a second run matches 0 rows.
--   - Run inside a transaction; rollback if verification looks wrong.
--
-- HOW TO RUN (production):
--   docker exec -i zkt-timer-postgres-1 psql -U postgres -d <db> -f - < scripts/migrations/333zz-to-333cfop-merge.sql
--   (or: psql $DATABASE_URL -f scripts/migrations/333zz-to-333cfop-merge.sql)
-- =============================================================================

BEGIN;

UPDATE solve       SET cube_type='333cfop' WHERE cube_type='333zz';
UPDATE top_solve   SET cube_type='333cfop' WHERE cube_type='333zz';
UPDATE top_average SET cube_type='333cfop' WHERE cube_type='333zz';
UPDATE setting     SET cube_type='333cfop' WHERE cube_type='333zz';

-- daily_goal: resolve the composite-unique collision before renaming
DELETE FROM daily_goal z
 USING daily_goal c
 WHERE z.cube_type = '333zz'
   AND c.cube_type = '333cfop'
   AND c.user_id = z.user_id
   AND c.scramble_subset = z.scramble_subset;

UPDATE daily_goal SET cube_type='333cfop' WHERE cube_type='333zz';

-- -----------------------------------------------------------------------------
-- VERIFICATION (optional — run before COMMIT)
-- -----------------------------------------------------------------------------
-- SELECT COUNT(*) AS remaining_333zz FROM solve       WHERE cube_type='333zz';
-- SELECT COUNT(*) AS remaining_333zz FROM top_solve   WHERE cube_type='333zz';
-- SELECT COUNT(*) AS remaining_333zz FROM top_average WHERE cube_type='333zz';
-- SELECT COUNT(*) AS remaining_333zz FROM setting     WHERE cube_type='333zz';
-- SELECT COUNT(*) AS remaining_333zz FROM daily_goal  WHERE cube_type='333zz';

COMMIT;
