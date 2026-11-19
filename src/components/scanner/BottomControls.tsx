"use client";
import { Flashlight, FlashlightOff, Gauge, RefreshCcw, Square, SwitchCamera } from "lucide-react";
import { IconButton } from "@/components/ui/Button";
import { Slider } from "@/components/ui/Slider";
import { useApp } from "@/components/AppProvider";
import { CaptureButton } from "./CaptureButton";

interface Props {
  mode: "lens" | "ir";
  torch: { supported: boolean; on: boolean };
  onTorch: () => void;
  onCapture: () => void;
  capturing: boolean;
  sensitivityLabel: string;
  onSensitivity: () => void;
  canSwitch: boolean;
  onSwitch: () => void;
  onFlipFacing?: () => void;
  zoom: { supported: boolean; min: number; max: number; step: number; value: number; set: (v: number) => void };
  onStop: () => void;
}

export function BottomControls(p: Props) {
  const { t } = useApp();
  return (
    <div className="safe-bottom absolute inset-x-0 bottom-0 z-20 bg-gradient-to-t from-black/80 via-black/50 to-transparent px-4 pt-10">
      {p.zoom.supported && (
        <div className="mx-auto mb-2 max-w-sm">
          <Slider
            label={t("zoom")}
            value={p.zoom.value}
            min={p.zoom.min}
            max={p.zoom.max}
            step={p.zoom.step}
            onChange={(v) => p.zoom.set(v)}
            format={(v) => `${v.toFixed(1)}×`}
          />
        </div>
      )}
      <div className="mx-auto flex max-w-md items-center justify-between">
        {p.mode === "lens" ? (
          <IconButton
            label={p.torch.supported ? (p.torch.on ? t("torchOn") : t("torchOff")) : t("torchNA")}
            active={p.torch.on}
            disabled={!p.torch.supported}
            aria-pressed={p.torch.on}
            onClick={p.onTorch}
            className="h-14 w-14"
          >
            {p.torch.on ? <Flashlight size={24} /> : <FlashlightOff size={24} />}
          </IconButton>
        ) : (
          <IconButton label={t("switchCamera")} onClick={p.onFlipFacing} className="h-14 w-14">
            <RefreshCcw size={24} />
          </IconButton>
        )}
        <IconButton label={`${t("sensitivity")}: ${p.sensitivityLabel}`} onClick={p.onSensitivity} className="h-14 w-14">
          <span className="flex flex-col items-center leading-none">
            <Gauge size={20} />
            <span className="mt-0.5 text-[10px]">{p.sensitivityLabel}</span>
          </span>
        </IconButton>
        <CaptureButton label={t("capture")} onClick={p.onCapture} busy={p.capturing} />
        <IconButton label={t("switchCamera")} onClick={p.onSwitch} disabled={!p.canSwitch} className="h-14 w-14">
          <SwitchCamera size={24} />
        </IconButton>
        <IconButton label={t("stop")} onClick={p.onStop} className="h-14 w-14 !bg-danger/80 hover:!bg-danger">
          <Square size={22} fill="currentColor" />
        </IconButton>
      </div>
    </div>
  );
}
