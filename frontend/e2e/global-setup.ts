import { execSync } from 'node:child_process';
import { resolve } from 'node:path';

/** Remet à zéro le parcours d'Aminata (relations, demandes, notifications des comptes de démo). */
export default function globalSetup() {
  execSync('pnpm db:demo-reset', { cwd: resolve(__dirname, '../..'), stdio: 'inherit' });
}
