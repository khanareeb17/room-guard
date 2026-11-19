export function ProgressRing({
  value,
  size = 56,
  stroke = 6,
  label,
  children,
}: {
  value: number;
  size?: number;
  stroke?: number;
  label?: string;
  children?: React.ReactNode;
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const v = Math.max(0, Math.min(1, value));
  return (
    <div
      className="relative inline-flex items-center justify-center"
      style={{ width: size, height: size }}
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(v * 100)}
      aria-label={label}
    >
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} className="stroke-surface-3" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - v)}
          className="stroke-accent transition-[stroke-dashoffset] duration-500"
        />
      </svg>
      <span className="absolute text-xs font-semibold tabular-nums">{children ?? `${Math.round(v * 100)}%`}</span>
    </div>
  );
}
