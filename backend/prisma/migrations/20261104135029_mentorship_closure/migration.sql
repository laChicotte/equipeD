-- AlterEnum
ALTER TYPE "NotificationType" ADD VALUE 'MENTORSHIP_COMPLETED';

-- AlterTable
ALTER TABLE "mentorships" ADD COLUMN     "end_note" VARCHAR(1000),
ADD COLUMN     "ended_by_id" TEXT;
