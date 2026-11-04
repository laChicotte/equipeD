import { defineConfig } from 'vitest/config';

/**
 * Tests e2e : API NestJS complète contre une vraie base PostgreSQL de test
 * (talents_connectes_test, recréée à chaque exécution par test/global-setup.ts).
 */
export default defineConfig({
  test: {
    globals: true,
    root: './',
    include: ['test/**/*.e2e-spec.ts'],
    globalSetup: ['./test/global-setup.ts'],
    env: { NODE_ENV: 'test' },
    // Une seule base partagée : exécution séquentielle des fichiers pour des résultats déterministes.
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 180_000,
  },
});
