-- Rename Workout to WorkoutPlan and its workout_id foreign keys to
-- workout_plan_id. Hand-written: Prisma generates a rename as drop + create,
-- which would delete every plan, its exercises and the links from runs and
-- recorded sets. Each statement renames in place, so rows, ids and foreign
-- keys are kept.

-- RenameTable
ALTER TABLE "workouts" RENAME TO "workout_plans";
ALTER SEQUENCE "workouts_id_seq" RENAME TO "workout_plans_id_seq";
ALTER TABLE "workout_plans" RENAME CONSTRAINT "workouts_pkey" TO "workout_plans_pkey";
ALTER TABLE "workout_plans" RENAME CONSTRAINT "workouts_user_id_fkey" TO "workout_plans_user_id_fkey";
ALTER TABLE "workout_plans" RENAME CONSTRAINT "workouts_generation_id_fkey" TO "workout_plans_generation_id_fkey";
ALTER INDEX "workouts_generation_id_key" RENAME TO "workout_plans_generation_id_key";
ALTER INDEX "idx_workouts_user_updated_at" RENAME TO "idx_workout_plans_user_updated_at";

-- RenameColumn: workout_exercises
ALTER TABLE "workout_exercises" RENAME COLUMN "workout_id" TO "workout_plan_id";
ALTER TABLE "workout_exercises" RENAME CONSTRAINT "workout_exercises_workout_id_fkey" TO "workout_exercises_workout_plan_id_fkey";
ALTER INDEX "idx_workout_exercises_workout_id" RENAME TO "idx_workout_exercises_workout_plan_id";
ALTER INDEX "uniq_workout_exercises_workout_position" RENAME TO "uniq_workout_exercises_workout_plan_position";

-- RenameColumn: workout_runs
ALTER TABLE "workout_runs" RENAME COLUMN "workout_id" TO "workout_plan_id";
ALTER TABLE "workout_runs" RENAME CONSTRAINT "workout_runs_workout_id_fkey" TO "workout_runs_workout_plan_id_fkey";

-- RenameColumn: recorded_sets
ALTER TABLE "recorded_sets" RENAME COLUMN "workout_id" TO "workout_plan_id";
ALTER TABLE "recorded_sets" RENAME CONSTRAINT "recorded_sets_workout_id_fkey" TO "recorded_sets_workout_plan_id_fkey";
ALTER INDEX "idx_recorded_sets_workout_performed_at_desc" RENAME TO "idx_recorded_sets_workout_plan_performed_at_desc";
