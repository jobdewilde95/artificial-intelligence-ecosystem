import * as Plot from '@observablehq/plot';
import type { Dataset } from '@/lib/data';
import { useTokens } from '@/lib/theme';
import { Figure, axes, leftMarginFor, LABEL_MAX } from '@/components/Figure';
import { MetricTile } from '@/components/MetricTile';
import { PageHeader, EmptyState } from '@/components/Panel';
import { integer, compact, shortDate, truncateLabel } from '@/lib/format';

export default function Compute({ data }: { data: Dataset }) {
  const tokens = useTokens();
  const comp = data.compute?.data;
  const source = { name: data.compute?.attribution.name ?? 'Epoch AI', url: data.compute?.attribution.url };

  if (!comp || !tokens) return <EmptyState what="Compute data has not been collected yet." why="Run npm run refresh." />;

  const totalH100 = comp.byCountry.reduce((s, c) => s + c.h100Equivalents, 0);
  const existing = comp.clusters.filter((c) => (c.status ?? '').toLowerCase() === 'existing');
  const topClusters = [...comp.clusters]
    .filter((c) => c.h100Equivalents != null)
    .sort((a, b) => (b.h100Equivalents ?? 0) - (a.h100Equivalents ?? 0))
    .slice(0, 15);

  const countries = comp.byCountry.slice(0, 12);
  const countryRows = countries.map((x) => ({ ...x, short: truncateLabel(x.country, LABEL_MAX) }));
  const owners = comp.byOwner.filter((o) => o.owner.trim()).slice(0, 12);
  const ownerRows = owners.map((o) => ({ ...o, short: truncateLabel(o.owner, LABEL_MAX) }));
  const cumulative = comp.byYear
    .filter((y) => y.year >= 2015)
    .reduce<Array<{ year: number; h100Equivalents: number; cumulative: number; count: number }>>((acc, y) => {
      const prior = acc.length ? acc[acc.length - 1].cumulative : 0;
      acc.push({ ...y, cumulative: prior + y.h100Equivalents });
      return acc;
    }, []);

  return (
    <div>
      <PageHeader
        eyebrow="Pillar 02"
        title="Compute & Infrastructure"
        lede="The physical substrate underneath every model: where the large clusters are, who owns them, and how fast aggregate capacity is being built. Measured in H100-equivalents so that chip generations can be compared on one scale."
      />

      <section className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <MetricTile label="Disclosed clusters" value={integer(comp.clusters.length)} detail={`${integer(existing.length)} listed as existing`} accent={tokens.series[1]} />
        <MetricTile label="Aggregate capacity" value={`${compact(totalH100)} H100e`} detail="across all tracked clusters" accent={tokens.series[1]} />
        <MetricTile
          label="Largest single cluster"
          value={comp.largest?.h100Equivalents ? `${compact(comp.largest.h100Equivalents)} H100e` : '—'}
          detail={comp.largest?.name ?? '—'}
          accent={tokens.series[0]}
        />
        <MetricTile label="Countries with clusters" value={integer(comp.byCountry.length)} detail="hosting at least one" accent={tokens.series[2]} />
      </section>

      <div className="space-y-5">
        <Figure
          title="Largest disclosed AI clusters"
          subtitle="By H100-equivalent capacity."
          height={360}
          source={source}
          note="Epoch tracks publicly disclosed or credibly reported systems. Private clusters that have never been described are necessarily absent, so this is a floor, not a census."
          plot={({ c }) => {
            const labelled = topClusters.map((t) => ({ ...t, short: truncateLabel(t.name, LABEL_MAX) }));
            return {
            marginLeft: leftMarginFor(labelled.map((l) => l.short)), marginBottom: 34,
            x: { label: 'H100-equivalents', tickFormat: (d: number) => compact(d), ...axes(c).grid },
            y: { label: null, domain: labelled.map((t) => t.short) },
            marks: [
              Plot.gridX({ stroke: c.grid, strokeOpacity: 1, strokeWidth: 1 }),
              Plot.barX(labelled, { x: 'h100Equivalents', y: 'short', fill: c.series[1], insetTop: 2, insetBottom: 2, r: 2, sort: { y: '-x' } }),
              Plot.ruleX([0], { stroke: c.baseline, strokeWidth: 1 }),
              Plot.tip(labelled, Plot.pointerY({
                x: 'h100Equivalents', y: 'short',
                title: (d: (typeof labelled)[number]) =>
                  `${d.name}\n${d.owner || 'Owner undisclosed'}\n${d.country || 'Country unknown'}\n${compact(d.h100Equivalents)} H100e\n${d.chipType || 'chip unknown'}${d.chipQuantity ? ` ×${integer(d.chipQuantity)}` : ''}\n${d.status ?? ''}`,
              })),
            ],
          };
          }}
          table={{
            columns: [
              { key: 'name', label: 'Cluster', value: (r) => r.name },
              { key: 'owner', label: 'Owner', value: (r) => r.owner ?? '—' },
              { key: 'country', label: 'Country', value: (r) => r.country ?? '—' },
              { key: 'h100', label: 'H100e', align: 'right', value: (r) => compact(r.h100Equivalents) },
              { key: 'chip', label: 'Chip', value: (r) => r.chipType ?? '—' },
              { key: 'status', label: 'Status', value: (r) => r.status ?? '—' },
            ],
            rows: [...comp.clusters].filter((c) => c.h100Equivalents != null).sort((a, b) => (b.h100Equivalents ?? 0) - (a.h100Equivalents ?? 0)).slice(0, 100),
          }}
        />

        <div className="grid gap-5 xl:grid-cols-2">
          <Figure
            title="Capacity by country"
            subtitle="Summed H100-equivalents of clusters located in each country."
            height={300}
            source={source}
            plot={({ c }) => ({
              marginLeft: leftMarginFor(countryRows.map((t) => t.short)), marginBottom: 34,
              x: { label: 'H100-equivalents', tickFormat: (d: number) => compact(d), ...axes(c).grid },
              y: { label: null, domain: countryRows.map((t) => t.short) },
              marks: [
                Plot.gridX({ stroke: c.grid, strokeOpacity: 1, strokeWidth: 1 }),
                Plot.barX(countryRows, { x: 'h100Equivalents', y: 'short', fill: c.series[1], insetTop: 2, insetBottom: 2, r: 2, sort: { y: '-x' } }),
                Plot.ruleX([0], { stroke: c.baseline, strokeWidth: 1 }),
                Plot.tip(countryRows, Plot.pointerY({
                  x: 'h100Equivalents', y: 'short',
                  title: (d: (typeof countryRows)[number]) => `${d.country}\n${compact(d.h100Equivalents)} H100e\n${d.count} clusters`,
                })),
              ],
            })}
            table={{
              columns: [
                { key: 'country', label: 'Country', value: (r) => r.country },
                { key: 'clusters', label: 'Clusters', align: 'right', value: (r) => integer(r.count) },
                { key: 'h100', label: 'H100e', align: 'right', value: (r) => compact(r.h100Equivalents) },
              ],
              rows: comp.byCountry,
            }}
          />

          <Figure
            title="Capacity by owner"
            subtitle="Named owners only; many clusters are reported without one."
            height={300}
            source={source}
            plot={({ c }) => ({
              marginLeft: leftMarginFor(ownerRows.map((t) => t.short)), marginBottom: 34,
              x: { label: 'H100-equivalents', tickFormat: (d: number) => compact(d), ...axes(c).grid },
              y: { label: null, domain: ownerRows.map((t) => t.short) },
              marks: [
                Plot.gridX({ stroke: c.grid, strokeOpacity: 1, strokeWidth: 1 }),
                Plot.barX(ownerRows, { x: 'h100Equivalents', y: 'short', fill: c.series[2], insetTop: 2, insetBottom: 2, r: 2, sort: { y: '-x' } }),
                Plot.ruleX([0], { stroke: c.baseline, strokeWidth: 1 }),
                Plot.tip(ownerRows, Plot.pointerY({
                  x: 'h100Equivalents', y: 'short',
                  title: (d: (typeof ownerRows)[number]) => `${d.owner}\n${compact(d.h100Equivalents)} H100e\n${d.count} clusters`,
                })),
              ],
            })}
            table={{
              columns: [
                { key: 'owner', label: 'Owner', value: (r) => r.owner },
                { key: 'clusters', label: 'Clusters', align: 'right', value: (r) => integer(r.count) },
                { key: 'h100', label: 'H100e', align: 'right', value: (r) => compact(r.h100Equivalents) },
              ],
              rows: comp.byOwner,
            }}
          />
        </div>

        <Figure
          title="Cumulative disclosed capacity brought online"
          subtitle="Running total of H100-equivalents, by first operational year."
          height={300}
          source={source}
          note="Only clusters with a recorded first-operational date contribute. Recent years are revised upward as systems are disclosed, so the final point is always an undercount."
          plot={({ c }) => ({
            marginLeft: 56, marginBottom: 34,
            x: { label: null, tickFormat: 'd', ticks: cumulative.map((r) => r.year).filter((_, i) => i % 2 === 0) },
            y: { label: 'Cumulative H100-equivalents', tickFormat: (d: number) => compact(d), ...axes(c).grid },
            marks: [
              Plot.gridY({ stroke: c.grid, strokeOpacity: 1, strokeWidth: 1 }),
              Plot.areaY(cumulative, { x: 'year', y: 'cumulative', fill: c.series[1], fillOpacity: 0.1, curve: 'monotone-x' }),
              Plot.line(cumulative, { x: 'year', y: 'cumulative', stroke: c.series[1], strokeWidth: 2, curve: 'monotone-x' }),
              Plot.dot(cumulative.slice(-1), { x: 'year', y: 'cumulative', fill: c.series[1], r: 4, stroke: c.surface, strokeWidth: 2 }),
              Plot.ruleY([0], { stroke: c.baseline, strokeWidth: 1 }),
              Plot.tip(cumulative, Plot.pointerX({
                x: 'year', y: 'cumulative',
                title: (d: (typeof cumulative)[number]) => `${d.year}\nCumulative: ${compact(d.cumulative)} H100e\nAdded: ${compact(d.h100Equivalents)} H100e\n${d.count} clusters`,
              })),
            ],
          })}
          table={{
            columns: [
              { key: 'year', label: 'Year', value: (r) => r.year },
              { key: 'count', label: 'Clusters', align: 'right', value: (r) => integer(r.count) },
              { key: 'added', label: 'Added H100e', align: 'right', value: (r) => compact(r.h100Equivalents) },
              { key: 'cum', label: 'Cumulative', align: 'right', value: (r) => compact(r.cumulative) },
            ],
            rows: [...cumulative].reverse(),
          }}
        />

        {comp.largest && (
          <section className="rounded-lg border border-hairline bg-surface p-4 text-xs text-ink-secondary sm:p-5">
            <h3 className="mb-2 text-sm font-semibold text-ink">Largest cluster on record</h3>
            <dl className="grid grid-cols-2 gap-x-6 gap-y-2 sm:grid-cols-3">
              {[
                ['Name', comp.largest.name],
                ['Owner', comp.largest.owner ?? '—'],
                ['Country', comp.largest.country ?? '—'],
                ['Chips', comp.largest.chipQuantity ? `${integer(comp.largest.chipQuantity)} × ${comp.largest.chipType ?? 'unknown'}` : (comp.largest.chipType ?? '—')],
                ['H100-equivalents', compact(comp.largest.h100Equivalents)],
                ['First operational', shortDate(comp.largest.firstOperational)],
              ].map(([k, v]) => (
                <div key={k}>
                  <dt className="text-ink-muted">{k}</dt>
                  <dd className="mt-0.5 text-ink">{v}</dd>
                </div>
              ))}
            </dl>
          </section>
        )}
      </div>
    </div>
  );
}
