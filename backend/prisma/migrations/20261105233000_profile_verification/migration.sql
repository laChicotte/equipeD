-- Vérification des profils mentors et candidatures des mentorés pour devenir mentor.
-- CreateEnum
CREATE TYPE "VerificationKind" AS ENUM ('MENTOR_VERIFICATION', 'MENTOR_APPLICATION');

-- CreateEnum
CREATE TYPE "VerificationRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'WITHDRAWN');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "NotificationType" ADD VALUE 'VERIFICATION_APPROVED';
ALTER TYPE "NotificationType" ADD VALUE 'VERIFICATION_REJECTED';

-- CreateTable
CREATE TABLE "verification_requests" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "kind" "VerificationKind" NOT NULL,
    "status" "VerificationRequestStatus" NOT NULL DEFAULT 'PENDING',
    "message" VARCHAR(2000) NOT NULL,
    "profile_url" VARCHAR(300),
    "decision_note" VARCHAR(1000),
    "decided_by_id" TEXT,
    "decided_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "verification_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "verification_documents" (
    "id" TEXT NOT NULL,
    "request_id" TEXT NOT NULL,
    "file_name" VARCHAR(200) NOT NULL,
    "mime_type" VARCHAR(120) NOT NULL,
    "size" INTEGER NOT NULL,
    "data" BYTEA NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "verification_documents_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "verification_requests_status_created_at_idx" ON "verification_requests"("status", "created_at");

-- CreateIndex
CREATE INDEX "verification_requests_user_id_created_at_idx" ON "verification_requests"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "verification_documents_request_id_idx" ON "verification_documents"("request_id");

-- AddForeignKey
ALTER TABLE "verification_requests" ADD CONSTRAINT "verification_requests_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "verification_requests" ADD CONSTRAINT "verification_requests_decided_by_id_fkey" FOREIGN KEY ("decided_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "verification_documents" ADD CONSTRAINT "verification_documents_request_id_fkey" FOREIGN KEY ("request_id") REFERENCES "verification_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Invariants garantis par la base.
-- Une seule demande en attente par personne.
CREATE UNIQUE INDEX "verification_requests_one_pending_per_user" ON "verification_requests"("user_id")
  WHERE "status" = 'PENDING';
-- Message non vide ; un refus est toujours motivé ; une décision est datée.
ALTER TABLE "verification_requests" ADD CONSTRAINT "verification_requests_message_check"
  CHECK (char_length(btrim("message")) >= 30);
ALTER TABLE "verification_requests" ADD CONSTRAINT "verification_requests_decision_check"
  CHECK (
    ("status" IN ('APPROVED', 'REJECTED') AND "decided_at" IS NOT NULL)
    OR ("status" IN ('PENDING', 'WITHDRAWN'))
  );
ALTER TABLE "verification_requests" ADD CONSTRAINT "verification_requests_rejection_note_check"
  CHECK ("status" <> 'REJECTED' OR char_length(btrim(coalesce("decision_note", ''))) >= 10);
-- Justificatifs : PDF ou image, 10 Mo au plus, taille cohérente.
ALTER TABLE "verification_documents" ADD CONSTRAINT "verification_documents_size_check"
  CHECK ("size" BETWEEN 1 AND 10485760 AND "size" = octet_length("data"));
ALTER TABLE "verification_documents" ADD CONSTRAINT "verification_documents_mime_check"
  CHECK ("mime_type" IN ('application/pdf', 'image/png', 'image/jpeg', 'image/webp'));
