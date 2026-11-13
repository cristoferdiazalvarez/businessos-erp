import { randomBytes } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';

const password = () => randomBytes(24).toString('hex');
const databasePassword = password();
const testPassword = password();
const template = readFileSync(new URL('../.env.example', import.meta.url), 'utf8');
const contents = template.replace('REPLACE_WITH_POSTGRES_PASSWORD', databasePassword)
  .replace(/^POSTGRES_PASSWORD=$/m, `POSTGRES_PASSWORD=${databasePassword}`)
  .replace(/^(DEMO_\w+_PASSWORD|E2E_OTHER_PASSWORD)=$/gm, (_, key) => `${key}=${password()}`)
  .replace('REPLACE_WITH_TEST_PASSWORD', testPassword)
  .replace(/^TEST_POSTGRES_PASSWORD=$/m, `TEST_POSTGRES_PASSWORD=${testPassword}`)
  .replace('localhost:5433', process.argv.includes('--single-cluster') ? 'localhost:5432' : 'localhost:5433');
writeFileSync(new URL('../.env', import.meta.url), contents, { flag: 'wx', mode: 0o600 });
console.log('Created private .env with random local passwords. Existing files are never overwritten.');
