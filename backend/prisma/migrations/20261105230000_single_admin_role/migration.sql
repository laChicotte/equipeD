-- Un seul rôle d'administration : les super-administrateurs deviennent administrateurs,
-- puis la valeur SUPER_ADMIN est retirée du type énuméré (PostgreSQL impose de recréer le type).
UPDATE "users" SET "role" = 'ADMIN' WHERE "role" = 'SUPER_ADMIN';

ALTER TYPE "Role" RENAME TO "Role_old";
CREATE TYPE "Role" AS ENUM ('MENTEE', 'MENTOR', 'ADMIN');
ALTER TABLE "users" ALTER COLUMN "role" TYPE "Role" USING ("role"::text::"Role");
DROP TYPE "Role_old";
