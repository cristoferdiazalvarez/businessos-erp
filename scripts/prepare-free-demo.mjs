import { randomBytes } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const local = process.argv.includes('--local-test');
if (local) {
  const require = createRequire(new URL('../apps/api/package.json', import.meta.url));
  require('dotenv').config({ path: `${root}.env` });
}
// Production setup intentionally never loads the developer .env.
const direct = local ? process.env.TEST_DATABASE_URL : process.env.DIRECT_DATABASE_URL;
if (!direct) throw new Error('Provide the approved database direct URL through private operator environment variables');
const url = new URL(direct);
if (local) {
  if (!['localhost', '127.0.0.1'].includes(url.hostname) || !url.pathname.endsWith('_test')) throw new Error('Local verification requires an isolated local _test database');
} else {
  if (!url.hostname.endsWith('.neon.tech') || url.hostname.includes('-pooler.') || url.searchParams.get('sslmode') !== 'require' || url.searchParams.get('sslaccept') !== 'strict') {
    throw new Error('Free-demo setup requires a direct Neon TLS URL with sslmode=require and sslaccept=strict');
  }
}
const env = { ...process.env, NODE_ENV: local ? 'test' : 'production', DATABASE_URL: direct, DIRECT_DATABASE_URL: direct, BUSINESSOS_IGNORE_LOCAL_ENV: local ? 'false' : 'true' };
if (!local) Object.assign(env, {
  DEMO_ADMIN_EMAIL: 'admin@businessos.demo', DEMO_MANAGER_EMAIL: 'manager@businessos.demo',
  DEMO_EMPLOYEE_EMAIL: 'employee@businessos.demo', E2E_OTHER_EMAIL: 'isolation@businessos.demo',
});
for (const key of ['DEMO_ADMIN_PASSWORD', 'DEMO_MANAGER_PASSWORD', 'DEMO_EMPLOYEE_PASSWORD', 'E2E_OTHER_PASSWORD']) {
  env[key] = local && process.env[key] ? process.env[key] : randomBytes(32).toString('base64url');
}
const commands = [['db:migrate'], ['db:seed'], ['--filter', '@businessos/api', 'exec', 'tsx', 'prisma/e2e-seed.ts']];
for (const args of commands) {
  const result = spawnSync('corepack', ['pnpm', ...args], { cwd: root, env, stdio: 'inherit' });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}
console.log('Migrations and fictional demo seed prepared. Passwords were never printed; public visitors use the employee-only demo button. No cloud resources or subscription were created by this script.');
