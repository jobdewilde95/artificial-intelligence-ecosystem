import type { SourceHealth } from '@/types';
import { relativeTime, shortDate, integer } from '@/lib/format';

const STATUS: Record<string, { label: string; token: string; icon: string }> = {
  ok: { label: 'Fresh', token: 'var(--status-good)', icon: '●' },
  stale: { label: 'Stale', token: 'var(--status-warning)', icon: '▲' },
  empty: { label: 'No data', token: 'var(--status-serious)', icon: '■' },
};

/**
 * Per-source freshness. A dashboard that silently serves month-old numbers as
 * current is worse than one that shows a gap, so every source reports its own
 * state here. Status carries an icon and a word, never colour alone.
 */
export function DataHealth({ health }: { health: SourceHealth[] }) {
  if (!health.length) {
    return <p className="text-sm text-ink-secondary">No collector run recorded yet. Run <code className="rounded bg-raised px-1">npm run refresh</code>.</p>;
  }

  const degraded = health.filter((h) => h.status !== 'ok');

  return (
    <div className="space-y-3">
      <p className="text-sm text-ink-secondary">
        {degraded.length === 0
          ? `All ${health.length} sources returned data on the last run.`
          : `${health.length - degraded.length} of ${health.length} sources fresh; ${degraded.length} degraded. Degraded sources serve their last known-good snapshot.`}
      </p>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[560px] text-xs">
          <thead>
            <tr className="border-b border-hairline text-left text-ink-secondary">
              <th scope="col" className="py-2 pr-3 font-medium">Source</th>
              <th scope="col" className="py-2 pr-3 font-medium">Pillar</th>
              <th scope="col" className="py-2 pr-3 font-medium">Status</th>
              <th scope="col" className="py-2 pr-3 text-right font-medium">Records</th>
              <th scope="col" className="py-2 pr-3 font-medium">Last success</th>
            </tr>
          </thead>
          <tbody>
            {health.map((h) => {
              const s = STATUS[h.status] ?? STATUS.empty;
              return (
                <tr key={h.sourceId} className="border-b border-hairline/60 last:border-0 align-top">
                  <td className="py-2 pr-3">
                    <div className="font-medium text-ink">{h.label}</div>
                    {h.attribution.url ? (
                      <a href={h.attribution.url} target="_blank" rel="noreferrer" className="text-ink-muted underline underline-offset-2 hover:text-ink-secondary">
                        {h.attribution.name}
                      </a>
                    ) : (
                      <span className="text-ink-muted">{h.attribution.name}</span>
                    )}
                    {h.error && <div className="mt-0.5 text-ink-muted">{h.error}</div>}
                  </td>
                  <td className="py-2 pr-3 capitalize text-ink-secondary">{h.pillar}</td>
                  <td className="py-2 pr-3">
                    <span className="inline-flex items-center gap-1.5 text-ink">
                      <span aria-hidden style={{ color: s.token }}>{s.icon}</span>
                      {s.label}
                    </span>
                  </td>
                  <td className="py-2 pr-3 text-right tnum text-ink">{integer(h.recordCount)}</td>
                  <td className="py-2 pr-3 text-ink-secondary" title={shortDate(h.lastSuccess)}>
                    {relativeTime(h.lastSuccess)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
