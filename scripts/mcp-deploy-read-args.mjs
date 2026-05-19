/** Prints deploy_edge_function `arguments` JSON from mcp-args file (stdout). */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const fn = process.argv[2];
const map = {
  'send-email': 'mcp-args-send-email.json',
  'process-email-queue': 'mcp-args-process-email-queue.json',
};
const file = map[fn];
if (!file) process.exit(1);
const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const p = path.join(root, 'supabase', '.temp', file);
process.stdout.write(fs.readFileSync(p, 'utf8'));
