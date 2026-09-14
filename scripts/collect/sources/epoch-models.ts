import { defineSource, parseCsv, num, yearOf, median, tally } from '../framework.js';
import type { CapabilityData, AiModel } from '../../../src/types/index.js';

const CSV = 'https://epoch.ai/data/notable_ai_models.csv';

const truthy = (v: string | undefined) => {
  const s = (v ?? '').trim().toLowerCase();
  return s === 'yes' || s === 'true' || s === 'y';
};

export default defineSource<CapabilityData>({
  id: 'epoch-models',
  label: 'Notable AI models',
  pillar: 'capability',
  cadence: 'weekly',
  attribution: {
    name: 'Epoch AI — Notable AI Models',
    url: 'https://epoch.ai/data/notable-ai-models',
    license: 'CC BY 4.0',
  },
  empty: { models: [], byYear: [], topOrganizations: [], byCountry: [] },

  async collect(ctx) {
    const rows = parseCsv(await ctx.getText(CSV));
    ctx.log(`parsed ${rows.length} rows`);

    const models: AiModel[] = rows
      .filter((r) => r['Model'])
      .map((r) => ({
        name: r['Model'],
        organization: r['Organization'] || 'Unknown',
        orgCategory: r['Organization categorization'] || null,
        country: r['Country (of organization)'] || null,
        publicationDate: r['Publication date'] || null,
        domain: r['Domain'] || null,
        trainingComputeFlop: num(r['Training compute (FLOP)']),
        parameters: num(r['Parameters']),
        datasetSize: num(r['Training dataset size (total)']),
        costUsd2023: num(r['Training compute cost (2023 USD)']),
        trainingHardware: r['Training hardware'] || null,
        hardwareQuantity: num(r['Hardware quantity']),
        accessibility: r['Model accessibility'] || null,
        openWeights: r['Open model weights?'] ? truthy(r['Open model weights?']) : null,
        frontier: truthy(r['Frontier model']),
        link: r['Link'] || null,
      }));

    // Aggregate server-side: the browser should never reduce 1k+ rows on mount.
    const years = new Map<number, AiModel[]>();
    for (const m of models) {
      const y = yearOf(m.publicationDate);
      if (y == null) continue;
      const list = years.get(y) ?? [];
      list.push(m);
      years.set(y, list);
    }

    const byYear = [...years.entries()]
      .map(([year, ms]) => {
        const compute = ms.map((m) => m.trainingComputeFlop).filter((n): n is number => n != null);
        return {
          year,
          count: ms.length,
          frontierCount: ms.filter((m) => m.frontier).length,
          openWeightCount: ms.filter((m) => m.openWeights === true).length,
          maxComputeFlop: compute.length ? Math.max(...compute) : null,
          medianComputeFlop: median(compute),
        };
      })
      .sort((a, b) => a.year - b.year);

    const orgCounts = tally(models, (m) => m.organization);
    const topOrganizations = orgCounts.slice(0, 25).map(({ key, count }) => ({
      organization: key,
      count,
      frontierCount: models.filter((m) => m.organization === key && m.frontier).length,
    }));

    // Epoch stores multi-country collaborations as one comma-joined string
    // ("United States of America,United Kingdom"). Counting those verbatim
    // invents countries and produces labels no axis can fit, so split them and
    // credit each country once per model.
    const countryTally = new Map<string, number>();
    for (const m of models) {
      if (!m.country) continue;
      const parts = [...new Set(m.country.split(',').map((p) => p.trim()).filter(Boolean))];
      for (const part of parts) countryTally.set(part, (countryTally.get(part) ?? 0) + 1);
    }
    const byCountry = [...countryTally.entries()]
      .map(([country, count]) => ({ country, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 30);

    const thisYear = new Date().getUTCFullYear();
    const current = byYear.find((y) => y.year === thisYear);
    ctx.metric('capability.models_total', models.length, 'models');
    ctx.metric('capability.frontier_total', models.filter((m) => m.frontier).length, 'models');
    if (current) {
      ctx.metric('capability.models_ytd', current.count, 'models');
      ctx.metric('capability.frontier_ytd', current.frontierCount, 'models');
    }
    const allCompute = models.map((m) => m.trainingComputeFlop).filter((n): n is number => n != null);
    if (allCompute.length) ctx.metric('capability.max_training_compute_flop', Math.max(...allCompute), 'FLOP');

    return { models, byYear, topOrganizations, byCountry };
  },

  count: (d) => d.models.length,
});
