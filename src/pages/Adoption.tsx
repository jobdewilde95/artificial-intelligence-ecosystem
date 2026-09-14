import * as Plot from '@observablehq/plot';
import type { Dataset } from '@/lib/data';
import { useTokens } from '@/lib/theme';
import { Figure, axes, leftMarginFor } from '@/components/Figure';
import { MetricTile } from '@/components/MetricTile';
import { PageHeader, EmptyState } from '@/components/Panel';
import { integer, percent, shortDate } from '@/lib/format';

export default function Adoption({ data }: { data: Dataset }) {
  const tokens = useTokens();
  const discourse = data.discourse?.data;
  const indicators = data.curated?.data.adoption ?? [];
  const labs = data.curated?.data.labs ?? [];

  if (!tokens) return null;
  if (!discourse && !indicators.length) {
    return (
      <div>
        <PageHeader eyebrow="Pillar 08" title="Adoption & Impact" lede="Where AI has actually landed." />
        <EmptyState what="No adoption data yet." why="Run npm run refresh and add entries to data/curated/adoption.yaml." />
      </div>
    );
  }

  const labsByCountry = Object.entries(
    labs.reduce<Record<string, number>>((acc, l) => {
      acc[l.country] = (acc[l.country] ?? 0) + 1;
      return acc;
    }, {}),
  ).map(([country, count]) => ({ country, count })).sort((a, b) => b.count - a.count);

  const labsByCategory = Object.entries(
    labs.reduce<Record<string, number>>((acc, l) => {
      acc[l.category] = (acc[l.category] ?? 0) + 1;
      return acc;
    }, {}),
  ).map(([category, count]) => ({ category, count })).sort((a, b) => b.count - a.count);

  return (
    <div>
      <PageHeader
        eyebrow="Pillar 08"
        title="Adoption & Impact"
        lede="Who is actually using this, and what changed as a result. Adoption statistics are the least reliable numbers on this dashboard — executive surveys and firm-level censuses disagree by nearly an order of magnitude, and both are shown here rather than averaged into a false consensus."
      />

      <section className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <MetricTile
          label="AI share of HN front page"
          value={discourse?.aiShareOfFrontPage != null ? percent(discourse.aiShareOfFrontPage, 0) : '—'}
          detail={discourse ? `of ${integer(discourse.sampled)} sampled stories` : '—'}
          accent={tokens.series[7]}
        />
        <MetricTile label="Indicators tracked" value={integer(indicators.length)} detail="curated adoption measures" accent={tokens.series[0]} />
        <MetricTile label="Organizations profiled" value={integer(labs.length)} detail={`across ${labsByCountry.length} countries`} accent={tokens.series[2]} />
        <MetricTile
          label="Top AI story"
          value={discourse?.topStories[0] ? integer(discourse.topStories[0].score) : '—'}
          detail={discourse?.topStories[0] ? 'points on the current front page' : '—'}
          accent={tokens.series[1]}
        />
      </section>

      <div className="space-y-5">
        {indicators.length > 0 && (
          <section className="rounded-lg border border-hairline bg-surface p-4 sm:p-5">
            <h3 className="mb-1 text-sm font-semibold text-ink">Adoption indicators</h3>
            <p className="mb-4 text-xs text-ink-secondary">
              Each figure is a point-in-time reading from a named source. They measure different populations and are not
              directly comparable — that disagreement is the point.
            </p>
            <ul className="space-y-4">
              {[...indicators].sort((a, b) => b.asOf.localeCompare(a.asOf)).map((ind) => (
                <li key={ind.label} className="border-b border-hairline/60 pb-4 last:border-0 last:pb-0">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <span className="text-sm text-ink">{ind.label}</span>
                    <span className="text-lg font-semibold tnum text-ink">
                      {ind.value}
                      <span className="ml-0.5 text-xs font-normal text-ink-secondary">{ind.unit}</span>
                    </span>
                  </div>
                  <div className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-raised">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${Math.min(100, ind.unit === '%' ? ind.value : 100)}%`,
                        background: tokens.series[0],
                      }}
                    />
                  </div>
                  <p className="mt-1.5 text-[11px] leading-relaxed text-ink-muted">
                    {shortDate(ind.asOf)} ·{' '}
                    {ind.url ? (
                      <a href={ind.url} target="_blank" rel="noreferrer" className="underline underline-offset-2 hover:text-ink-secondary">{ind.source}</a>
                    ) : ind.source}
                    {' '}· {ind.note}
                  </p>
                </li>
              ))}
            </ul>
          </section>
        )}

        <div className="grid gap-5 xl:grid-cols-2">
          {labsByCountry.length > 0 && (
            <Figure
              title="Profiled organizations by country"
              subtitle="Where the tracked labs, chipmakers and infrastructure providers sit."
              height={280}
              source={{ name: 'Curated — data/curated/labs.yaml' }}
              plot={({ c }) => ({
                marginLeft: leftMarginFor(labsByCountry.map((r) => r.country)), marginBottom: 34,
                x: { label: 'Organizations', ...axes(c).grid },
                y: { label: null, domain: labsByCountry.map((r) => r.country) },
                marks: [
                  Plot.gridX({ stroke: c.grid, strokeOpacity: 1, strokeWidth: 1 }),
                  Plot.barX(labsByCountry, { x: 'count', y: 'country', fill: c.series[2], insetTop: 2, insetBottom: 2, r: 2, sort: { y: '-x' } }),
                  Plot.ruleX([0], { stroke: c.baseline, strokeWidth: 1 }),
                  Plot.tip(labsByCountry, Plot.pointerY({ x: 'count', y: 'country', title: (d: { country: string; count: number }) => `${d.country}\n${d.count} organizations` })),
                ],
              })}
              table={{
                columns: [
                  { key: 'country', label: 'Country', value: (r) => r.country },
                  { key: 'count', label: 'Organizations', align: 'right', value: (r) => integer(r.count) },
                ],
                rows: labsByCountry,
              }}
            />
          )}

          {labsByCategory.length > 0 && (
            <Figure
              title="By role in the ecosystem"
              subtitle="Frontier labs, big tech, open-source, research, chips and infrastructure."
              height={280}
              source={{ name: 'Curated — data/curated/labs.yaml' }}
              plot={({ c }) => ({
                marginLeft: leftMarginFor(labsByCategory.map((r) => r.category), 120), marginBottom: 34,
                x: { label: 'Organizations', ...axes(c).grid },
                y: { label: null, domain: labsByCategory.map((r) => r.category) },
                marks: [
                  Plot.gridX({ stroke: c.grid, strokeOpacity: 1, strokeWidth: 1 }),
                  Plot.barX(labsByCategory, { x: 'count', y: 'category', fill: c.series[0], insetTop: 2, insetBottom: 2, r: 2, sort: { y: '-x' } }),
                  Plot.ruleX([0], { stroke: c.baseline, strokeWidth: 1 }),
                  Plot.tip(labsByCategory, Plot.pointerY({ x: 'count', y: 'category', title: (d: { category: string; count: number }) => `${d.category}\n${d.count} organizations` })),
                ],
              })}
              table={{
                columns: [
                  { key: 'cat', label: 'Role', value: (r) => r.category },
                  { key: 'count', label: 'Organizations', align: 'right', value: (r) => integer(r.count) },
                ],
                rows: labsByCategory,
              }}
            />
          )}
        </div>

        {discourse && discourse.topStories.length > 0 && (
          <section className="rounded-lg border border-hairline bg-surface p-4 sm:p-5">
            <h3 className="mb-1 text-sm font-semibold text-ink">What developers are reading</h3>
            <p className="mb-3 text-xs text-ink-secondary">
              AI-related stories on the Hacker News front page at collection time — {percent(discourse.aiShareOfFrontPage ?? 0, 0)} of {integer(discourse.sampled)} sampled.
              A rough attention proxy, matched by keyword.
            </p>
            <ol className="space-y-2 text-xs">
              {discourse.topStories.slice(0, 15).map((s) => (
                <li key={s.title} className="flex items-baseline gap-3 border-b border-hairline/60 pb-2 last:border-0 last:pb-0">
                  <span className="w-9 shrink-0 text-right tnum text-ink-muted">{s.score}</span>
                  <span className="min-w-0 text-ink">
                    {s.url ? (
                      <a href={s.url} target="_blank" rel="noreferrer" className="underline underline-offset-2 hover:text-ink-secondary">{s.title}</a>
                    ) : s.title}
                  </span>
                </li>
              ))}
            </ol>
          </section>
        )}

        {labs.length > 0 && (
          <section className="rounded-lg border border-hairline bg-surface p-4 sm:p-5">
            <h3 className="mb-1 text-sm font-semibold text-ink">Organization profiles</h3>
            <p className="mb-3 text-xs text-ink-secondary">
              Curated in <code className="rounded bg-raised px-1">data/curated/labs.yaml</code> — {integer(labs.length)} organizations.
            </p>
            <div className="max-h-[440px] overflow-auto">
              <table className="w-full min-w-[620px] text-xs">
                <thead className="sticky top-0 bg-surface">
                  <tr className="border-b border-hairline text-left text-ink-secondary">
                    <th scope="col" className="py-2 pr-3 font-medium">Organization</th>
                    <th scope="col" className="py-2 pr-3 font-medium">Country</th>
                    <th scope="col" className="py-2 pr-3 font-medium">Role</th>
                    <th scope="col" className="py-2 pr-3 text-right font-medium">Founded</th>
                    <th scope="col" className="py-2 pr-3 font-medium">Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {[...labs].sort((a, b) => a.name.localeCompare(b.name)).map((l) => (
                    <tr key={l.id} className="border-b border-hairline/60 last:border-0">
                      <td className="py-2 pr-3 align-top text-ink">
                        {l.url ? <a href={l.url} target="_blank" rel="noreferrer" className="underline underline-offset-2 hover:text-ink-secondary">{l.name}</a> : l.name}
                      </td>
                      <td className="py-2 pr-3 align-top text-ink-secondary">{l.country}</td>
                      <td className="py-2 pr-3 align-top capitalize text-ink-secondary">{l.category}</td>
                      <td className="py-2 pr-3 text-right align-top tnum text-ink-secondary">{l.founded ?? '—'}</td>
                      <td className="py-2 pr-3 align-top leading-relaxed text-ink-muted">{l.notes}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
