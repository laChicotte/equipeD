-- Messagerie enrichie : pièces jointes (messages privés et de groupe) et appels audio/vidéo.
-- CreateEnum
CREATE TYPE "CallKind" AS ENUM ('AUDIO', 'VIDEO');

-- CreateEnum
CREATE TYPE "CallStatus" AS ENUM ('RINGING', 'ACTIVE', 'ENDED', 'MISSED', 'DECLINED', 'CANCELLED');

-- AlterTable
ALTER TABLE "group_messages" ADD COLUMN     "has_file" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "messages" ADD COLUMN     "call_id" TEXT,
ADD COLUMN     "has_file" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "message_files" (
    "message_id" TEXT NOT NULL,
    "file_name" VARCHAR(200) NOT NULL,
    "mime_type" VARCHAR(120) NOT NULL,
    "size" INTEGER NOT NULL,
    "data" BYTEA NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "message_files_pkey" PRIMARY KEY ("message_id")
);

-- CreateTable
CREATE TABLE "calls" (
    "id" TEXT NOT NULL,
    "mentorship_id" TEXT NOT NULL,
    "caller_id" TEXT NOT NULL,
    "callee_id" TEXT NOT NULL,
    "kind" "CallKind" NOT NULL,
    "status" "CallStatus" NOT NULL DEFAULT 'RINGING',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "answered_at" TIMESTAMPTZ(3),
    "ended_at" TIMESTAMPTZ(3),

    CONSTRAINT "calls_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "group_message_files" (
    "group_message_id" TEXT NOT NULL,
    "file_name" VARCHAR(200) NOT NULL,
    "mime_type" VARCHAR(120) NOT NULL,
    "size" INTEGER NOT NULL,
    "data" BYTEA NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "group_message_files_pkey" PRIMARY KEY ("group_message_id")
);

-- CreateIndex
CREATE INDEX "calls_mentorship_id_created_at_idx" ON "calls"("mentorship_id", "created_at");

-- CreateIndex
CREATE INDEX "calls_caller_id_status_idx" ON "calls"("caller_id", "status");

-- CreateIndex
CREATE INDEX "calls_callee_id_status_idx" ON "calls"("callee_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "messages_call_id_key" ON "messages"("call_id");

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_call_id_fkey" FOREIGN KEY ("call_id") REFERENCES "calls"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "message_files" ADD CONSTRAINT "message_files_message_id_fkey" FOREIGN KEY ("message_id") REFERENCES "messages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "calls" ADD CONSTRAINT "calls_mentorship_id_fkey" FOREIGN KEY ("mentorship_id") REFERENCES "mentorships"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "calls" ADD CONSTRAINT "calls_caller_id_fkey" FOREIGN KEY ("caller_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "calls" ADD CONSTRAINT "calls_callee_id_fkey" FOREIGN KEY ("callee_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "group_message_files" ADD CONSTRAINT "group_message_files_group_message_id_fkey" FOREIGN KEY ("group_message_id") REFERENCES "group_messages"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Invariants garantis par la base.
-- Un message contient du texte, une pièce jointe ou un compte rendu d'appel ; 2000 caractères au plus.
ALTER TABLE "messages" ADD CONSTRAINT "messages_content_check"
  CHECK (char_length("content") <= 2000 AND (char_length("content") >= 1 OR "has_file" OR "call_id" IS NOT NULL));
ALTER TABLE "group_messages" DROP CONSTRAINT "group_messages_content_check";
ALTER TABLE "group_messages" ADD CONSTRAINT "group_messages_content_check"
  CHECK (char_length("content") <= 2000 AND (char_length("content") >= 1 OR "has_file"));

-- Pièces jointes : 10 Mo au plus, taille cohérente, formats autorisés (mêmes règles que les ressources).
ALTER TABLE "message_files" ADD CONSTRAINT "message_files_size_check"
  CHECK ("size" BETWEEN 1 AND 10485760 AND "size" = octet_length("data"));
ALTER TABLE "message_files" ADD CONSTRAINT "message_files_mime_check" CHECK ("mime_type" IN ('application/pdf','application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document','application/vnd.ms-excel','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','application/vnd.ms-powerpoint','application/vnd.openxmlformats-officedocument.presentationml.presentation','application/vnd.oasis.opendocument.text','application/vnd.oasis.opendocument.spreadsheet','application/vnd.oasis.opendocument.presentation','text/plain','text/csv','image/png','image/jpeg','image/webp'));
ALTER TABLE "group_message_files" ADD CONSTRAINT "group_message_files_size_check"
  CHECK ("size" BETWEEN 1 AND 10485760 AND "size" = octet_length("data"));
ALTER TABLE "group_message_files" ADD CONSTRAINT "group_message_files_mime_check" CHECK ("mime_type" IN ('application/pdf','application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document','application/vnd.ms-excel','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','application/vnd.ms-powerpoint','application/vnd.openxmlformats-officedocument.presentationml.presentation','application/vnd.oasis.opendocument.text','application/vnd.oasis.opendocument.spreadsheet','application/vnd.oasis.opendocument.presentation','text/plain','text/csv','image/png','image/jpeg','image/webp'));

-- Appels : deux personnes distinctes, au plus un appel en cours par mentorat.
ALTER TABLE "calls" ADD CONSTRAINT "calls_distinct_participants" CHECK ("caller_id" <> "callee_id");
ALTER TABLE "calls" ADD CONSTRAINT "calls_answered_check"
  CHECK ("status" NOT IN ('ACTIVE', 'ENDED') OR "answered_at" IS NOT NULL);
CREATE UNIQUE INDEX "calls_one_live_per_mentorship" ON "calls"("mentorship_id")
  WHERE "status" IN ('RINGING', 'ACTIVE');
