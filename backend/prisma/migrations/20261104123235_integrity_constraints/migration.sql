-- Invariants métier garantis par PostgreSQL (non exprimables dans le schéma Prisma).
-- Ils protègent l'intégrité même en cas de requêtes concurrentes : l'API ne s'appuie
-- jamais sur une simple vérification préalable (« check-then-insert »).

-- Requis pour combiner égalité (=) et chevauchement (&&) dans une contrainte d'exclusion GiST.
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- 1. Une seule demande en attente par couple mentoré/mentor.
CREATE UNIQUE INDEX "mentorship_requests_one_pending"
  ON "mentorship_requests" ("mentee_id", "mentor_id")
  WHERE "status" = 'PENDING';

-- 2. Un seul mentorat actif par couple mentor/mentoré.
CREATE UNIQUE INDEX "mentorships_one_active"
  ON "mentorships" ("mentor_id", "mentee_id")
  WHERE "status" = 'ACTIVE';

-- 3. Créneaux de disponibilité cohérents et sans chevauchement pour un même mentor.
ALTER TABLE "availability_slots"
  ADD CONSTRAINT "availability_slots_valid_range" CHECK ("ends_at" > "starts_at");

ALTER TABLE "availability_slots"
  ADD CONSTRAINT "availability_slots_no_overlap"
  EXCLUDE USING gist ("mentor_id" WITH =, tstzrange("starts_at", "ends_at", '[)') WITH &&)
  WHERE ("is_active");

-- 4. Pas de double réservation : un créneau ne porte qu'une séance active…
CREATE UNIQUE INDEX "mentoring_sessions_one_active_per_slot"
  ON "mentoring_sessions" ("slot_id")
  WHERE "slot_id" IS NOT NULL AND "status" IN ('REQUESTED', 'CONFIRMED');

-- … et ni le mentor ni le mentoré n'ont deux séances actives qui se chevauchent.
ALTER TABLE "mentoring_sessions"
  ADD CONSTRAINT "mentoring_sessions_valid_range" CHECK ("ends_at" > "starts_at");

ALTER TABLE "mentoring_sessions"
  ADD CONSTRAINT "mentoring_sessions_mentor_no_overlap"
  EXCLUDE USING gist ("mentor_id" WITH =, tstzrange("starts_at", "ends_at", '[)') WITH &&)
  WHERE ("status" IN ('REQUESTED', 'CONFIRMED'));

ALTER TABLE "mentoring_sessions"
  ADD CONSTRAINT "mentoring_sessions_mentee_no_overlap"
  EXCLUDE USING gist ("mentee_id" WITH =, tstzrange("starts_at", "ends_at", '[)') WITH &&)
  WHERE ("status" IN ('REQUESTED', 'CONFIRMED'));

-- 5. Progression d'objectif bornée.
ALTER TABLE "goals"
  ADD CONSTRAINT "goals_progress_range" CHECK ("progress" BETWEEN 0 AND 100);

-- 6. Recherche plein texte rapide sur l'annuaire (contains/ILIKE accéléré par trigrammes).
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX "mentor_profiles_search_text_trgm"
  ON "mentor_profiles" USING gin ("search_text" gin_trgm_ops);
