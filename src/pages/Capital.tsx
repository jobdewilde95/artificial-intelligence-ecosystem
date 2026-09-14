import * as Plot from '@observablehq/plot';
import type { Dataset } from '@/lib/data';
import type { LiveValues } from '@/lib/live';
import { useTokens } from '@/lib/theme';
import { Figure, axes, leftMarginFor } from '@/components/Figure';
import { MetricTile } from '@/components/MetricTile';
import { PageHeader, EmptyState } from '@/components/Panel';
import { integer, compact, usd, shortDate } from '@/lib/format';

export default function Capital({ data, live, liveEnabled }: { data: Dataset; live: LiveValues; liveEnabled: boolean }) {
  const tokens = useTokens();
  const capital = data.capital?.data;
  const funding = data.curated?.data.funding ?? [];
  const source = { name: data.capital?.attribution.name ?? 'OpenRouter', url: data.capital?.attribution.url };

  if (!capital || !tokens) return <EmptyState what="Capital data has not been collected yet." why="Run npm run refresh." />;

  const isLive = liveEnabled && live.servedModels != null;
  const servedModels = (liveEnabled ? live.servedModels : null) ?? capital.servedModels.length;
  const cheapest = (liveEnabled ? live.cheapestUsdPerMTok : null) ?? capital.priceStats.minPromptUsdPerMTok;

  const priced = capital.servedModels
    .filter((m) => m.promptUsdPerMTok != null && m.promptUsdPerMTok > 0 && m.created)
    .map((m) => ({ ...m, createdDate: new Date(m.created!), price: m.promptUsdPerMTok! }))
    .filter((m) => !Number.isNaN(m.createdDate.getTime()));

  const providers = capital.byProvider.slice(0, 14);

  const fundingByYear = funding.reduce<Record<string, number>>((acc, f) => {
    const y = f.date.slice(0, 4);
    acc[y] = (acc[y] ?? 0) + f.amountUsdM;
    return acc;
  }, {});
  const fundingRows = Object.entries(fundingByYear)
    .map(([year, totalM]) => ({
      year: Number(year),
      total: totalM,
      // Plot in absolute dollars so the axis can read "$70B" directly.
      totalUsd: totalM * 1e6,
      count: funding.filter((f) => f.date.startsWith(year)).length,
    }))
    .sort((a, b) => a.year - b.year);

  return (
    <div>
      <PageHeader
        eyebrow="Pillar 03"
        title="Capital & Industry"
        lede="What is being invested into AI, and what intelligence costs to buy. The two move in opposite directions: capital raised keeps climbing while the price of a token keeps collapsing, which is the central economic fact of the current period."
      />

      <section className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <MetricTile
          label="Models served"
          value={integer(servedModels)}
          detail={`across ${integer((liveEnabled ? live.providers : null) ?? capital.providerCount)} providers`}
          hint={isLive ? 'Live from OpenRouter' : undefined}
          accent={tokens.series[2]}
        />
        <MetricTile
          label="Cheapest paid input"
          value={cheapest != null ? `${usd(cheapest)}/Mtok` : '—'}
          detail="lowest non-free prompt price"
          hint={isLive ? 'Live' : undefined}
          accent={tokens.series[2]}
        />
        <MetricTile
          label="Median input price"
          value={capital.priceStats.medianPromptUsdPerMTok != null ? `${usd(capital.priceStats.medianPromptUsdPerMTok)}/Mtok` : '—'}
          detail="across paid models"
          accent={tokens.series[0]}
        />
        <MetricTile
          label="Tracked capital"
          value={`$${compact(funding.reduce((s, f) => s + f.amountUsdM, 0) * 1e6, 0)}`}
          detail={`across ${integer(funding.length)} disclosed rounds`}
          accent={tokens.series[1]}
        />
      </section>

      <div className="space-y-5">
        <Figure
          title="Input price against model release date"
          subtitle="Every paid model on OpenRouter, by price per million prompt tokens. Log scale."
          height={340}
          source={source}
          note="Dates are when the model was listed on OpenRouter, not when it was first released. Free endpoints are excluded because they would pin the floor at zero and hide the trend."
          plot={({ c }) => ({
            marginLeft: 62, marginBottom: 34,
            x: { label: null, type: 'utc' },
            y: { type: 'log', label: 'USD per million prompt tokens', tickFormat: (d: number) => usd(d) },
            marks: [
              Plot.gridY({ stroke: c.grid, strokeOpacity: 1, strokeWidth: 1 }),
              Plot.dot(priced, { x: 'createdDate', y: 'price', fill: c.series[2], r: 4, stroke: c.surface, strokeWidth: 1.5, fillOpacity: 0.8 }),
              Plot.tip(priced, Plot.pointer({
                x: 'createdDate', y: 'price',
                title: (d: (typeof priced)[number]) =>
                  `${d.name}\n${d.provider}\n${usd(d.price)}/Mtok input\n${d.completionUsdPerMTok != null ? `${usd(d.completionUsdPerMTok)}/Mtok output\n` : ''}${d.contextLength ? `${compact(d.contextLength)} context` : ''}`,
              })),
            ],
          })}
          table={{
            columns: [
              { key: 'name', label: 'Model', value: (r) => r.name },
              { key: 'provider', label: 'Provider', value: (r) => r.provider },
              { key: 'in', label: 'Input /Mtok', align: 'right', value: (r) => usd(r.price) },
              { key: 'out', label: 'Output /Mtok', align: 'right', value: (r) => usd(r.completionUsdPerMTok) },
              { key: 'ctx', label: 'Context', align: 'right', value: (r) => compact(r.contextLength) },
            ],
            rows: [...priced].sort((a, b) => a.price - b.price).slice(0, 150),
          }}
        />

        <div className="grid gap-5 xl:grid-cols-2">
          <Figure
            title="Models per provider"
            subtitle="Who is serving the most distinct models."
            height={320}
            source={source}
            plot={({ c }) => ({
              marginLeft: leftMarginFor(providers.map((p) => p.provider)), marginBottom: 34,
              x: { label: 'Models served', ...axes(c).grid },
              y: { label: null, domain: providers.map((p) => p.provider) },
              marks: [
                Plot.gridX({ stroke: c.grid, strokeOpacity: 1, strokeWidth: 1 }),
                Plot.barX(providers, { x: 'count', y: 'provider', fill: c.series[2], insetTop: 2, insetBottom: 2, r: 2, sort: { y: '-x' } }),
                Plot.ruleX([0], { stroke: c.baseline, strokeWidth: 1 }),
                Plot.tip(providers, Plot.pointerY({
                  x: 'count', y: 'provider',
                  title: (d: (typeof providers)[number]) =>
                    `${d.provider}\n${d.count} models\nmedian input ${d.medianPromptUsdPerMTok != null ? usd(d.medianPromptUsdPerMTok) : 'n/a'}/Mtok`,
                })),
              ],
            })}
            table={{
              columns: [
                { key: 'provider', label: 'Provider', value: (r) => r.provider },
                { key: 'count', label: 'Models', align: 'right', value: (r) => integer(r.count) },
                { key: 'median', label: 'Median in /Mtok', align: 'right', value: (r) => usd(r.medianPromptUsdPerMTok) },
              ],
              rows: capital.byProvider,
            }}
          />

          <Figure
            title="Context window distribution"
            subtitle="How much context the served fleet actually offers."
            height={320}
            source={source}
            plot={({ c }) => ({
              marginLeft: leftMarginFor(capital.contextLengthBuckets.map((b) => b.bucket), 90), marginBottom: 34,
              x: { label: 'Models', ...axes(c).grid },
              y: { label: null, domain: capital.contextLengthBuckets.map((b) => b.bucket) },
              marks: [
                Plot.gridX({ stroke: c.grid, strokeOpacity: 1, strokeWidth: 1 }),
                Plot.barX(capital.contextLengthBuckets, { x: 'count', y: 'bucket', fill: c.series[0], insetTop: 2, insetBottom: 2, r: 2 }),
                Plot.ruleX([0], { stroke: c.baseline, strokeWidth: 1 }),
                Plot.tip(capital.contextLengthBuckets, Plot.pointerY({
                  x: 'count', y: 'bucket',
                  title: (d: { bucket: string; count: number }) => `${d.bucket}\n${d.count} models`,
                })),
              ],
            })}
            table={{
              columns: [
                { key: 'bucket', label: 'Context window', value: (r) => r.bucket },
                { key: 'count', label: 'Models', align: 'right', value: (r) => integer(r.count) },
              ],
              rows: capital.contextLengthBuckets,
            }}
          />
        </div>

        {fundingRows.length > 0 && (
          <Figure
            title="Disclosed AI funding by year"
            subtitle="Sum of the tracked rounds in the curated dataset."
            height={280}
            source={{ name: 'Curated — data/curated/funding.yaml' }}
            note="A hand-maintained sample of the largest, best-documented rounds — not a complete market total. Treat it as a floor and a shape, not a measurement."
            plot={({ c }) => ({
              marginLeft: 56, marginBottom: 34,
              x: { label: null, tickFormat: 'd' },
              y: { label: 'Disclosed capital (USD)', tickFormat: (d: number) => `$${compact(d, 0)}`, ...axes(c).grid },
              marks: [
                Plot.gridY({ stroke: c.grid, strokeOpacity: 1, strokeWidth: 1 }),
                Plot.rectY(fundingRows, { x: 'year', y: 'totalUsd', fill: c.series[1], insetLeft: 1, insetRight: 1, r: 2 }),
                Plot.ruleY([0], { stroke: c.baseline, strokeWidth: 1 }),
                Plot.tip(fundingRows, Plot.pointerX({
                  x: 'year', y: 'totalUsd',
                  title: (d: (typeof fundingRows)[number]) => `${d.year}\n$${compact(d.total * 1e6, 1)} across ${d.count} rounds`,
                })),
              ],
            })}
            table={{
              columns: [
                { key: 'year', label: 'Year', value: (r) => r.year },
                { key: 'rounds', label: 'Rounds', align: 'right', value: (r) => integer(r.count) },
                { key: 'total', label: 'Disclosed', align: 'right', value: (r) => `$${compact(r.total * 1e6, 1)}` },
              ],
              rows: [...fundingRows].reverse(),
            }}
          />
        )}

        {funding.length > 0 && (
          <section className="rounded-lg border border-hairline bg-surface p-4 sm:p-5">
            <h3 className="mb-1 text-sm font-semibold text-ink">Tracked funding rounds</h3>
            <p className="mb-3 text-xs text-ink-secondary">Curated from primary announcements. Edit <code className="rounded bg-raised px-1">data/curated/funding.yaml</code> to extend.</p>
            <div className="max-h-[420px] overflow-auto">
              <table className="w-full min-w-[620px] text-xs">
                <thead className="sticky top-0 bg-surface">
                  <tr className="border-b border-hairline text-left text-ink-secondary">
                    <th scope="col" className="py-2 pr-3 font-medium">Date</th>
                    <th scope="col" className="py-2 pr-3 font-medium">Company</th>
                    <th scope="col" className="py-2 pr-3 font-medium">Round</th>
                    <th scope="col" className="py-2 pr-3 text-right font-medium">Amount</th>
                    <th scope="col" className="py-2 pr-3 text-right font-medium">Valuation</th>
                    <th scope="col" className="py-2 pr-3 font-medium">Investors</th>
                  </tr>
                </thead>
                <tbody className="tnum">
                  {[...funding].sort((a, b) => b.date.localeCompare(a.date)).map((f) => (
                    <tr key={`${f.company}-${f.date}`} className="border-b border-hairline/60 last:border-0">
                      <td className="py-2 pr-3 text-ink-secondary">{shortDate(f.date)}</td>
                      <td className="py-2 pr-3 text-ink">
                        {f.url ? <a href={f.url} target="_blank" rel="noreferrer" className="underline underline-offset-2 hover:text-ink-secondary">{f.company}</a> : f.company}
                      </td>
                      <td className="py-2 pr-3 text-ink-secondary">{f.round}</td>
                      <td className="py-2 pr-3 text-right text-ink">${compact(f.amountUsdM * 1e6, 1)}</td>
                      <td className="py-2 pr-3 text-right text-ink">{f.valuationUsdB != null ? `$${f.valuationUsdB}B` : '—'}</td>
                      <td className="py-2 pr-3 text-ink-muted">{f.investors}</td>
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
