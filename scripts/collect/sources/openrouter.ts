import { defineSource, median } from '../framework.js';
import type { CapitalData, ServedModel } from '../../../src/types/index.js';

const API = 'https://openrouter.ai/api/v1/models';

interface OrModel {
  id: string;
  name: string;
  created?: number;
  context_length?: number | null;
  architecture?: { input_modalities?: string[]; output_modalities?: string[] };
  pricing?: Record<string, string>;
}

/** OpenRouter quotes USD per token; per-million is the unit people reason in. */
const perMillion = (v: string | undefined): number | null => {
  if (v == null) return null;
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? n * 1_000_000 : null;
};

export default defineSource<CapitalData>({
  id: 'openrouter',
  label: 'Served model catalogue & inference pricing',
  pillar: 'capital',
  cadence: 'daily',
  attribution: { name: 'OpenRouter', url: 'https://openrouter.ai/docs/api-reference/list-available-models' },
  empty: {
    servedModels: [],
    providerCount: 0,
    priceStats: { medianPromptUsdPerMTok: null, minPromptUsdPerMTok: null, medianCompletionUsdPerMTok: null },
    byProvider: [],
    contextLengthBuckets: [],
  },

  async collect(ctx) {
    const body = await ctx.getJson<{ data: OrModel[] }>(API);
    const raw = body.data ?? [];
    ctx.log(`${raw.length} served models`);

    const servedModels: ServedModel[] = raw.map((m) => ({
      id: m.id,
      name: m.name,
      provider: m.id.includes('/') ? m.id.split('/')[0] : 'other',
      contextLength: m.context_length ?? null,
      promptUsdPerMTok: perMillion(m.pricing?.prompt),
      completionUsdPerMTok: perMillion(m.pricing?.completion),
      modalities: m.architecture?.input_modalities ?? [],
      created: m.created ? new Date(m.created * 1000).toISOString().slice(0, 10) : null,
    }));

    // Free endpoints would drag the median to zero and hide the real trend.
    const paidPrompt = servedModels
      .map((m) => m.promptUsdPerMTok)
      .filter((n): n is number => n != null && n > 0);
    const paidCompletion = servedModels
      .map((m) => m.completionUsdPerMTok)
      .filter((n): n is number => n != null && n > 0);

    const providers = new Map<string, ServedModel[]>();
    for (const m of servedModels) {
      const list = providers.get(m.provider) ?? [];
      list.push(m);
      providers.set(m.provider, list);
    }
    const byProvider = [...providers.entries()]
      .map(([provider, ms]) => ({
        provider,
        count: ms.length,
        medianPromptUsdPerMTok: median(
          ms.map((m) => m.promptUsdPerMTok).filter((n): n is number => n != null && n > 0),
        ),
      }))
      .sort((a, b) => b.count - a.count);

    const buckets: Array<{ bucket: string; min: number; max: number }> = [
      { bucket: '<32K', min: 0, max: 32_000 },
      { bucket: '32K–128K', min: 32_000, max: 128_000 },
      { bucket: '128K–256K', min: 128_000, max: 256_000 },
      { bucket: '256K–1M', min: 256_000, max: 1_000_000 },
      { bucket: '≥1M', min: 1_000_000, max: Infinity },
    ];
    const contextLengthBuckets = buckets.map(({ bucket, min, max }) => ({
      bucket,
      count: servedModels.filter((m) => m.contextLength != null && m.contextLength >= min && m.contextLength < max).length,
    }));

    ctx.metric('capital.served_models', servedModels.length, 'models');
    ctx.metric('capital.providers', providers.size, 'providers');
    const medPrompt = median(paidPrompt);
    if (medPrompt != null) ctx.metric('capital.median_prompt_usd_per_mtok', medPrompt, 'USD/Mtok');
    if (paidPrompt.length) ctx.metric('capital.min_prompt_usd_per_mtok', Math.min(...paidPrompt), 'USD/Mtok');

    return {
      servedModels,
      providerCount: providers.size,
      priceStats: {
        medianPromptUsdPerMTok: medPrompt,
        minPromptUsdPerMTok: paidPrompt.length ? Math.min(...paidPrompt) : null,
        medianCompletionUsdPerMTok: median(paidCompletion),
      },
      byProvider,
      contextLengthBuckets,
    };
  },

  count: (d) => d.servedModels.length,
});
