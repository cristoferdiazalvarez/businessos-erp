import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';
const require = createRequire(new URL('../apps/api/package.json', import.meta.url));
require('dotenv').config({ path: new URL('../.env', import.meta.url).pathname });
const literal = value => `'${value.replaceAll("'", "''")}'`;
const identifier = value => `"${value.replaceAll('"', '""')}"`;
const development = new URL(process.env.DATABASE_URL);
const testing = new URL(process.env.TEST_DATABASE_URL);
if (development.pathname === testing.pathname || development.username === testing.username) {
  throw new Error('Development and tests require separate database names and roles.');
}
const sql = [development, testing].map(url => {
  const role = identifier(decodeURIComponent(url.username));
  const database = identifier(url.pathname.slice(1));
  return `CREATE ROLE ${role} LOGIN PASSWORD ${literal(decodeURIComponent(url.password))};\nCREATE DATABASE ${database} OWNER ${role};\nREVOKE ALL ON DATABASE ${database} FROM PUBLIC;`;
}).join('\n');
const result = spawnSync(process.env.PSQL_BIN ?? 'psql', ['-h', process.env.PG_SOCKET ?? '/tmp', '-p', development.port || '5432', '-U', process.env.PG_ADMIN ?? 'businessos_local', '-d', 'postgres', '-v', 'ON_ERROR_STOP=1'], { input: sql, encoding: 'utf8' });
// Never echo SQL containing generated passwords on failure.
if (result.status !== 0) throw new Error('Database creation failed. Check the local PostgreSQL server; roles/databases may already exist.');
console.log('Created separate development/test databases and non-superuser owners; PUBLIC access revoked.');
