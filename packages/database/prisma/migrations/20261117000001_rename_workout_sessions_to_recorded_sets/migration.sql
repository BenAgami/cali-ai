-- Rename WorkoutSession to RecordedSet, its session_id foreign keys to
-- recorded_set_id, and the SessionStatus enum to ProcessingStatus.
-- Hand-written: Prisma generates a rename as drop + create, which would delete
-- every recorded set and its analysis. Each statement renames in place, so
-- rows, ids and foreign keys are kept.

-- RenameEnum
ALTER TYPE "SessionStatus" RENAME TO "ProcessingStatus";

-- RenameTable
ALTER TABLE "workout_sessions" RENAME TO "recorded_sets";
ALTER SEQUENCE "workout_sessions_id_seq" RENAME TO "recorded_sets_id_seq";
ALTER TABLE "recorded_sets" RENAME CONSTRAINT "workout_sessions_pkey" TO "recorded_sets_pkey";
ALTER TABLE "recorded_sets" RENAME CONSTRAINT "workout_sessions_user_id_fkey" TO "recorded_sets_user_id_fkey";
ALTER TABLE "recorded_sets" RENAME CONSTRAINT "workout_sessions_exercise_id_fkey" TO "recorded_sets_exercise_id_fkey";
ALTER TABLE "recorded_sets" RENAME CONSTRAINT "workout_sessions_workout_id_fkey" TO "recorded_sets_workout_id_fkey";
ALTER TABLE "recorded_sets" RENAME CONSTRAINT "workout_sessions_workout_run_id_fkey" TO "recorded_sets_workout_run_id_fkey";
ALTER INDEX "idx_sessions_user_performed_at_desc" RENAME TO "idx_recorded_sets_user_performed_at_desc";
ALTER INDEX "idx_sessions_user_exercise_performed_at_desc" RENAME TO "idx_recorded_sets_user_exercise_performed_at_desc";
ALTER INDEX "idx_sessions_workout_performed_at_desc" RENAME TO "idx_recorded_sets_workout_performed_at_desc";
ALTER INDEX "idx_sessions_workout_run_id" RENAME TO "idx_recorded_sets_workout_run_id";
ALTER INDEX "idx_sessions_processing_status" RENAME TO "idx_recorded_sets_processing_status";

-- RenameColumn: analysis_results
ALTER TABLE "analysis_results" RENAME COLUMN "session_id" TO "recorded_set_id";
ALTER TABLE "analysis_results" RENAME CONSTRAINT "analysis_results_session_id_fkey" TO "analysis_results_recorded_set_id_fkey";
ALTER INDEX "analysis_results_session_id_key" RENAME TO "analysis_results_recorded_set_id_key";

-- RenameColumn: pose_captures
ALTER TABLE "pose_captures" RENAME COLUMN "session_id" TO "recorded_set_id";
ALTER TABLE "pose_captures" RENAME CONSTRAINT "pose_captures_session_id_fkey" TO "pose_captures_recorded_set_id_fkey";
ALTER INDEX "pose_captures_session_id_key" RENAME TO "pose_captures_recorded_set_id_key";

-- RenameColumn: analysis_retries
ALTER TABLE "analysis_retries" RENAME COLUMN "session_id" TO "recorded_set_id";
ALTER TABLE "analysis_retries" RENAME CONSTRAINT "analysis_retries_session_id_fkey" TO "analysis_retries_recorded_set_id_fkey";
ALTER INDEX "idx_analysis_retries_session_created" RENAME TO "idx_analysis_retries_recorded_set_created";

-- RenameColumn: user_milestones
ALTER TABLE "user_milestones" RENAME COLUMN "session_id" TO "recorded_set_id";
ALTER TABLE "user_milestones" RENAME CONSTRAINT "user_milestones_session_id_fkey" TO "user_milestones_recorded_set_id_fkey";
