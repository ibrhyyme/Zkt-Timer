-- =============================================================================
-- ONE-TIME DATA FIX: standalone WCA-event buckets -> canonical `wca` bucket
-- =============================================================================
--
-- Context:
--   The 2026-06-08 wca-subset-migration moved 333::null -> wca::333, but a leak
--   (SessionPicker fallback `|| '333'`) kept producing standalone WCA-event
--   solves AFTER it. Result: ~10.7k solves split between the "3x3x3" (wca::333)
--   and the duplicate "3x3" (333::null) box, for ~31 users — same for 222, 444,
--   pyram, skewb, etc. The code leak is fixed separately (SessionPicker, save
--   normalize guard, migrate_wca_subset setting migration). This script cleans
--   up the rows already written in the wrong bucket.
--
-- What it moves:
--   cube_type IN (WCA events) AND scramble_subset is NULL / '' / equal to the
--   cube_type (e.g. 333::null, 333::'', 333::333) -> cube_type='wca',
--   scramble_subset=<old cube_type>.
--
--   The SET runs as a single atomic assignment: `scramble_subset = cube_type`
--   reads the OLD row value (Postgres evaluates all SET exprs against the old
--   row), so `333` becomes the subset and cube_type becomes `wca` in one pass.
--
-- What it PRESERVES (NOT touched):
--   Real variants  -> 333::333o (random-move), 333::333oh, 333::333mirror,
--                     333::333ni, 222::222oh, ...  (subset != cube_type, != '')
--   Method types   -> 333cfop, 333roux, 333mehta, 444yau, other
--   Inconsistent   -> 333::444, 222::pyram, 333::corners, ... (handled manually,
--                     see scripts/migrations notes — NOT in scope here)
--
-- Safety:
--   - UPDATE only (except the daily_goal conflict pre-delete below).
--   - Idempotent: a second run matches 0 rows (cube_type is already 'wca').
--   - Runs in a transaction; inspect with the SELECTs at the bottom before COMMIT.
--   - No --accept-data-loss anywhere.
--
-- HOW TO RUN (prod):
--   docker exec -i zkt-timer-postgres-1 psql -U root -d "Zkt-Timer" \
--     -f scripts/migrations/wca-event-bucket-fix.sql
-- =============================================================================

BEGIN;

-- WCA event id list reused by every statement below.
-- ('333','222','444','555','666','777','sq1','pyram','clock','skewb','minx')

-- -----------------------------------------------------------------------------
-- 1) SOLVE
-- -----------------------------------------------------------------------------
UPDATE solve
SET scramble_subset = cube_type, cube_type = 'wca'
WHERE cube_type IN ('333','222','444','555','666','777','sq1','pyram','clock','skewb','minx')
  AND (scramble_subset IS NULL OR scramble_subset = '' OR scramble_subset = cube_type);

-- -----------------------------------------------------------------------------
-- 2) TOP_SOLVE (leaderboard singles — no unique constraint, plain UPDATE safe)
-- -----------------------------------------------------------------------------
UPDATE top_solve
SET scramble_subset = cube_type, cube_type = 'wca'
WHERE cube_type IN ('333','222','444','555','666','777','sq1','pyram','clock','skewb','minx')
  AND (scramble_subset IS NULL OR scramble_subset = '' OR scramble_subset = cube_type);

-- -----------------------------------------------------------------------------
-- 3) TOP_AVERAGE (leaderboard ao5 — no unique constraint, plain UPDATE safe)
-- -----------------------------------------------------------------------------
UPDATE top_average
SET scramble_subset = cube_type, cube_type = 'wca'
WHERE cube_type IN ('333','222','444','555','666','777','sq1','pyram','clock','skewb','minx')
  AND (scramble_subset IS NULL OR scramble_subset = '' OR scramble_subset = cube_type);

-- -----------------------------------------------------------------------------
-- 4) SETTING (user's active picker — one row per user, plain UPDATE safe)
-- -----------------------------------------------------------------------------
UPDATE setting
SET scramble_subset = cube_type, cube_type = 'wca'
WHERE cube_type IN ('333','222','444','555','666','777','sq1','pyram','clock','skewb','minx')
  AND (scramble_subset IS NULL OR scramble_subset = '' OR scramble_subset = cube_type);

-- -----------------------------------------------------------------------------
-- 5) DAILY_GOAL  @@unique([user_id, cube_type, scramble_subset])
-- -----------------------------------------------------------------------------
-- scramble_subset is String @default("") here — never NULL.
-- If a user already has the canonical wca::<event> goal AND the legacy one, the
-- UPDATE would hit the unique constraint. Drop the legacy duplicate first, then
-- migrate the rest. (The canonical row is kept as the source of truth.)
DELETE FROM daily_goal d_old
WHERE d_old.cube_type IN ('333','222','444','555','666','777','sq1','pyram','clock','skewb','minx')
  AND (d_old.scramble_subset = '' OR d_old.scramble_subset = d_old.cube_type)
  AND EXISTS (
    SELECT 1 FROM daily_goal d_new
    WHERE d_new.user_id = d_old.user_id
      AND d_new.cube_type = 'wca'
      AND d_new.scramble_subset = d_old.cube_type
  );

UPDATE daily_goal
SET scramble_subset = cube_type, cube_type = 'wca'
WHERE cube_type IN ('333','222','444','555','666','777','sq1','pyram','clock','skewb','minx')
  AND (scramble_subset = '' OR scramble_subset = cube_type);

-- -----------------------------------------------------------------------------
-- VERIFICATION (run before COMMIT; expect 0 standalone WCA-event rows left,
-- except preserved variants like 333::333o)
-- -----------------------------------------------------------------------------
-- SELECT cube_type, scramble_subset, COUNT(*) FROM solve
--   WHERE cube_type IN ('333','222','444','555','666','777','sq1','pyram','clock','skewb','minx')
--   GROUP BY 1,2 ORDER BY 3 DESC;
-- SELECT cube_type, scramble_subset, COUNT(*) FROM setting
--   WHERE cube_type IN ('333','222','444','555','666','777','sq1','pyram','clock','skewb','minx')
--   GROUP BY 1,2 ORDER BY 3 DESC;
-- SELECT cube_type, scramble_subset, COUNT(*) FROM daily_goal
--   WHERE cube_type IN ('333','222','444','555','666','777','sq1','pyram','clock','skewb','minx')
--   GROUP BY 1,2 ORDER BY 3 DESC;

COMMIT;
