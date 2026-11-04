-- CreateEnum
CREATE TYPE "GenerationStatus" AS ENUM ('PENDING', 'SUCCEEDED', 'FAILED');

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "ai_consent_at" TIMESTAMP(3),
ADD COLUMN     "ai_consent_version" VARCHAR(20),
ALTER COLUMN "experience_level" DROP NOT NULL,
ALTER COLUMN "experience_level" DROP DEFAULT;

-- AlterTable
ALTER TABLE "workouts" ADD COLUMN     "ai_model" VARCHAR(80),
ADD COLUMN     "generation_id" INTEGER;

-- CreateTable
CREATE TABLE "workout_generations" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "status" "GenerationStatus" NOT NULL DEFAULT 'PENDING',
    "goal_text" VARCHAR(500) NOT NULL,
    "model" VARCHAR(80),
    "prompt_version" VARCHAR(40) NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "error_code" VARCHAR(40),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMP(3),

    CONSTRAINT "workout_generations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "idx_workout_generations_user_created_at_desc" ON "workout_generations"("user_id", "created_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "workouts_generation_id_key" ON "workouts"("generation_id");

-- AddForeignKey
ALTER TABLE "workout_generations" ADD CONSTRAINT "workout_generations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workouts" ADD CONSTRAINT "workouts_generation_id_fkey" FOREIGN KEY ("generation_id") REFERENCES "workout_generations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

