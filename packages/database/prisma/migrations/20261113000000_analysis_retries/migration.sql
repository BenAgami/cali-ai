-- CreateTable
CREATE TABLE "analysis_retries" (
    "id" SERIAL NOT NULL,
    "session_id" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "analysis_retries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "idx_analysis_retries_session_created" ON "analysis_retries"("session_id", "created_at");

-- AddForeignKey
ALTER TABLE "analysis_retries" ADD CONSTRAINT "analysis_retries_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "workout_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
