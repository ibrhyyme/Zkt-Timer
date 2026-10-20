-- =============================================================================
-- ONE-TIME DATA MIGRATION: smart_device rows -> My Cubes (cube, cube_main, solve.cube_id)
-- =============================================================================
--
-- Context (design .feedback/designs/magnet-cubes.md section 7, BACKLOG EK-b, K-10):
--   "My Cubes" replaces "Manage smart cubes". Every smart cube a user registered
--   (table smart_device) becomes a 3x3 cube, the most used one becomes the user's
--   3x3 main, and the past solves made with it are linked through solve.cube_id.
--   The new client never writes smart_device again; the old table stays in the
--   schema for apps still on an older OTA bundle (design 2.7).
--
-- What it does, in one transaction:
--   1. Groups smart_device rows into physical cubes. Key: the advertised BLE name
--      when it ends in a 4 digit hex serial ("GANi3_F568", the same rule as
--      isDistinctiveBleName in server/util/cube_validation.ts), case-insensitive,
--      else the BLE device id. Reinstalls (iOS), web ids and the duplicate rows the
--      old smartCubeInDb + addSmartCubeToDb race left behind end up in one group.
--      Canonical row of a group: most solves, then the oldest.
--   2. Finds a cube that already exists for a group (made after the deploy by
--      ensureSmartCube or by the legacy addNewSmartDevice): same id, one of the
--      group's rows in legacy_smart_device_ids, one of the group's BLE ids, or (for
--      serial names only) the same BLE name, the rule ensureSmartCube uses.
--   3. Inserts the missing cubes: id = canonical row id, puzzle '333', name = the
--      row's name, brand from the BLE name (SQL copy of SUPPORTED_SMART_CUBE_BRANDS),
--      ble_device_id = the device id of the group's most recently used row.
--   4. Adds every row id of a group to its cube's legacy_smart_device_ids. The
--      client backfill (client/db/solves/migrate_cube_link.ts) and the server's
--      smart_device_id -> cube_id translation (server/util/solve_links.ts) read it.
--   5. Links past solves: smart_device_id of the group, same account, still no
--      cube_id, a 3x3 bucket (PUZZLE_333_PREDICATE), not a trainer solve.
--   6. Smart solves without a device row (imports drop smart_device_id): linked
--      when the user has exactly ONE smart 3x3 cube, left alone otherwise (owner
--      decision Q3). Skipped with -v skip_orphans=1.
--   7. Picks the 3x3 main for users without one: the non-archived smart 3x3 cube
--      with the most linked solves, then the newest last solve, then the oldest.
--      set_at = 2000-01-01 on purpose: any choice a person makes later (offline
--      included) is newer and wins (design 4.2).
--   8. Prints a report. Rows of kind 'change' are writes; rows of kind 'info'
--      describe the data.
--
-- What it does NOT touch:
--   - No DELETE, no DROP, no TRUNCATE, no schema change, no --accept-data-loss.
--   - smart_device rows and solve.smart_device_id stay as they are.
--   - A solve that already has a cube_id (stamped by the new client after the
--     deploy, or corrected by the user) is never overwritten.
--   - Solves outside 3x3 buckets, trainer solves, and solves pointing at another
--     account's device row are counted, not linked.
--
-- Re-running (idempotent): every 'change' row of the report is 0 on a second
--   apply. Cubes: ON CONFLICT DO NOTHING plus step 2 finds them. Legacy ids: only
--   arrays missing an id are updated. Solves: only cube_id IS NULL rows. Main:
--   ON CONFLICT (user_id, puzzle) DO NOTHING. A cube the user deleted does not
--   come back: deleteCube also deletes its legacy smart_device rows.
--
-- Re-running LATER (days after the first apply, once people have used the app)
--   is not neutral, so run it only in the deploy window (dry run, apply, second
--   apply) and not again afterwards. Two reasons:
--   - Step 5 links every 3x3 device solve whose cube_id is NULL. A solve the user
--     set to "no cube" on the solve card is NULL too, so it gets its cube back.
--   - deleteCube removes the cube's smart_device rows; the foreign key then clears
--     solve.smart_device_id on its solves, which turns them into "smart solves
--     without a device row". Step 6 would hand them to the user's remaining smart
--     cube. If a later run is unavoidable, pass -v skip_orphans=1.
--
-- Prerequisite: the release with the new schema is deployed, so the container's
--   `prisma db push` has created cube, cube_main, cube_calibration and
--   solve.cube_id (design 9.3).
--
-- HOW TO RUN (prod, from the repo folder on the server; check the container name
-- with `docker ps`):
--   1) Dry run: everything runs, the report prints, then ROLLBACK.
--        docker exec -i zkt-timer-postgres-1 psql -U root -d "Zkt-Timer" -v ON_ERROR_STOP=1 \
--          < scripts/migrations/cubes-from-smart-devices.sql
--   2) Apply: same file, COMMIT at the end.
--        docker exec -i zkt-timer-postgres-1 psql -U root -d "Zkt-Timer" -v ON_ERROR_STOP=1 -v apply=1 \
--          < scripts/migrations/cubes-from-smart-devices.sql
--   3) Apply a second time: every 'change' row must be 0.
--   Without step 6: add -v skip_orphans=1.
--   `apply` must be a true value (1, on, true, yes). Any other value counts as
--   false: psql prints a warning and the run ends in ROLLBACK.
--
-- Time: one sequential scan of solve (the snapshot in step 0); the updates then
--   go through the primary key. \timing prints every statement's duration. If
--   the dry run shows a step above ~30 s, split that step by user ranges.
-- =============================================================================

\set ON_ERROR_STOP on
\timing on
\pset pager off

\if :{?apply}
  \if :apply
    \echo 'MODE: apply (COMMIT at the end)'
  \else
    \echo 'MODE: dry run (apply is false, ROLLBACK at the end)'
  \endif
\else
  \echo 'MODE: dry run (ROLLBACK at the end; pass -v apply=1 to write)'
\endif

BEGIN;

-- Every helper table is TEMP: it lives in this psql session only, a ROLLBACK
-- removes it, and the session ends with the script.
CREATE TEMP TABLE cube_migration_report (
  ord  serial,
  step int,
  kind text,
  item text,
  n    bigint
);

-- -----------------------------------------------------------------------------
-- 0) SNAPSHOT of the solves this script can touch (the only scan of solve)
-- -----------------------------------------------------------------------------
-- Device-linked solves and smart solves without a cube. Everything below joins
-- this small table and updates solve by primary key.
CREATE TEMP TABLE smart_solves AS
SELECT s.id, s.user_id, s.smart_device_id, s.cube_id, s.trainer_name,
       s.cube_type, s.scramble_subset, s.is_smart_cube, s.created_at
FROM solve s
WHERE s.smart_device_id IS NOT NULL
   OR (s.is_smart_cube AND s.cube_id IS NULL);

CREATE INDEX ON smart_solves (smart_device_id);
CREATE INDEX ON smart_solves (user_id);
ANALYZE smart_solves;

-- -----------------------------------------------------------------------------
-- 1) GROUP smart_device rows into physical cubes
-- -----------------------------------------------------------------------------
-- ble_name: the advertised name as registered (internal_name never changes; name
-- could be renamed through the legacy changeSmartDeviceName). Whitespace is
-- collapsed and trimmed the way cleanText does it in cube_validation.ts.
CREATE TEMP TABLE sd_rows AS
SELECT r.sd_id, r.user_id, r.device_id, r.display_name, r.ble_name, r.created_at,
       CASE
         WHEN r.ble_name ~ '[0-9A-Fa-f]{4}$' -- DISTINCTIVE_NAME_PATTERN
           THEN 'name:' || lower(r.ble_name)
         ELSE 'dev:' || r.device_id
       END AS group_key,
       coalesce(u.solve_count, 0) AS solve_count,
       u.last_solve_at
FROM (
  SELECT sd.id AS sd_id, sd.user_id, sd.device_id, sd.created_at,
         btrim(regexp_replace(sd.name, '\s+', ' ', 'g')) AS display_name,
         left(coalesce(
           nullif(btrim(regexp_replace(sd.internal_name, '\s+', ' ', 'g')), ''),
           nullif(btrim(regexp_replace(sd.name, '\s+', ' ', 'g')), '')
         ), 64) AS ble_name
  FROM smart_device sd
) r
LEFT JOIN (
  SELECT smart_device_id, count(*) AS solve_count, max(created_at) AS last_solve_at
  FROM smart_solves
  WHERE smart_device_id IS NOT NULL
  GROUP BY smart_device_id
) u ON u.smart_device_id = r.sd_id;

CREATE TEMP TABLE sd_groups AS
SELECT c.user_id, c.group_key, c.canonical_id, c.cube_name, c.ble_name,
       l.device_id AS ble_device_id,
       a.sd_ids, a.device_ids, a.first_created_at,
       NULL::text AS cube_id,
       NULL::text AS match_kind
FROM (
  -- Canonical row: most solves, then the oldest.
  SELECT DISTINCT ON (user_id, group_key)
         user_id, group_key, sd_id AS canonical_id, ble_name,
         coalesce(nullif(btrim(left(display_name, 40)), ''), nullif(btrim(left(ble_name, 40)), ''), 'Smart Cube') AS cube_name
  FROM sd_rows
  ORDER BY user_id, group_key, solve_count DESC, created_at ASC, sd_id
) c
JOIN (
  -- The BLE id the cube answers to today: the row used most recently.
  SELECT DISTINCT ON (user_id, group_key) user_id, group_key, nullif(device_id, '') AS device_id
  FROM sd_rows
  ORDER BY user_id, group_key, last_solve_at DESC NULLS LAST, created_at DESC, sd_id
) l USING (user_id, group_key)
JOIN (
  SELECT user_id, group_key,
         array_agg(sd_id ORDER BY sd_id) AS sd_ids,
         array_agg(DISTINCT device_id) FILTER (WHERE device_id <> '') AS device_ids,
         min(created_at) AS first_created_at
  FROM sd_rows
  GROUP BY user_id, group_key
) a USING (user_id, group_key);

INSERT INTO cube_migration_report (step, kind, item, n)
SELECT 1, 'info', 'smart_device rows examined', count(*) FROM sd_rows;
INSERT INTO cube_migration_report (step, kind, item, n)
SELECT 1, 'info', 'groups (physical cubes)', count(*) FROM sd_groups;
INSERT INTO cube_migration_report (step, kind, item, n)
SELECT 1, 'info', 'duplicate rows merged into a group',
       (SELECT count(*) FROM sd_rows) - (SELECT count(*) FROM sd_groups);

-- -----------------------------------------------------------------------------
-- 2) EXISTING cube for a group
-- -----------------------------------------------------------------------------
-- Priority: the canonical row id itself, a row id in legacy_smart_device_ids, a
-- BLE id of the group, then (serial names only) the same BLE name. Only smart
-- 3x3 cubes of the same account qualify.
UPDATE sd_groups g
SET cube_id = t.cube_id, match_kind = 'existing'
FROM (
  SELECT DISTINCT ON (g2.user_id, g2.group_key) g2.user_id, g2.group_key, c.id AS cube_id
  FROM sd_groups g2
  JOIN cube c
    ON c.user_id = g2.user_id
   AND c.puzzle = '333'
   AND c.is_smart
   AND (
        c.id = ANY (g2.sd_ids)
     OR c.legacy_smart_device_ids && g2.sd_ids
     OR c.ble_device_id = ANY (g2.device_ids)
     OR (g2.group_key LIKE 'name:%' AND lower(c.ble_name) = lower(g2.ble_name))
   )
  WHERE g2.cube_id IS NULL
  ORDER BY g2.user_id, g2.group_key,
           (c.id = ANY (g2.sd_ids)) DESC,
           (c.legacy_smart_device_ids && g2.sd_ids) DESC,
           (c.ble_device_id = ANY (g2.device_ids)) DESC NULLS LAST,
           (c.archived_at IS NULL) DESC,
           c.created_at, c.id
) t
WHERE g.user_id = t.user_id AND g.group_key = t.group_key;

INSERT INTO cube_migration_report (step, kind, item, n)
SELECT 2, 'info', 'groups mapped to an existing cube', count(*) FROM sd_groups WHERE match_kind = 'existing';

-- -----------------------------------------------------------------------------
-- 3) INSERT the missing cubes
-- -----------------------------------------------------------------------------
-- updated_at has no database default (Prisma @updatedAt), so it is set here, in
-- UTC like every Prisma timestamp. The brand CASE mirrors brandFromBleName: the
-- first entry of SUPPORTED_SMART_CUBE_BRANDS whose prefix matches, else NULL.
-- starts_with, not LIKE: prefixes such as 'WCU_MY3' contain LIKE wildcards.
WITH ins AS (
  INSERT INTO cube (id, user_id, puzzle, name, brand, is_smart, ble_device_id, ble_name,
                    legacy_smart_device_ids, created_at, updated_at)
  SELECT g.canonical_id, g.user_id, '333', g.cube_name,
         CASE
           WHEN starts_with(g.ble_name, 'GAN') OR starts_with(g.ble_name, 'Gan') OR starts_with(g.ble_name, 'gan') THEN 'GAN' -- BRAND_CASE
           WHEN starts_with(g.ble_name, 'MG') THEN 'Monster Go' -- BRAND_CASE
           WHEN starts_with(g.ble_name, 'AiCube') THEN 'AiCube' -- BRAND_CASE
           WHEN starts_with(g.ble_name, 'Gi') OR starts_with(g.ble_name, 'Hi-') THEN 'Giiker' -- BRAND_CASE
           WHEN starts_with(g.ble_name, 'Mi Smart Magic Cube') THEN 'Xiaomi' -- BRAND_CASE
           WHEN starts_with(g.ble_name, 'GoCube') THEN 'GoCube' -- BRAND_CASE
           WHEN starts_with(g.ble_name, 'Rubiks') THEN 'Rubik''s Connected' -- BRAND_CASE
           WHEN starts_with(g.ble_name, 'MHC') OR starts_with(g.ble_name, 'WCU_MY3') OR starts_with(g.ble_name, '^S') THEN 'MoYu' -- BRAND_CASE
           WHEN starts_with(g.ble_name, 'QY-QYSC') OR starts_with(g.ble_name, 'XMD-TornadoV4-i') THEN 'QiYi' -- BRAND_CASE
         END,
         true, g.ble_device_id, g.ble_name,
         g.sd_ids, g.first_created_at, (now() AT TIME ZONE 'UTC')
  FROM sd_groups g
  WHERE g.cube_id IS NULL
  ORDER BY g.user_id, g.first_created_at, g.canonical_id
  ON CONFLICT DO NOTHING
  RETURNING id
)
UPDATE sd_groups g
SET cube_id = ins.id, match_kind = 'inserted'
FROM ins
WHERE g.canonical_id = ins.id;

INSERT INTO cube_migration_report (step, kind, item, n)
SELECT 3, 'change', 'cubes inserted', count(*) FROM sd_groups WHERE match_kind = 'inserted';

-- A group whose insert lost a (user_id, ble_device_id) conflict shares its BLE id
-- with a cube that exists now (another group of this run, or a cube a running
-- app created a moment ago): same BLE id, same physical cube.
UPDATE sd_groups g
SET cube_id = t.cube_id, match_kind = 'existing_after_conflict'
FROM (
  SELECT DISTINCT ON (g2.user_id, g2.group_key) g2.user_id, g2.group_key, c.id AS cube_id
  FROM sd_groups g2
  JOIN cube c
    ON c.user_id = g2.user_id
   AND c.puzzle = '333'
   AND c.is_smart
   AND (
        c.id = ANY (g2.sd_ids)
     OR c.legacy_smart_device_ids && g2.sd_ids
     OR c.ble_device_id = ANY (g2.device_ids)
   )
  WHERE g2.cube_id IS NULL
  ORDER BY g2.user_id, g2.group_key, c.created_at, c.id
) t
WHERE g.user_id = t.user_id AND g.group_key = t.group_key;

INSERT INTO cube_migration_report (step, kind, item, n)
SELECT 3, 'info', 'groups mapped after an insert conflict', count(*) FROM sd_groups WHERE match_kind = 'existing_after_conflict';
INSERT INTO cube_migration_report (step, kind, item, n)
SELECT 3, 'info', 'groups left without a cube (expected 0)', count(*) FROM sd_groups WHERE cube_id IS NULL;

-- Every smart_device row id -> its cube.
CREATE TEMP TABLE sd_map AS
SELECT x.sd_id, g.user_id, g.cube_id
FROM sd_groups g
CROSS JOIN LATERAL unnest(g.sd_ids) AS x(sd_id)
WHERE g.cube_id IS NOT NULL;

CREATE UNIQUE INDEX ON sd_map (sd_id);
ANALYZE sd_map;

-- -----------------------------------------------------------------------------
-- 4) LEGACY IDS on each cube
-- -----------------------------------------------------------------------------
WITH want AS (
  SELECT cube_id, array_agg(DISTINCT sd_id) AS ids
  FROM sd_map
  GROUP BY cube_id
), upd AS (
  UPDATE cube c
  SET legacy_smart_device_ids = ARRAY(
        SELECT DISTINCT v FROM unnest(c.legacy_smart_device_ids || w.ids) AS v ORDER BY v
      ),
      updated_at = (now() AT TIME ZONE 'UTC')
  FROM want w
  WHERE c.id = w.cube_id
    AND NOT (c.legacy_smart_device_ids @> w.ids)
  RETURNING 1
)
INSERT INTO cube_migration_report (step, kind, item, n)
SELECT 4, 'change', 'cubes whose legacy_smart_device_ids grew', count(*) FROM upd;

-- -----------------------------------------------------------------------------
-- 5) LINK past solves of the registered devices
-- -----------------------------------------------------------------------------
-- The predicate must equal puzzleOfBucket(cube_type, scramble_subset) === '333'
-- (shared/cube_puzzle.ts). The test compares the marked lines with that function.
WITH upd AS (
  UPDATE solve t
  SET cube_id = m.cube_id
  FROM smart_solves s
  JOIN sd_map m ON m.sd_id = s.smart_device_id AND m.user_id = s.user_id
  WHERE t.id = s.id
    AND t.cube_id IS NULL
    AND s.trainer_name IS NULL
    AND ((s.cube_type = 'wca' AND s.scramble_subset IN ('333','333oh','333bf','333ft','333fm','333mbf','333mbld')) OR s.cube_type IN ('333','333cfop','333roux','333mehta','333sub','333zz')) -- PUZZLE_333_PREDICATE
  RETURNING 1
)
INSERT INTO cube_migration_report (step, kind, item, n)
SELECT 5, 'change', 'solves linked to their device''s cube', count(*) FROM upd;

INSERT INTO cube_migration_report (step, kind, item, n)
SELECT 5, 'info', 'device solves not linked: not a 3x3 bucket', count(*)
FROM smart_solves s
JOIN sd_map m ON m.sd_id = s.smart_device_id AND m.user_id = s.user_id
WHERE s.cube_id IS NULL
  AND s.trainer_name IS NULL
  AND NOT coalesce(
    ((s.cube_type = 'wca' AND s.scramble_subset IN ('333','333oh','333bf','333ft','333fm','333mbf','333mbld')) OR s.cube_type IN ('333','333cfop','333roux','333mehta','333sub','333zz')) -- PUZZLE_333_PREDICATE
  , false);

INSERT INTO cube_migration_report (step, kind, item, n)
SELECT 5, 'info', 'device solves not linked: trainer solve', count(*)
FROM smart_solves s
JOIN sd_map m ON m.sd_id = s.smart_device_id AND m.user_id = s.user_id
WHERE s.cube_id IS NULL AND s.trainer_name IS NOT NULL;

INSERT INTO cube_migration_report (step, kind, item, n)
SELECT 5, 'info', 'device solves not linked: device row of another account', count(*)
FROM smart_solves s
JOIN sd_map m ON m.sd_id = s.smart_device_id
WHERE m.user_id <> s.user_id;

-- -----------------------------------------------------------------------------
-- 6) SMART SOLVES WITHOUT A DEVICE ROW (owner decision Q3)
-- -----------------------------------------------------------------------------
-- Linked only when the user has exactly one smart 3x3 cube (archived included:
-- with two candidates there is no safe guess). Identify them afterwards with
--   cube_id IS NOT NULL AND smart_device_id IS NULL AND is_smart_cube
--   AND created_at < <deploy date>
\if :{?skip_orphans}
INSERT INTO cube_migration_report (step, kind, item, n)
SELECT 6, 'info', 'skipped (-v skip_orphans): smart solves without a device row', count(*)
FROM smart_solves s
WHERE s.is_smart_cube AND s.smart_device_id IS NULL AND s.cube_id IS NULL AND s.trainer_name IS NULL
  AND ((s.cube_type = 'wca' AND s.scramble_subset IN ('333','333oh','333bf','333ft','333fm','333mbf','333mbld')) OR s.cube_type IN ('333','333cfop','333roux','333mehta','333sub','333zz')) -- PUZZLE_333_PREDICATE
;
\else
CREATE TEMP TABLE single_smart_cube AS
SELECT c.user_id, min(c.id) AS cube_id, count(*) AS smart_cubes
FROM cube c
WHERE c.is_smart AND c.puzzle = '333'
GROUP BY c.user_id;

WITH upd AS (
  UPDATE solve t
  SET cube_id = o.cube_id
  FROM smart_solves s
  JOIN single_smart_cube o ON o.user_id = s.user_id AND o.smart_cubes = 1
  WHERE t.id = s.id
    AND t.cube_id IS NULL
    AND t.smart_device_id IS NULL
    AND s.is_smart_cube
    AND s.smart_device_id IS NULL
    AND s.trainer_name IS NULL
    AND ((s.cube_type = 'wca' AND s.scramble_subset IN ('333','333oh','333bf','333ft','333fm','333mbf','333mbld')) OR s.cube_type IN ('333','333cfop','333roux','333mehta','333sub','333zz')) -- PUZZLE_333_PREDICATE
  RETURNING 1
)
INSERT INTO cube_migration_report (step, kind, item, n)
SELECT 6, 'change', 'solves without a device row linked to the only smart cube', count(*) FROM upd;

INSERT INTO cube_migration_report (step, kind, item, n)
SELECT 6, 'info', 'solves without a device row left: several smart cubes', count(*)
FROM smart_solves s
JOIN single_smart_cube o ON o.user_id = s.user_id AND o.smart_cubes > 1
WHERE s.is_smart_cube AND s.smart_device_id IS NULL AND s.cube_id IS NULL AND s.trainer_name IS NULL
  AND ((s.cube_type = 'wca' AND s.scramble_subset IN ('333','333oh','333bf','333ft','333fm','333mbf','333mbld')) OR s.cube_type IN ('333','333cfop','333roux','333mehta','333sub','333zz')) -- PUZZLE_333_PREDICATE
;

INSERT INTO cube_migration_report (step, kind, item, n)
SELECT 6, 'info', 'solves without a device row left: no smart cube', count(*)
FROM smart_solves s
WHERE s.is_smart_cube AND s.smart_device_id IS NULL AND s.cube_id IS NULL AND s.trainer_name IS NULL
  AND NOT EXISTS (SELECT 1 FROM single_smart_cube o WHERE o.user_id = s.user_id)
  AND ((s.cube_type = 'wca' AND s.scramble_subset IN ('333','333oh','333bf','333ft','333fm','333mbf','333mbld')) OR s.cube_type IN ('333','333cfop','333roux','333mehta','333sub','333zz')) -- PUZZLE_333_PREDICATE
;
\endif

-- -----------------------------------------------------------------------------
-- 7) 3x3 MAIN for users without one
-- -----------------------------------------------------------------------------
-- Linked solve counts come through the solve_cube_id_idx index, one cube at a time.
WITH ranked AS (
  SELECT DISTINCT ON (c.user_id) c.user_id, c.id AS cube_id
  FROM cube c
  CROSS JOIN LATERAL (
    SELECT count(*) AS n, max(x.created_at) AS last_at
    FROM solve x
    WHERE x.cube_id = c.id AND x.user_id = c.user_id
  ) u
  WHERE c.is_smart
    AND c.puzzle = '333'
    AND c.archived_at IS NULL
    AND NOT EXISTS (SELECT 1 FROM cube_main cm WHERE cm.user_id = c.user_id AND cm.puzzle = '333')
  ORDER BY c.user_id, u.n DESC, u.last_at DESC NULLS LAST, c.created_at, c.id
), ins AS (
  INSERT INTO cube_main (user_id, puzzle, cube_id, set_at)
  SELECT r.user_id, '333', r.cube_id, TIMESTAMP '2000-01-01 00:00:00'
  FROM ranked r
  ON CONFLICT (user_id, puzzle) DO NOTHING
  RETURNING 1
)
INSERT INTO cube_migration_report (step, kind, item, n)
SELECT 7, 'change', '3x3 mains inserted', count(*) FROM ins;

-- -----------------------------------------------------------------------------
-- 8) REPORT (same table on a dry run and on apply)
-- -----------------------------------------------------------------------------
SELECT step, kind, item, n FROM cube_migration_report ORDER BY step, ord;

-- -----------------------------------------------------------------------------
-- VERIFICATION (run by hand after apply)
-- -----------------------------------------------------------------------------
-- 3x3 device solves still without a cube (expect 0; trainer solves and foreign
-- device rows are excluded on purpose):
-- SELECT count(*) FROM solve s
--   JOIN smart_device d ON d.id = s.smart_device_id AND d.user_id = s.user_id
--   WHERE s.cube_id IS NULL AND s.trainer_name IS NULL
--     AND ((s.cube_type = 'wca' AND s.scramble_subset IN ('333','333oh','333bf','333ft','333fm','333mbf','333mbld'))
--          OR s.cube_type IN ('333','333cfop','333roux','333mehta','333sub','333zz'));
-- smart_device rows no cube claims (expect 0):
-- SELECT count(*) FROM smart_device d
--   WHERE NOT EXISTS (SELECT 1 FROM cube c WHERE c.user_id = d.user_id
--                     AND (c.id = d.id OR d.id = ANY (c.legacy_smart_device_ids)));
-- Users with a smart 3x3 cube but no 3x3 main (expect 0 unless all are archived):
-- SELECT count(DISTINCT c.user_id) FROM cube c
--   WHERE c.is_smart AND c.puzzle = '333' AND c.archived_at IS NULL
--     AND NOT EXISTS (SELECT 1 FROM cube_main m WHERE m.user_id = c.user_id AND m.puzzle = '333');
-- Linked solves per cube, biggest first:
-- SELECT c.name, c.user_id, count(s.id) FROM cube c LEFT JOIN solve s ON s.cube_id = c.id
--   WHERE c.is_smart GROUP BY c.id ORDER BY 3 DESC LIMIT 20;

\if :{?apply}
  \if :apply
COMMIT;
\echo 'APPLIED: COMMIT'
  \else
ROLLBACK;
\echo 'DRY RUN: ROLLBACK (nothing written)'
  \endif
\else
ROLLBACK;
\echo 'DRY RUN: ROLLBACK (nothing written)'
\endif
