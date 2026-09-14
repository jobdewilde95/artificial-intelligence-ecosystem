import { useState } from 'react';
import * as Plot from '@observablehq/plot';
import type { Dataset } from '@/lib/data';
import { useTokens } from '@/lib/theme';
import { Figure, axes, leftMarginFor, LABEL_MAX } from '@/components/Figure';
import { MetricTile } from '@/components/MetricTile';
import { PageHeader, EmptyState } from '@/components/Panel';
import { integer, shortDate, truncateLabel } from '@/lib/format';

const KIND_LABEL: Record<string, string> = {
  law: 'Law', regulation: 'Regulation', executive: 'Executive action',
  agreement: 'International agreement', 'export-control': 'Export control', standard: 'Standard',
};

const STATUS_TOKEN: Record<string, { color: string; icon: string }> = {
  'in-force': { color: 'var(--status-good)', icon: '●' },
  'phasing-in': { color: 'var(--status-warning)', icon: '◐' },
  proposed: { color: 'var(--text-muted)', icon: '○' },
  superseded: { color: 'var(--text-muted)', icon: '✕' },
};

export default function Policy({ data }: { data: Dataset }) {
  const tokens = useTokens();
  const policy = data.policy?.data;
  const milestones = data.curated?.data.policyMilestones ?? [];
  const [jurisdiction, setJurisdiction] = useState('all');
  const source = { name: data.policy?.attribution.name ?? 'Federal Register', url: data.policy?.attribution.url };

  if (!policy || !tokens) return <EmptyState what="Policy data has not been collected yet." why="Run npm run refresh." />;

  const year = new Date().getUTCFullYear();
  const jurisdictions = [...new Set(milestones.map((m) => m.jurisdiction))].sort();
  const shown = milestones
    .filter((m) => jurisdiction === 'all' || m.jurisdiction === jurisdiction)
    .sort((a, b) => b.date.localeCompare(a.date));

  // Both series are document counts, so they share one axis — this is a
  // two-series chart, never a dual-axis one.
  const corpusStartYear = policy.corpusEarliestDate ? Number(policy.corpusEarliestDate.slice(0, 4)) : null;
  const combined = policy.byYearMentions.map((m) => ({
    year: m.year,
    mentions: m.count,
    about: policy.byYear.find((a) => a.year === m.year)?.count ?? 0,
    partial: corpusStartYear != null && m.year === corpusStartYear,
  }));

  return (
    <div>
      <PageHeader
        eyebrow="Pillar 06"
        title="Policy & Governance"
        lede="How AI is actually being regulated. Two very different pictures sit side by side here: a curated timeline of binding global milestones, and a measured read of US federal rulemaking activity."
      />

      <section className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <MetricTile label="Federal AI actions" value={integer(policy.documents.length)} detail="documents substantively about AI" accent={tokens.series[5]} />
        <MetricTile label={`Actions in ${year}`} value={integer(policy.byYear.find((y) => y.year === year)?.count ?? 0)} detail="year to date" accent={tokens.series[5]} />
        <MetricTile label="Global milestones" value={integer(milestones.length)} detail={`across ${jurisdictions.length} jurisdictions`} accent={tokens.series[0]} />
        <MetricTile
          label="In force now"
          value={integer(milestones.filter((m) => m.status === 'in-force').length)}
          detail={`${integer(milestones.filter((m) => m.status === 'phasing-in').length)} still phasing in`}
          accent={tokens.series[2]}
        />
      </section>

      <div className="space-y-5">
        <Figure
          title="Mentioning AI vs. actually about AI"
          subtitle="US Federal Register documents per year, on one shared count axis."
          height={320}
          source={source}
          legend={[
            { label: 'Mentions AI anywhere in the text', color: tokens.series[4] },
            { label: 'Substantively about AI', color: tokens.series[5] },
          ]}
          note={
            <>
              The Federal Register's term search matches full document text, which pulls in documents that merely mention
              AI in passing — a biosafety policy and an advisory-board nomination both ranked in its top results. The darker
              series applies a relevance gate (AI named in the title, or repeated in the abstract), keeping{' '}
              {integer(policy.documents.length)} of {integer(policy.byYearMentions.reduce((s, y) => s + y.count, 0))} candidates.
              The widening gap is the finding: AI is becoming ambient in federal documents faster than it is becoming the
              subject of dedicated rulemaking.
              {corpusStartYear != null && (
                <> {corpusStartYear} is partial — the fetch window starts {shortDate(policy.corpusEarliestDate)}, so treat that first bar as truncated, not as a quiet year.</>
              )}
            </>
          }
          plot={({ c }) => ({
            marginLeft: 52, marginBottom: 34,
            x: { label: null, tickFormat: 'd' },
            y: { label: 'Documents', ...axes(c).grid },
            marks: [
              Plot.gridY({ stroke: c.grid, strokeOpacity: 1, strokeWidth: 1 }),
              Plot.rectY(combined, {
                x: 'year', y: 'mentions',
                fill: (d: (typeof combined)[number]) => (d.partial ? c.muted : c.series[4]),
                insetLeft: 1, insetRight: 1, r: 2,
              }),
              Plot.rectY(combined, { x: 'year', y: 'about', fill: c.series[5], insetLeft: 1, insetRight: 1, r: 2 }),
              Plot.ruleY([0], { stroke: c.baseline, strokeWidth: 1 }),
              Plot.tip(combined, Plot.pointerX({
                x: 'year', y: 'mentions',
                title: (d: (typeof combined)[number]) =>
                  `${d.year}${d.partial ? ' (partial year)' : ''}\n${d.mentions} mention AI\n${d.about} about AI`,
              })),
            ],
          })}
          table={{
            columns: [
              { key: 'year', label: 'Year', value: (r) => `${r.year}${r.partial ? ' (partial)' : ''}` },
              { key: 'mentions', label: 'Mentions AI', align: 'right', value: (r) => integer(r.mentions) },
              { key: 'about', label: 'About AI', align: 'right', value: (r) => integer(r.about) },
            ],
            rows: [...combined].reverse(),
          }}
        />

        <div className="grid gap-5 xl:grid-cols-2">
          <Figure
            title="Which agencies act on AI"
            subtitle="Federal Register documents about AI, by issuing agency."
            height={300}
            source={source}
            plot={({ c }) => {
              const rows = policy.byAgency.slice(0, 12).map((r) => ({ ...r, short: truncateLabel(r.agency, LABEL_MAX) }));
              return {
                marginLeft: leftMarginFor(rows.map((r) => r.short)), marginBottom: 34,
                x: { label: 'Documents', ...axes(c).grid },
                y: { label: null, domain: rows.map((r) => r.short) },
                marks: [
                  Plot.gridX({ stroke: c.grid, strokeOpacity: 1, strokeWidth: 1 }),
                  Plot.barX(rows, { x: 'count', y: 'short', fill: c.series[5], insetTop: 2, insetBottom: 2, r: 2, sort: { y: '-x' } }),
                  Plot.ruleX([0], { stroke: c.baseline, strokeWidth: 1 }),
                  Plot.tip(rows, Plot.pointerY({ x: 'count', y: 'short', title: (d: (typeof rows)[number]) => `${d.agency}\n${d.count} documents` })),
                ],
              };
            }}
            table={{
              columns: [
                { key: 'agency', label: 'Agency', value: (r) => r.agency },
                { key: 'count', label: 'Documents', align: 'right', value: (r) => integer(r.count) },
              ],
              rows: policy.byAgency,
            }}
          />

          <Figure
            title="What form the action takes"
            subtitle="Notices dominate; binding rules are comparatively rare."
            height={300}
            source={source}
            plot={({ c }) => ({
              marginLeft: leftMarginFor(policy.byType.map((r) => r.type)), marginBottom: 34,
              x: { label: 'Documents', ...axes(c).grid },
              y: { label: null, domain: policy.byType.map((r) => r.type) },
              marks: [
                Plot.gridX({ stroke: c.grid, strokeOpacity: 1, strokeWidth: 1 }),
                Plot.barX(policy.byType, { x: 'count', y: 'type', fill: c.series[0], insetTop: 2, insetBottom: 2, r: 2, sort: { y: '-x' } }),
                Plot.ruleX([0], { stroke: c.baseline, strokeWidth: 1 }),
                Plot.tip(policy.byType, Plot.pointerY({ x: 'count', y: 'type', title: (d: { type: string; count: number }) => `${d.type}\n${d.count} documents` })),
              ],
            })}
            table={{
              columns: [
                { key: 'type', label: 'Document type', value: (r) => r.type },
                { key: 'count', label: 'Count', align: 'right', value: (r) => integer(r.count) },
              ],
              rows: policy.byType,
            }}
          />
        </div>

        <section className="rounded-lg border border-hairline bg-surface p-4 sm:p-5">
          <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold text-ink">Global governance timeline</h3>
              <p className="mt-0.5 text-xs text-ink-secondary">
                Curated binding and near-binding milestones. Edit <code className="rounded bg-raised px-1">data/curated/policy-timeline.yaml</code> to extend.
              </p>
            </div>
            <select
              value={jurisdiction}
              onChange={(e) => setJurisdiction(e.target.value)}
              aria-label="Filter by jurisdiction"
              className="max-w-[240px] truncate rounded border border-hairline bg-surface px-2 py-1 text-xs text-ink"
            >
              <option value="all">All jurisdictions ({milestones.length})</option>
              {jurisdictions.map((j) => (
                <option key={j} value={j}>{j}</option>
              ))}
            </select>
          </div>

          <ol className="space-y-0">
            {shown.map((m, i) => {
              const s = STATUS_TOKEN[m.status] ?? STATUS_TOKEN.proposed;
              return (
                <li key={`${m.date}-${m.title}`} className="relative flex gap-3 pb-4 last:pb-0">
                  {i < shown.length - 1 && <span aria-hidden className="absolute left-[5px] top-4 h-full w-px bg-hairline" />}
                  <span aria-hidden className="relative z-10 mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: s.color }} />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                      <span className="text-xs tnum text-ink-muted">{shortDate(m.date)}</span>
                      <span className="text-[11px] text-ink-muted">{m.jurisdiction}</span>
                      <span className="rounded bg-raised px-1.5 py-0.5 text-[10px] text-ink-secondary">{KIND_LABEL[m.kind] ?? m.kind}</span>
                      <span className="inline-flex items-center gap-1 text-[10px] text-ink-secondary">
                        <span aria-hidden style={{ color: s.color }}>{s.icon}</span>
                        {m.status.replace('-', ' ')}
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-ink">
                      {m.url ? (
                        <a href={m.url} target="_blank" rel="noreferrer" className="underline underline-offset-2 hover:text-ink-secondary">{m.title}</a>
                      ) : m.title}
                    </p>
                    <p className="mt-0.5 text-xs leading-relaxed text-ink-secondary">{m.summary}</p>
                  </div>
                </li>
              );
            })}
          </ol>
        </section>

        <section className="rounded-lg border border-hairline bg-surface p-4 sm:p-5">
          <h3 className="mb-1 text-sm font-semibold text-ink">Recent US federal actions</h3>
          <p className="mb-3 text-xs text-ink-secondary">Documents that passed the relevance gate, newest first.</p>
          <div className="max-h-[420px] overflow-auto">
            <table className="w-full min-w-[600px] text-xs">
              <thead className="sticky top-0 bg-surface">
                <tr className="border-b border-hairline text-left text-ink-secondary">
                  <th scope="col" className="py-2 pr-3 font-medium">Date</th>
                  <th scope="col" className="py-2 pr-3 font-medium">Title</th>
                  <th scope="col" className="py-2 pr-3 font-medium">Type</th>
                </tr>
              </thead>
              <tbody>
                {policy.documents.slice(0, 60).map((d) => (
                  <tr key={d.url} className="border-b border-hairline/60 last:border-0">
                    <td className="py-2 pr-3 tnum align-top text-ink-secondary">{shortDate(d.date)}</td>
                    <td className="py-2 pr-3 text-ink">
                      <a href={d.url} target="_blank" rel="noreferrer" className="underline underline-offset-2 hover:text-ink-secondary">{d.title}</a>
                      {d.agencies.length > 0 && <div className="mt-0.5 text-[11px] text-ink-muted">{d.agencies.join(', ')}</div>}
                    </td>
                    <td className="py-2 pr-3 align-top text-ink-secondary">{d.type}</td>
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
