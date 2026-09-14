import { useState } from 'react';
import * as Plot from '@observablehq/plot';
import type { Dataset } from '@/lib/data';
import { useTokens } from '@/lib/theme';
import { Figure, axes, leftMarginFor } from '@/components/Figure';
import { MetricTile } from '@/components/MetricTile';
import { PageHeader, EmptyState } from '@/components/Panel';
import { integer, shortDate } from '@/lib/format';

const CATEGORY_LABEL: Record<string, string> = {
  incident: 'Incident', evaluation: 'Evaluation', commitment: 'Commitment',
  framework: 'Framework', research: 'Research',
};

/** Severity uses the reserved status palette, always with an icon and a word. */
const SEVERITY: Record<string, { color: string; icon: string; label: string }> = {
  high: { color: 'var(--status-critical)', icon: '▲', label: 'High' },
  medium: { color: 'var(--status-serious)', icon: '◆', label: 'Medium' },
  low: { color: 'var(--status-warning)', icon: '■', label: 'Low' },
  informational: { color: 'var(--text-muted)', icon: '●', label: 'Informational' },
};

export default function Safety({ data }: { data: Dataset }) {
  const tokens = useTokens();
  const events = data.curated?.data.safetyEvents ?? [];
  const [category, setCategory] = useState('all');

  if (!tokens) return null;
  if (!events.length) {
    return (
      <div>
        <PageHeader eyebrow="Pillar 07" title="Safety & Risk" lede="Incidents, evaluations and the frameworks meant to catch them." />
        <EmptyState what="No safety events recorded yet." why="Add entries to data/curated/safety-events.yaml." />
      </div>
    );
  }

  const shown = events
    .filter((e) => category === 'all' || e.category === category)
    .sort((a, b) => b.date.localeCompare(a.date));

  const byCategory = Object.entries(
    events.reduce<Record<string, number>>((acc, e) => {
      acc[e.category] = (acc[e.category] ?? 0) + 1;
      return acc;
    }, {}),
  ).map(([key, count]) => ({ category: CATEGORY_LABEL[key] ?? key, count }))
    .sort((a, b) => b.count - a.count);

  const byYear = Object.entries(
    events.reduce<Record<string, number>>((acc, e) => {
      const y = e.date.slice(0, 4);
      acc[y] = (acc[y] ?? 0) + 1;
      return acc;
    }, {}),
  ).map(([year, count]) => ({ year: Number(year), count })).sort((a, b) => a.year - b.year);

  return (
    <div>
      <PageHeader
        eyebrow="Pillar 07"
        title="Safety & Risk"
        lede="What has gone wrong, what is being measured, and what the labs have committed to. This pillar is deliberately curated rather than scraped — safety events need judgement to classify, and an automated feed would produce a noisier and less honest picture."
      />

      <section className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <MetricTile label="Events tracked" value={integer(events.length)} detail="incidents, evaluations, frameworks" accent={tokens.series[6]} />
        <MetricTile
          label="Documented incidents"
          value={integer(events.filter((e) => e.category === 'incident').length)}
          detail="real-world harms and failures"
          accent={tokens.series[7]}
        />
        <MetricTile
          label="Safety frameworks"
          value={integer(events.filter((e) => e.category === 'framework').length)}
          detail="published by frontier developers"
          accent={tokens.series[2]}
        />
        <MetricTile
          label="High severity"
          value={integer(events.filter((e) => e.severity === 'high').length)}
          detail="events with material real-world harm"
          accent={tokens.series[0]}
        />
      </section>

      <div className="space-y-5">
        <div className="grid gap-5 xl:grid-cols-2">
          <Figure
            title="Events by kind"
            subtitle="How the tracked record breaks down."
            height={260}
            source={{ name: 'Curated — data/curated/safety-events.yaml' }}
            plot={({ c }) => ({
              marginLeft: Math.max(96, leftMarginFor(byCategory.map((b) => b.category), 130)), marginBottom: 34,
              x: { label: 'Events', ...axes(c).grid },
              y: { label: null, domain: byCategory.map((b) => b.category) },
              marks: [
                Plot.gridX({ stroke: c.grid, strokeOpacity: 1, strokeWidth: 1 }),
                Plot.barX(byCategory, { x: 'count', y: 'category', fill: c.series[6], insetTop: 2, insetBottom: 2, r: 2, sort: { y: '-x' } }),
                Plot.ruleX([0], { stroke: c.baseline, strokeWidth: 1 }),
                Plot.tip(byCategory, Plot.pointerY({ x: 'count', y: 'category', title: (d: { category: string; count: number }) => `${d.category}\n${d.count} events` })),
              ],
            })}
            table={{
              columns: [
                { key: 'cat', label: 'Kind', value: (r) => r.category },
                { key: 'count', label: 'Events', align: 'right', value: (r) => integer(r.count) },
              ],
              rows: byCategory,
            }}
          />

          <Figure
            title="Events per year"
            subtitle="Tracked safety events by year."
            height={260}
            source={{ name: 'Curated — data/curated/safety-events.yaml' }}
            note="Counts reflect what this curated list records, not the true incidence of AI harms — which is unmeasured and certainly far higher."
            plot={({ c }) => ({
              marginLeft: 42, marginBottom: 34,
              x: { label: null, tickFormat: 'd' },
              y: { label: 'Events', ...axes(c).grid },
              marks: [
                Plot.gridY({ stroke: c.grid, strokeOpacity: 1, strokeWidth: 1 }),
                Plot.rectY(byYear, { x: 'year', y: 'count', fill: c.series[6], insetLeft: 1, insetRight: 1, r: 2 }),
                Plot.ruleY([0], { stroke: c.baseline, strokeWidth: 1 }),
                Plot.tip(byYear, Plot.pointerX({ x: 'year', y: 'count', title: (d: { year: number; count: number }) => `${d.year}\n${d.count} events` })),
              ],
            })}
            table={{
              columns: [
                { key: 'year', label: 'Year', value: (r) => r.year },
                { key: 'count', label: 'Events', align: 'right', value: (r) => integer(r.count) },
              ],
              rows: [...byYear].reverse(),
            }}
          />
        </div>

        <section className="rounded-lg border border-hairline bg-surface p-4 sm:p-5">
          <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold text-ink">Safety record</h3>
              <p className="mt-0.5 text-xs text-ink-secondary">Newest first. Severity is a judgement call, shown with an icon and a word rather than colour alone.</p>
            </div>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              aria-label="Filter by kind"
              className="max-w-[240px] truncate rounded border border-hairline bg-surface px-2 py-1 text-xs text-ink"
            >
              <option value="all">All kinds ({events.length})</option>
              {Object.entries(CATEGORY_LABEL).map(([k, label]) => (
                <option key={k} value={k}>{label} ({events.filter((e) => e.category === k).length})</option>
              ))}
            </select>
          </div>

          <ol className="space-y-3">
            {shown.map((e) => {
              const sev = SEVERITY[e.severity] ?? SEVERITY.informational;
              return (
                <li key={`${e.date}-${e.title}`} className="border-b border-hairline/60 pb-3 last:border-0 last:pb-0">
                  <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                    <span className="text-xs tnum text-ink-muted">{shortDate(e.date)}</span>
                    <span className="rounded bg-raised px-1.5 py-0.5 text-[10px] text-ink-secondary">{CATEGORY_LABEL[e.category] ?? e.category}</span>
                    <span className="inline-flex items-center gap-1 text-[10px] text-ink-secondary">
                      <span aria-hidden style={{ color: sev.color }}>{sev.icon}</span>
                      {sev.label}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-ink">
                    {e.url ? (
                      <a href={e.url} target="_blank" rel="noreferrer" className="underline underline-offset-2 hover:text-ink-secondary">{e.title}</a>
                    ) : e.title}
                  </p>
                  <p className="mt-0.5 text-xs leading-relaxed text-ink-secondary">{e.summary}</p>
                </li>
              );
            })}
          </ol>
        </section>
      </div>
    </div>
  );
}
