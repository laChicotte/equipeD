-- CreateEnum
CREATE TYPE "OpportunityType" AS ENUM ('INTERNSHIP', 'JOB', 'CALL_FOR_PROJECTS', 'SCHOLARSHIP', 'TRAINING', 'EVENT', 'OTHER');

-- AlterEnum
ALTER TYPE "UserStatus" ADD VALUE 'DELETED';

-- CreateTable
CREATE TABLE "opportunities" (
    "id" TEXT NOT NULL,
    "author_id" TEXT NOT NULL,
    "domain_id" TEXT,
    "type" "OpportunityType" NOT NULL,
    "title" VARCHAR(160) NOT NULL,
    "organization" VARCHAR(120) NOT NULL,
    "description" VARCHAR(3000) NOT NULL,
    "location" VARCHAR(120),
    "is_remote" BOOLEAN NOT NULL DEFAULT false,
    "url" VARCHAR(500),
    "deadline" TIMESTAMPTZ(3),
    "archived_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "opportunities_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "opportunities_archived_at_deadline_idx" ON "opportunities"("archived_at", "deadline");

-- CreateIndex
CREATE INDEX "opportunities_type_created_at_idx" ON "opportunities"("type", "created_at");

-- CreateIndex
CREATE INDEX "opportunities_domain_id_idx" ON "opportunities"("domain_id");

-- AddForeignKey
ALTER TABLE "opportunities" ADD CONSTRAINT "opportunities_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "opportunities" ADD CONSTRAINT "opportunities_domain_id_fkey" FOREIGN KEY ("domain_id") REFERENCES "expertise_domains"("id") ON DELETE SET NULL ON UPDATE CASCADE;
