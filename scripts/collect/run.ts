import { writeFile, mkdir, readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { parse as parseYaml } from 'yaml';
import { loadSources } from './registry.js';
import { runSource, appendMetrics, ROOT, SNAPSHOT_DIR } from './framework.js';
import type { MetricPoint, SourceHealth, CuratedData } from '../../src/types/index.js';

const args = process.argv.slice(2);
const only = args.find((a) => a.startsWith('--only='))?.split('=')[1];

/** Curated YAML is compiled into a snapshot so the UI loads one kind of file. */
async function buildCurated(ts: string): Promise<number> {
  const dir = resolve(ROOT, 'data/curated');
  const read = async <T>(name: string): Promise<T[]> => {
    const file = resolve(dir, `${name}.yaml`);
    if (!existsSync(file)) return [];
    const parsed = parseYaml(await readFile(file, 'utf8'));
    return (Array.isArray(parsed) ? parsed : []) as T[];
  };

  const data: CuratedData = {
    labs: await read('labs'),
    policyMilestones: await read('policy-timeline'),
    funding: await read('funding'),
    safetyEvents: await read('safety-events'),
    adoption: await read('adoption'),
  };

  const total =
    data.labs.length + data.policyMilestones.length + data.funding.length +
    data.safetyEvents.length + data.adoption.length;

  await mkdir(SNAPSHOT_DIR, { recursive: true });
  await writeFile(
    resolve(SNAPSHOT_DIR, 'curated.json'),
    JSON.stringify(
      {
        sourceId: 'curated',
        label: 'Hand-curated context',
        status: total > 0 ? 'ok' : 'empty',
        fetchedAt: ts,
        lastSuccess: ts,
        attribution: { name: 'Maintained in data/curated/*.yaml', url: '' },
        data,
      },
      null,
      1,
    ) + '\n',
    'utf8',
  );
  return total;
}

async function main() {
  const ts = new Date().toISOString();
  const all = await loadSources();
  const sources = only ? all.filter((s) => s.id === only) : all;

  if (only && !sources.length) {
    console.error(`No source with id "${only}". Available: ${all.map((s) => s.id).join(', ')}`);
    process.exit(1);
  }

  console.log(`\nAI Ecosystem Observatory — refreshing ${sources.length} source(s) at ${ts}\n`);

  const metrics: MetricPoint[] = [];
  const health: SourceHealth[] = [];

  for (const def of sources) {
    process.stdout.write(`  • ${def.label} (${def.id})\n`);
    const result = await runSource(def, metrics, ts);
    health.push({
      sourceId: def.id,
      label: def.label,
      pillar: def.pillar,
      status: result.status,
      fetchedAt: ts,
      lastSuccess: result.lastSuccess,
      error: result.error,
      recordCount: result.recordCount,
      attribution: def.attribution,
    });
    const badge = result.status === 'ok' ? 'ok' : result.status.toUpperCase();
    console.log(
      `    → ${badge}  ${result.recordCount} records  ${(result.durationMs / 1000).toFixed(1)}s` +
        (result.error ? `  (${result.error})` : ''),
    );
  }

  const curatedCount = await buildCurated(ts);
  console.log(`\n  • Curated context\n    → ok  ${curatedCount} records`);

  // Merge health for sources we skipped this run, so the panel stays complete.
  if (only) {
    const file = resolve(SNAPSHOT_DIR, 'sources.json');
    if (existsSync(file)) {
      const prior = JSON.parse(await readFile(file, 'utf8')) as SourceHealth[];
      for (const p of prior) if (!health.some((h) => h.sourceId === p.sourceId)) health.push(p);
    }
  }

  await writeFile(
    resolve(SNAPSHOT_DIR, 'sources.json'),
    JSON.stringify(health.sort((a, b) => a.sourceId.localeCompare(b.sourceId)), null, 1) + '\n',
    'utf8',
  );
  await appendMetrics(metrics);

  const failed = health.filter((h) => h.status !== 'ok');
  console.log(
    `\nDone. ${health.length - failed.length}/${health.length} sources ok, ` +
      `${metrics.length} metrics appended to history.`,
  );
  if (failed.length) {
    console.log(`Degraded: ${failed.map((f) => `${f.sourceId} (${f.status})`).join(', ')}`);
    console.log('Serving last-known-good data for these; the dashboard flags them as stale.');
  }
  // Exit 0 even when sources fail: a flaky upstream must never break the build.
}

main().catch((err) => {
  console.error('Fatal error in collector runner:', err);
  process.exit(1);
});
