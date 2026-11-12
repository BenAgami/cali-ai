-- DropForeignKey
ALTER TABLE "workout_logs" DROP CONSTRAINT "workout_logs_workout_id_fkey";

-- AddForeignKey
ALTER TABLE "workout_logs" ADD CONSTRAINT "workout_logs_workout_id_fkey" FOREIGN KEY ("workout_id") REFERENCES "workouts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
