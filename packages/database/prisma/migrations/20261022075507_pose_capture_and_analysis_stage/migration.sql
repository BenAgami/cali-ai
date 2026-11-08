-- CreateEnum
CREATE TYPE "AnalysisStage" AS ENUM ('QUEUED', 'ANALYZING_REPS', 'WRITING_FEEDBACK', 'COMPLETED');

-- AlterTable
ALTER TABLE "workout_sessions" DROP COLUMN "video_duration_sec",
DROP COLUMN "video_fps",
DROP COLUMN "video_height",
DROP COLUMN "video_r2_key",
DROP COLUMN "video_size_bytes",
DROP COLUMN "video_width",
ADD COLUMN     "analysis_stage" "AnalysisStage",
ADD COLUMN     "analysis_stage_progress" REAL;

-- CreateTable
CREATE TABLE "pose_captures" (
    "id" SERIAL NOT NULL,
    "session_id" INTEGER NOT NULL,
    "keypoints" BYTEA,
    "keypoints_format" VARCHAR(40) NOT NULL,
    "pose_model_name" VARCHAR(80) NOT NULL,
    "pose_model_version" VARCHAR(40) NOT NULL,
    "fps" DECIMAL(6,2) NOT NULL,
    "frame_count" INTEGER NOT NULL,
    "duration_sec" DECIMAL(6,2) NOT NULL,
    "camera_view" VARCHAR(20),
    "device_model" VARCHAR(80),
    "app_version" VARCHAR(40),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pose_captures_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "pose_captures_session_id_key" ON "pose_captures"("session_id");

-- AddForeignKey
ALTER TABLE "pose_captures" ADD CONSTRAINT "pose_captures_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "workout_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
