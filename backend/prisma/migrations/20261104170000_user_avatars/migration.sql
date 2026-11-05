-- Photo de profil : une ligne par utilisateur, supprimée avec le compte.
ALTER TABLE "users" ADD COLUMN "avatar_updated_at" TIMESTAMPTZ(3);

CREATE TABLE "user_avatars" (
    "user_id" TEXT NOT NULL,
    "mime_type" VARCHAR(32) NOT NULL,
    "data" BYTEA NOT NULL,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "user_avatars_pkey" PRIMARY KEY ("user_id"),
    -- Invariants garantis par la base : 1 Mo au plus, trois formats d'image seulement.
    CONSTRAINT "user_avatars_size_check" CHECK (octet_length("data") BETWEEN 1 AND 1048576),
    CONSTRAINT "user_avatars_mime_check" CHECK ("mime_type" IN ('image/jpeg', 'image/png', 'image/webp'))
);

ALTER TABLE "user_avatars" ADD CONSTRAINT "user_avatars_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
