import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';

interface MetricTileProps {
  label: string;
  value: string;
  /** Supporting context — the unit, the qualifier, the as-of date. */
  detail?: string;
  hint?: string;
  to?: string;
  accent?: string;
  children?: ReactNode;
}

/**
 * The stat tile is the right form when the story is one number — per the
 * data-viz guidance, a one-bar chart is never the answer.
 */
export function MetricTile({ label, value, detail, hint, to, accent, children }: MetricTileProps) {
  const body = (
    <>
      <div className="flex items-center gap-2">
        {accent && <span aria-hidden className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: accent }} />}
        <span className="text-[11px] font-medium uppercase tracking-wide text-ink-muted">{label}</span>
      </div>
      <div className="mt-1.5 text-2xl font-semibold leading-none text-ink sm:text-[1.75rem]">{value}</div>
      {detail && <div className="mt-1.5 text-xs text-ink-secondary">{detail}</div>}
      {children}
      {hint && <div className="mt-1 text-[11px] text-ink-muted">{hint}</div>}
    </>
  );

  const className =
    'block rounded-lg border border-hairline bg-surface p-4 transition-colors' +
    (to ? ' hover:border-ink-muted/40' : '');

  return to ? (
    <Link to={to} className={className}>
      {body}
    </Link>
  ) : (
    <div className={className}>{body}</div>
  );
}
