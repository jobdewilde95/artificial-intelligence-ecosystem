import * as Plot from '@observablehq/plot';
import type { Dataset } from '@/lib/data';
import { useTokens } from '@/lib/theme';
import { Figure, axes, leftMarginFor, LABEL_MAX } from '@/components/Figure';
import { MetricTile } from '@/components/MetricTile';
import { PageHeader, EmptyState } from '@/components/Panel';
import { integer, compact, shortDate, truncateLabel } from '@/lib/format';

export default function Research({ data }: { data: Dataset }) {
  const tokens = useTokens();
  const research = data.research?.data;
  const cap = data.capability?.data;
  const source = { name: data.research?.attribution.name ?? 'Crossref', url: data.research?.attribution.url };

  if (!research || !tokens) return <EmptyState what="Research data has not been collected yet." why="Run npm run refresh." />;

  const year = new Date().getUTCFullYear();
  const complete = research.byYear.filter((y) => y.year < year);
  const growth =
    complete.length >= 2
      ? complete[complete.length - 1].count / complete[0].count
      : null;

  const countries = (cap?.byCountry.slice(0, 12) ?? []).map((x) => ({ ...x, short: truncateLabel(x.country, LABEL_MAX) }));

  return (
    <div>
      <PageHeader
        eyebrow="Pillar 05"
        title="Research"
        lede="The publication record underneath the products. Counting papers is a crude measure of progress — volume is not insight — but it captures how many people are now working on this, and that number has changed by an order of magnitude."
      />

      <section className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <MetricTile label="Indexed works" value={research.totalMatching ? compact(research.totalMatching) : '—'} detail="matching AI search terms" accent={tokens.series[4]} />
        <MetricTile
          label={`Published ${year}`}
          value={compact(research.byYear.find((y) => y.year === year)?.count ?? null)}
          detail="year to date"
          accent={tokens.series[4]}
        />
        <MetricTile
          label="Growth since 2015"
          value={growth ? `${growth.toFixed(1)}×` : '—'}
          detail={complete.length >= 2 ? `${complete[0].year} to ${complete[complete.length - 1].year}` : '—'}
          accent={tokens.series[0]}
        />
        <MetricTile
          label="arXiv categories"
          value={research.byCategory.length ? integer(research.byCategory.length) : '—'}
          detail={research.byCategory.length ? 'AI-relevant categories tracked' : 'arXiv unreachable this run'}
          accent={tokens.series[2]}
        />
      </section>

      <div className="space-y-5">
        <Figure
          title="AI-related publications per year"
          subtitle="Crossref-indexed works matching artificial intelligence, machine learning, deep learning or large language model."
          height={320}
          source={source}
          note={`The current year (${year}) is incomplete, and indexing lags publication by months — the last one or two bars will rise after the fact. A bibliographic keyword search also catches applied papers that merely use AI methods, so read this as attention, not as frontier research output.`}
          plot={({ c }) => ({
            marginLeft: 56, marginBottom: 34,
            x: { label: null, tickFormat: 'd', ticks: research.byYear.map((r) => r.year).filter((_, i) => i % 2 === 0) },
            y: { label: 'Works indexed', tickFormat: (d: number) => compact(d), ...axes(c).grid },
            marks: [
              Plot.gridY({ stroke: c.grid, strokeOpacity: 1, strokeWidth: 1 }),
              Plot.rectY(research.byYear, {
                x: 'year', y: 'count',
                fill: (d: { year: number }) => (d.year === year ? c.muted : c.series[4]),
                insetLeft: 1, insetRight: 1, r: 2,
              }),
              Plot.ruleY([0], { stroke: c.baseline, strokeWidth: 1 }),
              Plot.tip(research.byYear, Plot.pointerX({
                x: 'year', y: 'count',
                title: (d: { year: number; count: number }) =>
                  `${d.year}\n${integer(d.count)} works${d.year === year ? '\n(year incomplete)' : ''}`,
              })),
            ],
          })}
          table={{
            columns: [
              { key: 'year', label: 'Year', value: (r) => r.year },
              { key: 'count', label: 'Works', align: 'right', value: (r) => integer(r.count) },
            ],
            rows: [...research.byYear].reverse(),
          }}
        />

        {research.byCategory.length > 0 && (
          <Figure
            title="arXiv volume by category"
            subtitle="All-time submissions in AI-relevant categories."
            height={280}
            source={{ name: 'arXiv', url: 'https://arxiv.org' }}
            plot={({ c }) => ({
              marginLeft: 160, marginBottom: 34,
              x: { label: 'Submissions', ...axes(c).grid },
              y: { label: null, domain: research.byCategory.map((b) => b.label) },
              marks: [
                Plot.gridX({ stroke: c.grid, strokeOpacity: 1, strokeWidth: 1 }),
                Plot.barX(research.byCategory, { x: 'count', y: 'label', fill: c.series[4], insetTop: 2, insetBottom: 2, r: 2, sort: { y: '-x' } }),
                Plot.ruleX([0], { stroke: c.baseline, strokeWidth: 1 }),
                Plot.tip(research.byCategory, Plot.pointerY({
                  x: 'count', y: 'label',
                  title: (d: { label: string; category: string; count: number }) => `${d.label} (${d.category})\n${integer(d.count)} submissions`,
                })),
              ],
            })}
            table={{
              columns: [
                { key: 'cat', label: 'Category', value: (r) => `${r.label} (${r.category})` },
                { key: 'count', label: 'Submissions', align: 'right', value: (r) => integer(r.count) },
              ],
              rows: research.byCategory,
            }}
          />
        )}

        {countries.length > 0 && (
          <Figure
            title="Notable models by country of origin"
            subtitle="Where the models in the notable-models corpus were built."
            height={300}
            source={{ name: data.capability?.attribution.name ?? 'Epoch AI', url: data.capability?.attribution.url }}
            note="Attributed to the organisation's home country, which understates multinational and distributed collaborations."
            plot={({ c }) => ({
              marginLeft: leftMarginFor(countries.map((b) => b.short)), marginBottom: 34,
              x: { label: 'Notable models', ...axes(c).grid },
              y: { label: null, domain: countries.map((b) => b.short) },
              marks: [
                Plot.gridX({ stroke: c.grid, strokeOpacity: 1, strokeWidth: 1 }),
                Plot.barX(countries, { x: 'count', y: 'short', fill: c.series[4], insetTop: 2, insetBottom: 2, r: 2, sort: { y: '-x' } }),
                Plot.ruleX([0], { stroke: c.baseline, strokeWidth: 1 }),
                Plot.tip(countries, Plot.pointerY({
                  x: 'count', y: 'short',
                  title: (d: (typeof countries)[number]) => `${d.country}\n${integer(d.count)} notable models`,
                })),
              ],
            })}
            table={{
              columns: [
                { key: 'country', label: 'Country', value: (r) => r.country },
                { key: 'count', label: 'Models', align: 'right', value: (r) => integer(r.count) },
              ],
              rows: cap?.byCountry ?? [],
            }}
          />
        )}

        {research.recent.length > 0 && (
          <section className="rounded-lg border border-hairline bg-surface p-4 sm:p-5">
            <h3 className="mb-1 text-sm font-semibold text-ink">Recently indexed works</h3>
            <p className="mb-3 text-xs text-ink-secondary">Newest Crossref records matching the AI query.</p>
            <ul className="space-y-2 text-xs">
              {research.recent.slice(0, 15).map((r, i) => (
                <li key={`${r.doi ?? i}`} className="border-b border-hairline/60 pb-2 last:border-0 last:pb-0">
                  <p className="text-ink">
                    {r.doi ? (
                      <a href={`https://doi.org/${r.doi}`} target="_blank" rel="noreferrer" className="underline underline-offset-2 hover:text-ink-secondary">{r.title}</a>
                    ) : r.title}
                  </p>
                  <p className="mt-0.5 text-ink-muted">
                    {shortDate(r.date)}{r.venue ? ` · ${r.venue}` : ''}
                  </p>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </div>
  );
}
