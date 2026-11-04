-- CreateEnum
CREATE TYPE "Role" AS ENUM ('MENTEE', 'MENTOR', 'ADMIN');

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "Modality" AS ENUM ('REMOTE', 'IN_PERSON', 'HYBRID');

-- CreateEnum
CREATE TYPE "VerificationStatus" AS ENUM ('UNVERIFIED', 'PENDING', 'VERIFIED', 'REJECTED');

-- CreateEnum
CREATE TYPE "MenteeSituation" AS ENUM ('STUDENT', 'GRADUATE', 'ENTREPRENEUR', 'PROJECT_HOLDER', 'CAREER_CHANGE', 'PROFESSIONAL', 'OTHER');

-- CreateEnum
CREATE TYPE "MentorshipRequestStatus" AS ENUM ('PENDING', 'ACCEPTED', 'DECLINED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "MentorshipStatus" AS ENUM ('ACTIVE', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "SessionStatus" AS ENUM ('REQUESTED', 'CONFIRMED', 'CANCELLED', 'COMPLETED');

-- CreateEnum
CREATE TYPE "GoalStatus" AS ENUM ('NOT_STARTED', 'IN_PROGRESS', 'COMPLETED');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "first_name" VARCHAR(80) NOT NULL,
    "last_name" VARCHAR(80) NOT NULL,
    "role" "Role" NOT NULL,
    "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE',
    "timezone" VARCHAR(64) NOT NULL DEFAULT 'Africa/Conakry',
    "onboarded_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "auth_sessions" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "token_hash" CHAR(64) NOT NULL,
    "expires_at" TIMESTAMPTZ(3) NOT NULL,
    "revoked_at" TIMESTAMPTZ(3),
    "last_used_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "user_agent" VARCHAR(255),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "auth_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "expertise_domains" (
    "id" TEXT NOT NULL,
    "slug" VARCHAR(80) NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "description" TEXT NOT NULL,
    "icon" VARCHAR(40) NOT NULL,
    "topics" TEXT[],
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "expertise_domains_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mentor_profiles" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "headline" VARCHAR(140) NOT NULL,
    "bio" TEXT NOT NULL,
    "current_position" VARCHAR(120),
    "organization" VARCHAR(120),
    "years_experience" INTEGER NOT NULL,
    "expertise" TEXT[],
    "languages" TEXT[],
    "modalities" "Modality"[],
    "city" VARCHAR(80),
    "session_duration_min" INTEGER NOT NULL DEFAULT 60,
    "max_mentees" INTEGER NOT NULL DEFAULT 5,
    "verification_status" "VerificationStatus" NOT NULL DEFAULT 'UNVERIFIED',
    "is_published" BOOLEAN NOT NULL DEFAULT true,
    "search_text" TEXT NOT NULL DEFAULT '',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "mentor_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mentor_domains" (
    "mentor_profile_id" TEXT NOT NULL,
    "domain_id" TEXT NOT NULL,

    CONSTRAINT "mentor_domains_pkey" PRIMARY KEY ("mentor_profile_id","domain_id")
);

-- CreateTable
CREATE TABLE "mentee_profiles" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "situation" "MenteeSituation" NOT NULL,
    "goals_summary" TEXT NOT NULL,
    "desired_skills" TEXT[],
    "preferred_modality" "Modality" NOT NULL,
    "city" VARCHAR(80),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "mentee_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mentee_interests" (
    "mentee_profile_id" TEXT NOT NULL,
    "domain_id" TEXT NOT NULL,

    CONSTRAINT "mentee_interests_pkey" PRIMARY KEY ("mentee_profile_id","domain_id")
);

-- CreateTable
CREATE TABLE "mentorship_requests" (
    "id" TEXT NOT NULL,
    "mentee_id" TEXT NOT NULL,
    "mentor_id" TEXT NOT NULL,
    "domain_id" TEXT,
    "goal" VARCHAR(200) NOT NULL,
    "message" TEXT NOT NULL,
    "status" "MentorshipRequestStatus" NOT NULL DEFAULT 'PENDING',
    "decision_note" VARCHAR(500),
    "responded_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "mentorship_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mentorships" (
    "id" TEXT NOT NULL,
    "request_id" TEXT NOT NULL,
    "mentor_id" TEXT NOT NULL,
    "mentee_id" TEXT NOT NULL,
    "status" "MentorshipStatus" NOT NULL DEFAULT 'ACTIVE',
    "started_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ended_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "mentorships_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "availability_slots" (
    "id" TEXT NOT NULL,
    "mentor_id" TEXT NOT NULL,
    "starts_at" TIMESTAMPTZ(3) NOT NULL,
    "ends_at" TIMESTAMPTZ(3) NOT NULL,
    "timezone" VARCHAR(64) NOT NULL DEFAULT 'Africa/Conakry',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "availability_slots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mentoring_sessions" (
    "id" TEXT NOT NULL,
    "mentorship_id" TEXT NOT NULL,
    "mentor_id" TEXT NOT NULL,
    "mentee_id" TEXT NOT NULL,
    "slot_id" TEXT,
    "starts_at" TIMESTAMPTZ(3) NOT NULL,
    "ends_at" TIMESTAMPTZ(3) NOT NULL,
    "status" "SessionStatus" NOT NULL DEFAULT 'REQUESTED',
    "topic" VARCHAR(200) NOT NULL,
    "modality" "Modality" NOT NULL DEFAULT 'REMOTE',
    "meeting_url" VARCHAR(500),
    "location" VARCHAR(200),
    "confirmed_at" TIMESTAMPTZ(3),
    "cancelled_at" TIMESTAMPTZ(3),
    "cancelled_by" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "mentoring_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "messages" (
    "id" TEXT NOT NULL,
    "mentorship_id" TEXT NOT NULL,
    "sender_id" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "read_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "goals" (
    "id" TEXT NOT NULL,
    "mentorship_id" TEXT NOT NULL,
    "created_by_id" TEXT NOT NULL,
    "title" VARCHAR(160) NOT NULL,
    "description" TEXT,
    "status" "GoalStatus" NOT NULL DEFAULT 'NOT_STARTED',
    "progress" INTEGER NOT NULL DEFAULT 0,
    "due_date" TIMESTAMPTZ(3),
    "mentor_feedback" TEXT,
    "completed_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "goals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "milestones" (
    "id" TEXT NOT NULL,
    "goal_id" TEXT NOT NULL,
    "title" VARCHAR(160) NOT NULL,
    "is_done" BOOLEAN NOT NULL DEFAULT false,
    "done_at" TIMESTAMPTZ(3),
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "milestones_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_role_status_idx" ON "users"("role", "status");

-- CreateIndex
CREATE UNIQUE INDEX "auth_sessions_token_hash_key" ON "auth_sessions"("token_hash");

-- CreateIndex
CREATE INDEX "auth_sessions_user_id_idx" ON "auth_sessions"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "expertise_domains_slug_key" ON "expertise_domains"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "mentor_profiles_user_id_key" ON "mentor_profiles"("user_id");

-- CreateIndex
CREATE INDEX "mentor_profiles_is_published_verification_status_idx" ON "mentor_profiles"("is_published", "verification_status");

-- CreateIndex
CREATE INDEX "mentor_domains_domain_id_idx" ON "mentor_domains"("domain_id");

-- CreateIndex
CREATE UNIQUE INDEX "mentee_profiles_user_id_key" ON "mentee_profiles"("user_id");

-- CreateIndex
CREATE INDEX "mentee_interests_domain_id_idx" ON "mentee_interests"("domain_id");

-- CreateIndex
CREATE INDEX "mentorship_requests_mentor_id_status_created_at_idx" ON "mentorship_requests"("mentor_id", "status", "created_at");

-- CreateIndex
CREATE INDEX "mentorship_requests_mentee_id_status_created_at_idx" ON "mentorship_requests"("mentee_id", "status", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "mentorships_request_id_key" ON "mentorships"("request_id");

-- CreateIndex
CREATE INDEX "mentorships_mentor_id_status_idx" ON "mentorships"("mentor_id", "status");

-- CreateIndex
CREATE INDEX "mentorships_mentee_id_status_idx" ON "mentorships"("mentee_id", "status");

-- CreateIndex
CREATE INDEX "availability_slots_mentor_id_starts_at_idx" ON "availability_slots"("mentor_id", "starts_at");

-- CreateIndex
CREATE INDEX "mentoring_sessions_mentor_id_starts_at_idx" ON "mentoring_sessions"("mentor_id", "starts_at");

-- CreateIndex
CREATE INDEX "mentoring_sessions_mentee_id_starts_at_idx" ON "mentoring_sessions"("mentee_id", "starts_at");

-- CreateIndex
CREATE INDEX "mentoring_sessions_mentorship_id_idx" ON "mentoring_sessions"("mentorship_id");

-- CreateIndex
CREATE INDEX "messages_mentorship_id_created_at_idx" ON "messages"("mentorship_id", "created_at");

-- CreateIndex
CREATE INDEX "goals_mentorship_id_idx" ON "goals"("mentorship_id");

-- CreateIndex
CREATE INDEX "milestones_goal_id_sort_order_idx" ON "milestones"("goal_id", "sort_order");

-- AddForeignKey
ALTER TABLE "auth_sessions" ADD CONSTRAINT "auth_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mentor_profiles" ADD CONSTRAINT "mentor_profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mentor_domains" ADD CONSTRAINT "mentor_domains_mentor_profile_id_fkey" FOREIGN KEY ("mentor_profile_id") REFERENCES "mentor_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mentor_domains" ADD CONSTRAINT "mentor_domains_domain_id_fkey" FOREIGN KEY ("domain_id") REFERENCES "expertise_domains"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mentee_profiles" ADD CONSTRAINT "mentee_profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mentee_interests" ADD CONSTRAINT "mentee_interests_mentee_profile_id_fkey" FOREIGN KEY ("mentee_profile_id") REFERENCES "mentee_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mentee_interests" ADD CONSTRAINT "mentee_interests_domain_id_fkey" FOREIGN KEY ("domain_id") REFERENCES "expertise_domains"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mentorship_requests" ADD CONSTRAINT "mentorship_requests_mentee_id_fkey" FOREIGN KEY ("mentee_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mentorship_requests" ADD CONSTRAINT "mentorship_requests_mentor_id_fkey" FOREIGN KEY ("mentor_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mentorship_requests" ADD CONSTRAINT "mentorship_requests_domain_id_fkey" FOREIGN KEY ("domain_id") REFERENCES "expertise_domains"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mentorships" ADD CONSTRAINT "mentorships_request_id_fkey" FOREIGN KEY ("request_id") REFERENCES "mentorship_requests"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mentorships" ADD CONSTRAINT "mentorships_mentor_id_fkey" FOREIGN KEY ("mentor_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mentorships" ADD CONSTRAINT "mentorships_mentee_id_fkey" FOREIGN KEY ("mentee_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "availability_slots" ADD CONSTRAINT "availability_slots_mentor_id_fkey" FOREIGN KEY ("mentor_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mentoring_sessions" ADD CONSTRAINT "mentoring_sessions_mentorship_id_fkey" FOREIGN KEY ("mentorship_id") REFERENCES "mentorships"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mentoring_sessions" ADD CONSTRAINT "mentoring_sessions_mentor_id_fkey" FOREIGN KEY ("mentor_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mentoring_sessions" ADD CONSTRAINT "mentoring_sessions_mentee_id_fkey" FOREIGN KEY ("mentee_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mentoring_sessions" ADD CONSTRAINT "mentoring_sessions_slot_id_fkey" FOREIGN KEY ("slot_id") REFERENCES "availability_slots"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_mentorship_id_fkey" FOREIGN KEY ("mentorship_id") REFERENCES "mentorships"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_sender_id_fkey" FOREIGN KEY ("sender_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "goals" ADD CONSTRAINT "goals_mentorship_id_fkey" FOREIGN KEY ("mentorship_id") REFERENCES "mentorships"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "goals" ADD CONSTRAINT "goals_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "milestones" ADD CONSTRAINT "milestones_goal_id_fkey" FOREIGN KEY ("goal_id") REFERENCES "goals"("id") ON DELETE CASCADE ON UPDATE CASCADE;
