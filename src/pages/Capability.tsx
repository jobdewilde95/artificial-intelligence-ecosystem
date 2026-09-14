import { useMemo, useState } from 'react';
import * as Plot from '@observablehq/plot';
import type { Dataset } from '@/lib/data';
import { useTokens } from '@/lib/theme';
import { Figure, axes, leftMarginFor, LABEL_MAX } from '@/components/Figure';
import { MetricTile } from '@/components/MetricTile';
import { PageHeader, EmptyState } from '@/components/Panel';
import { integer, flops, compact, shortDate, usd, truncateLabel } from '@/lib/format';

export default function Capability({ data }: { data: Dataset }) {
  const tokens = useTokens();
  const cap = data.capability?.data;
  const [orgFilter, setOrgFilter] = useState<string>('all');

  const source = {
    name: data.capability?.attribution.name ?? 'Epoch AI',
    url: data.capability?.attribution.url,
  };

  const frontier = useMemo(
    () => (cap?.models ?? []).filter((m) => m.frontier && m.publicationDate).sort((a, b) => (b.publicationDate ?? '').localeCompare(a.publicationDate ?? '')),
    [cap],
  );

  const withCompute = useMemo(
    () => (cap?.models ?? []).filter((m) => m.trainingComputeFlop != null && m.publicationDate),
    [cap],
  );

  const orgs = useMemo(() => cap?.topOrganizations.slice(0, 12) ?? [], [cap]);

  if (!cap || !tokens) return <EmptyState what="Capability data has not been collected yet." why="Run npm run refresh." />;

  const totalOpen = cap.models.filter((m) => m.openWeights === true).length;
  const withWeightsInfo = cap.models.filter((m) => m.openWeights != null).length;
  const costed = cap.models.filter((m) => m.costUsd2023 != null).sort((a, b) => (b.costUsd2023 ?? 0) - (a.costUsd2023 ?? 0));

  // Scatter is an all-pairs colour context, which the palette validates for
  // only three slots — so organisations collapse to a three-way split.
  const scatterRows = withCompute
    .filter((m) => (orgFilter === 'all' ? true : m.orgCategory === orgFilter))
    .map((m) => ({
      date: new Date(m.publicationDate!),
      compute: m.trainingComputeFlop!,
      name: m.name,
      organization: m.organization,
      group: m.frontier ? 'Frontier-flagged' : m.openWeights === true ? 'Open weights' : 'Other notable',
    }))
    .filter((m) => !Number.isNaN(m.date.getTime()) && m.compute > 0);

  const groupColors: Record<string, string> = {
    'Frontier-flagged': tokens.series[0],
    'Open weights': tokens.series[1],
    'Other notable': tokens.series[2],
  };

  const orgCategories = [...new Set(cap.models.map((m) => m.orgCategory).filter((c): c is string => !!c))].sort();

  return (
    <div>
      <PageHeader
        eyebrow="Pillar 01"
        title="Capability & Models"
        lede="What the frontier can do, who built it, and what it took. Training compute is the closest thing the field has to a common yardstick — it is imperfect, unevenly reported, and still the best single proxy for capability trajectory."
      />

      <section className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <MetricTile label="Notable models" value={integer(cap.models.length)} detail="in the tracked corpus" accent={tokens.series[0]} />
        <MetricTile label="Frontier-flagged" value={integer(cap.models.filter((m) => m.frontier).length)} detail="by Epoch's criteria" accent={tokens.series[0]} />
        <MetricTile
          label="Open weights"
          value={integer(totalOpen)}
          detail={withWeightsInfo ? `of ${integer(withWeightsInfo)} with a stated licence` : 'licence not recorded'}
          accent={tokens.series[1]}
        />
        <MetricTile label="Producing countries" value={integer(cap.byCountry.length)} detail="with at least one notable model" accent={tokens.series[2]} />
      </section>

      <div className="space-y-5">
        <Figure
          title="Every notable model with a compute estimate"
          subtitle="One dot per model, positioned by release date and training compute. Log scale."
          height={380}
          source={source}
          note={
            <>
              Grouped three ways because scatter plots put every colour pair on screen at once, and the palette is
              validated for three simultaneous series in that mode. {integer(scatterRows.length)} of {integer(cap.models.length)} models
              carry a compute estimate.
            </>
          }
          legend={Object.entries(groupColors).map(([label, color]) => ({ label, color }))}
          plot={({ c }) => ({
            marginLeft: 62,
            marginBottom: 34,
            x: { label: null, type: 'utc' },
            y: { type: 'log', label: 'Training compute (FLOP)', tickFormat: (d: number) => `1e${Math.round(Math.log10(d))}` },
            color: { domain: Object.keys(groupColors), range: Object.values(groupColors) },
            marks: [
              Plot.gridY({ stroke: c.grid, strokeOpacity: 1, strokeWidth: 1 }),
              Plot.dot(scatterRows, {
                x: 'date', y: 'compute', fill: 'group', r: 4,
                stroke: c.surface, strokeWidth: 1.5, fillOpacity: 0.85,
              }),
              Plot.tip(scatterRows, Plot.pointer({
                x: 'date', y: 'compute',
                title: (d: (typeof scatterRows)[number]) =>
                  `${d.name}\n${d.organization}\n${shortDate(d.date.toISOString())}\n${flops(d.compute)}`,
              })),
            ],
          })}
          table={{
            columns: [
              { key: 'name', label: 'Model', value: (r) => r.name },
              { key: 'org', label: 'Organization', value: (r) => r.organization },
              { key: 'date', label: 'Released', value: (r) => shortDate(r.date.toISOString()) },
              { key: 'compute', label: 'Compute', align: 'right', value: (r) => flops(r.compute) },
            ],
            rows: [...scatterRows].sort((a, b) => b.compute - a.compute).slice(0, 200),
          }}
        />

        <div className="flex flex-wrap items-center gap-2">
          <label htmlFor="org-filter" className="text-xs text-ink-secondary">Filter the plot above by organisation type:</label>
          <select
            id="org-filter"
            value={orgFilter}
            onChange={(e) => setOrgFilter(e.target.value)}
            className="max-w-[240px] truncate rounded border border-hairline bg-surface px-2 py-1 text-xs text-ink"
          >
            <option value="all">All ({integer(withCompute.length)})</option>
            {orgCategories.map((c) => (
              <option key={c} value={c}>{c.length > 44 ? `${c.slice(0, 42)}…` : c}</option>
            ))}
          </select>
        </div>

        <div className="grid gap-5 xl:grid-cols-2">
          <Figure
            title="Models released per year"
            subtitle="All notable models, with the frontier-flagged subset."
            height={280}
            source={source}
            legend={[
              { label: 'All notable models', color: tokens.series[0] },
              { label: 'Frontier-flagged', color: tokens.series[1] },
            ]}
            plot={({ c }) => {
              const rows = cap.byYear.filter((y) => y.year >= 2010);
              return {
                marginLeft: 48, marginBottom: 34,
                // Every-other-year ticks: 16 labels in ~500px collide otherwise.
                x: { label: null, tickFormat: 'd', ticks: rows.filter((_, i) => i % 2 === 0).map((r) => r.year) },
                y: { label: 'Models', ...axes(c).grid },
                marks: [
                  Plot.gridY({ stroke: c.grid, strokeOpacity: 1, strokeWidth: 1 }),
                  Plot.rectY(rows, {
                    x: 'year', y: 'count', fill: c.series[0],
                    // 2px surface gap does the separating, never a stroke.
                    insetLeft: 1, insetRight: 1, r: 2,
                  }),
                  Plot.rectY(rows, { x: 'year', y: 'frontierCount', fill: c.series[1], insetLeft: 1, insetRight: 1, r: 2 }),
                  Plot.ruleY([0], { stroke: c.baseline, strokeWidth: 1 }),
                  Plot.tip(rows, Plot.pointerX({
                    x: 'year', y: 'count',
                    title: (d: (typeof rows)[number]) => `${d.year}\n${d.count} models\n${d.frontierCount} frontier\n${d.openWeightCount} open weights`,
                  })),
                ],
              };
            }}
            table={{
              columns: [
                { key: 'year', label: 'Year', value: (r) => r.year },
                { key: 'count', label: 'Models', align: 'right', value: (r) => integer(r.count) },
                { key: 'frontier', label: 'Frontier', align: 'right', value: (r) => integer(r.frontierCount) },
                { key: 'open', label: 'Open weights', align: 'right', value: (r) => integer(r.openWeightCount) },
              ],
              rows: [...cap.byYear].reverse(),
            }}
          />

          <Figure
            title="Most prolific organizations"
            subtitle="By count of notable models in the corpus."
            height={280}
            source={source}
            plot={({ c }) => ({
              marginLeft: leftMarginFor(orgs.map((o) => o.organization)), marginBottom: 34,
              x: { label: 'Models', ...axes(c).grid },
              y: { label: null, domain: orgs.map((o) => o.organization) },
              marks: [
                Plot.gridX({ stroke: c.grid, strokeOpacity: 1, strokeWidth: 1 }),
                Plot.barX(orgs, {
                  x: 'count', y: 'organization', fill: c.series[0],
                  insetTop: 2, insetBottom: 2, r: 2, sort: { y: '-x' },
                }),
                Plot.ruleX([0], { stroke: c.baseline, strokeWidth: 1 }),
                Plot.tip(orgs, Plot.pointerY({
                  x: 'count', y: 'organization',
                  title: (d: (typeof orgs)[number]) => `${d.organization}\n${d.count} models\n${d.frontierCount} frontier`,
                })),
              ],
            })}
            table={{
              columns: [
                { key: 'org', label: 'Organization', value: (r) => r.organization },
                { key: 'count', label: 'Models', align: 'right', value: (r) => integer(r.count) },
                { key: 'frontier', label: 'Frontier', align: 'right', value: (r) => integer(r.frontierCount) },
              ],
              rows: orgs,
            }}
          />
        </div>

        {costed.length > 0 && (
          <Figure
            title="Most expensive training runs on record"
            subtitle="Estimated training compute cost, in 2023 US dollars."
            height={300}
            source={source}
            note="Cost estimates are modelled from hardware, duration and utilisation — treat them as order-of-magnitude, not accounting."
            plot={({ c }) => {
              const rows = costed.slice(0, 12).map((r) => ({ ...r, short: truncateLabel(r.name, LABEL_MAX) }));
              return {
                marginLeft: leftMarginFor(rows.map((r) => r.short)), marginBottom: 34,
                x: { label: 'Estimated cost (2023 USD)', tickFormat: (d: number) => usd(d), ...axes(c).grid },
                y: { label: null, domain: rows.map((r) => r.short) },
                marks: [
                  Plot.gridX({ stroke: c.grid, strokeOpacity: 1, strokeWidth: 1 }),
                  Plot.barX(rows, { x: 'costUsd2023', y: 'short', fill: c.series[0], insetTop: 2, insetBottom: 2, r: 2, sort: { y: '-x' } }),
                  Plot.ruleX([0], { stroke: c.baseline, strokeWidth: 1 }),
                  Plot.tip(rows, Plot.pointerY({
                    x: 'costUsd2023', y: 'short',
                    title: (d: (typeof rows)[number]) => `${d.name}\n${d.organization}\n${usd(d.costUsd2023)}\n${flops(d.trainingComputeFlop)}`,
                  })),
                ],
              };
            }}
            table={{
              columns: [
                { key: 'name', label: 'Model', value: (r) => r.name },
                { key: 'org', label: 'Organization', value: (r) => r.organization },
                { key: 'cost', label: 'Est. cost', align: 'right', value: (r) => usd(r.costUsd2023) },
                { key: 'compute', label: 'Compute', align: 'right', value: (r) => flops(r.trainingComputeFlop) },
              ],
              rows: costed.slice(0, 40),
            }}
          />
        )}

        <section className="rounded-lg border border-hairline bg-surface p-4 sm:p-5">
          <h3 className="mb-1 text-sm font-semibold text-ink">Recent frontier-flagged releases</h3>
          <p className="mb-3 text-xs text-ink-secondary">
            The {integer(frontier.length)} models Epoch flags as frontier, newest first.
          </p>
          <div className="max-h-[420px] overflow-auto">
            <table className="w-full min-w-[560px] text-xs">
              <thead className="sticky top-0 bg-surface">
                <tr className="border-b border-hairline text-left text-ink-secondary">
                  <th scope="col" className="py-2 pr-3 font-medium">Model</th>
                  <th scope="col" className="py-2 pr-3 font-medium">Organization</th>
                  <th scope="col" className="py-2 pr-3 font-medium">Released</th>
                  <th scope="col" className="py-2 pr-3 text-right font-medium">Compute</th>
                  <th scope="col" className="py-2 pr-3 text-right font-medium">Parameters</th>
                </tr>
              </thead>
              <tbody className="tnum">
                {frontier.slice(0, 60).map((m) => (
                  <tr key={`${m.name}-${m.publicationDate}`} className="border-b border-hairline/60 last:border-0">
                    <td className="py-2 pr-3 text-ink">
                      {m.link ? (
                        <a href={m.link} target="_blank" rel="noreferrer" className="underline underline-offset-2 hover:text-ink-secondary">{m.name}</a>
                      ) : m.name}
                    </td>
                    <td className="py-2 pr-3 text-ink-secondary">{m.organization}</td>
                    <td className="py-2 pr-3 text-ink-secondary">{shortDate(m.publicationDate)}</td>
                    <td className="py-2 pr-3 text-right text-ink">{flops(m.trainingComputeFlop)}</td>
                    <td className="py-2 pr-3 text-right text-ink">{compact(m.parameters)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
}
