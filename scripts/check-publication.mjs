import { execFileSync } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(new URL('../apps/api/package.json', import.meta.url));
const cached = new Set(execFileSync('git', ['ls-files', '-z', '--cached'], { encoding: 'utf8' }).split('\0').filter(Boolean));
const untracked = execFileSync('git', ['ls-files', '-z', '--others', '--exclude-standard'], { encoding: 'utf8' }).split('\0').filter(Boolean);
const files = [...new Set([...cached, ...untracked])];
let privateValues = [];
let localEnv = {};
try {
  localEnv = require('dotenv').parse(readFileSync('.env'));
} catch { /* A fresh clone need not have a local environment. */ }
const credentials = { ...localEnv };
for (const [key, value] of Object.entries(process.env)) {
  if (/^(?:DATABASE_URL|TEST_DATABASE_URL|DIRECT_DATABASE_URL|NEON_API_KEY|VERCEL_TOKEN|GH_TOKEN|GITHUB_TOKEN|DEMO_\w+_PASSWORD|E2E_OTHER_PASSWORD)$/.test(key)) credentials[key] = value;
}
privateValues = Object.entries(credentials).filter(([key, value]) => /PASSWORD|SECRET|TOKEN|API_KEY/.test(key) && value.length >= 12).map(([, value]) => value);
for (const key of ['DATABASE_URL', 'TEST_DATABASE_URL', 'DIRECT_DATABASE_URL']) {
  if (credentials[key]) {
    const password = decodeURIComponent(new URL(credentials[key]).password);
    if (password.length >= 12) privateValues.push(password);
  }
}
const failures = [];
for (const file of files) {
  if (/(^|\/)(node_modules|dist|\.next|\.local|\.vercel|\.pnpm-store|test-results|playwright-report|\.aws|\.codex|\.agents)(\/|$)/.test(file) || /(^|\/)\.env(\.|$)/.test(file) && file !== '.env.example') {
    failures.push(`${file}: private/generated path`);
    continue;
  }
  const versions = [];
  if (existsSync(file)) versions.push(readFileSync(file).toString('utf8'));
  if (cached.has(file)) versions.push(execFileSync('git', ['show', `:${file}`], { maxBuffer: 16 * 1024 * 1024 }).toString('utf8'));
  if (versions.some(data => privateValues.some(secret => data.includes(secret)) || /-----BEGIN (?:RSA |OPENSSH |EC )?PRIVATE KEY-----/.test(data) || /\bAKIA[A-Z0-9]{16}\b/.test(data) || /\bgh[pousr]_[A-Za-z0-9]{30,}\b/.test(data))) {
    failures.push(`${file}: possible secret (value redacted)`);
  }
}
if (failures.length) { console.error(failures.join('\n')); process.exit(1); }
console.log(`Checked ${files.length} publication candidates: no local passwords, recognized secret signatures, or private/generated paths found. This check is not a full security audit.`);
