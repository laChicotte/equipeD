/**
 * Préparation de la base de test (une fois par exécution de la suite e2e) :
 * création de la base si besoin, remise à zéro du schéma, migrations puis seed.
 * La base de test est distincte de la base de développement (voir .env.test).
 */
import { execSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import pg from 'pg';

/** URL de la base de test : variable TEST_DATABASE_URL (CI) ou fichier .env.test (poste local). */
function readTestDatabaseUrl(): string {
  if (process.env.TEST_DATABASE_URL) return process.env.TEST_DATABASE_URL;
  const path = resolve(import.meta.dirname, '../.env.test');
  if (!existsSync(path)) {
    throw new Error(
      'Créez backend/.env.test à partir de backend/.env.test.example (ou définissez TEST_DATABASE_URL).',
    );
  }
  const file = readFileSync(path, 'utf8');
  const line = file.split(/\r?\n/).find((l) => l.startsWith('DATABASE_URL='));
  if (!line) throw new Error('DATABASE_URL absent de .env.test');
  return line.slice('DATABASE_URL='.length).trim();
}

export default async function setup(): Promise<void> {
  const url = readTestDatabaseUrl();
  const parsed = new URL(url);
  const dbName = parsed.pathname.slice(1);
  if (!dbName.endsWith('_test')) {
    throw new Error(`Refus : la base de test doit se terminer par _test (reçu « ${dbName} »).`);
  }

  const adminUrl = new URL(url);
  adminUrl.pathname = '/postgres';
  adminUrl.search = '';
  const admin = new pg.Client({ connectionString: adminUrl.toString() });
  await admin.connect();
  const exists = await admin.query('SELECT 1 FROM pg_database WHERE datname = $1', [dbName]);
  if (exists.rowCount === 0) await admin.query(`CREATE DATABASE "${dbName}"`);
  await admin.end();

  // Schéma neuf à chaque exécution : tests reproductibles.
  const db = new pg.Client({ connectionString: url.replace(/\?.*$/, '') });
  await db.connect();
  await db.query('DROP SCHEMA IF EXISTS public CASCADE; CREATE SCHEMA public;');
  await db.end();

  const env = { ...process.env, DATABASE_URL: url, NODE_ENV: 'test' };
  const cwd = resolve(import.meta.dirname, '..');
  execSync('npx prisma migrate deploy', { cwd, env, stdio: 'pipe' });
  execSync('npx tsx prisma/seed.ts', { cwd, env, stdio: 'pipe' });
}
