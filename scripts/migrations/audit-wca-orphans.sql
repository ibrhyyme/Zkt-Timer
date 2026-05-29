-- ============================================================================
-- AUDIT: cube_type='wca' + scramble_subset=NULL orphans
-- ----------------------------------------------------------------------------
-- Read-only. No UPDATE/DELETE operations. Report only.
--
-- Usage:
--   docker compose exec -T postgres psql -U root -d Zkt-Timer < scripts/migrations/audit-wca-orphans.sql
-- ============================================================================

\echo '================================================================'
\echo 'SOLVE TABLE — cube_type=wca distribution (by subset)'
\echo '================================================================'
SELECT
    COALESCE(scramble_subset, '<NULL>') AS subset,
    COUNT(*) AS count
FROM solve
WHERE cube_type = 'wca'
GROUP BY scramble_subset
ORDER BY count DESC;

\echo ''
\echo '================================================================'
\echo 'SOLVE — orphan classification preview'
\echo '================================================================'
SELECT
    CASE
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
        ELSE 'SKIP'
    END AS predicted_subset,
    COUNT(*) AS count
FROM solve
WHERE cube_type = 'wca'
  AND scramble_subset IS NULL
GROUP BY predicted_subset
ORDER BY count DESC;

\echo ''
\echo '================================================================'
\echo 'TOP_SOLVE TABLE — cube_type=wca distribution'
\echo '================================================================'
SELECT
    COALESCE(scramble_subset, '<NULL>') AS subset,
    COUNT(*) AS count
FROM top_solve
WHERE cube_type = 'wca'
GROUP BY scramble_subset
ORDER BY count DESC;

\echo ''
\echo '================================================================'
\echo 'TOP_AVERAGE TABLE — cube_type=wca distribution'
\echo '================================================================'
SELECT
    COALESCE(scramble_subset, '<NULL>') AS subset,
    COUNT(*) AS count
FROM top_average
WHERE cube_type = 'wca'
GROUP BY scramble_subset
ORDER BY count DESC;

\echo ''
\echo '================================================================'
\echo 'SOLVE — top 5 users with most orphans'
\echo '================================================================'
SELECT
    user_id,
    COUNT(*) AS orphan_count
FROM solve
WHERE cube_type = 'wca' AND scramble_subset IS NULL
GROUP BY user_id
ORDER BY orphan_count DESC
LIMIT 5;

\echo ''
\echo '================================================================'
\echo 'SOLVE — first 10 orphan example scrambles'
\echo '================================================================'
SELECT
    length(scramble) AS scr_len,
    LEFT(scramble, 60) AS scr_preview,
    created_at
FROM solve
WHERE cube_type = 'wca' AND scramble_subset IS NULL
ORDER BY created_at ASC
LIMIT 10;
