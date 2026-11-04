import { defineConfig } from 'vitest/config';

/** Tests unitaires : logique métier pure, sans base de données. */
export default defineConfig({
  test: {
    globals: true,
    root: './',
    include: ['src/**/*.spec.ts'],
  },
});
