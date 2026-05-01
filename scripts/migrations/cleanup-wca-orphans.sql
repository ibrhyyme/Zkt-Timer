-- ============================================================================
-- CLEANUP: cube_type='wca' + scramble_subset=NULL orphans
-- ----------------------------------------------------------------------------
-- Scramble pattern heuristic'iyle subset atar. Tum tablolari (solve, top_solve,
-- top_average) birlikte temizler. Idempotent — ikinci kosturmada 0 satir eslesir.
--
-- Transaction icinde calisir. Hata olursa rollback otomatik. Apply icin SQL
-- sonundaki COMMIT'i acik birak. Dry-run icin COMMIT yerine ROLLBACK koy.
--
-- Kullanim (APPLY):
--   docker compose exec -T postgres psql -U root -d Zkt-Timer < scripts/migrations/cleanup-wca-orphans.sql
--
-- Kullanim (DRY-RUN):
--   sed 's/^COMMIT;$/ROLLBACK;/' scripts/migrations/cleanup-wca-orphans.sql | \
--     docker compose exec -T postgres psql -U root -d Zkt-Timer
-- ============================================================================

BEGIN;

-- ============================================================================
-- SOLVE TABLE
-- ============================================================================

\echo '[solve] Once durumu:'
SELECT
    COALESCE(scramble_subset, '<NULL>') AS subset,
    COUNT(*) AS count
FROM solve
WHERE cube_type = 'wca'
GROUP BY scramble_subset
ORDER BY count DESC;

UPDATE solve
SET scramble_subset = CASE
    WHEN scramble LIKE '%/%' THEN 'sq1'
    WHEN scramble LIKE '%++%' OR scramble LIKE '%--%' THEN 'minx'
    WHEN scramble ~ '\d?[RLUDFB]w' THEN
        CASE
            WHEN length(scramble) < 100 THEN '444'
            WHEN length(scramble) < 130 THEN '555'
            WHEN length(scramble) < 180 THEN '666'
            ELSE '777'
        END
    WHEN scramble ~ '(^|\s)[lrub]''?(\s|$)' AND length(scramble) < 50 THEN 'pyram'
    WHEN scramble ~ '^[UDLRFB''2 ]+$' AND length(scramble) >= 25 AND length(scramble) <= 80 THEN '333'
    WHEN scramble ~ '^[UDLRFB''2 ]+$' AND length(scramble) < 30 THEN '222'
    ELSE NULL
END
WHERE cube_type = 'wca'
  AND scramble_subset IS NULL
  -- Sadece classifier'in atayabildigi satirlar (NULL kalanlar SKIP)
  AND (
      scramble LIKE '%/%'
      OR scramble LIKE '%++%' OR scramble LIKE '%--%'
      OR scramble ~ '\d?[RLUDFB]w'
      OR (scramble ~ '(^|\s)[lrub]''?(\s|$)' AND length(scramble) < 50)
      OR (scramble ~ '^[UDLRFB''2 ]+$' AND length(scramble) >= 25 AND length(scramble) <= 80)
      OR (scramble ~ '^[UDLRFB''2 ]+$' AND length(scramble) < 30)
  );

\echo ''
\echo '[solve] Sonra durumu:'
SELECT
    COALESCE(scramble_subset, '<NULL>') AS subset,
    COUNT(*) AS count
FROM solve
WHERE cube_type = 'wca'
GROUP BY scramble_subset
ORDER BY count DESC;

\echo ''
\echo '[solve] SKIPPED (manuel inceleme):'
SELECT
    length(scramble) AS scr_len,
    LEFT(scramble, 60) AS scr_preview
FROM solve
WHERE cube_type = 'wca' AND scramble_subset IS NULL
LIMIT 10;

-- ============================================================================
-- TOP_SOLVE TABLE
-- ============================================================================
\echo ''
\echo '[top_solve] Once durumu:'
SELECT
    COALESCE(scramble_subset, '<NULL>') AS subset,
    COUNT(*) AS count
FROM top_solve
WHERE cube_type = 'wca'
GROUP BY scramble_subset
ORDER BY count DESC;

UPDATE top_solve ts
SET scramble_subset = CASE
    WHEN s.scramble LIKE '%/%' THEN 'sq1'
    WHEN s.scramble LIKE '%++%' OR s.scramble LIKE '%--%' THEN 'minx'
    WHEN s.scramble ~ '\d?[RLUDFB]w' THEN
        CASE
            WHEN length(s.scramble) < 100 THEN '444'
            WHEN length(s.scramble) < 130 THEN '555'
            WHEN length(s.scramble) < 180 THEN '666'
            ELSE '777'
        END
    WHEN s.scramble ~ '(^|\s)[lrub]''?(\s|$)' AND length(s.scramble) < 50 THEN 'pyram'
    WHEN s.scramble ~ '^[UDLRFB''2 ]+$' AND length(s.scramble) >= 25 AND length(s.scramble) <= 80 THEN '333'
    WHEN s.scramble ~ '^[UDLRFB''2 ]+$' AND length(s.scramble) < 30 THEN '222'
    ELSE NULL
END
FROM solve s
WHERE ts.solve_id = s.id
  AND ts.cube_type = 'wca'
  AND ts.scramble_subset IS NULL
  AND (
      s.scramble LIKE '%/%'
      OR s.scramble LIKE '%++%' OR s.scramble LIKE '%--%'
      OR s.scramble ~ '\d?[RLUDFB]w'
      OR (s.scramble ~ '(^|\s)[lrub]''?(\s|$)' AND length(s.scramble) < 50)
      OR (s.scramble ~ '^[UDLRFB''2 ]+$' AND length(s.scramble) >= 25 AND length(s.scramble) <= 80)
      OR (s.scramble ~ '^[UDLRFB''2 ]+$' AND length(s.scramble) < 30)
  );

\echo ''
\echo '[top_solve] Sonra durumu:'
SELECT
    COALESCE(scramble_subset, '<NULL>') AS subset,
    COUNT(*) AS count
FROM top_solve
WHERE cube_type = 'wca'
GROUP BY scramble_subset
ORDER BY count DESC;

-- ============================================================================
-- TOP_AVERAGE TABLE
-- ============================================================================
\echo ''
\echo '[top_average] Once durumu:'
SELECT
    COALESCE(scramble_subset, '<NULL>') AS subset,
    COUNT(*) AS count
FROM top_average
WHERE cube_type = 'wca'
GROUP BY scramble_subset
ORDER BY count DESC;

UPDATE top_average ta
SET scramble_subset = CASE
    WHEN s.scramble LIKE '%/%' THEN 'sq1'
    WHEN s.scramble LIKE '%++%' OR s.scramble LIKE '%--%' THEN 'minx'
    WHEN s.scramble ~ '\d?[RLUDFB]w' THEN
        CASE
            WHEN length(s.scramble) < 100 THEN '444'
            WHEN length(s.scramble) < 130 THEN '555'
            WHEN length(s.scramble) < 180 THEN '666'
            ELSE '777'
        END
    WHEN s.scramble ~ '(^|\s)[lrub]''?(\s|$)' AND length(s.scramble) < 50 THEN 'pyram'
    WHEN s.scramble ~ '^[UDLRFB''2 ]+$' AND length(s.scramble) >= 25 AND length(s.scramble) <= 80 THEN '333'
    WHEN s.scramble ~ '^[UDLRFB''2 ]+$' AND length(s.scramble) < 30 THEN '222'
    ELSE NULL
END
FROM solve s
WHERE ta.solve_1_id = s.id
  AND ta.cube_type = 'wca'
  AND ta.scramble_subset IS NULL
  AND (
      s.scramble LIKE '%/%'
      OR s.scramble LIKE '%++%' OR s.scramble LIKE '%--%'
      OR s.scramble ~ '\d?[RLUDFB]w'
      OR (s.scramble ~ '(^|\s)[lrub]''?(\s|$)' AND length(s.scramble) < 50)
      OR (s.scramble ~ '^[UDLRFB''2 ]+$' AND length(s.scramble) >= 25 AND length(s.scramble) <= 80)
      OR (s.scramble ~ '^[UDLRFB''2 ]+$' AND length(s.scramble) < 30)
  );

\echo ''
\echo '[top_average] Sonra durumu:'
SELECT
    COALESCE(scramble_subset, '<NULL>') AS subset,
    COUNT(*) AS count
FROM top_average
WHERE cube_type = 'wca'
GROUP BY scramble_subset
ORDER BY count DESC;

-- DRY-RUN icin: bu satiri ROLLBACK; yap.
COMMIT;
