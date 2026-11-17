-- AlterTable
ALTER TABLE "workout_logs" ADD COLUMN     "started_at" TIMESTAMP(3);

-- Existing logs were written once, at the end of a run.
UPDATE "workout_logs"
SET "started_at" = "completed_at" - ("duration_secs" * INTERVAL '1 second');

-- AlterTable
ALTER TABLE "workout_logs" ALTER COLUMN "started_at" SET NOT NULL,
ALTER COLUMN "started_at" SET DEFAULT CURRENT_TIMESTAMP,
ALTER COLUMN "completed_at" DROP NOT NULL,
ALTER COLUMN "completed_at" DROP DEFAULT,
ALTER COLUMN "duration_secs" DROP NOT NULL;

-- AlterTable
ALTER TABLE "workout_sessions" ADD COLUMN     "workout_log_id" INTEGER;

-- CreateIndex
CREATE INDEX "idx_sessions_workout_log_id" ON "workout_sessions"("workout_log_id");

-- AddForeignKey
ALTER TABLE "workout_sessions" ADD CONSTRAINT "workout_sessions_workout_log_id_fkey" FOREIGN KEY ("workout_log_id") REFERENCES "workout_logs"("id") ON DELETE SET NULL ON UPDATE CASCADE;
