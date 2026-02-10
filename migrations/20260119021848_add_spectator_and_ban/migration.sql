-- AlterTable
ALTER TABLE "friendly_room_participant" ADD COLUMN     "is_spectator" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "friendly_room_ban" (
    "id" TEXT NOT NULL,
    "room_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "banned_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "friendly_room_ban_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "friendly_room_ban_room_id_idx" ON "friendly_room_ban"("room_id");

-- CreateIndex
CREATE INDEX "friendly_room_ban_user_id_idx" ON "friendly_room_ban"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "friendly_room_ban_room_id_user_id_key" ON "friendly_room_ban"("room_id", "user_id");
