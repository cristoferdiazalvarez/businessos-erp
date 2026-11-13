import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const require = createRequire(new URL('../apps/api/package.json', import.meta.url));
require('dotenv').config({ path: `${root}.env` });
const testUrl = process.env.TEST_DATABASE_URL;
if (!testUrl) throw new Error('Set TEST_DATABASE_URL to a dedicated database ending in _test.');
const parsed = new URL(testUrl);
if (!parsed.pathname.endsWith('_test') || parsed.pathname === new URL(process.env.DATABASE_URL).pathname) {
  throw new Error('E2E requires a separate database with a name ending in _test. Development data must remain isolated.');
}
process.env.DATABASE_URL = testUrl;
process.env.NODE_ENV = 'test';
const commands = process.argv[2] === 'prepare'
  ? [['db:migrate'], ['db:seed'], ['--filter', '@businessos/api', 'exec', 'tsx', 'prisma/e2e-seed.ts']]
  : [['--filter', '@businessos/web', 'test:e2e', ...process.argv.slice(3)]];
for (const args of commands) {
  const result = spawnSync('corepack', ['pnpm', ...args], { cwd: root, env: process.env, stdio: 'inherit' });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}
