-- CreateEnum
CREATE TYPE "FriendlyRoomStatus" AS ENUM ('WAITING', 'ACTIVE', 'CLOSED');

-- CreateTable
CREATE TABLE "friendly_room" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "password" TEXT,
    "cube_type" TEXT NOT NULL DEFAULT '333',
    "max_players" INTEGER NOT NULL DEFAULT 8,
    "created_by_id" TEXT NOT NULL,
    "is_private" BOOLEAN NOT NULL DEFAULT false,
    "current_scramble" TEXT,
    "scramble_index" INTEGER NOT NULL DEFAULT 0,
    "status" "FriendlyRoomStatus" NOT NULL DEFAULT 'WAITING',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "friendly_room_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "friendly_room_participant" (
    "id" TEXT NOT NULL,
    "room_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "is_ready" BOOLEAN NOT NULL DEFAULT false,
    "joined_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "friendly_room_participant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "friendly_room_solve" (
    "id" TEXT NOT NULL,
    "room_id" TEXT NOT NULL,
    "participant_id" TEXT NOT NULL,
    "scramble_index" INTEGER NOT NULL,
    "time" DOUBLE PRECISION NOT NULL,
    "dnf" BOOLEAN NOT NULL DEFAULT false,
    "plus_two" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "friendly_room_solve_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "friendly_room_chat" (
    "id" TEXT NOT NULL,
    "room_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "friendly_room_chat_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "friendly_room_created_by_id_idx" ON "friendly_room"("created_by_id");

-- CreateIndex
CREATE INDEX "friendly_room_status_idx" ON "friendly_room"("status");

-- CreateIndex
CREATE INDEX "friendly_room_participant_room_id_idx" ON "friendly_room_participant"("room_id");

-- CreateIndex
CREATE INDEX "friendly_room_participant_user_id_idx" ON "friendly_room_participant"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "friendly_room_participant_room_id_user_id_key" ON "friendly_room_participant"("room_id", "user_id");

-- CreateIndex
CREATE INDEX "friendly_room_solve_room_id_idx" ON "friendly_room_solve"("room_id");

-- CreateIndex
CREATE INDEX "friendly_room_solve_participant_id_idx" ON "friendly_room_solve"("participant_id");

-- CreateIndex
CREATE INDEX "friendly_room_solve_scramble_index_idx" ON "friendly_room_solve"("scramble_index");

-- CreateIndex
CREATE INDEX "friendly_room_chat_room_id_idx" ON "friendly_room_chat"("room_id");

-- CreateIndex
CREATE INDEX "friendly_room_chat_user_id_idx" ON "friendly_room_chat"("user_id");

-- AddForeignKey
ALTER TABLE "friendly_room" ADD CONSTRAINT "friendly_room_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "user_account"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "friendly_room_participant" ADD CONSTRAINT "friendly_room_participant_room_id_fkey" FOREIGN KEY ("room_id") REFERENCES "friendly_room"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "friendly_room_participant" ADD CONSTRAINT "friendly_room_participant_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user_account"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "friendly_room_solve" ADD CONSTRAINT "friendly_room_solve_room_id_fkey" FOREIGN KEY ("room_id") REFERENCES "friendly_room"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "friendly_room_solve" ADD CONSTRAINT "friendly_room_solve_participant_id_fkey" FOREIGN KEY ("participant_id") REFERENCES "friendly_room_participant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "friendly_room_chat" ADD CONSTRAINT "friendly_room_chat_room_id_fkey" FOREIGN KEY ("room_id") REFERENCES "friendly_room"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "friendly_room_chat" ADD CONSTRAINT "friendly_room_chat_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user_account"("id") ON DELETE CASCADE ON UPDATE CASCADE;
