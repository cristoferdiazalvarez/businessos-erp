import { createRequire } from 'node:module';
import { statSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const require = createRequire(new URL('../apps/web/package.json', import.meta.url));
const { nodeFileTrace } = require('next/dist/compiled/@vercel/nft');
const { fileList } = await nodeFileTrace([`${root}apps/api/dist/src/main.js`], { base: root, processCwd: `${root}apps/api` });
let bytes = 0;
for (const file of fileList) {
  try { bytes += statSync(resolve(root, file)).size; } catch { /* optional platform assets */ }
}
const rhel = [...fileList].some(file => file.includes('libquery_engine-rhel-openssl-3.0.x.so.node'));
if (!rhel) throw new Error('Trace did not include the Vercel-compatible Prisma engine');
if (![...fileList].some(file => /argon2.*prebuilds.*\.node$/.test(file))) throw new Error('Trace did not include the native Argon2 runtime');
if (![...fileList].some(file => /pdfkit.*Helvetica\.afm$/.test(file))) throw new Error('Trace did not include invoice PDF font assets');
if (bytes >= 250 * 1024 * 1024) throw new Error('Traced API runtime exceeds the standard 250 MiB serverless bundle limit');
console.log(`API runtime trace: ${fileList.size} files, ${(bytes / 1024 / 1024).toFixed(1)} MiB; Linux Prisma engine included. This preflight does not certify Vercel packaging or create a deployment.`);
