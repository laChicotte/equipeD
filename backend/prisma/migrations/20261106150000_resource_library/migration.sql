-- Bibliothèque : validation des documents publiés par les mentors, couvertures,
-- types Livre / Guide / Podcast, auteur de l'œuvre, langue, licence et téléchargements.

ALTER TYPE "ResourceKind" ADD VALUE IF NOT EXISTS 'BOOK';
ALTER TYPE "ResourceKind" ADD VALUE IF NOT EXISTS 'GUIDE';
ALTER TYPE "ResourceKind" ADD VALUE IF NOT EXISTS 'PODCAST';

ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'RESOURCE_SUBMITTED';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'RESOURCE_APPROVED';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'RESOURCE_REJECTED';

CREATE TYPE "ResourceStatus" AS ENUM ('PUBLISHED', 'PENDING', 'REJECTED');

-- Les ressources existantes restent publiées.
ALTER TABLE "resources"
  ADD COLUMN "status" "ResourceStatus" NOT NULL DEFAULT 'PUBLISHED',
  ADD COLUMN "work_author" VARCHAR(120),
  ADD COLUMN "language" VARCHAR(30),
  ADD COLUMN "license" VARCHAR(20),
  ADD COLUMN "rights_confirmed" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "review_note" VARCHAR(500),
  ADD COLUMN "reviewed_at" TIMESTAMPTZ(3),
  ADD COLUMN "download_count" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "resources" ADD CONSTRAINT "resources_license_check"
  CHECK ("license" IS NULL OR "license" IN ('AUTHOR', 'PERMISSION', 'CC', 'PUBLIC_DOMAIN'));
ALTER TABLE "resources" ADD CONSTRAINT "resources_download_count_check"
  CHECK ("download_count" >= 0);
-- Une ressource privée (mentorat) n'est jamais soumise à validation.
ALTER TABLE "resources" ADD CONSTRAINT "resources_private_published_check"
  CHECK ("mentorship_id" IS NULL OR "status" = 'PUBLISHED');

CREATE INDEX "resources_status_created_at_idx" ON "resources"("status", "created_at");

-- Documents : 25 Mo au plus (la limite de 10 Mo des mentors est appliquée par l'API).
ALTER TABLE "resource_files" DROP CONSTRAINT "resource_files_size_check";
ALTER TABLE "resource_files" ADD CONSTRAINT "resource_files_size_check"
  CHECK ("size" BETWEEN 1 AND 26214400 AND "size" = octet_length("data"));

CREATE TABLE "resource_covers" (
    "resource_id" TEXT NOT NULL,
    "mime_type" VARCHAR(40) NOT NULL,
    "size" INTEGER NOT NULL,
    "data" BYTEA NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "resource_covers_pkey" PRIMARY KEY ("resource_id")
);

ALTER TABLE "resource_covers" ADD CONSTRAINT "resource_covers_resource_id_fkey"
  FOREIGN KEY ("resource_id") REFERENCES "resources"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "resource_covers" ADD CONSTRAINT "resource_covers_size_check"
  CHECK ("size" BETWEEN 1 AND 1048576 AND "size" = octet_length("data"));
ALTER TABLE "resource_covers" ADD CONSTRAINT "resource_covers_mime_check"
  CHECK ("mime_type" IN ('image/jpeg', 'image/png', 'image/webp'));
