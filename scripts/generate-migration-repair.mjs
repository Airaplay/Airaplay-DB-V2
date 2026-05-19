import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const remotePath =
  process.argv[2] ||
  path.join(
    process.env.USERPROFILE || '',
    '.cursor/projects/c-Users-BILDIAMO-Desktop-YOUNGDI-AIRA-VV1-ADMIN-Airaplay-DB-V2/agent-tools/7a8ae653-aea3-46b5-a0e2-fad1aebbbd52.txt',
  );

const remote = JSON.parse(fs.readFileSync(remotePath, 'utf8')).migrations;
const remoteSet = new Set(remote.map((m) => m.version).filter(Boolean));
const dir = path.join(root, 'supabase/migrations');
const pending = fs
  .readdirSync(dir)
  .filter((f) => /^(\d{14})_.+\.sql$/.test(f))
  .sort()
  .map((f) => ({
    version: f.slice(0, 14),
    name: f.replace(/^\d+_/, '').replace(/\.sql$/, ''),
  }))
  .filter((x) => !remoteSet.has(x.version));

const esc = (s) => s.replace(/'/g, "''");

const out = path.join(root, 'supabase/.temp/repair-all-pending.sql');
fs.mkdirSync(path.dirname(out), { recursive: true });

// Chunk to keep each statement manageable for MCP execute_sql
const chunkSize = 25;
const parts = [];
for (let i = 0; i < pending.length; i += chunkSize) {
  const slice = pending.slice(i, i + chunkSize);
  const rows = slice.map((p) => `('${p.version}', ARRAY[]::text[], '${esc(p.name)}')`).join(',\n');
  parts.push(
    `INSERT INTO supabase_migrations.schema_migrations (version, statements, name)\nVALUES\n${rows}\nON CONFLICT (version) DO NOTHING;`,
  );
}
fs.writeFileSync(out, parts.join('\n\n'));
console.log('Wrote', out, 'rows:', pending.length, 'chunks:', parts.length);
