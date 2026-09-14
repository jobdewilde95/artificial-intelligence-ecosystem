import type {
  Snapshot, SourceHealth, CapabilityData, ComputeData, CapitalData,
  OpenSourceData, ResearchData, PolicyData, DiscourseData, CuratedData, MetricPoint,
} from '@/types';

const BASE = import.meta.env.BASE_URL;

async function loadSnapshot<T>(name: string): Promise<Snapshot<T> | null> {
  try {
    const res = await fetch(`${BASE}data/snapshots/${name}.json`);
    if (!res.ok) return null;
    return (await res.json()) as Snapshot<T>;
  } catch {
    return null;
  }
}

export interface Dataset {
  capability: Snapshot<CapabilityData> | null;
  compute: Snapshot<ComputeData> | null;
  capital: Snapshot<CapitalData> | null;
  opensource: Snapshot<OpenSourceData> | null;
  research: Snapshot<ResearchData> | null;
  policy: Snapshot<PolicyData> | null;
  discourse: Snapshot<DiscourseData> | null;
  curated: Snapshot<CuratedData> | null;
  health: SourceHealth[];
  history: MetricPoint[];
}

export async function loadDataset(): Promise<Dataset> {
  const [capability, compute, capital, opensource, research, policy, discourse, curated, health, history] =
    await Promise.all([
      loadSnapshot<CapabilityData>('epoch-models'),
      loadSnapshot<ComputeData>('epoch-compute'),
      loadSnapshot<CapitalData>('openrouter'),
      loadSnapshot<OpenSourceData>('opensource'),
      loadSnapshot<ResearchData>('research'),
      loadSnapshot<PolicyData>('policy'),
      loadSnapshot<DiscourseData>('discourse'),
      loadSnapshot<CuratedData>('curated'),
      fetch(`${BASE}data/snapshots/sources.json`)
        .then((r) => (r.ok ? (r.json() as Promise<SourceHealth[]>) : []))
        .catch(() => [] as SourceHealth[]),
      fetch(`${BASE}data/history/metrics.ndjson`)
        .then((r) => (r.ok ? r.text() : ''))
        .then((t) =>
          t
            .split('\n')
            .filter((l) => l.trim())
            .flatMap((l) => {
              try {
                return [JSON.parse(l) as MetricPoint];
              } catch {
                return [];
              }
            }),
        )
        .catch(() => [] as MetricPoint[]),
    ]);

  return { capability, compute, capital, opensource, research, policy, discourse, curated, health, history };
}

/** Time series for one metric, oldest first. */
export function seriesFor(history: MetricPoint[], metric: string): MetricPoint[] {
  return history.filter((p) => p.metric === metric).sort((a, b) => a.ts.localeCompare(b.ts));
}

export function latestValue(history: MetricPoint[], metric: string): number | null {
  const s = seriesFor(history, metric);
  return s.length ? s[s.length - 1].value : null;
}
