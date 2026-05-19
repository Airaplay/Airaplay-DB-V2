/**
 * Deploy edge functions to Airaplay (vwcadgjaivvffxwgnkzy) from prebuilt JSON payloads.
 * Requires SUPABASE_ACCESS_TOKEN in env or .env.local
 *
 *   node scripts/run-mcp-deploy-from-json.mjs send-email
 *   node scripts/run-mcp-deploy-from-json.mjs process-email-queue
 *   node scripts/run-mcp-deploy-from-json.mjs all
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

async function deploy(fn) {
  const jsonPath = path.join(root, 'supabase', '.temp', `mcp-args-${fn}.json`);
  const args = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
  const token = loadToken();
  if (!token) throw new Error('Missing SUPABASE_ACCESS_TOKEN');

  const url = `https://api.supabase.com/v1/projects/${PROJECT_REF}/functions/deploy?slug=${fn}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      slug: fn,
      name: fn,
      entrypoint_path: args.entrypoint_path,
      verify_jwt: args.verify_jwt,
      files: args.files,
    }),
  });
  const text = await res.text();
  console.log(fn, res.status, text);
  if (!res.ok) process.exit(1);
}

const target = process.argv[2] || 'all';
const fns = target === 'all' ? ['send-email', 'process-email-queue'] : [target];
for (const fn of fns) {
  await deploy(fn);
}
