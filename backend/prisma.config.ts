import 'dotenv/config';
import { defineConfig } from 'prisma/config';

// Valeur de repli : permet `prisma generate` (postinstall) sur un clone neuf, avant la création de .env.
const DEV_FALLBACK_URL =
  'postgresql://talents:talents_dev_password@127.0.0.1:5450/talents_connectes?schema=public';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'tsx prisma/seed.ts',
  },
  datasource: {
    url: process.env.DATABASE_URL ?? DEV_FALLBACK_URL,
  },
});
