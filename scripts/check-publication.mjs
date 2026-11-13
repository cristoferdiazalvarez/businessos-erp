import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(new URL('../apps/api/package.json', import.meta.url));
const files = [...new Set(execFileSync('git', ['ls-files', '-z', '--cached', '--others', '--exclude-standard'], { encoding: 'utf8' }).split('\0').filter(Boolean))];
let privateValues = [];
try {
  const env = require('dotenv').parse(readFileSync('.env'));
  privateValues = Object.entries(env).filter(([key, value]) => /PASSWORD|SECRET|TOKEN/.test(key) && value.length >= 12).map(([, value]) => value);
  for (const key of ['DATABASE_URL', 'TEST_DATABASE_URL']) {
    if (env[key]) {
      const password = decodeURIComponent(new URL(env[key]).password);
      if (password.length >= 12) privateValues.push(password);
    }
  }
} catch { /* A fresh clone need not have a local environment. */ }
const failures = [];
for (const file of files) {
  if (/(^|\/)(node_modules|dist|\.next|\.local|\.pnpm-store|test-results|playwright-report|\.aws|\.codex|\.agents)(\/|$)/.test(file) || /(^|\/)\.env(\.|$)/.test(file) && file !== '.env.example') {
    failures.push(`${file}: private/generated path`);
    continue;
  }
  const data = readFileSync(file).toString('utf8');
  if (privateValues.some(secret => data.includes(secret)) || /-----BEGIN (?:RSA |OPENSSH |EC )?PRIVATE KEY-----/.test(data) || /\bAKIA[A-Z0-9]{16}\b/.test(data) || /\bgh[pousr]_[A-Za-z0-9]{30,}\b/.test(data)) {
    failures.push(`${file}: possible secret (value redacted)`);
  }
}
if (failures.length) { console.error(failures.join('\n')); process.exit(1); }
console.log(`Checked ${files.length} publication candidates: no local passwords, recognized secret signatures, or private/generated paths found. This check is not a full security audit.`);
