-- Bannière du profil (image large en haut de la carte de profil).
ALTER TABLE "users" ADD COLUMN "banner_updated_at" TIMESTAMPTZ(3);

CREATE TABLE "user_banners" (
    "user_id" TEXT NOT NULL,
    "mime_type" VARCHAR(32) NOT NULL,
    "data" BYTEA NOT NULL,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "user_banners_pkey" PRIMARY KEY ("user_id"),
    CONSTRAINT "user_banners_size_check" CHECK (octet_length("data") BETWEEN 1 AND 1048576),
    CONSTRAINT "user_banners_mime_check" CHECK ("mime_type" IN ('image/jpeg', 'image/png', 'image/webp'))
);
ALTER TABLE "user_banners" ADD CONSTRAINT "user_banners_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
