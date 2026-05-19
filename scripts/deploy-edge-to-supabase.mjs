/**
 * Deploy edge functions to Supabase project vwcadgjaivvffxwgnkzy via Management API.
 * Requires SUPABASE_ACCESS_TOKEN (https://supabase.com/dashboard/account/tokens).
 *
 * Usage:
 *   $env:SUPABASE_ACCESS_TOKEN = "sbp_..."
 *   node scripts/deploy-edge-to-supabase.mjs send-email
 *   node scripts/deploy-edge-to-supabase.mjs process-email-queue
 *   node scripts/deploy-edge-to-supabase.mjs contribution-monthly-convert
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const PROJECT_REF = 'vwcadgjaivvffxwgnkzy';
const fn = process.argv[2];
const token = process.env.SUPABASE_ACCESS_TOKEN?.trim();

if (!fn) {
  console.error('Usage: node scripts/deploy-edge-to-supabase.mjs <function-name>');
  process.exit(1);
}
if (!token) {
  console.error('Missing SUPABASE_ACCESS_TOKEN. Create one at https://supabase.com/dashboard/account/tokens');
  process.exit(1);
}

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const functionsRoot = path.join(root, 'supabase', 'functions');
const sharedRoot = path.join(functionsRoot, '_shared');

function read(rel) {
  return fs.readFileSync(path.join(functionsRoot, rel), 'utf8');
}

/** @type {{ entrypoint_path: string, verify_jwt: boolean, files: { name: string, content: string }[] }} */
const bundles = {
  'send-email': {
    entrypoint_path: 'index.ts',
    verify_jwt: true,
    files: [
      { name: 'index.ts', content: read('send-email/index.ts') },
      { name: '../_shared/auth.ts', content: fs.readFileSync(path.join(sharedRoot, 'auth.ts'), 'utf8') },
      {
        name: '../_shared/emailHeaderStyle.ts',
        content: fs.readFileSync(path.join(sharedRoot, 'emailHeaderStyle.ts'), 'utf8'),
      },
    ],
  },
  'process-email-queue': {
    entrypoint_path: 'index.ts',
    verify_jwt: true,
    files: [
      { name: 'index.ts', content: read('process-email-queue/index.ts') },
      { name: '../_shared/auth.ts', content: fs.readFileSync(path.join(sharedRoot, 'auth.ts'), 'utf8') },
    ],
  },
  'contribution-monthly-convert': {
    entrypoint_path: 'index.ts',
    verify_jwt: false,
    files: [{ name: 'index.ts', content: read('contribution-monthly-convert/index.ts') }],
  },
};

const payload = bundles[fn];
if (!payload) {
  console.error(`Unknown function "${fn}". Supported: ${Object.keys(bundles).join(', ')}`);
  process.exit(1);
}

const url = `https://api.supabase.com/v1/projects/${PROJECT_REF}/functions/deploy?slug=${fn}`;
const res = await fetch(url, {
  method: 'POST',
  headers: {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    slug: fn,
    name: fn,
    entrypoint_path: payload.entrypoint_path,
    verify_jwt: payload.verify_jwt,
    files: payload.files,
  }),
});

const text = await res.text();
console.log(res.status, text);
if (!res.ok) process.exit(1);
