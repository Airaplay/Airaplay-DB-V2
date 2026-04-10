/**
 * Ensures every supabase.rpc('...') used under AdminDashboardScreen has a matching
 * CREATE FUNCTION in supabase/migrations (static check).
 *
 * Some legacy RPCs may be listed in scripts/admin-rpc-allowlist.json until DB migrations catch up.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const adminDir = path.join(root, 'src', 'screens', 'AdminDashboardScreen');
const migDir = path.join(root, 'supabase', 'migrations');
const allowlistPath = path.join(__dirname, 'admin-rpc-allowlist.json');

function walkTs(dir, acc = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walkTs(p, acc);
    else if (/\.(ts|tsx)$/.test(e.name)) acc.push(p);
  }
  return acc;
}

const allowlist = fs.existsSync(allowlistPath)
  ? new Set(JSON.parse(fs.readFileSync(allowlistPath, 'utf8')))
  : new Set();

const rpcs = new Set();
for (const f of walkTs(adminDir)) {
  const t = fs.readFileSync(f, 'utf8');
  for (const m of t.matchAll(/rpc\('([^']+)'/g)) rpcs.add(m[1]);
}

const sql = fs
  .readdirSync(migDir)
  .filter((f) => f.endsWith('.sql'))
  .map((f) => fs.readFileSync(path.join(migDir, f), 'utf8').toLowerCase())
  .join('\n');

const missing = [];
for (const name of [...rpcs].sort()) {
  const n = name.toLowerCase();
  const found = sql.includes(`function ${n}(`) || sql.includes(`function public.${n}(`);
  if (!found && !allowlist.has(name)) missing.push(name);
}

if (missing.length) {
  console.error('[verify-admin-rpcs] Missing RPC definitions in migrations:', missing.join(', '));
  process.exit(1);
}

for (const n of allowlist) {
  const low = n.toLowerCase();
  const found = sql.includes(`function ${low}(`) || sql.includes(`function public.${low}(`);
  if (found) {
    console.warn('[verify-admin-rpcs] Allowlist entry can be removed (now in migrations):', n);
  }
}

console.log(`[verify-admin-rpcs] OK — ${rpcs.size} admin RPC references checked.`);
