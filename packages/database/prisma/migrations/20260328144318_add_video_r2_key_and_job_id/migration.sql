/*
  Warnings:

  - Made the column `height_cm` on table `body_metrics` required. This step will fail if there are existing NULL values in that column.
  - Made the column `weight_kg` on table `body_metrics` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "body_metrics" ALTER COLUMN "height_cm" SET NOT NULL,
ALTER COLUMN "weight_kg" SET NOT NULL;

-- AlterTable
ALTER TABLE "workout_sessions" ADD COLUMN     "bullmq_job_id" TEXT,
ADD COLUMN     "video_r2_key" TEXT;
