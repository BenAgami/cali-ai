/*
  Warnings:

  - You are about to drop the column `password` on the `users` table. All the data in the column will be lost.
  - Added the required column `password_hash` to the `users` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "ExperienceLevel" AS ENUM ('BEGINNER', 'INTERMEDIATE', 'ADVANCED');

-- CreateEnum
CREATE TYPE "GoalType" AS ENUM ('SKILL', 'STRENGTH', 'ENDURANCE', 'MOBILITY', 'CONSISTENCY');

-- CreateEnum
CREATE TYPE "GoalStatus" AS ENUM ('ACTIVE', 'PAUSED', 'COMPLETED', 'DROPPED');

-- CreateEnum
CREATE TYPE "ExerciseType" AS ENUM ('DYNAMIC', 'STATIC_HOLD');

-- CreateEnum
CREATE TYPE "SessionStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "FindingType" AS ENUM ('MISTAKE', 'CORRECTION', 'POSITIVE');

-- CreateEnum
CREATE TYPE "FindingSeverity" AS ENUM ('LOW', 'MEDIUM', 'HIGH');

-- AlterTable
ALTER TABLE "users" DROP COLUMN "password",
ADD COLUMN     "experience_level" "ExperienceLevel" NOT NULL DEFAULT 'BEGINNER',
ADD COLUMN     "password_hash" TEXT NOT NULL;

-- CreateTable
CREATE TABLE "analysis_findings" (
    "id" SERIAL NOT NULL,
    "analysis_result_id" INTEGER NOT NULL,
    "finding_type" "FindingType" NOT NULL,
    "severity" "FindingSeverity" NOT NULL DEFAULT 'MEDIUM',
    "code" VARCHAR(80),
    "title" VARCHAR(140) NOT NULL,
    "description" TEXT NOT NULL,
    "correction" TEXT,
    "body_part" VARCHAR(60),
    "start_sec" DECIMAL(6,2),
    "end_sec" DECIMAL(6,2),
    "sort_order" SMALLINT NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "analysis_findings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "analysis_results" (
    "id" SERIAL NOT NULL,
    "session_id" INTEGER NOT NULL,
    "form_score" SMALLINT NOT NULL,
    "score_breakdown" JSONB NOT NULL DEFAULT '{}',
    "summary_feedback" TEXT,
    "raw_feedback" JSONB NOT NULL DEFAULT '{}',
    "ai_model_name" VARCHAR(80),
    "ai_model_version" VARCHAR(40),
    "analyzed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "analysis_results_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "body_metrics" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "height_cm" DOUBLE PRECISION,
    "weight_kg" DOUBLE PRECISION,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "body_metrics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "exercises" (
    "id" SERIAL NOT NULL,
    "code" VARCHAR(40) NOT NULL,
    "display_name" VARCHAR(80) NOT NULL,
    "exercise_type" "ExerciseType" NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "description" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "exercises_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "milestone_definitions" (
    "id" SERIAL NOT NULL,
    "code" VARCHAR(60) NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "description" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "milestone_definitions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_goals" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "goal_type" "GoalType" NOT NULL,
    "title" VARCHAR(120) NOT NULL,
    "target_value" DECIMAL(10,2),
    "target_unit" VARCHAR(30),
    "target_date" DATE,
    "status" "GoalStatus" NOT NULL DEFAULT 'ACTIVE',
    "completed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_goals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_milestones" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "milestone_definition_id" INTEGER NOT NULL,
    "session_id" INTEGER,
    "unlocked_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_milestones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workout_sessions" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "exercise_id" INTEGER NOT NULL,
    "processing_status" "SessionStatus" NOT NULL DEFAULT 'PENDING',
    "notes" TEXT,
    "performed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "video_duration_sec" DECIMAL(6,2),
    "video_fps" DECIMAL(6,2),
    "video_width" INTEGER,
    "video_height" INTEGER,
    "video_size_bytes" BIGINT,
    "processing_started_at" TIMESTAMP(3),
    "processing_finished_at" TIMESTAMP(3),
    "failure_reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "workout_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "idx_findings_result_type_order" ON "analysis_findings"("analysis_result_id", "finding_type", "sort_order");

-- CreateIndex
CREATE INDEX "idx_findings_code" ON "analysis_findings"("code");

-- CreateIndex
CREATE UNIQUE INDEX "analysis_results_session_id_key" ON "analysis_results"("session_id");

-- CreateIndex
CREATE INDEX "idx_analysis_results_analyzed_at" ON "analysis_results"("analyzed_at" DESC);

-- CreateIndex
CREATE INDEX "idx_body_metrics_user_created_at_desc" ON "body_metrics"("user_id", "created_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "exercises_code_key" ON "exercises"("code");

-- CreateIndex
CREATE UNIQUE INDEX "milestone_definitions_code_key" ON "milestone_definitions"("code");

-- CreateIndex
CREATE INDEX "idx_user_goals_user_status" ON "user_goals"("user_id", "status");

-- CreateIndex
CREATE INDEX "idx_user_milestones_user_unlocked_at_desc" ON "user_milestones"("user_id", "unlocked_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "user_milestones_user_id_milestone_definition_id_key" ON "user_milestones"("user_id", "milestone_definition_id");

-- CreateIndex
CREATE INDEX "idx_sessions_user_performed_at_desc" ON "workout_sessions"("user_id", "performed_at" DESC);

-- CreateIndex
CREATE INDEX "idx_sessions_user_exercise_performed_at_desc" ON "workout_sessions"("user_id", "exercise_id", "performed_at" DESC);

-- CreateIndex
CREATE INDEX "idx_sessions_processing_status" ON "workout_sessions"("processing_status");

-- AddForeignKey
ALTER TABLE "analysis_findings" ADD CONSTRAINT "analysis_findings_analysis_result_id_fkey" FOREIGN KEY ("analysis_result_id") REFERENCES "analysis_results"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "analysis_results" ADD CONSTRAINT "analysis_results_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "workout_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "body_metrics" ADD CONSTRAINT "body_metrics_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_goals" ADD CONSTRAINT "user_goals_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_milestones" ADD CONSTRAINT "user_milestones_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_milestones" ADD CONSTRAINT "user_milestones_milestone_definition_id_fkey" FOREIGN KEY ("milestone_definition_id") REFERENCES "milestone_definitions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_milestones" ADD CONSTRAINT "user_milestones_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "workout_sessions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workout_sessions" ADD CONSTRAINT "workout_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workout_sessions" ADD CONSTRAINT "workout_sessions_exercise_id_fkey" FOREIGN KEY ("exercise_id") REFERENCES "exercises"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
