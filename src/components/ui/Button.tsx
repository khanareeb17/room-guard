"use client";
import type { ButtonHTMLAttributes, ReactNode } from "react";

type Variant = "primary" | "secondary" | "ghost" | "danger" | "outline";
type Size = "md" | "lg" | "sm";

const variants: Record<Variant, string> = {
  primary: "bg-accent text-accent-ink hover:bg-accent-strong active:bg-accent-strong font-semibold",
  secondary: "bg-surface-2 text-ink hover:bg-surface-3 border border-line",
  ghost: "bg-transparent text-ink hover:bg-white/5",
  danger: "bg-danger/15 text-red-300 border border-danger/40 hover:bg-danger/25",
  outline: "bg-transparent text-ink border border-line hover:bg-white/5",
};
const sizes: Record<Size, string> = {
  sm: "min-h-11 px-3 text-sm rounded-xl gap-1.5",
  md: "min-h-12 px-4 text-base rounded-2xl gap-2",
  lg: "min-h-16 px-6 text-lg rounded-2xl gap-3",
};

export function Button({
  variant = "secondary",
  size = "md",
  block,
  icon,
  className = "",
  children,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: Size;
  block?: boolean;
  icon?: ReactNode;
}) {
  return (
    <button
      type="button"
      className={`inline-flex items-center justify-center transition-colors disabled:opacity-50 disabled:pointer-events-none ${variants[variant]} ${sizes[size]} ${block ? "w-full" : ""} ${className}`}
      {...rest}
    >
      {icon}
      {children}
    </button>
  );
}

/** Round icon-only button with a required accessible label. */
export function IconButton({
  label,
  children,
  active,
  className = "",
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { label: string; active?: boolean }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={`inline-flex min-h-12 min-w-12 items-center justify-center rounded-full transition-colors disabled:opacity-40 ${
        active ? "bg-accent text-accent-ink" : "bg-black/45 text-white hover:bg-black/60"
      } backdrop-blur ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}
