"use client";
import { ArrowLeft } from "lucide-react";
import { useApp } from "@/components/AppProvider";
import type { ReactNode } from "react";

export function ViewHeader({ title, right }: { title: string; right?: ReactNode }) {
  const { navigate, t } = useApp();
  return (
    <header className="safe-top no-print sticky top-0 z-30 -mx-4 mb-4 flex items-center gap-2 border-b border-line/60 bg-bg/90 px-2 pb-2 backdrop-blur">
      <button
        type="button"
        onClick={() => navigate("home")}
        aria-label={t("back")}
        className="inline-flex min-h-12 min-w-12 items-center justify-center rounded-full hover:bg-white/5"
      >
        <ArrowLeft size={24} />
      </button>
      <h1 className="flex-1 truncate text-xl font-semibold">{title}</h1>
      {right}
    </header>
  );
}
