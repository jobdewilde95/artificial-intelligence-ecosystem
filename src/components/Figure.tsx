import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import * as Plot from '@observablehq/plot';
import { useTokens, type Tokens } from '@/lib/theme';

export interface TableColumn<R> {
  key: string;
  label: string;
  align?: 'left' | 'right';
  value: (row: R) => string | number;
}

interface FigureProps<R> {
  title: string;
  subtitle?: string;
  /** Provenance, rendered under the figure so every number is traceable. */
  source?: { name: string; url?: string };
  /** Caveats that change how the chart should be read. */
  note?: ReactNode;
  height?: number;
  /** Built per render so it can react to width and theme tokens. */
  plot: (ctx: { width: number; c: Tokens }) => Plot.PlotOptions;
  /**
   * Every figure ships a table view. It is the accessibility fallback, and the
   * documented relief for the three light-mode series colours that sit below
   * 3:1 contrast on the light surface.
   */
  table?: { columns: TableColumn<R>[]; rows: R[] };
  legend?: Array<{ label: string; color: string }>;
}

export function Figure<R>({
  title, subtitle, source, note, height = 300, plot, table, legend,
}: FigureProps<R>) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const [view, setView] = useState<'chart' | 'table'>('chart');
  const tokens = useTokens();

  useEffect(() => {
    const el = hostRef.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => {
      setWidth(Math.max(0, Math.floor(entry.contentRect.width)));
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const figure = useMemo(() => {
    if (!tokens || width <= 0 || view !== 'chart') return null;
    try {
      const spec = plot({ width, c: tokens });
      return Plot.plot({
        ...spec,
        width,
        height,
        style: { background: 'transparent', color: tokens.inkSecondary, fontSize: '12px' },
        // Plot's own swatch legend is suppressed; we render an accessible one
        // in the header instead, so it survives into the table view too.
        color: { ...(spec.color ?? {}), legend: false },
      });
    } catch (err) {
      console.error(`Figure "${title}" failed to render`, err);
      return null;
    }
  }, [plot, width, height, tokens, view, title]);

  useEffect(() => {
    const el = hostRef.current;
    if (!el) return;
    el.replaceChildren();
    if (figure) el.append(figure);
    return () => {
      if (figure && figure.parentNode === el) el.removeChild(figure);
    };
  }, [figure]);

  return (
    <figure className="rounded-lg border border-hairline bg-surface p-4 sm:p-5">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-ink">{title}</h3>
          {subtitle && <p className="mt-0.5 text-xs text-ink-secondary">{subtitle}</p>}
        </div>
        {table && (
          <div role="group" aria-label="View as" className="flex shrink-0 rounded border border-hairline text-xs">
            {(['chart', 'table'] as const).map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => setView(v)}
                aria-pressed={view === v}
                className={`px-2 py-1 capitalize transition-colors first:rounded-l last:rounded-r ${
                  view === v ? 'bg-raised font-medium text-ink' : 'text-ink-secondary hover:text-ink'
                }`}
              >
                {v}
              </button>
            ))}
          </div>
        )}
      </div>

      {legend && legend.length > 1 && view === 'chart' && (
        <ul className="mb-3 flex flex-wrap gap-x-4 gap-y-1.5">
          {legend.map((l) => (
            <li key={l.label} className="flex items-center gap-1.5 text-xs text-ink-secondary">
              <span aria-hidden className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: l.color }} />
              {l.label}
            </li>
          ))}
        </ul>
      )}

      {view === 'chart' ? (
        <div ref={hostRef} className="plot-host w-full overflow-x-auto" style={{ minHeight: height }} />
      ) : (
        table && (
          <div className="max-h-[420px] overflow-auto">
            <table className="w-full text-xs tnum">
              <thead className="sticky top-0 bg-surface">
                <tr className="border-b border-hairline text-left text-ink-secondary">
                  {table.columns.map((col) => (
                    <th key={col.key} scope="col" className={`py-1.5 pr-3 font-medium ${col.align === 'right' ? 'text-right' : ''}`}>
                      {col.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {table.rows.map((row, i) => (
                  <tr key={i} className="border-b border-hairline/60 last:border-0">
                    {table.columns.map((col) => (
                      <td key={col.key} className={`py-1.5 pr-3 text-ink ${col.align === 'right' ? 'text-right' : ''}`}>
                        {col.value(row)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      )}

      {(note || source) && (
        <figcaption className="mt-3 space-y-1 border-t border-hairline pt-2.5 text-[11px] leading-relaxed text-ink-muted">
          {note && <div>{note}</div>}
          {source && (
            <div>
              Source:{' '}
              {source.url ? (
                <a href={source.url} target="_blank" rel="noreferrer" className="underline underline-offset-2 hover:text-ink-secondary">
                  {source.name}
                </a>
              ) : (
                source.name
              )}
            </div>
          )}
        </figcaption>
      )}
    </figure>
  );
}

/**
 * Left margin sized to the longest label actually being rendered. Hard-coding
 * a margin clips whatever turns out to be longer than you guessed ("xAI
 * Colossus Memphis Phase 3" lost its first characters that way); ~6.6px per
 * character at 12px system sans is close enough, and the cap keeps a long
 * label from eating the plot.
 */
export function leftMarginFor(labels: string[], cap = 200): number {
  const longest = labels.reduce((m, l) => Math.max(m, l.length), 0);
  return Math.min(cap, Math.ceil(longest * 7.1) + 18);
}

/** Longest label that fits the default cap — keep truncation and margin in step. */
export const LABEL_MAX = 25;

/** Shared Plot defaults: hairline solid grid, recessive axes, no chart junk. */
export function axes(c: Tokens) {
  return {
    grid: { stroke: c.grid, strokeOpacity: 1, strokeWidth: 1 },
    axis: { stroke: c.baseline, strokeWidth: 1, color: c.muted },
  };
}
