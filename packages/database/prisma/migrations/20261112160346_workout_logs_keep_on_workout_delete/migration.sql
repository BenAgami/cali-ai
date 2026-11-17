-- DropForeignKey
ALTER TABLE "workout_logs" DROP CONSTRAINT "workout_logs_workout_id_fkey";

-- AlterTable
ALTER TABLE "workout_logs" ALTER COLUMN "workout_id" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "workout_logs" ADD CONSTRAINT "workout_logs_workout_id_fkey" FOREIGN KEY ("workout_id") REFERENCES "workouts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
