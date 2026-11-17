-- Rename WorkoutLog to WorkoutRun. Hand-written: Prisma generates a rename as
-- drop + create, which would delete every run. Each statement renames in
-- place, so rows, ids and foreign keys are kept.

-- RenameTable
ALTER TABLE "workout_logs" RENAME TO "workout_runs";
ALTER SEQUENCE "workout_logs_id_seq" RENAME TO "workout_runs_id_seq";
ALTER TABLE "workout_runs" RENAME CONSTRAINT "workout_logs_pkey" TO "workout_runs_pkey";
ALTER TABLE "workout_runs" RENAME CONSTRAINT "workout_logs_user_id_fkey" TO "workout_runs_user_id_fkey";
ALTER TABLE "workout_runs" RENAME CONSTRAINT "workout_logs_workout_id_fkey" TO "workout_runs_workout_id_fkey";
ALTER INDEX "idx_workout_logs_user_completed" RENAME TO "idx_workout_runs_user_completed";

-- RenameColumn
ALTER TABLE "workout_sessions" RENAME COLUMN "workout_log_id" TO "workout_run_id";
ALTER TABLE "workout_sessions" RENAME CONSTRAINT "workout_sessions_workout_log_id_fkey" TO "workout_sessions_workout_run_id_fkey";
ALTER INDEX "idx_sessions_workout_log_id" RENAME TO "idx_sessions_workout_run_id";
