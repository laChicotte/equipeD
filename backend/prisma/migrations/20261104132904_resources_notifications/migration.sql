-- CreateEnum
CREATE TYPE "ResourceKind" AS ENUM ('ARTICLE', 'VIDEO', 'TEMPLATE', 'TOOL', 'ADVICE', 'OTHER');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('REQUEST_RECEIVED', 'REQUEST_ACCEPTED', 'REQUEST_DECLINED', 'SESSION_REQUESTED', 'SESSION_CONFIRMED', 'SESSION_CANCELLED', 'GOAL_FEEDBACK', 'RESOURCE_SHARED');

-- CreateTable
CREATE TABLE "resources" (
    "id" TEXT NOT NULL,
    "author_id" TEXT NOT NULL,
    "mentorship_id" TEXT,
    "domain_id" TEXT,
    "kind" "ResourceKind" NOT NULL DEFAULT 'OTHER',
    "title" VARCHAR(160) NOT NULL,
    "description" VARCHAR(2000),
    "url" VARCHAR(500),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "resources_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "type" "NotificationType" NOT NULL,
    "title" VARCHAR(160) NOT NULL,
    "body" VARCHAR(500),
    "link" VARCHAR(300),
    "read_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "resources_mentorship_id_created_at_idx" ON "resources"("mentorship_id", "created_at");

-- CreateIndex
CREATE INDEX "resources_domain_id_created_at_idx" ON "resources"("domain_id", "created_at");

-- CreateIndex
CREATE INDEX "notifications_user_id_read_at_created_at_idx" ON "notifications"("user_id", "read_at", "created_at");

-- AddForeignKey
ALTER TABLE "resources" ADD CONSTRAINT "resources_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "resources" ADD CONSTRAINT "resources_mentorship_id_fkey" FOREIGN KEY ("mentorship_id") REFERENCES "mentorships"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "resources" ADD CONSTRAINT "resources_domain_id_fkey" FOREIGN KEY ("domain_id") REFERENCES "expertise_domains"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Une ressource porte au moins un lien ou un contenu rédigé.
ALTER TABLE "resources"
  ADD CONSTRAINT "resources_has_content" CHECK ("url" IS NOT NULL OR "description" IS NOT NULL);
