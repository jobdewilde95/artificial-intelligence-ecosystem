import { defineSource, parseCsv, num, yearOf } from '../framework.js';
import type { ComputeData, ComputeCluster } from '../../../src/types/index.js';

const CSV = 'https://epoch.ai/data/ai_supercomputers.csv';

export default defineSource<ComputeData>({
  id: 'epoch-compute',
  label: 'AI supercomputers & GPU clusters',
  pillar: 'compute',
  cadence: 'weekly',
  attribution: {
    name: 'Epoch AI — AI Supercomputers',
    url: 'https://epoch.ai/data/ai-supercomputers',
    license: 'CC BY 4.0',
  },
  empty: { clusters: [], byCountry: [], byOwner: [], byYear: [], largest: null },

  async collect(ctx) {
    const rows = parseCsv(await ctx.getText(CSV));
    ctx.log(`parsed ${rows.length} rows`);

    const clusters: ComputeCluster[] = rows
      .filter((r) => r['Name'])
      .map((r) => ({
        name: r['Name'],
        status: r['Status'] || null,
        certainty: r['Certainty'] || null,
        owner: r['Owner'] || null,
        country: r['Country'] || null,
        chipType: r['Chip type (primary)'] || null,
        chipQuantity: num(r['Chip quantity (primary)']),
        h100Equivalents: num(r['H100 equivalents']),
        maxOpsLog: num(r['Max OP/s (log)']),
        firstOperational: r['First Operational Date'] || null,
      }));

    const groupSum = (key: (c: ComputeCluster) => string | null) => {
      const m = new Map<string, { count: number; h100Equivalents: number }>();
      for (const c of clusters) {
        const k = key(c);
        if (!k) continue;
        const cur = m.get(k) ?? { count: 0, h100Equivalents: 0 };
        cur.count += 1;
        cur.h100Equivalents += c.h100Equivalents ?? 0;
        m.set(k, cur);
      }
      return [...m.entries()]
        .map(([k, v]) => ({ key: k, ...v }))
        .sort((a, b) => b.h100Equivalents - a.h100Equivalents);
    };

    const byCountry = groupSum((c) => c.country)
      .slice(0, 20)
      .map(({ key, count, h100Equivalents }) => ({ country: key, count, h100Equivalents }));

    const byOwner = groupSum((c) => c.owner)
      .slice(0, 20)
      .map(({ key, count, h100Equivalents }) => ({ owner: key, count, h100Equivalents }));

    const yearMap = new Map<number, { count: number; h100Equivalents: number }>();
    for (const c of clusters) {
      const y = yearOf(c.firstOperational);
      if (y == null) continue;
      const cur = yearMap.get(y) ?? { count: 0, h100Equivalents: 0 };
      cur.count += 1;
      cur.h100Equivalents += c.h100Equivalents ?? 0;
      yearMap.set(y, cur);
    }
    const byYear = [...yearMap.entries()]
      .map(([year, v]) => ({ year, ...v }))
      .sort((a, b) => a.year - b.year);

    const largest =
      clusters
        .filter((c) => c.h100Equivalents != null)
        .sort((a, b) => (b.h100Equivalents ?? 0) - (a.h100Equivalents ?? 0))[0] ?? null;

    ctx.metric('compute.clusters_total', clusters.length, 'clusters');
    const totalH100 = clusters.reduce((s, c) => s + (c.h100Equivalents ?? 0), 0);
    ctx.metric('compute.h100_equivalents_total', Math.round(totalH100), 'H100e');
    if (largest?.h100Equivalents) {
      ctx.metric('compute.largest_cluster_h100e', Math.round(largest.h100Equivalents), 'H100e');
    }

    return { clusters, byCountry, byOwner, byYear, largest };
  },

  count: (d) => d.clusters.length,
});
