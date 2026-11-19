"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

/** Image-capture capabilities missing from the TS DOM lib. */
export interface ExtCaps {
  torch?: boolean;
  zoom?: { min: number; max: number; step?: number };
  exposureCompensation?: { min: number; max: number; step?: number };
  exposureMode?: string[];
  exposureTime?: { min: number; max: number; step?: number };
  focusMode?: string[];
  width?: { max?: number };
  height?: { max?: number };
}

type Adv = Record<string, string | number | boolean>;

export function getCaps(track: MediaStreamTrack | null): ExtCaps {
  if (!track || typeof track.getCapabilities !== "function") return {};
  try {
    return track.getCapabilities() as unknown as ExtCaps;
  } catch {
    return {};
  }
}

async function apply(track: MediaStreamTrack, adv: Adv): Promise<boolean> {
  try {
    await track.applyConstraints({ advanced: [adv as MediaTrackConstraintSet] });
    return true;
  } catch {
    return false;
  }
}

interface Options {
  /** Turn the torch on automatically when the track becomes available. */
  autoTorch: boolean;
  glintBoost: boolean;
}

/**
 * Torch, Glint Boost (low exposure), zoom and focus. Every capability is
 * feature-detected; failures degrade silently and never throw.
 */
export function useCameraControls(track: MediaStreamTrack | null, { autoTorch, glintBoost }: Options) {
  const caps = useMemo(() => getCaps(track), [track]);
  const torchSupported = !!caps.torch;
  const zoomCaps = caps.zoom && caps.zoom.max > caps.zoom.min ? caps.zoom : null;
  const ecCaps =
    caps.exposureCompensation && caps.exposureCompensation.max > caps.exposureCompensation.min
      ? caps.exposureCompensation
      : null;
  const manualExposure = !!(caps.exposureMode?.includes("manual") && caps.exposureTime);
  const boostSupported = !!ecCaps || manualExposure;

  const [torch, setTorchState] = useState<{ track: MediaStreamTrack | null; on: boolean }>({ track: null, on: false });
  const [zoom, setZoomState] = useState<{ track: MediaStreamTrack | null; value: number }>({ track: null, value: 1 });
  const [boostActive, setBoostActive] = useState<{ track: MediaStreamTrack | null; on: boolean }>({
    track: null,
    on: false,
  });
  /** Torch state requested right now (read by the frame loop for verification). */
  const torchRequested = useRef(false);

  const setTorch = useCallback(
    async (on: boolean) => {
      if (!track || !torchSupported) return false;
      torchRequested.current = on;
      const ok = await apply(track, { torch: on });
      if (ok) setTorchState({ track, on });
      return ok;
    },
    [track, torchSupported],
  );

  // Auto torch + continuous focus when a new track arrives.
  useEffect(() => {
    if (!track) return;
    torchRequested.current = false;
    let cancelled = false;
    (async () => {
      if (caps.focusMode?.includes("continuous")) await apply(track, { focusMode: "continuous" });
      if (autoTorch && caps.torch && !cancelled) {
        torchRequested.current = true;
        const ok = await apply(track, { torch: true });
        if (!cancelled) setTorchState({ track, on: ok });
        if (!ok) torchRequested.current = false;
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [track, autoTorch, caps]);

  // Glint Boost: push exposure down so lens glints stand out.
  useEffect(() => {
    if (!track || !boostSupported) return;
    let cancelled = false;
    (async () => {
      let ok = false;
      if (glintBoost) {
        if (ecCaps) {
          const v = ecCaps.min + (ecCaps.max - ecCaps.min) * 0.25;
          const step = ecCaps.step && ecCaps.step > 0 ? ecCaps.step : 0;
          ok = await apply(track, { exposureCompensation: step ? Math.round(v / step) * step : v });
        }
        if (!ok && manualExposure && caps.exposureTime) {
          // Short exposure (units are 100 µs in the spec): aim for ~1/250 s within range.
          const et = Math.max(caps.exposureTime.min, Math.min(caps.exposureTime.max, 40));
          ok = await apply(track, { exposureMode: "manual", exposureTime: et });
        }
      } else {
        if (ecCaps) await apply(track, { exposureCompensation: Math.max(ecCaps.min, Math.min(ecCaps.max, 0)) });
        if (manualExposure) await apply(track, { exposureMode: "continuous" });
      }
      if (!cancelled) setBoostActive({ track, on: glintBoost && ok });
    })();
    return () => {
      cancelled = true;
    };
  }, [track, glintBoost, boostSupported, ecCaps, manualExposure, caps.exposureTime]);

  const setZoom = useCallback(
    async (value: number) => {
      if (!track || !zoomCaps) return;
      const v = Math.max(zoomCaps.min, Math.min(zoomCaps.max, value));
      setZoomState({ track, value: v });
      await apply(track, { zoom: v });
    },
    [track, zoomCaps],
  );

  return {
    caps,
    torch: {
      supported: torchSupported,
      on: torch.track === track && torch.on,
      set: setTorch,
      requested: torchRequested,
    },
    zoom: zoomCaps
      ? {
          supported: true as const,
          min: zoomCaps.min,
          max: zoomCaps.max,
          step: zoomCaps.step || 0.1,
          value: zoom.track === track ? zoom.value : zoomCaps.min,
          set: setZoom,
        }
      : { supported: false as const, min: 1, max: 1, step: 0.1, value: 1, set: setZoom },
    glintBoost: { supported: boostSupported, active: boostActive.track === track && boostActive.on },
  };
}
