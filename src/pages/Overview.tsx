import { Link } from 'react-router-dom';
import * as Plot from '@observablehq/plot';
import type { Dataset } from '@/lib/data';
import type { LiveValues } from '@/lib/live';
import { PILLARS } from '@/lib/pillars';
import { useTokens } from '@/lib/theme';
import { MetricTile } from '@/components/MetricTile';
import { Figure, axes } from '@/components/Figure';
import { PageHeader } from '@/components/Panel';
import { compact, integer, usd, flops, percent, shortDate } from '@/lib/format';

interface Props {
  data: Dataset;
  live: LiveValues;
  liveEnabled: boolean;
}

export default function Overview({ data, live, liveEnabled }: Props) {
  const tokens = useTokens();
  const year = new Date().getUTCFullYear();

  const cap = data.capability?.data;
  const comp = data.compute?.data;
  const capital = data.capital?.data;
  const policy = data.policy?.data;
  const research = data.research?.data;
  const curated = data.curated?.data;

  const thisYear = cap?.byYear.find((y) => y.year === year);
  const allCompute = cap?.byYear.map((y) => y.maxComputeFlop).filter((n): n is number => n != null) ?? [];
  const peakCompute = allCompute.length ? Math.max(...allCompute) : null;

  // Live values override the snapshot where the browser could reach the API.
  const servedModels = (liveEnabled ? live.servedModels : null) ?? capital?.servedModels.length ?? null;
  const cheapest = (liveEnabled ? live.cheapestUsdPerMTok : null) ?? capital?.priceStats.minPromptUsdPerMTok ?? null;
  const isLive = liveEnabled && live.servedModels != null;

  const policyThisYear = policy?.byYear.find((y) => y.year === year)?.count ?? null;
  const researchThisYear = research?.byYear.find((y) => y.year === year)?.count ?? null;

  return (
    <div>
      <PageHeader
        eyebrow="Situation room"
        title="The AI ecosystem, as currently measured"
        lede="A broad reading of where artificial intelligence stands — capability and compute, the capital behind them, the open-source commons, the research record, and the policy, safety and adoption consequences. Every panel names its source and its age."
      />

      <section aria-label="Headline indicators" className="mb-8 grid grid-cols-2 gap-3 lg:grid-cols-3">
        <MetricTile
          label={`Notable models, ${year}`}
          value={thisYear ? integer(thisYear.count) : '—'}
          detail={
            !thisYear
              ? 'No entries yet this year'
              : thisYear.frontierCount > 0
                ? `${integer(thisYear.frontierCount)} flagged frontier`
                : `${integer(thisYear.openWeightCount)} with open weights`
          }
          hint={thisYear && thisYear.frontierCount === 0 ? 'Frontier flags are assigned in retrospect' : undefined}
          to="/capability"
          accent={tokens?.series[0]}
        />
        <MetricTile
          label="Largest known training run"
          value={peakCompute ? flops(peakCompute) : '—'}
          detail="Peak disclosed training compute"
          to="/capability"
          accent={tokens?.series[0]}
        />
        <MetricTile
          label="Largest disclosed cluster"
          value={comp?.largest?.h100Equivalents ? `${compact(comp.largest.h100Equivalents)} H100e` : '—'}
          detail={comp?.largest ? comp.largest.name : 'No cluster data'}
          to="/compute"
          accent={tokens?.series[1]}
        />
        <MetricTile
          label="Cheapest paid inference"
          value={cheapest != null ? `${usd(cheapest)}/Mtok` : '—'}
          detail={`Across ${integer(servedModels)} served models`}
          hint={isLive ? 'Live from OpenRouter' : undefined}
          to="/capital"
          accent={tokens?.series[2]}
        />
        <MetricTile
          label={`US AI policy actions, ${year}`}
          value={policyThisYear != null ? integer(policyThisYear) : '—'}
          detail="Federal Register documents about AI"
          to="/policy"
          accent={tokens?.series[5]}
        />
        <MetricTile
          label={`AI research works, ${year}`}
          value={researchThisYear != null ? compact(researchThisYear) : '—'}
          detail="Crossref-indexed publications"
          to="/research"
          accent={tokens?.series[4]}
        />
      </section>

      {cap && cap.byYear.length > 1 && tokens && (
        <div className="mb-8">
          <Figure
            title="Training compute of notable models, by year"
            subtitle="Peak and median across models with a published compute estimate. Log scale — each gridline is 10× the one below."
            height={320}
            source={{ name: data.capability?.attribution.name ?? 'Epoch AI', url: data.capability?.attribution.url }}
            note="Only models Epoch has a compute estimate for are plotted; coverage thins for the most recent months as estimates are researched."
            legend={[
              { label: 'Peak in year', color: tokens.series[0] },
              { label: 'Median in year', color: tokens.series[1] },
            ]}
            plot={({ c }) => {
              const rows = cap.byYear.filter((y) => y.maxComputeFlop != null && y.year >= 2012);
              const lows = rows.map((r) => r.medianComputeFlop ?? r.maxComputeFlop!).filter(Boolean);
              const highs = rows.map((r) => r.maxComputeFlop!);
              return {
                marginLeft: 62,
                marginBottom: 34,
                // Domain is pinned to the data. A ruleY baseline would drag a
                // log scale down to 1 and squash every point into the top.
                x: { label: null, tickFormat: 'd', ticks: rows.filter((_, i) => i % 2 === 0).map((r) => r.year) },
                y: {
                  type: 'log',
                  label: 'Training compute (FLOP)',
                  domain: [Math.min(...lows) / 3, Math.max(...highs) * 3],
                  ...axes(c).grid,
                  tickFormat: (d: number) => `1e${Math.round(Math.log10(d))}`,
                },
                marks: [
                  Plot.gridY({ stroke: c.grid, strokeOpacity: 1, strokeWidth: 1 }),
                  Plot.line(rows, { x: 'year', y: 'maxComputeFlop', stroke: c.series[0], strokeWidth: 2, curve: 'monotone-x' }),
                  Plot.line(rows.filter((r) => r.medianComputeFlop != null), {
                    x: 'year', y: 'medianComputeFlop', stroke: c.series[1], strokeWidth: 2, curve: 'monotone-x',
                  }),
                  Plot.dot(rows, { x: 'year', y: 'maxComputeFlop', fill: c.series[0], r: 4, stroke: c.surface, strokeWidth: 2 }),
                  Plot.tip(rows, Plot.pointerX({
                    x: 'year', y: 'maxComputeFlop',
                    title: (d: (typeof rows)[number]) =>
                      `${d.year}\nPeak: ${flops(d.maxComputeFlop)}\nMedian: ${flops(d.medianComputeFlop)}\nModels: ${d.count}`,
                  })),
                ],
              };
            }}
            table={{
              columns: [
                { key: 'year', label: 'Year', value: (r) => r.year },
                { key: 'count', label: 'Models', align: 'right', value: (r) => integer(r.count) },
                { key: 'frontier', label: 'Frontier', align: 'right', value: (r) => integer(r.frontierCount) },
                { key: 'max', label: 'Peak compute', align: 'right', value: (r) => flops(r.maxComputeFlop) },
                { key: 'median', label: 'Median compute', align: 'right', value: (r) => flops(r.medianComputeFlop) },
              ],
              rows: [...cap.byYear].reverse(),
            }}
          />
        </div>
      )}

      <h2 className="mb-3 text-sm font-semibold text-ink">The eight pillars</h2>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {PILLARS.map((pillar) => {
          const color = tokens?.series[pillar.slot];
          let stat = '—';
          let detail = pillar.tagline;

          switch (pillar.id) {
            case 'capability':
              stat = cap ? integer(cap.models.length) : '—';
              detail = `notable models tracked, ${cap?.byCountry.length ?? 0} countries`;
              break;
            case 'compute':
              stat = comp ? integer(comp.clusters.length) : '—';
              detail = `disclosed clusters, ${compact(comp?.byCountry.reduce((s, x) => s + x.h100Equivalents, 0) ?? 0)} H100e total`;
              break;
            case 'capital':
              stat = capital ? integer(capital.providerCount) : '—';
              detail = `providers serving ${integer(capital?.servedModels.length ?? 0)} models`;
              break;
            case 'opensource':
              stat = data.opensource ? integer(data.opensource.data.hub.topTrending.length) : '—';
              detail = data.opensource?.data.repos.length
                ? `trending models · ${integer(data.opensource.data.repos.length)} repos tracked`
                : 'trending Hub models (repo stats pending first CI run)';
              break;
            case 'research':
              stat = research?.totalMatching ? compact(research.totalMatching) : '—';
              detail = 'Crossref works matching AI terms';
              break;
            case 'policy':
              stat = policy ? integer(policy.documents.length) : '—';
              detail = `federal actions about AI · ${curated?.policyMilestones.length ?? 0} global milestones`;
              break;
            case 'safety':
              stat = curated ? integer(curated.safetyEvents.length) : '—';
              detail = 'incidents, evaluations and frameworks';
              break;
            case 'adoption':
              stat = data.discourse?.data.aiShareOfFrontPage != null
                ? percent(data.discourse.data.aiShareOfFrontPage, 0)
                : '—';
              detail = 'of Hacker News front page is AI-related';
              break;
          }

          return (
            <Link
              key={pillar.id}
              to={pillar.path}
              className="group rounded-lg border border-hairline bg-surface p-4 transition-colors hover:border-ink-muted/40"
            >
              <div className="flex items-center gap-2">
                <span aria-hidden className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: color }} />
                <span className="text-[11px] font-medium uppercase tracking-wide text-ink-muted">{pillar.name}</span>
              </div>
              <div className="mt-2 text-xl font-semibold leading-none text-ink">{stat}</div>
              <p className="mt-1.5 text-xs leading-relaxed text-ink-secondary">{detail}</p>
              <p className="mt-2 text-[11px] italic leading-relaxed text-ink-muted">{pillar.question}</p>
            </Link>
          );
        })}
      </div>

      {data.curated && curated && curated.policyMilestones.length > 0 && (
        <section className="mt-8">
          <h2 className="mb-3 text-sm font-semibold text-ink">Recent milestones</h2>
          <ol className="space-y-2">
            {[...curated.policyMilestones, ]
              .sort((a, b) => b.date.localeCompare(a.date))
              .slice(0, 5)
              .map((m) => (
                <li key={`${m.date}-${m.title}`} className="flex gap-3 rounded-lg border border-hairline bg-surface p-3">
                  <span className="w-24 shrink-0 text-xs tnum text-ink-muted">{shortDate(m.date)}</span>
                  <div className="min-w-0">
                    <p className="text-sm text-ink">
                      {m.url ? (
                        <a href={m.url} target="_blank" rel="noreferrer" className="underline underline-offset-2 hover:text-ink-secondary">{m.title}</a>
                      ) : m.title}
                    </p>
                    <p className="mt-0.5 text-xs text-ink-secondary">{m.jurisdiction} · {m.summary}</p>
                  </div>
                </li>
              ))}
          </ol>
        </section>
      )}
    </div>
  );
}
