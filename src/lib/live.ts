import { useEffect, useState } from 'react';

/**
 * Browser-side refresh of the handful of endpoints that actually permit it.
 *
 * CORS was checked against every candidate source while building this: these
 * five send Access-Control-Allow-Origin, and GitHub, Epoch and SEC EDGAR do
 * not — those stay server-side in the collectors. This layer only ever
 * *enhances* committed snapshot data; it never gates rendering, and any
 * failure is silent by design.
 */

export interface LiveValues {
  servedModels: number | null;
  providers: number | null;
  cheapestUsdPerMTok: number | null;
  hfTrendingDownloads: number | null;
  policyDocsTotal: number | null;
  researchWorksTotal: number | null;
  fetchedAt: string | null;
}

const EMPTY: LiveValues = {
  servedModels: null, providers: null, cheapestUsdPerMTok: null,
  hfTrendingDownloads: null, policyDocsTotal: null, researchWorksTotal: null, fetchedAt: null,
};

async function withTimeout<T>(p: (signal: AbortSignal) => Promise<T>, ms = 8000): Promise<T | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    return await p(controller.signal);
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

const json = <T,>(url: string) =>
  withTimeout<T>(async (signal) => {
    const res = await fetch(url, { signal });
    if (!res.ok) throw new Error(String(res.status));
    return (await res.json()) as T;
  });

export function useLiveValues(enabled: boolean): { live: LiveValues; loading: boolean } {
  const [live, setLive] = useState<LiveValues>(EMPTY);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!enabled) {
      setLive(EMPTY);
      return;
    }
    let cancelled = false;
    setLoading(true);

    (async () => {
      const [openrouter, hf, policy, research] = await Promise.all([
        json<{ data: Array<{ id: string; pricing?: { prompt?: string } }> }>('https://openrouter.ai/api/v1/models'),
        json<{ recentlyTrending?: Array<{ repoData?: { downloads?: number } }> }>(
          'https://huggingface.co/api/trending?type=model&limit=20',
        ),
        json<{ count?: number }>(
          'https://www.federalregister.gov/api/v1/documents.json?conditions[term]=%22artificial%20intelligence%22&per_page=1&fields[]=title',
        ),
        json<{ message?: { 'total-results'?: number } }>(
          'https://api.crossref.org/works?query.bibliographic=artificial+intelligence&rows=0&mailto=jobdewilde95@gmail.com',
        ),
      ]);
      if (cancelled) return;

      const models = openrouter?.data ?? [];
      const paid = models
        .map((m) => Number(m.pricing?.prompt))
        .filter((n) => Number.isFinite(n) && n > 0)
        .map((n) => n * 1_000_000);

      setLive({
        servedModels: models.length || null,
        providers: models.length ? new Set(models.map((m) => m.id.split('/')[0])).size : null,
        cheapestUsdPerMTok: paid.length ? Math.min(...paid) : null,
        hfTrendingDownloads:
          hf?.recentlyTrending?.reduce((s, t) => s + (t.repoData?.downloads ?? 0), 0) ?? null,
        policyDocsTotal: policy?.count ?? null,
        researchWorksTotal: research?.message?.['total-results'] ?? null,
        fetchedAt: new Date().toISOString(),
      });
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [enabled]);

  return { live, loading };
}
