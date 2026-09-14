/**
 * Structural validation of everything under data/. Run in CI before a build so
 * a malformed curated edit fails loudly rather than rendering a blank panel.
 */
import { readFile, readdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { parse as parseYaml } from 'yaml';
import { ROOT, SNAPSHOT_DIR, HISTORY_FILE } from './collect/framework.js';

const errors: string[] = [];
const warnings: string[] = [];

const isIsoDate = (v: unknown): boolean => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v);

function requireFields(
  file: string, index: number, row: Record<string, unknown>,
  spec: Record<string, 'string' | 'number' | 'date' | 'string|null' | 'number|null'>,
) {
  for (const [field, kind] of Object.entries(spec)) {
    const v = row[field];
    const nullable = kind.endsWith('|null');
    const base = kind.replace('|null', '');
    if (v == null) {
      if (!nullable) errors.push(`${file}[${index}]: missing required field "${field}"`);
      continue;
    }
    if (base === 'date' && !isIsoDate(v)) {
      errors.push(`${file}[${index}]: "${field}" must be YYYY-MM-DD, got ${JSON.stringify(v)}`);
    } else if (base !== 'date' && typeof v !== base) {
      errors.push(`${file}[${index}]: "${field}" must be ${base}, got ${typeof v}`);
    }
  }
}

function checkEnum(file: string, index: number, field: string, value: unknown, allowed: string[]) {
  if (typeof value !== 'string' || !allowed.includes(value)) {
    errors.push(`${file}[${index}]: "${field}" must be one of ${allowed.join(' | ')}, got ${JSON.stringify(value)}`);
  }
}

async function loadYaml(name: string): Promise<Record<string, unknown>[]> {
  const file = resolve(ROOT, 'data/curated', `${name}.yaml`);
  if (!existsSync(file)) {
    warnings.push(`data/curated/${name}.yaml not found — treated as empty`);
    return [];
  }
  const parsed = parseYaml(await readFile(file, 'utf8'));
  if (!Array.isArray(parsed)) {
    errors.push(`data/curated/${name}.yaml must be a YAML list at the top level`);
    return [];
  }
  return parsed as Record<string, unknown>[];
}

async function validateCurated() {
  const labs = await loadYaml('labs');
  labs.forEach((row, i) => {
    requireFields('labs.yaml', i, row, { id: 'string', name: 'string', country: 'string', notes: 'string', founded: 'number|null', url: 'string|null' });
    checkEnum('labs.yaml', i, 'category', row.category, ['frontier', 'bigtech', 'open', 'research', 'chips', 'infra']);
  });
  const ids = labs.map((l) => l.id);
  const dupes = ids.filter((id, i) => ids.indexOf(id) !== i);
  if (dupes.length) errors.push(`labs.yaml: duplicate ids: ${[...new Set(dupes)].join(', ')}`);

  const policy = await loadYaml('policy-timeline');
  policy.forEach((row, i) => {
    requireFields('policy-timeline.yaml', i, row, { date: 'date', jurisdiction: 'string', title: 'string', summary: 'string', url: 'string|null' });
    checkEnum('policy-timeline.yaml', i, 'kind', row.kind, ['law', 'regulation', 'executive', 'agreement', 'export-control', 'standard']);
    checkEnum('policy-timeline.yaml', i, 'status', row.status, ['in-force', 'phasing-in', 'proposed', 'superseded']);
  });

  const funding = await loadYaml('funding');
  funding.forEach((row, i) => {
    requireFields('funding.yaml', i, row, { date: 'date', company: 'string', amountUsdM: 'number', round: 'string', investors: 'string', valuationUsdB: 'number|null', url: 'string|null' });
    if (typeof row.amountUsdM === 'number' && row.amountUsdM <= 0) {
      errors.push(`funding.yaml[${i}]: amountUsdM must be positive`);
    }
  });

  const safety = await loadYaml('safety-events');
  safety.forEach((row, i) => {
    requireFields('safety-events.yaml', i, row, { date: 'date', title: 'string', summary: 'string', url: 'string|null' });
    checkEnum('safety-events.yaml', i, 'category', row.category, ['incident', 'evaluation', 'commitment', 'framework', 'research']);
    checkEnum('safety-events.yaml', i, 'severity', row.severity, ['low', 'medium', 'high', 'informational']);
  });

  const adoption = await loadYaml('adoption');
  adoption.forEach((row, i) => {
    requireFields('adoption.yaml', i, row, { label: 'string', value: 'number', unit: 'string', asOf: 'date', source: 'string', note: 'string', url: 'string|null' });
  });

  console.log(`  curated: ${labs.length} labs, ${policy.length} policy milestones, ${funding.length} funding rounds, ${safety.length} safety events, ${adoption.length} adoption indicators`);
}

async function validateSnapshots() {
  if (!existsSync(SNAPSHOT_DIR)) {
    errors.push('data/snapshots does not exist — run `npm run refresh` first');
    return;
  }
  const files = (await readdir(SNAPSHOT_DIR)).filter((f) => f.endsWith('.json'));
  if (!files.length) errors.push('data/snapshots is empty — run `npm run refresh` first');

  for (const file of files) {
    const raw = await readFile(resolve(SNAPSHOT_DIR, file), 'utf8');
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch (err) {
      errors.push(`snapshots/${file}: invalid JSON (${err instanceof Error ? err.message : String(err)})`);
      continue;
    }
    if (file === 'sources.json') {
      if (!Array.isArray(parsed)) errors.push('snapshots/sources.json must be an array');
      continue;
    }
    const env = parsed as Record<string, unknown>;
    for (const key of ['sourceId', 'label', 'status', 'fetchedAt', 'data']) {
      if (!(key in env)) errors.push(`snapshots/${file}: missing envelope field "${key}"`);
    }
    if (env.status === 'stale') warnings.push(`snapshots/${file}: serving stale data (${String(env.error ?? 'unknown error')})`);
    if (env.status === 'empty') warnings.push(`snapshots/${file}: no records collected yet`);
  }
  console.log(`  snapshots: ${files.length} files parsed`);
}

async function validateHistory() {
  if (!existsSync(HISTORY_FILE)) {
    warnings.push('data/history/metrics.ndjson not found — no time series yet');
    return;
  }
  const lines = (await readFile(HISTORY_FILE, 'utf8')).split('\n').filter((l) => l.trim());
  lines.forEach((line, i) => {
    try {
      const p = JSON.parse(line) as Record<string, unknown>;
      if (typeof p.ts !== 'string' || typeof p.metric !== 'string' || typeof p.value !== 'number') {
        errors.push(`history line ${i + 1}: expected {ts, metric, value}`);
      }
    } catch {
      errors.push(`history line ${i + 1}: invalid JSON`);
    }
  });
  console.log(`  history: ${lines.length} metric points`);
}

async function main() {
  console.log('\nValidating data/\n');
  await validateCurated();
  await validateSnapshots();
  await validateHistory();

  if (warnings.length) {
    console.log(`\n${warnings.length} warning(s):`);
    for (const w of warnings) console.log(`  ! ${w}`);
  }
  if (errors.length) {
    console.log(`\n${errors.length} error(s):`);
    for (const e of errors) console.log(`  ✗ ${e}`);
    process.exit(1);
  }
  console.log('\nAll data valid.\n');
}

main().catch((err) => {
  console.error('validate failed:', err);
  process.exit(1);
});
