interface SparklineProps {
  values: number[];
  color: string;
  width?: number;
  height?: number;
  label: string;
}

/** Trend shape only — no axes, no values. The tile beside it carries the number. */
export function Sparkline({ values, color, width = 110, height = 28, label }: SparklineProps) {
  if (values.length < 2) return null;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const step = width / (values.length - 1);
  const points = values.map((v, i) => `${(i * step).toFixed(1)},${(height - ((v - min) / span) * height).toFixed(1)}`);
  const last = values[values.length - 1];
  const lastY = height - ((last - min) / span) * height;

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} role="img" aria-label={label} className="overflow-visible">
      <polyline
        points={points.join(' ')}
        fill="none"
        stroke={color}
        strokeWidth={2}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      {/* End marker carries a surface ring so it stays legible over the line. */}
      <circle cx={width} cy={lastY} r={3.5} fill={color} stroke="var(--surface-1)" strokeWidth={2} />
    </svg>
  );
}
