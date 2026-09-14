// Snapshots live in data/ (committed, diff-friendly) but must be *served*, so
// they are copied into public/ where Vite picks them up for both dev and build.
// public/data is generated and gitignored — data/ stays the source of truth.
import { cp, mkdir, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const dest = resolve(root, 'public/data');

await rm(dest, { recursive: true, force: true });
await mkdir(dest, { recursive: true });

const snapshots = resolve(root, 'data/snapshots');
if (!existsSync(snapshots)) {
  console.error('sync-data: data/snapshots missing — run `npm run refresh` first');
  process.exit(1);
}
await cp(snapshots, resolve(dest, 'snapshots'), { recursive: true });

const history = resolve(root, 'data/history/metrics.ndjson');
if (existsSync(history)) {
  await mkdir(resolve(dest, 'history'), { recursive: true });
  await cp(history, resolve(dest, 'history/metrics.ndjson'));
}
console.log('sync-data: public/data refreshed');
