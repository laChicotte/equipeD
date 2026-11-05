-- Un mentor accompagne autant de personnes qu'il le souhaite : la capacité maximale disparaît.
-- Certificats d'accompagnement délivrés à la clôture d'un mentorat (instantané figé, vérifiable par code).

-- AlterEnum
ALTER TYPE "NotificationType" ADD VALUE 'CERTIFICATE_ISSUED';

-- AlterTable
ALTER TABLE "mentor_profiles" DROP COLUMN "max_mentees";

-- CreateTable
CREATE TABLE "mentorship_certificates" (
    "id" TEXT NOT NULL,
    "code" VARCHAR(16) NOT NULL,
    "mentorship_id" TEXT NOT NULL,
    "mentor_id" TEXT NOT NULL,
    "mentee_id" TEXT NOT NULL,
    "mentor_name" VARCHAR(170) NOT NULL,
    "mentee_name" VARCHAR(100) NOT NULL,
    "domain_name" VARCHAR(120) NOT NULL,
    "started_at" TIMESTAMPTZ(3) NOT NULL,
    "ended_at" TIMESTAMPTZ(3) NOT NULL,
    "completed_sessions" INTEGER NOT NULL,
    "total_minutes" INTEGER NOT NULL,
    "goals_completed" INTEGER NOT NULL,
    "goals_total" INTEGER NOT NULL,
    "average_rating" DOUBLE PRECISION,
    "issued_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revoked_at" TIMESTAMPTZ(3),

    CONSTRAINT "mentorship_certificates_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "mentorship_certificates_code_key" ON "mentorship_certificates"("code");

-- CreateIndex
CREATE UNIQUE INDEX "mentorship_certificates_mentorship_id_key" ON "mentorship_certificates"("mentorship_id");

-- CreateIndex
CREATE INDEX "mentorship_certificates_mentor_id_issued_at_idx" ON "mentorship_certificates"("mentor_id", "issued_at");

-- AddForeignKey
ALTER TABLE "mentorship_certificates" ADD CONSTRAINT "mentorship_certificates_mentorship_id_fkey" FOREIGN KEY ("mentorship_id") REFERENCES "mentorships"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mentorship_certificates" ADD CONSTRAINT "mentorship_certificates_mentor_id_fkey" FOREIGN KEY ("mentor_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mentorship_certificates" ADD CONSTRAINT "mentorship_certificates_mentee_id_fkey" FOREIGN KEY ("mentee_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Invariants garantis par la base : un certificat suppose au moins une séance réalisée,
-- des durées et compteurs positifs, des dates cohérentes et une note entre 1 et 5.
ALTER TABLE "mentorship_certificates"
  ADD CONSTRAINT "mentorship_certificates_sessions_check" CHECK ("completed_sessions" >= 1),
  ADD CONSTRAINT "mentorship_certificates_minutes_check" CHECK ("total_minutes" > 0),
  ADD CONSTRAINT "mentorship_certificates_goals_check" CHECK ("goals_completed" >= 0 AND "goals_completed" <= "goals_total"),
  ADD CONSTRAINT "mentorship_certificates_dates_check" CHECK ("ended_at" >= "started_at"),
  ADD CONSTRAINT "mentorship_certificates_rating_check" CHECK ("average_rating" IS NULL OR "average_rating" BETWEEN 1 AND 5),
  ADD CONSTRAINT "mentorship_certificates_code_check" CHECK ("code" ~ '^TC-[A-Z0-9]{4}-[A-Z0-9]{4}$');
