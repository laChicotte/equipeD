-- CreateTable
CREATE TABLE "session_feedbacks" (
    "id" TEXT NOT NULL,
    "session_id" TEXT NOT NULL,
    "author_id" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "comment" VARCHAR(1000),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "session_feedbacks_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "session_feedbacks_author_id_idx" ON "session_feedbacks"("author_id");

-- CreateIndex
CREATE UNIQUE INDEX "session_feedbacks_session_id_author_id_key" ON "session_feedbacks"("session_id", "author_id");

-- AddForeignKey
ALTER TABLE "session_feedbacks" ADD CONSTRAINT "session_feedbacks_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "mentoring_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "session_feedbacks" ADD CONSTRAINT "session_feedbacks_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Note bornée de 1 à 5.
ALTER TABLE "session_feedbacks"
  ADD CONSTRAINT "session_feedbacks_rating_range" CHECK ("rating" BETWEEN 1 AND 5);
