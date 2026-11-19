"use client";

export function Toggle({
  checked,
  onChange,
  label,
  hint,
  disabled,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  hint?: string;
  disabled?: boolean;
}) {
  return (
    <label className={`flex min-h-14 cursor-pointer items-center justify-between gap-4 py-2 ${disabled ? "opacity-50" : ""}`}>
      <span className="flex flex-col">
        <span className="text-base text-ink">{label}</span>
        {hint && <span className="text-sm text-muted">{hint}</span>}
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={`relative h-8 w-14 shrink-0 rounded-full transition-colors ${checked ? "bg-accent" : "bg-surface-3"}`}
      >
        <span
          className={`absolute top-1 left-1 h-6 w-6 rounded-full bg-white shadow transition-transform ${checked ? "translate-x-6" : ""}`}
        />
      </button>
    </label>
  );
}
