-- AlterTable
ALTER TABLE "user_account" ADD COLUMN "email_verified" BOOLEAN NOT NULL DEFAULT false;

-- Set existing users as verified
UPDATE "user_account" SET "email_verified" = true WHERE "email_verified" = false;

-- CreateTable
CREATE TABLE "email_verification" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "claimed" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "email_verification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "email_verification_user_id_idx" ON "email_verification"("user_id");

-- AddForeignKey
ALTER TABLE "email_verification" ADD CONSTRAINT "email_verification_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user_account"("id") ON DELETE CASCADE ON UPDATE CASCADE;
