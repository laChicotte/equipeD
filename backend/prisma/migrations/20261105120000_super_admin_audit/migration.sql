-- Rôle super-administrateur, journal d'audit de l'équipe et motif de révocation des certificats.

-- AlterEnum
ALTER TYPE "Role" ADD VALUE 'SUPER_ADMIN';

-- AlterTable
ALTER TABLE "mentorship_certificates" ADD COLUMN     "revoked_reason" VARCHAR(300);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "actor_id" TEXT,
    "actor_name" VARCHAR(170) NOT NULL,
    "action" VARCHAR(60) NOT NULL,
    "target_type" VARCHAR(40) NOT NULL,
    "target_id" TEXT,
    "summary" VARCHAR(300) NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "audit_logs_created_at_idx" ON "audit_logs"("created_at");

-- CreateIndex
CREATE INDEX "audit_logs_action_created_at_idx" ON "audit_logs"("action", "created_at");

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- Le journal n'accepte que des entrées renseignées.
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_action_check" CHECK (length("action") > 0 AND length("summary") > 0);
