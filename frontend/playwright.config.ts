import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { defineConfig, devices } from '@playwright/test';

/** Hors du dossier frontend : Next.js surveille ses fichiers et rechargerait la page en plein test. */
const OUTPUT = join(tmpdir(), 'talents-connectes-playwright');

/**
 * Ports dédiés : le test tourne sur sa propre API et sur un build de production de l'interface,
 * sans gêner les serveurs de développement (3000 et 4000) et sans rechargement à chaud.
 */
const API_PORT = Number(process.env.E2E_API_PORT ?? 4100);
const WEB_PORT = Number(process.env.E2E_WEB_PORT ?? 3100);
const WEB_URL = `http://localhost:${WEB_PORT}`;

/**
 * Test de bout en bout du scénario de démonstration (docs/jury/scenario-demo.md).
 *
 * Prérequis : PostgreSQL démarré (`pnpm db:up`), migrations et seed appliquées.
 * Le scénario d'Aminata est remis à zéro avant et après le test (`pnpm db:demo-reset`).
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 180_000,
  expect: { timeout: 15_000 },
  outputDir: join(OUTPUT, 'results'),
  reporter: [['list'], ['html', { open: 'never', outputFolder: join(OUTPUT, 'report') }]],
  globalSetup: './e2e/global-setup.ts',
  globalTeardown: './e2e/global-teardown.ts',
  use: {
    baseURL: WEB_URL,
    locale: 'fr-FR',
    timezoneId: 'Africa/Conakry',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: [
    {
      // Depuis backend/ : l'API y lit son fichier .env (base de données, secret de session).
      command: 'pnpm build && node dist/main.js',
      cwd: '../backend',
      url: `http://localhost:${API_PORT}/api/v1/health`,
      env: { PORT: String(API_PORT), WEB_ORIGINS: WEB_URL },
      reuseExistingServer: true,
      timeout: 180_000,
    },
    {
      command: `pnpm --filter frontend build && pnpm --filter frontend exec next start -p ${WEB_PORT}`,
      cwd: '..',
      url: WEB_URL,
      // Les réécritures /api/v1 sont figées au build : l'URL de l'API doit être connue dès cette étape.
      // Build dans .next-e2e pour ne pas écraser le .next habituel.
      env: { API_URL: `http://localhost:${API_PORT}`, NEXT_DIST_DIR: '.next-e2e' },
      reuseExistingServer: true,
      timeout: 400_000,
    },
  ],
});
