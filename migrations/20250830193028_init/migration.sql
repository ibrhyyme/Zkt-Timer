/*
  Warnings:

  - You are about to drop the `ad_view` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "ad_view" DROP CONSTRAINT "ad_view_user_id_fkey";

-- DropTable
DROP TABLE "ad_view";
