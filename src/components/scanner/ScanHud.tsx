"use client";
import { ChevronDown, Flashlight, FlashlightOff, Sparkles, Volume2, VolumeX, Gauge, ListChecks } from "lucide-react";
import { useApp } from "@/components/AppProvider";

interface Props {
  mode: "lens" | "ir";
  roomLabel: string;
  onRoom: () => void;
  torch: { supported: boolean; on: boolean };
  boost: { supported: boolean; active: boolean };
  sensitivityLabel: string;
  spots: number;
  running: boolean;
  hint: string;
  hintTone: "normal" | "warn" | "alert";
  sound: boolean;
  onToggleSound: () => void;
  coverageLabel: string;
  onCoverage: () => void;
}

function Pill({ children, tone = "normal" }: { children: React.ReactNode; tone?: "normal" | "on" | "off" }) {
  return (
    <span
      className={`inline-flex h-8 items-center gap-1 rounded-full px-2.5 text-xs font-medium backdrop-blur ${
        tone === "on" ? "bg-accent/25 text-accent" : tone === "off" ? "bg-black/45 text-white/60" : "bg-black/45 text-white"
      }`}
    >
      {children}
    </span>
  );
}

export function ScanHud(p: Props) {
  const { t } = useApp();
  return (
    <div className="safe-top pointer-events-none absolute inset-x-0 top-0 z-20 bg-gradient-to-b from-black/70 to-transparent px-3 pb-8">
      <div className="pointer-events-auto flex items-center gap-2">
        <button
          type="button"
          onClick={p.onRoom}
          className="inline-flex min-h-11 items-center gap-1 rounded-full bg-black/50 px-3 text-sm font-semibold text-white backdrop-blur"
          aria-label={`${t("room")}: ${p.roomLabel}`}
        >
          {p.roomLabel}
          <ChevronDown size={16} aria-hidden />
        </button>
        <span className="flex-1" />
        <span className="inline-flex items-center gap-1.5 text-xs text-white/90" role="status">
          <span className="relative flex h-2.5 w-2.5" aria-hidden>
            {p.running && <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent opacity-75" />}
            <span className={`relative inline-flex h-2.5 w-2.5 rounded-full ${p.running ? "bg-accent" : "bg-white/40"}`} />
          </span>
          {p.running ? t("detectionActive") : t("paused")}
        </span>
        <button
          type="button"
          onClick={p.onToggleSound}
          aria-label={p.sound ? t("soundOn") : t("soundOff")}
          aria-pressed={p.sound}
          className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-full bg-black/50 text-white backdrop-blur"
        >
          {p.sound ? <Volume2 size={20} /> : <VolumeX size={20} />}
        </button>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        {p.mode === "lens" && (
          <>
            <Pill tone={p.torch.supported ? (p.torch.on ? "on" : "off") : "off"}>
              {p.torch.on ? <Flashlight size={14} aria-hidden /> : <FlashlightOff size={14} aria-hidden />}
              {p.torch.supported ? (p.torch.on ? t("torchOn") : t("torchOff")) : t("torchNA")}
            </Pill>
            <Pill tone={p.boost.supported ? (p.boost.active ? "on" : "off") : "off"}>
              <Sparkles size={14} aria-hidden />
              {p.boost.supported ? (p.boost.active ? t("glintBoostOn") : t("glintBoostOff")) : t("glintBoostNA")}
            </Pill>
          </>
        )}
        <Pill>
          <Gauge size={14} aria-hidden />
          {p.sensitivityLabel}
        </Pill>
        <Pill>
          {t("spotsChecked")}: <span className="tabular-nums font-semibold">{p.spots}</span>
        </Pill>
        <button
          type="button"
          onClick={p.onCoverage}
          className="pointer-events-auto inline-flex min-h-8 items-center gap-1 rounded-full bg-black/45 px-2.5 text-xs font-medium text-white backdrop-blur"
        >
          <ListChecks size={14} aria-hidden />
          {p.coverageLabel}
        </button>
      </div>
      <p className="mt-3 text-center">
        <span
          className={`inline-block rounded-full bg-black/55 px-4 py-1.5 text-base font-semibold backdrop-blur ${
            p.hintTone === "alert" ? "text-red-300" : p.hintTone === "warn" ? "text-amber-300" : "text-white"
          }`}
        >
          {p.hint}
        </span>
      </p>
    </div>
  );
}
