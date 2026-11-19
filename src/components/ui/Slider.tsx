"use client";

export function Slider({
  value,
  min,
  max,
  step,
  onChange,
  label,
  format,
}: {
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
  label: string;
  format?: (v: number) => string;
}) {
  return (
    <label className="flex w-full items-center gap-3 text-sm text-white">
      <span className="sr-only">{label}</span>
      <span aria-hidden className="w-10 text-right tabular-nums">
        {format ? format(min) : min}
      </span>
      <input
        type="range"
        className="rg-range flex-1"
        min={min}
        max={max}
        step={step}
        value={value}
        aria-label={label}
        aria-valuetext={format ? format(value) : String(value)}
        onChange={(e) => onChange(Number(e.target.value))}
      />
      <span className="w-12 tabular-nums font-semibold">{format ? format(value) : value}</span>
    </label>
  );
}
