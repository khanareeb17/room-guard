"use client";
import { useEffect, useState, useSyncExternalStore } from "react";
import type { Confidence, DetectMode, FrameStats, Sensitivity, TrackView, Verdict } from "@/lib/detection/types";
import type { FromWorker, ToWorker } from "@/workers/protocol";

const RES_STEPS = [320, 360, 480, 640];
const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export interface TorchHandle {
  supported: boolean;
  on: boolean;
  set: (on: boolean) => Promise<boolean>;
  requested: { current: boolean };
}

export interface DetectorSnapshot {
  tracks: TrackView[];
  stats: FrameStats | null;
  fps: number;
  procWidth: number;
  verifyingId: number | null;
  spotsChecked: number;
  bestLevel: Confidence;
  bestValue: number;
  running: boolean;
  pipelineMode: "bitmap" | "canvas" | "pending";
  /** performance.now() when this snapshot was published. */
  at: number;
}

export type DetectorEvent =
  | { type: "level"; track: TrackView; prev: Confidence }
  | { type: "verdict"; trackId: number; verdict: Verdict; track?: TrackView };

interface Config {
  mode: DetectMode;
  sensitivity: Sensitivity;
  zoom: number;
  debug: boolean;
  autoVerify: boolean;
}

const EMPTY: DetectorSnapshot = {
  tracks: [],
  stats: null,
  fps: 0,
  procWidth: 480,
  verifyingId: null,
  spotsChecked: 0,
  bestLevel: "none",
  bestValue: 0,
  running: false,
  pipelineMode: "pending",
  at: 0,
};

const rank: Record<Confidence, number> = { none: 0, low: 1, possible: 2, likely: 3 };

/**
 * Main-thread side of detection: grabs downscaled frames (one in flight at a
 * time), talks to the worker, adapts resolution, runs torch verification and
 * publishes throttled snapshots for React. The overlay reads `tracks`
 * directly every animation frame for smooth markers.
 */
export class DetectorController {
  private worker: Worker | null = null;
  private workerReady = false;
  private offscreen = false;
  private useBitmap = true;
  private video: HTMLVideoElement | null = null;
  private running = false;
  private inFlight = false;
  private rvfc: number | null = null;
  private raf: number | null = null;
  private canvas: HTMLCanvasElement | null = null;
  private resIdx = 2;
  private procEma = 0;
  private framesSinceRes = 0;
  private fpsCount = 0;
  private fpsT0 = 0;
  private fps = 0;
  private lastPublish = 0;
  private seen = new Set<number>();
  private levels = new Map<number, Confidence>();
  private lastVerifyAt = new Map<number, number>();
  private lastAnyVerify = 0;
  private pending = new Map<string, (v: unknown) => void>();
  private listeners = new Set<() => void>();
  private eventListeners = new Set<(e: DetectorEvent) => void>();
  private snapshot: DetectorSnapshot = EMPTY;
  private cfg: Config = { mode: "lens", sensitivity: "normal", zoom: 1, debug: false, autoVerify: true };

  tracks: TrackView[] = [];
  stats: FrameStats | null = null;
  lastMean = 0;
  verifyingId: number | null = null;
  torch: TorchHandle | null = null;
  setTorch(t: TorchHandle) {
    this.torch = t;
  }
  mask: { data: Uint8Array; w: number; h: number } | null = null;

  subscribe = (fn: () => void) => {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  };
  getSnapshot = () => this.snapshot;

  onEvent(fn: (e: DetectorEvent) => void) {
    this.eventListeners.add(fn);
    return () => {
      this.eventListeners.delete(fn);
    };
  }

  configure(cfg: Config) {
    const changed =
      cfg.mode !== this.cfg.mode ||
      cfg.sensitivity !== this.cfg.sensitivity ||
      cfg.zoom !== this.cfg.zoom ||
      cfg.debug !== this.cfg.debug;
    this.cfg = cfg;
    if (!cfg.debug) this.mask = null;
    if (changed) this.post({ type: "config", opts: { mode: cfg.mode, sensitivity: cfg.sensitivity, zoom: cfg.zoom }, debug: cfg.debug });
  }

  private ensureWorker() {
    if (this.worker) return;
    try {
      this.worker = new Worker(new URL("../workers/detector.worker.ts", import.meta.url), { type: "module" });
    } catch {
      this.worker = null;
      return;
    }
    this.worker.onmessage = (e: MessageEvent<FromWorker>) => this.onMessage(e.data);
    this.worker.onerror = () => {
      this.inFlight = false;
    };
    this.post({
      type: "config",
      opts: { mode: this.cfg.mode, sensitivity: this.cfg.sensitivity, zoom: this.cfg.zoom },
      debug: this.cfg.debug,
    });
  }

  private post(msg: ToWorker, transfer?: Transferable[]) {
    if (!this.worker) return;
    if (transfer) this.worker.postMessage(msg, transfer);
    else this.worker.postMessage(msg);
  }

  start(video: HTMLVideoElement) {
    this.ensureWorker();
    this.video = video;
    if (this.running) return;
    this.running = true;
    this.fpsT0 = performance.now();
    this.fpsCount = 0;
    this.schedule();
    this.publish(true);
  }

  stop() {
    this.running = false;
    if (this.rvfc !== null && this.video && "cancelVideoFrameCallback" in this.video) {
      (this.video as HTMLVideoElement & { cancelVideoFrameCallback(h: number): void }).cancelVideoFrameCallback(this.rvfc);
    }
    if (this.raf !== null) cancelAnimationFrame(this.raf);
    this.rvfc = null;
    this.raf = null;
    this.inFlight = false;
    this.tracks = [];
    this.levels.clear();
    this.post({ type: "clear-tracks" });
    this.publish(true);
  }

  dispose() {
    this.stop();
    this.worker?.terminate();
    this.worker = null;
    this.workerReady = false;
    this.pending.forEach((r) => r(null));
    this.pending.clear();
  }

  /** Forget everything incl. safe zones (new room / new session). */
  resetSession() {
    this.seen.clear();
    this.levels.clear();
    this.lastVerifyAt.clear();
    this.tracks = [];
    this.post({ type: "reset" });
    this.publish(true);
  }

  markSafe(id: number) {
    this.post({ type: "mark-safe", id, t: performance.now() });
    this.tracks = this.tracks.map((t) => (t.id === id ? { ...t, safe: true } : t));
    this.publish(true);
  }

  private schedule = () => {
    if (!this.running || !this.video) return;
    const v = this.video as HTMLVideoElement & {
      requestVideoFrameCallback?: (cb: () => void) => number;
    };
    if (typeof v.requestVideoFrameCallback === "function") this.rvfc = v.requestVideoFrameCallback(this.onFrame);
    else this.raf = requestAnimationFrame(this.onFrame);
  };

  private onFrame = () => {
    this.grab();
    this.schedule();
  };

  private async grab() {
    const v = this.video;
    if (!this.running || this.inFlight || !this.worker || !this.workerReady || !v) return;
    if (v.readyState < 2 || !v.videoWidth || !v.videoHeight) return;
    this.inFlight = true;
    const w = RES_STEPS[this.resIdx];
    const h = Math.max(2, Math.round((w * v.videoHeight) / v.videoWidth / 2) * 2);
    const t = performance.now();
    const torch = this.torch?.supported ? this.torch.requested.current : true;
    try {
      if (this.useBitmap && this.offscreen && typeof createImageBitmap === "function") {
        const bitmap = await createImageBitmap(v, { resizeWidth: w, resizeHeight: h, resizeQuality: "low" });
        if (!this.running) {
          bitmap.close();
          this.inFlight = false;
          return;
        }
        this.post({ type: "frame", w, h, t, torch, bitmap }, [bitmap]);
      } else {
        if (!this.canvas) this.canvas = document.createElement("canvas");
        const c = this.canvas;
        if (c.width !== w || c.height !== h) {
          c.width = w;
          c.height = h;
        }
        const ctx = c.getContext("2d", { willReadFrequently: true });
        if (!ctx) throw new Error("no 2d");
        ctx.drawImage(v, 0, 0, w, h);
        const img = ctx.getImageData(0, 0, w, h);
        this.post({ type: "frame", w, h, t, torch, buffer: img.data.buffer }, [img.data.buffer]);
      }
    } catch {
      if (this.useBitmap) this.useBitmap = false;
      this.inFlight = false;
    }
  }

  private onMessage(m: FromWorker) {
    switch (m.type) {
      case "ready":
        this.workerReady = true;
        this.offscreen = m.offscreen;
        this.publish(true);
        return;
      case "error":
        // e.g. bitmap path failed inside the worker → use the canvas path.
        this.useBitmap = false;
        this.inFlight = false;
        return;
      case "verify-started":
        this.resolve("verify-started", m.ok);
        return;
      case "verdict":
        this.resolve("verdict", m.result);
        return;
      case "result":
        this.inFlight = false;
        if (!this.running) return;
        this.onResult(m);
        return;
    }
  }

  private resolve(type: string, v: unknown) {
    const r = this.pending.get(type);
    if (r) {
      this.pending.delete(type);
      r(v);
    }
  }

  private request<T>(type: string, msg: ToWorker, timeout = 1500): Promise<T | null> {
    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        this.pending.delete(type);
        resolve(null);
      }, timeout);
      this.pending.set(type, (v) => {
        clearTimeout(timer);
        resolve(v as T);
      });
      this.post(msg);
    });
  }

  private onResult(m: Extract<FromWorker, { type: "result" }>) {
    const now = performance.now();
    this.tracks = m.tracks;
    this.stats = m.stats;
    this.lastMean = m.stats.mean;
    if (m.mask && m.maskW && m.maskH) this.mask = { data: m.mask, w: m.maskW, h: m.maskH };

    // fps
    this.fpsCount++;
    if (now - this.fpsT0 >= 1000) {
      this.fps = (this.fpsCount * 1000) / (now - this.fpsT0);
      this.fpsCount = 0;
      this.fpsT0 = now;
    }

    // Adaptive processing resolution.
    this.procEma = this.procEma === 0 ? m.stats.procMs : 0.9 * this.procEma + 0.1 * m.stats.procMs;
    this.framesSinceRes++;
    if (this.framesSinceRes > 20 && this.verifyingId === null) {
      if (this.procEma > 40 && this.resIdx > 0) {
        this.resIdx--;
        this.framesSinceRes = 0;
      } else if (this.procEma < 15 && this.resIdx < RES_STEPS.length - 1 && this.fps >= 20) {
        this.resIdx++;
        this.framesSinceRes = 0;
      }
    }

    // Level transitions → events.
    let levelChanged = false;
    for (const t of m.tracks) {
      if (t.hits >= 3) this.seen.add(t.id);
      const prev = this.levels.get(t.id) ?? "none";
      if (prev !== t.confidence) {
        this.levels.set(t.id, t.confidence);
        if (rank[t.confidence] > rank[prev] && rank[t.confidence] >= 2) {
          levelChanged = true;
          this.emit({ type: "level", track: t, prev });
        }
      }
    }
    if (this.levels.size > 200) {
      const alive = new Set(m.tracks.map((t) => t.id));
      for (const id of this.levels.keys()) if (!alive.has(id)) this.levels.delete(id);
    }

    this.maybeAutoVerify(now);
    this.publish(levelChanged);
  }

  private maybeAutoVerify(now: number) {
    if (!this.cfg.autoVerify || this.cfg.mode !== "lens" || !this.torch?.supported || !this.torch.on) return;
    if (this.verifyingId !== null || now - this.lastAnyVerify < 3000) return;
    let best: TrackView | null = null;
    for (const t of this.tracks) {
      if (t.safe || t.verdict !== "unverified" || rank[t.confidence] < 2 || t.hits < 5) continue;
      const last = this.lastVerifyAt.get(t.id);
      if (last !== undefined && now - last < 3000) continue;
      if (!best || t.value > best.value) best = t;
    }
    if (best) void this.verify(best.id);
  }

  /** Torch verification (§5.6). */
  async verify(id: number): Promise<Verdict | "no-torch" | "busy" | "gone"> {
    const torch = this.torch;
    if (!torch?.supported) return "no-torch";
    if (this.verifyingId !== null || !this.worker) return "busy";
    const now = performance.now();
    this.verifyingId = id;
    this.lastVerifyAt.set(id, now);
    this.lastAnyVerify = now;
    this.publish(true);
    const wasOn = torch.on;
    let verdict: Verdict = "inconclusive";
    try {
      if (!wasOn) {
        await torch.set(true);
        await sleep(350);
      }
      const ok = await this.request<boolean>("verify-started", { type: "verify-start", id });
      if (!ok) return "gone";
      const baseline = this.lastMean;
      for (let c = 0; c < 3; c++) {
        await this.pulse(torch, false, baseline);
        await this.pulse(torch, true, baseline);
      }
      const res = await this.request<{ trackId: number; outcome: { verdict: Verdict } } | null>("verdict", {
        type: "verify-finish",
      });
      verdict = res?.outcome.verdict ?? "inconclusive";
      this.tracks = this.tracks.map((t) => (t.id === id ? { ...t, verdict } : t));
      this.emit({ type: "verdict", trackId: id, verdict, track: this.tracks.find((t) => t.id === id) });
      return verdict;
    } finally {
      this.verifyingId = null;
      this.lastAnyVerify = performance.now();
      if (!wasOn) await torch.set(false);
      else if (!torch.requested.current) await torch.set(true);
      this.publish(true);
    }
  }

  /**
   * Switch the torch and wait until the frame brightness actually changes
   * (devices have variable latency), then hold the state for ~250 ms.
   */
  private async pulse(torch: TorchHandle, on: boolean, baseline: number) {
    await torch.set(on);
    const t0 = performance.now();
    while (performance.now() - t0 < 500) {
      const m = this.lastMean;
      if (on ? m >= baseline * 0.93 : m <= baseline * 0.88) break;
      await sleep(30);
    }
    await sleep(250);
  }

  private emit(e: DetectorEvent) {
    this.eventListeners.forEach((fn) => fn(e));
  }

  private publish(force = false) {
    const now = performance.now();
    if (!force && now - this.lastPublish < 120) return;
    this.lastPublish = now;
    let bestLevel: Confidence = "none";
    let bestValue = 0;
    for (const t of this.tracks) {
      if (t.safe || t.verdict === "light") continue;
      if (rank[t.confidence] > rank[bestLevel] || (t.confidence === bestLevel && t.value > bestValue)) {
        bestLevel = t.confidence;
        bestValue = t.value;
      }
    }
    this.snapshot = {
      tracks: this.tracks,
      stats: this.stats,
      fps: this.fps,
      procWidth: RES_STEPS[this.resIdx],
      verifyingId: this.verifyingId,
      spotsChecked: this.seen.size,
      bestLevel,
      bestValue,
      running: this.running,
      pipelineMode: !this.workerReady ? "pending" : this.useBitmap && this.offscreen ? "bitmap" : "canvas",
      at: now,
    };
    this.listeners.forEach((l) => l());
  }
}

interface Options extends Config {
  active: boolean;
  torch: TorchHandle;
}

export function useDetector(video: HTMLVideoElement | null, opts: Options) {
  const [ctrl] = useState(() => new DetectorController());
  const { active, mode, sensitivity, zoom, debug, autoVerify, torch } = opts;

  useEffect(() => {
    ctrl.configure({ mode, sensitivity, zoom, debug, autoVerify });
  }, [ctrl, mode, sensitivity, zoom, debug, autoVerify]);

  useEffect(() => {
    ctrl.setTorch(torch);
  }, [ctrl, torch]);

  useEffect(() => {
    if (!active || !video) return;
    ctrl.start(video);
    return () => ctrl.stop();
  }, [ctrl, active, video]);

  useEffect(() => () => ctrl.dispose(), [ctrl]);

  const snap = useSyncExternalStore(ctrl.subscribe, ctrl.getSnapshot, ctrl.getSnapshot);
  return { ctrl, snap };
}
