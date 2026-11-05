// Code de sortie 0 si la base ne contient encore aucun compte (premier démarrage), 1 sinon.
import { createRequire } from 'node:module';

const require = createRequire('/app/backend/package.json');
const { Client } = require('pg');

const client = new Client({ connectionString: process.env.DATABASE_URL });
await client.connect();
const { rows } = await client.query('SELECT COUNT(*)::int AS n FROM users');
await client.end();
console.log(rows[0].n === 0 ? 'Base vide : chargement des comptes de démo.' : 'Comptes présents : pas de seed.');
process.exit(rows[0].n === 0 ? 0 : 1);
