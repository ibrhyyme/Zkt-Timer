-- CreateTable
CREATE TABLE "wca_record" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "integration_id" TEXT NOT NULL,
    "wca_event" TEXT NOT NULL,
    "single_record" INTEGER,
    "average_record" INTEGER,
    "single_world_rank" INTEGER,
    "average_world_rank" INTEGER,
    "single_continent_rank" INTEGER,
    "average_continent_rank" INTEGER,
    "single_country_rank" INTEGER,
    "average_country_rank" INTEGER,
    "published" BOOLEAN NOT NULL DEFAULT false,
    "fetched_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "wca_record_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "wca_record_user_id_idx" ON "wca_record"("user_id");

-- CreateIndex
CREATE INDEX "wca_record_integration_id_idx" ON "wca_record"("integration_id");

-- CreateIndex
CREATE INDEX "wca_record_published_idx" ON "wca_record"("published");

-- CreateIndex
CREATE UNIQUE INDEX "wca_record_user_id_wca_event_key" ON "wca_record"("user_id", "wca_event");

-- AddForeignKey
ALTER TABLE "wca_record" ADD CONSTRAINT "wca_record_integration_id_fkey" FOREIGN KEY ("integration_id") REFERENCES "integration"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wca_record" ADD CONSTRAINT "wca_record_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user_account"("id") ON DELETE CASCADE ON UPDATE CASCADE;
