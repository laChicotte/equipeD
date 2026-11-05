import { execSync } from 'node:child_process';
import { resolve } from 'node:path';

/** Laisse la base prête pour une démonstration en direct après le test. */
export default function globalTeardown() {
  execSync('pnpm db:demo-reset', { cwd: resolve(__dirname, '../..'), stdio: 'inherit' });
}
