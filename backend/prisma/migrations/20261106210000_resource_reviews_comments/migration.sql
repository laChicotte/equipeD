-- Fiche ressource : avis (note 1 à 5) et questions / discussion avec la personne qui partage.
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'RESOURCE_COMMENT';

CREATE TABLE "resource_reviews" (
    "id" TEXT NOT NULL,
    "resource_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "rating" SMALLINT NOT NULL,
    "comment" VARCHAR(1000),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "resource_reviews_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "resource_reviews_rating_check" CHECK ("rating" BETWEEN 1 AND 5)
);
CREATE UNIQUE INDEX "resource_reviews_resource_id_user_id_key" ON "resource_reviews"("resource_id", "user_id");
CREATE INDEX "resource_reviews_resource_id_created_at_idx" ON "resource_reviews"("resource_id", "created_at");
ALTER TABLE "resource_reviews" ADD CONSTRAINT "resource_reviews_resource_id_fkey"
  FOREIGN KEY ("resource_id") REFERENCES "resources"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "resource_reviews" ADD CONSTRAINT "resource_reviews_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "resource_comments" (
    "id" TEXT NOT NULL,
    "resource_id" TEXT NOT NULL,
    "author_id" TEXT NOT NULL,
    "parent_id" TEXT,
    "content" VARCHAR(2000) NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "resource_comments_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "resource_comments_content_check" CHECK (length(btrim("content")) >= 2)
);
CREATE INDEX "resource_comments_resource_id_created_at_idx" ON "resource_comments"("resource_id", "created_at");
ALTER TABLE "resource_comments" ADD CONSTRAINT "resource_comments_resource_id_fkey"
  FOREIGN KEY ("resource_id") REFERENCES "resources"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "resource_comments" ADD CONSTRAINT "resource_comments_author_id_fkey"
  FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "resource_comments" ADD CONSTRAINT "resource_comments_parent_id_fkey"
  FOREIGN KEY ("parent_id") REFERENCES "resource_comments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
