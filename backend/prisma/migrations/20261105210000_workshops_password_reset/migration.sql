-- Ateliers thématiques de groupe (TDR, étape 4) et liens de réinitialisation du mot de passe.
-- CreateEnum
CREATE TYPE "WorkshopResponse" AS ENUM ('GOING', 'NOT_GOING');

-- AlterEnum


ALTER TYPE "NotificationType" ADD VALUE 'WORKSHOP_SCHEDULED';
ALTER TYPE "NotificationType" ADD VALUE 'WORKSHOP_CANCELLED';

-- CreateTable
CREATE TABLE "password_reset_tokens" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "token_hash" CHAR(64) NOT NULL,
    "expires_at" TIMESTAMPTZ(3) NOT NULL,
    "used_at" TIMESTAMPTZ(3),
    "created_by_id" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "password_reset_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "group_workshops" (
    "id" TEXT NOT NULL,
    "group_id" TEXT NOT NULL,
    "created_by_id" TEXT NOT NULL,
    "title" VARCHAR(160) NOT NULL,
    "description" VARCHAR(2000),
    "starts_at" TIMESTAMPTZ(3) NOT NULL,
    "ends_at" TIMESTAMPTZ(3) NOT NULL,
    "modality" "Modality" NOT NULL DEFAULT 'REMOTE',
    "meeting_url" VARCHAR(500),
    "location" VARCHAR(200),
    "cancelled_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "group_workshops_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workshop_attendances" (
    "workshop_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "response" "WorkshopResponse" NOT NULL,
    "responded_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "workshop_attendances_pkey" PRIMARY KEY ("workshop_id","user_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "password_reset_tokens_token_hash_key" ON "password_reset_tokens"("token_hash");

-- CreateIndex
CREATE INDEX "password_reset_tokens_user_id_created_at_idx" ON "password_reset_tokens"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "group_workshops_group_id_starts_at_idx" ON "group_workshops"("group_id", "starts_at");

-- CreateIndex
CREATE INDEX "group_workshops_created_by_id_starts_at_idx" ON "group_workshops"("created_by_id", "starts_at");

-- CreateIndex
CREATE INDEX "workshop_attendances_user_id_idx" ON "workshop_attendances"("user_id");

-- AddForeignKey
ALTER TABLE "password_reset_tokens" ADD CONSTRAINT "password_reset_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "group_workshops" ADD CONSTRAINT "group_workshops_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "mentoring_groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "group_workshops" ADD CONSTRAINT "group_workshops_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workshop_attendances" ADD CONSTRAINT "workshop_attendances_workshop_id_fkey" FOREIGN KEY ("workshop_id") REFERENCES "group_workshops"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workshop_attendances" ADD CONSTRAINT "workshop_attendances_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Invariants garantis par la base.
ALTER TABLE "group_workshops"
  ADD CONSTRAINT "group_workshops_valid_range"
  CHECK ("ends_at" > "starts_at" AND "ends_at" - "starts_at" BETWEEN interval '15 minutes' AND interval '4 hours');
ALTER TABLE "group_workshops"
  ADD CONSTRAINT "group_workshops_title_check" CHECK (char_length(btrim("title")) >= 3);

-- Un mentor n'anime jamais deux ateliers non annulés qui se chevauchent (même en cas de requêtes simultanées).
ALTER TABLE "group_workshops"
  ADD CONSTRAINT "group_workshops_creator_no_overlap"
  EXCLUDE USING gist ("created_by_id" WITH =, tstzrange("starts_at", "ends_at", '[)') WITH &&)
  WHERE ("cancelled_at" IS NULL);

ALTER TABLE "password_reset_tokens"
  ADD CONSTRAINT "password_reset_tokens_valid_range" CHECK ("expires_at" > "created_at");
