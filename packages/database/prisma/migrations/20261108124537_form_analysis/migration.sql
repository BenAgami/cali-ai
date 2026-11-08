-- CreateEnum
CREATE TYPE "AnalysisOutcome" AS ENUM ('SCORED', 'UNTRACKABLE');

-- AlterTable
ALTER TABLE "analysis_findings" ADD COLUMN     "rep_numbers" INTEGER[] DEFAULT ARRAY[]::INTEGER[];

-- AlterTable
ALTER TABLE "analysis_results" ADD COLUMN     "outcome" "AnalysisOutcome" NOT NULL DEFAULT 'SCORED',
ADD COLUMN     "untrackable_reasons" TEXT[] DEFAULT ARRAY[]::TEXT[],
ALTER COLUMN "form_score" DROP NOT NULL;

-- AlterTable
ALTER TABLE "workout_sessions" ADD COLUMN     "set_number" SMALLINT,
ADD COLUMN     "workout_id" INTEGER;

-- CreateIndex
CREATE INDEX "idx_sessions_workout_performed_at_desc" ON "workout_sessions"("workout_id", "performed_at" DESC);

-- AddForeignKey
ALTER TABLE "workout_sessions" ADD CONSTRAINT "workout_sessions_workout_id_fkey" FOREIGN KEY ("workout_id") REFERENCES "workouts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
