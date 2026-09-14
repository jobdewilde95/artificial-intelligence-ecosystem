/** Shared number/date formatting. Keeps axis ticks and tiles consistent. */

const UNITS = [
  { v: 1e12, s: 'T' },
  { v: 1e9, s: 'B' },
  { v: 1e6, s: 'M' },
  { v: 1e3, s: 'K' },
];

export function compact(n: number | null | undefined, digits = 1): string {
  if (n == null || !Number.isFinite(n)) return '—';
  const abs = Math.abs(n);
  for (const { v, s } of UNITS) {
    if (abs >= v) {
      const scaled = n / v;
      return `${scaled.toFixed(Math.abs(scaled) >= 100 ? 0 : digits).replace(/\.0$/, '')}${s}`;
    }
  }
  return Number.isInteger(n) ? String(n) : n.toFixed(digits);
}

export function integer(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return '—';
  return Math.round(n).toLocaleString('en-US');
}

/** Training compute spans ~20 orders of magnitude, so powers of ten it is. */
export function flops(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n) || n <= 0) return '—';
  const exp = Math.floor(Math.log10(n));
  const mant = n / 10 ** exp;
  return `${mant.toFixed(1)}e${exp} FLOP`;
}

export function usd(n: number | null | undefined, digits = 2): string {
  if (n == null || !Number.isFinite(n)) return '—';
  if (n >= 1000) return `$${compact(n, 1)}`;
  if (n < 0.01 && n > 0) return `$${n.toFixed(4)}`;
  return `$${n.toFixed(digits)}`;
}

export function percent(n: number | null | undefined, digits = 1): string {
  if (n == null || !Number.isFinite(n)) return '—';
  return `${(n * 100).toFixed(digits)}%`;
}

export function shortDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

export function monthYear(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short' });
}

export function relativeTime(iso: string | null | undefined): string {
  if (!iso) return 'never';
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return 'unknown';
  const mins = Math.round((Date.now() - then) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days}d ago`;
  return `${Math.round(days / 30)}mo ago`;
}

/**
 * Shortens a category label to fit a chart's left margin. Agency and model
 * names are arbitrarily long, and growing the margin to fit the worst case
 * steals width from the plot — so the label is clipped here, deliberately,
 * with the full text still carried by the tooltip and the table view.
 */
export function truncateLabel(s: string, max = 30): string {
  if (s.length <= max) return s;
  return `${s.slice(0, max - 1).trimEnd()}…`;
}
