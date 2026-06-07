-- =============================================================================
-- ONE-TIME DATA MIGRATION: cube_type '333sub' -> '333'
-- =============================================================================
--
-- Context:
--   The '333sub' cube type ("3x3 Subsets") was removed. Its subsets
--   (2gen, 2genl, roux, 3gen_F, 3gen_L, RrU, 333drud, half) were merged
--   directly into the '333' cube type's scramble_subset list.
--
-- Mapping:
--   cube_type='333sub', scramble_subset=<id>  ->  cube_type='333', scramble_subset=<id>
--   (scramble_subset is preserved as-is.)
--
-- Safety:
--   - No DELETEs. UPDATE only. cube_type rename, subset untouched.
--   - NO conflict risk: none of the 333sub subset ids (2gen, roux, 333drud, ...)
--     existed under '333' before this change, so no (user_id, cube_type, subset)
--     unique-key collisions in top_solve / top_average / daily_goal.
--   - Idempotent: a second run matches 0 rows.
--
-- HOW TO RUN (production):
--   docker exec -i zkt-timer-postgres-1 psql -U postgres -d <db> -f - < scripts/migrations/333sub-to-333-merge.sql
--   (or: psql $DATABASE_URL -f scripts/migrations/333sub-to-333-merge.sql)
-- =============================================================================

BEGIN;

UPDATE solve       SET cube_type='333' WHERE cube_type='333sub';
UPDATE top_solve   SET cube_type='333' WHERE cube_type='333sub';
UPDATE top_average SET cube_type='333' WHERE cube_type='333sub';
UPDATE setting     SET cube_type='333' WHERE cube_type='333sub';
UPDATE daily_goal  SET cube_type='333' WHERE cube_type='333sub';

-- -----------------------------------------------------------------------------
-- VERIFICATION (optional — run before COMMIT to confirm 0 rows remain)
-- -----------------------------------------------------------------------------
-- SELECT COUNT(*) AS remaining_333sub FROM solve       WHERE cube_type='333sub';
-- SELECT COUNT(*) AS remaining_333sub FROM top_solve   WHERE cube_type='333sub';
-- SELECT COUNT(*) AS remaining_333sub FROM top_average WHERE cube_type='333sub';
-- SELECT COUNT(*) AS remaining_333sub FROM setting     WHERE cube_type='333sub';
-- SELECT COUNT(*) AS remaining_333sub FROM daily_goal  WHERE cube_type='333sub';

COMMIT;
