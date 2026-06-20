-- ZKT sprint — local schema sync (idempotent, no data loss).
-- Run with:  npx prisma db execute --file prisma/local_schema_fix.sql --schema schema.prisma
-- Then `npx prisma db push` should report "already in sync".

-- registration_number (WCA registrantId)
ALTER TABLE "zkt_registration" ADD COLUMN IF NOT EXISTS "registration_number" INTEGER;
ALTER TABLE "zkt_round"        ADD COLUMN IF NOT EXISTS "group_count" INTEGER;
ALTER TABLE "zkt_person"       ADD COLUMN IF NOT EXISTS "is_staff" BOOLEAN NOT NULL DEFAULT false;

UPDATE "zkt_registration" r SET "registration_number" = sub.rn
FROM (SELECT id, ROW_NUMBER() OVER (PARTITION BY competition_id ORDER BY created_at, id) rn
      FROM "zkt_registration") sub
WHERE r.id = sub.id AND r."registration_number" IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "zkt_registration_competition_id_registration_number_key"
  ON "zkt_registration" ("competition_id", "registration_number");

-- per-group scrambles
ALTER TABLE "zkt_scramble" ADD COLUMN IF NOT EXISTS "group_id" TEXT;
ALTER TABLE "zkt_scramble" DROP CONSTRAINT IF EXISTS "zkt_scramble_group_id_fkey";
ALTER TABLE "zkt_scramble" ADD CONSTRAINT "zkt_scramble_group_id_fkey"
  FOREIGN KEY ("group_id") REFERENCES "zkt_group"("id") ON DELETE CASCADE ON UPDATE CASCADE;
DROP INDEX IF EXISTS "zkt_scramble_round_id_attempt_number_key";
CREATE UNIQUE INDEX IF NOT EXISTS "zkt_scramble_round_id_group_id_attempt_number_key"
  ON "zkt_scramble" ("round_id", "group_id", "attempt_number");
