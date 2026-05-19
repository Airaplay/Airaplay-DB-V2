/**
 * Deploy send-email + process-email-queue to vwcadgjaivvffxwgnkzy.
 * Uses SUPABASE_ACCESS_TOKEN or reads from .env.local
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const PROJECT_REF = 'vwcadgjaivvffxwgnkzy';
const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

function loadToken() {
  if (process.env.SUPABASE_ACCESS_TOKEN?.trim()) return process.env.SUPABASE_ACCESS_TOKEN.trim();
  for (const name of ['.env.local', '.env']) {
    const p = path.join(root, name);
    if (!fs.existsSync(p)) continue;
    const m = fs.readFileSync(p, 'utf8').match(/^\s*SUPABASE_ACCESS_TOKEN\s*=\s*(.+)\s*$/m);
    if (m) return m[1].replace(/^['"]|['"]$/g, '').trim();
  }
  return null;
}

function bundle(fnName) {
  const functionsRoot = path.join(root, 'supabase', 'functions');
  const sharedRoot = path.join(functionsRoot, '_shared');
  const read = (rel) => fs.readFileSync(path.join(functionsRoot, rel), 'utf8');
  const files = [
    { name: 'index.ts', content: read(`${fnName}/index.ts`) },
    { name: '../_shared/auth.ts', content: fs.readFileSync(path.join(sharedRoot, 'auth.ts'), 'utf8') },
  ];
  if (fnName === 'send-email') {
    files.push({
      name: '../_shared/emailHeaderStyle.ts',
      content: fs.readFileSync(path.join(sharedRoot, 'emailHeaderStyle.ts'), 'utf8'),
    });
  }
  return { entrypoint_path: 'index.ts', verify_jwt: true, files };
}

async function deploy(fn, token) {
  const { entrypoint_path, verify_jwt, files } = bundle(fn);
  const url = `https://api.supabase.com/v1/projects/${PROJECT_REF}/functions/deploy?slug=${fn}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ slug: fn, name: fn, entrypoint_path, verify_jwt, files }),
  });
  const text = await res.text();
  console.log(fn, res.status, text.slice(0, 500));
  if (!res.ok) process.exit(1);
}

const token = loadToken();
if (!token) {
  console.error('Set SUPABASE_ACCESS_TOKEN in .env.local or environment');
  process.exit(1);
}

for (const fn of ['process-email-queue', 'send-email']) {
  await deploy(fn, token);
}
console.log('Done');
