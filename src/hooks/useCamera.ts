"use client";
import { useCallback, useEffect, useState } from "react";
import { hasCameraApi, inAppBrowserName, isSecure } from "@/lib/env";
import { useDocumentVisible } from "./useIsClient";

export type Facing = "environment" | "user";
export type CameraErrorKind = "insecure" | "denied" | "notfound" | "busy" | "inapp" | "unsupported" | "unknown";
export type CameraStatus = "idle" | "starting" | "live" | "paused" | "error";

export interface CameraDevice {
  deviceId: string;
  label: string;
}

interface Session {
  key: string;
  stream: MediaStream | null;
  error: CameraErrorKind | null;
  errorMessage?: string;
}

const BAD_LABEL = /ultra|0[.,]5|wide[- ]?angle 0|tele|macro|depth|infrared|\bir\b|tof/i;
const prefKey = (f: Facing) => `rg.cam.${f}`;

function readPref(f: Facing): string | null {
  try {
    return localStorage.getItem(prefKey(f));
  } catch {
    return null;
  }
}
function writePref(f: Facing, id: string) {
  try {
    localStorage.setItem(prefKey(f), id);
  } catch {
    /* ignore */
  }
}

/** Pre-flight checks that don't need getUserMedia. */
export function cameraPrecheck(): CameraErrorKind | null {
  if (typeof window === "undefined") return null;
  if (!isSecure()) return "insecure";
  if (!hasCameraApi()) return inAppBrowserName() ? "inapp" : "unsupported";
  return null;
}

function classify(err: unknown): CameraErrorKind {
  const name = (err as { name?: string })?.name ?? "";
  if (name === "NotAllowedError" || name === "SecurityError" || name === "PermissionDeniedError")
    return inAppBrowserName() ? "inapp" : "denied";
  if (name === "NotFoundError" || name === "DevicesNotFoundError" || name === "OverconstrainedError") return "notfound";
  if (name === "NotReadableError" || name === "TrackStartError" || name === "AbortError") return "busy";
  return "unknown";
}

async function openStream(facing: Facing, deviceId: string | null): Promise<MediaStream> {
  const md = navigator.mediaDevices;
  const ideal = { width: { ideal: 1920 }, height: { ideal: 1080 }, frameRate: { ideal: 30 } };
  const attempts: MediaStreamConstraints[] = [];
  if (deviceId) attempts.push({ audio: false, video: { deviceId: { exact: deviceId }, ...ideal } });
  attempts.push({ audio: false, video: { facingMode: { ideal: facing }, ...ideal } });
  attempts.push({ audio: false, video: { facingMode: facing } });
  attempts.push({ audio: false, video: true });
  let lastErr: unknown = null;
  for (const c of attempts) {
    try {
      return await md.getUserMedia(c);
    } catch (e) {
      lastErr = e;
      const name = (e as { name?: string })?.name;
      // Only retry with looser constraints for constraint / device problems.
      if (name !== "OverconstrainedError" && name !== "NotFoundError" && name !== "NotReadableError") throw e;
    }
  }
  throw lastErr;
}

export function stopStream(s: MediaStream | null | undefined) {
  s?.getTracks().forEach((t) => t.stop());
}

/** Attach a stream to a <video> and start playback (no-op if already attached). */
export function attachStream(video: HTMLVideoElement, stream: MediaStream | null) {
  if (video.srcObject === stream) return;
  video.srcObject = stream;
  if (stream) video.play().catch(() => {});
}

interface Options {
  enabled: boolean;
  facing: Facing;
  video: HTMLVideoElement | null;
}

/**
 * Camera lifecycle: starts after the user enabled it, stops on disable /
 * unmount / page hidden, restarts when visible again. Remembers the chosen
 * device per facing and prefers the main wide camera over ultra-wide/tele.
 */
export function useCamera({ enabled, facing, video }: Options) {
  const visible = useDocumentVisible();
  const [retry, setRetry] = useState(0);
  const [requested, setRequested] = useState<{ facing: Facing; id: string | null } | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [devices, setDevices] = useState<CameraDevice[]>([]);

  const deviceId = requested && requested.facing === facing ? requested.id : null;
  const active = enabled && visible;
  const key = `${active}|${facing}|${deviceId ?? ""}|${retry}`;

  useEffect(() => {
    if (!active) return;
    const pre = cameraPrecheck();
    let cancelled = false;
    let stream: MediaStream | null = null;
    (async () => {
      if (pre) {
        setSession({ key, stream: null, error: pre });
        return;
      }
      try {
        const want = deviceId ?? readPref(facing);
        stream = await openStream(facing, want);
        if (cancelled) {
          stopStream(stream);
          return;
        }
        // Enumerate cameras (labels are available after permission).
        let cams: CameraDevice[] = [];
        try {
          const all = await navigator.mediaDevices.enumerateDevices();
          cams = all
            .filter((d) => d.kind === "videoinput")
            .map((d, i) => ({ deviceId: d.deviceId, label: d.label || `Camera ${i + 1}` }));
        } catch {
          /* ignore */
        }
        if (cancelled) {
          stopStream(stream);
          return;
        }
        setDevices(cams);
        const track = stream.getVideoTracks()[0];
        const label = track?.label ?? "";
        // Auto-pick the main wide camera when nothing was chosen yet.
        if (!want && facing === "environment" && BAD_LABEL.test(label) && cams.length > 1) {
          const better = cams.find((c) => /back|rear|environment|facing back/i.test(c.label) && !BAD_LABEL.test(c.label));
          if (better) {
            writePref(facing, better.deviceId);
            stopStream(stream);
            stream = null;
            setRequested({ facing, id: better.deviceId });
            return;
          }
        }
        setSession({ key, stream, error: null });
      } catch (e) {
        if (cancelled) return;
        setSession({ key, stream: null, error: classify(e), errorMessage: (e as Error)?.message });
      }
    })();
    return () => {
      cancelled = true;
      stopStream(stream);
    };
  }, [active, facing, deviceId, retry, key]);

  const current = session && session.key === key ? session : null;
  const stream = active ? (current?.stream ?? null) : null;

  // Attach to the <video> element.
  useEffect(() => {
    if (video) attachStream(video, stream);
  }, [video, stream]);

  const status: CameraStatus = !enabled
    ? "idle"
    : !visible
      ? "paused"
      : current?.error
        ? "error"
        : stream
          ? "live"
          : "starting";

  const track = stream?.getVideoTracks()[0] ?? null;
  const activeDeviceId = track?.getSettings?.().deviceId ?? null;

  const switchCamera = useCallback(() => {
    if (devices.length < 2) return;
    const idx = Math.max(0, devices.findIndex((d) => d.deviceId === activeDeviceId));
    const next = devices[(idx + 1) % devices.length];
    writePref(facing, next.deviceId);
    setRequested({ facing, id: next.deviceId });
  }, [devices, activeDeviceId, facing]);

  const retryNow = useCallback(() => setRetry((r) => r + 1), []);

  return {
    status,
    stream,
    track,
    error: status === "error" ? (current?.error ?? "unknown") : null,
    errorMessage: current?.errorMessage,
    devices,
    activeDeviceId,
    activeLabel: track?.label ?? "",
    switchCamera,
    retry: retryNow,
  };
}
