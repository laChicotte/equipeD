-- Documents joints aux ressources (partage privé dans un mentorat ou bibliothèque publique).
-- AlterTable
ALTER TABLE "resources" ADD COLUMN     "has_file" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "resource_files" (
    "resource_id" TEXT NOT NULL,
    "file_name" VARCHAR(200) NOT NULL,
    "mime_type" VARCHAR(120) NOT NULL,
    "size" INTEGER NOT NULL,
    "data" BYTEA NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "resource_files_pkey" PRIMARY KEY ("resource_id")
);

-- AddForeignKey
ALTER TABLE "resource_files" ADD CONSTRAINT "resource_files_resource_id_fkey" FOREIGN KEY ("resource_id") REFERENCES "resources"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Une ressource contient un lien, un texte ou un document (has_file).
ALTER TABLE "resources" DROP CONSTRAINT "resources_has_content";
ALTER TABLE "resources"
  ADD CONSTRAINT "resources_has_content" CHECK ("url" IS NOT NULL OR "description" IS NOT NULL OR "has_file");

-- Invariants garantis par la base : 10 Mo au plus, taille cohérente, types de documents autorisés.
ALTER TABLE "resource_files" ADD CONSTRAINT "resource_files_size_check" CHECK ("size" BETWEEN 1 AND 10485760 AND "size" = octet_length("data"));
ALTER TABLE "resource_files" ADD CONSTRAINT "resource_files_mime_check" CHECK ("mime_type" IN (
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/vnd.oasis.opendocument.text',
  'application/vnd.oasis.opendocument.spreadsheet',
  'application/vnd.oasis.opendocument.presentation',
  'text/plain',
  'text/csv',
  'image/png',
  'image/jpeg',
  'image/webp'
));
