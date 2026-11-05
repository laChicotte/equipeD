-- Identifiant client des messages : un message envoyé hors ligne puis renvoyé n'est pas dupliqué.
-- AlterTable
ALTER TABLE "group_messages" ADD COLUMN     "client_id" VARCHAR(64);

-- AlterTable
ALTER TABLE "messages" ADD COLUMN     "client_id" VARCHAR(64);

-- CreateIndex
CREATE UNIQUE INDEX "group_messages_sender_id_client_id_key" ON "group_messages"("sender_id", "client_id");

-- CreateIndex
CREATE UNIQUE INDEX "messages_sender_id_client_id_key" ON "messages"("sender_id", "client_id");

