import * as Plot from '@observablehq/plot';
import type { Dataset } from '@/lib/data';
import { useTokens } from '@/lib/theme';
import { Figure, axes, leftMarginFor, LABEL_MAX } from '@/components/Figure';
import { MetricTile } from '@/components/MetricTile';
import { PageHeader, EmptyState } from '@/components/Panel';
import { integer, compact, shortDate, truncateLabel } from '@/lib/format';

export default function OpenSource({ data }: { data: Dataset }) {
  const tokens = useTokens();
  const os = data.opensource?.data;
  const cap = data.capability?.data;
  const source = { name: data.opensource?.attribution.name ?? 'GitHub & Hugging Face', url: data.opensource?.attribution.url };

  if (!os || !tokens) return <EmptyState what="Open-source data has not been collected yet." why="Run npm run refresh." />;

  const repos = os.repos;
  const byCategory = repos.reduce<Record<string, { category: string; stars: number; repos: number }>>((acc, r) => {
    const cur = acc[r.category] ?? { category: r.category, stars: 0, repos: 0 };
    cur.stars += r.stars;
    cur.repos += 1;
    acc[r.category] = cur;
    return acc;
  }, {});
  const categoryRows = Object.values(byCategory).sort((a, b) => b.stars - a.stars);

  const openByYear = (cap?.byYear ?? []).filter((y) => y.year >= 2018 && y.count > 0)
    .map((y) => ({ ...y, openShare: y.count ? y.openWeightCount / y.count : 0 }));

  return (
    <div>
      <PageHeader
        eyebrow="Pillar 04"
        title="Open Source & Developers"
        lede="The part of the stack anyone can pick up: open-weight models, the inference and training tooling around them, and what builders are actually downloading this week."
      />

      <section className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <MetricTile
          label="Repos tracked"
          value={integer(repos.length)}
          detail={repos.length ? `${compact(repos.reduce((s, r) => s + r.stars, 0))} stars combined` : 'populates on first CI run'}
          accent={tokens.series[3]}
        />
        <MetricTile label="Trending Hub models" value={integer(os.hub.topTrending.length)} detail="currently trending on Hugging Face" accent={tokens.series[3]} />
        <MetricTile
          label="Open-weight models"
          value={cap ? integer(cap.models.filter((m) => m.openWeights === true).length) : '—'}
          detail="in the notable-models corpus"
          accent={tokens.series[1]}
        />
        <MetricTile
          label="Trending orgs"
          value={integer(os.hub.trendingAuthors.length)}
          detail={os.hub.trendingAuthors[0] ? `led by ${os.hub.trendingAuthors[0].author}` : '—'}
          accent={tokens.series[2]}
        />
      </section>

      {repos.length === 0 && (
        <div className="mb-5 rounded-lg border border-hairline bg-surface p-4 text-xs leading-relaxed text-ink-secondary">
          <span aria-hidden style={{ color: 'var(--status-warning)' }}>▲</span>{' '}
          <strong className="text-ink">GitHub repository statistics are empty.</strong> The collector requests
          <code className="mx-1 rounded bg-raised px-1">api.github.com/repos/…</code> for each tracked project, which needs a
          token with public read access. It populates automatically on the first scheduled run in GitHub Actions, where
          <code className="mx-1 rounded bg-raised px-1">GITHUB_TOKEN</code> is provided. Hugging Face data below is unaffected.
        </div>
      )}

      <div className="space-y-5">
        {repos.length > 0 && (
          <>
            <Figure
              title="Tracked projects by stars"
              subtitle="A curated set of projects the ecosystem actually builds on, not a popularity ranking."
              height={420}
              source={source}
              plot={({ c }) => {
                const rows = repos.slice(0, 20).map((r) => ({ ...r, short: truncateLabel(r.fullName, LABEL_MAX) }));
                return {
                  marginLeft: leftMarginFor(rows.map((r) => r.short)), marginBottom: 34,
                  x: { label: 'Stars', tickFormat: (d: number) => compact(d), ...axes(c).grid },
                  y: { label: null, domain: rows.map((r) => r.short) },
                  marks: [
                    Plot.gridX({ stroke: c.grid, strokeOpacity: 1, strokeWidth: 1 }),
                    Plot.barX(rows, { x: 'stars', y: 'short', fill: c.series[3], insetTop: 2, insetBottom: 2, r: 2, sort: { y: '-x' } }),
                    Plot.ruleX([0], { stroke: c.baseline, strokeWidth: 1 }),
                    Plot.tip(rows, Plot.pointerY({
                      x: 'stars', y: 'short',
                      title: (d: (typeof rows)[number]) =>
                        `${d.fullName}\n${d.category}\n${integer(d.stars)} stars · ${integer(d.forks)} forks\nlast push ${shortDate(d.pushedAt)}`,
                    })),
                  ],
                };
              }}
              table={{
                columns: [
                  { key: 'repo', label: 'Repository', value: (r) => r.fullName },
                  { key: 'cat', label: 'Category', value: (r) => r.category },
                  { key: 'stars', label: 'Stars', align: 'right', value: (r) => integer(r.stars) },
                  { key: 'forks', label: 'Forks', align: 'right', value: (r) => integer(r.forks) },
                  { key: 'push', label: 'Last push', value: (r) => shortDate(r.pushedAt) },
                ],
                rows: repos,
              }}
            />

            <Figure
              title="Where the open stack's gravity sits"
              subtitle="Combined stars by layer of the stack."
              height={280}
              source={source}
              plot={({ c }) => ({
                marginLeft: leftMarginFor(categoryRows.map((r) => r.category)), marginBottom: 34,
                x: { label: 'Combined stars', tickFormat: (d: number) => compact(d), ...axes(c).grid },
                y: { label: null, domain: categoryRows.map((r) => r.category) },
                marks: [
                  Plot.gridX({ stroke: c.grid, strokeOpacity: 1, strokeWidth: 1 }),
                  Plot.barX(categoryRows, { x: 'stars', y: 'category', fill: c.series[3], insetTop: 2, insetBottom: 2, r: 2, sort: { y: '-x' } }),
                  Plot.ruleX([0], { stroke: c.baseline, strokeWidth: 1 }),
                  Plot.tip(categoryRows, Plot.pointerY({
                    x: 'stars', y: 'category',
                    title: (d: (typeof categoryRows)[number]) => `${d.category}\n${integer(d.stars)} stars across ${d.repos} repos`,
                  })),
                ],
              })}
              table={{
                columns: [
                  { key: 'cat', label: 'Category', value: (r) => r.category },
                  { key: 'repos', label: 'Repos', align: 'right', value: (r) => integer(r.repos) },
                  { key: 'stars', label: 'Stars', align: 'right', value: (r) => integer(r.stars) },
                ],
                rows: categoryRows,
              }}
            />
          </>
        )}

        {openByYear.length > 1 && (
          <Figure
            title="Open-weight share of notable models"
            subtitle="Proportion of each year's notable models released with open weights."
            height={280}
            source={{ name: data.capability?.attribution.name ?? 'Epoch AI', url: data.capability?.attribution.url }}
            note="Only models with a recorded weight-availability status count toward the share; models with no stated licence are treated as not open."
            plot={({ c }) => ({
              marginLeft: 52, marginBottom: 34,
              x: { label: null, tickFormat: 'd' },
              y: {
                label: 'Share with open weights',
                domain: [0, 1],
                tickFormat: (d: number) => `${Math.round(d * 100)}%`,
                ...axes(c).grid,
              },
              marks: [
                Plot.gridY({ stroke: c.grid, strokeOpacity: 1, strokeWidth: 1 }),
                Plot.areaY(openByYear, { x: 'year', y: 'openShare', fill: c.series[1], fillOpacity: 0.1, curve: 'monotone-x' }),
                Plot.line(openByYear, { x: 'year', y: 'openShare', stroke: c.series[1], strokeWidth: 2, curve: 'monotone-x' }),
                Plot.dot(openByYear.slice(-1), { x: 'year', y: 'openShare', fill: c.series[1], r: 4, stroke: c.surface, strokeWidth: 2 }),
                Plot.ruleY([0], { stroke: c.baseline, strokeWidth: 1 }),
                Plot.tip(openByYear, Plot.pointerX({
                  x: 'year', y: 'openShare',
                  title: (d: (typeof openByYear)[number]) => `${d.year}\n${(d.openShare * 100).toFixed(0)}% open weights\n${d.openWeightCount} of ${d.count} models`,
                })),
              ],
            })}
            table={{
              columns: [
                { key: 'year', label: 'Year', value: (r) => r.year },
                { key: 'open', label: 'Open weights', align: 'right', value: (r) => integer(r.openWeightCount) },
                { key: 'total', label: 'Total', align: 'right', value: (r) => integer(r.count) },
                { key: 'share', label: 'Share', align: 'right', value: (r) => `${(r.openShare * 100).toFixed(0)}%` },
              ],
              rows: [...openByYear].reverse(),
            }}
          />
        )}

        <div className="grid gap-5 xl:grid-cols-2">
          <section className="rounded-lg border border-hairline bg-surface p-4 sm:p-5">
            <h3 className="mb-1 text-sm font-semibold text-ink">Most downloaded on the Hub</h3>
            <p className="mb-3 text-xs text-ink-secondary">All-time download leaders — heavily weighted toward small utility models.</p>
            <ol className="space-y-1.5 text-xs">
              {os.hub.topDownloaded.slice(0, 12).map((m, i) => (
                <li key={m.id} className="flex items-baseline justify-between gap-3">
                  <span className="min-w-0 truncate text-ink">
                    <span className="mr-2 tnum text-ink-muted">{i + 1}</span>
                    <a href={`https://huggingface.co/${m.id}`} target="_blank" rel="noreferrer" className="underline underline-offset-2 hover:text-ink-secondary">{m.id}</a>
                  </span>
                  <span className="shrink-0 tnum text-ink-secondary">{compact(m.downloads)}</span>
                </li>
              ))}
            </ol>
          </section>

          <section className="rounded-lg border border-hairline bg-surface p-4 sm:p-5">
            <h3 className="mb-1 text-sm font-semibold text-ink">Trending right now</h3>
            <p className="mb-3 text-xs text-ink-secondary">What the Hub is surfacing today — the closest thing to a live pulse on open releases.</p>
            <ol className="space-y-1.5 text-xs">
              {os.hub.topTrending.slice(0, 12).map((m, i) => (
                <li key={m.id} className="flex items-baseline justify-between gap-3">
                  <span className="min-w-0 truncate text-ink">
                    <span className="mr-2 tnum text-ink-muted">{i + 1}</span>
                    <a href={`https://huggingface.co/${m.id}`} target="_blank" rel="noreferrer" className="underline underline-offset-2 hover:text-ink-secondary">{m.id}</a>
                  </span>
                  <span className="shrink-0 tnum text-ink-secondary">{compact(m.downloads)}</span>
                </li>
              ))}
            </ol>
          </section>
        </div>
      </div>
    </div>
  );
}
