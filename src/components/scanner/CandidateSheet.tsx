"use client";
import { useEffect, useRef } from "react";
import { Camera, CheckCircle2, Loader2, ScanSearch } from "lucide-react";
import { Sheet } from "@/components/ui/Sheet";
import { Button } from "@/components/ui/Button";
import { useApp } from "@/components/AppProvider";
import { drawCrop } from "@/lib/capture";
import type { TrackView } from "@/lib/detection/types";
import type { I18nKey } from "@/lib/i18n";

interface Props {
  track: TrackView | null;
  open: boolean;
  onClose: () => void;
  video: HTMLVideoElement | null;
  getTrack: (id: number) => TrackView | undefined;
  mirror: boolean;
  mode: "lens" | "ir";
  torchSupported: boolean;
  verifying: boolean;
  onVerify: () => void;
  onCapture: () => void;
  onMarkSafe: () => void;
}

export function CandidateSheet(p: Props) {
  const { t } = useApp();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const id = p.track?.id;
  const { video, getTrack, open } = p;

  // Live zoomed crop around the candidate.
  useEffect(() => {
    if (!open || id === undefined || !video) return;
    let raf = 0;
    let last = { x: 0.5, y: 0.5 };
    const loop = () => {
      raf = requestAnimationFrame(loop);
      const tr = getTrack(id);
      if (tr) last = { x: tr.x, y: tr.y };
      if (canvasRef.current) drawCrop(video, canvasRef.current, last.x, last.y);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [open, id, video, getTrack]);

  const tr = p.track;
  let title: I18nKey = "verdictUnverified";
  let body: I18nKey | null = null;
  let tone = "text-amber-300";
  if (tr) {
    if (tr.safe) {
      title = "markedSafe";
      tone = "text-muted";
    } else if (p.verifying || tr.verdict === "verifying") {
      title = "verdictVerifying";
    } else if (tr.verdict === "reflection") {
      title = "verdictReflection";
      body = "verdictReflectionBody";
      tone = "text-red-300";
    } else if (tr.verdict === "light") {
      title = "verdictLight";
      body = "verdictLightBody";
      tone = "text-sky-300";
    } else if (tr.verdict === "inconclusive") {
      title = "verdictInconclusive";
      body = "verdictInconclusiveBody";
    } else if (p.mode === "ir") {
      title = "markerIr";
    } else if (tr.confidence === "likely") {
      title = "markerLikely";
      tone = "text-red-300";
    } else {
      title = "markerPossible";
    }
  }

  return (
    <Sheet open={p.open} onClose={p.onClose} title={t("candidate")} closeLabel={t("close")}>
      <div className="flex gap-4">
        <canvas
          ref={canvasRef}
          width={160}
          height={160}
          className="h-32 w-32 shrink-0 rounded-2xl border border-line bg-black"
          style={p.mirror ? { transform: "scaleX(-1)" } : undefined}
          aria-label={t("candidate")}
          role="img"
        />
        <div className="min-w-0 flex-1">
          <p className="text-xs uppercase tracking-wide text-faint">{t("verdict")}</p>
          <p className={`text-lg font-semibold ${tone}`}>
            {p.verifying && <Loader2 className="mr-1 inline animate-spin" size={18} aria-hidden />}
            {t(title)}
          </p>
          {tr && !tr.safe && p.mode === "lens" && (
            <p className="mt-1 text-sm text-muted">
              {t("confidence")}: {tr.confidence === "likely" ? t("confLikely") : tr.confidence === "possible" ? t("confPossible") : t("confLow")}
            </p>
          )}
        </div>
      </div>
      {body && <p className="mt-3 text-sm text-ink/90">{t(body)}</p>}
      {p.mode === "lens" && !p.torchSupported && <p className="mt-3 text-sm text-amber-200">{t("verdictNoTorch")}</p>}
      <div className="mt-4 grid gap-2 pb-2">
        {p.mode === "lens" && p.torchSupported && (
          <Button
            variant="primary"
            icon={<ScanSearch size={20} />}
            onClick={p.onVerify}
            disabled={p.verifying || !tr || tr.safe}
          >
            {tr && tr.verdict !== "unverified" ? t("verifyAgain") : t("verify")}
          </Button>
        )}
        <Button icon={<Camera size={20} />} onClick={p.onCapture}>
          {t("capture")}
        </Button>
        <Button variant="outline" icon={<CheckCircle2 size={20} />} onClick={p.onMarkSafe} disabled={!tr || tr.safe}>
          {t("markSafe")}
        </Button>
      </div>
    </Sheet>
  );
}
