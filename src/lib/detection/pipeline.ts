import { computeFeatures } from "./blobFeatures";
import { labelComponents } from "./components";
import { buildIntegral } from "./integralImage";
import { rejectIrBlob, scoreIrBlob } from "./irDetect";
import { computeLuminance } from "./luminance";
import { estimateShift } from "./motion";
import { rejectBlob, scoreLensBlob } from "./scoring";
import { buildMask, localRadiusFor, thresholdsFor } from "./threshold";
import { analyzeVerification, measureSpot } from "./torchVerify";
import { Tracker, type Motion } from "./tracker";
import type { PipelineOptions, PipelineResult, ScoredBlob, VerifyOutcome, VerifySample } from "./types";

/**
 * The full per-frame pipeline with buffers reused between frames.
 * Pure TypeScript — used by the Web Worker and directly by unit tests.
 */
export class DetectorPipeline {
  private cap = 0;
  private Y = new Uint8Array(0);
  private integral = new Uint32Array(0);
  private mask = new Uint8Array(0);
  private labels = new Int32Array(0);
  private stack = new Int32Array(0);
  private col = new Float32Array(0);
  private row = new Float32Array(0);
  private prevCol = new Float32Array(0);
  private prevRow = new Float32Array(0);
  private prevW = 0;
  private prevH = 0;
  private costs = new Float32Array(256);
  readonly tracker = new Tracker();
  private verifying: { trackId: number; samples: VerifySample[] } | null = null;
  lastW = 0;
  lastH = 0;

  private ensure(w: number, h: number): void {
    const n = w * h;
    if (n > this.cap) {
      this.cap = n;
      this.Y = new Uint8Array(n);
      this.mask = new Uint8Array(n);
      this.labels = new Int32Array(n);
      this.stack = new Int32Array(n);
    }
    if (this.integral.length < (w + 1) * (h + 1)) this.integral = new Uint32Array((w + 1) * (h + 1));
    if (this.col.length < w) {
      this.col = new Float32Array(w);
      this.prevCol = new Float32Array(w);
    }
    if (this.row.length < h) {
      this.row = new Float32Array(h);
      this.prevRow = new Float32Array(h);
    }
  }

  reset(): void {
    this.tracker.reset();
    this.prevW = 0;
    this.prevH = 0;
    this.verifying = null;
  }

  /** Read-only view of the last candidate mask (debug preview). */
  getMask(): Uint8Array {
    return this.mask.subarray(0, this.lastW * this.lastH);
  }

  startVerify(trackId: number): boolean {
    if (!this.tracker.getTrack(trackId)) return false;
    this.tracker.setVerdict(trackId, "verifying");
    this.verifying = { trackId, samples: [] };
    return true;
  }

  isVerifying(): boolean {
    return this.verifying !== null;
  }

  finishVerify(): { trackId: number; outcome: VerifyOutcome; samples: number } | null {
    const v = this.verifying;
    if (!v) return null;
    this.verifying = null;
    const outcome = analyzeVerification(v.samples);
    this.tracker.setVerdict(v.trackId, outcome.verdict);
    return { trackId: v.trackId, outcome, samples: v.samples.length };
  }

  process(
    rgba: Uint8ClampedArray | Uint8Array,
    w: number,
    h: number,
    opts: PipelineOptions,
    now: number,
    torchRequested = true,
  ): PipelineResult {
    const t0 = typeof performance !== "undefined" ? performance.now() : Date.now();
    this.ensure(w, h);
    this.tracker.mode = opts.mode;
    const lum = computeLuminance(rgba, w, h, this.Y, this.col, this.row);

    // Global motion from projection profiles.
    let motion: Motion = { dx: 0, dy: 0, reliable: false };
    if (this.prevW === w && this.prevH === h) {
      const maxShift = Math.round(w * 0.08);
      const sx = estimateShift(this.prevCol, this.col, w, maxShift, this.costs);
      const sy = estimateShift(this.prevRow, this.row, h, Math.round(h * 0.08), this.costs);
      if (sx.confidence > 0.3 && sy.confidence > 0.3) {
        motion = { dx: sx.shift / w, dy: sy.shift / w, reliable: true };
      }
    }
    // On a resolution change (adaptive downscale) positions stay valid: they are normalised.
    this.prevCol.set(this.col.subarray(0, w));
    this.prevRow.set(this.row.subarray(0, h));
    this.prevW = w;
    this.prevH = h;
    this.lastW = w;
    this.lastH = h;

    const t = thresholdsFor(opts.sensitivity, opts.mode);
    const statsBase = {
      width: w,
      height: h,
      mean: lum.mean,
      std: lum.std,
      brightFraction: lum.brightFraction,
      motionX: motion.dx,
      motionY: motion.dy,
    };

    // While verifying, the torch blanks the scene: measure the spot only.
    if (this.verifying) {
      this.tracker.hold(motion, now);
      const tr = this.tracker.getTrack(this.verifying.trackId);
      if (tr) {
        const spot = measureSpot(this.Y, w, h, tr.x * w, tr.y * w, Math.max(4, tr.r * w * 2.5));
        this.verifying.samples.push({
          requested: torchRequested,
          frameMean: lum.mean,
          peak: spot.peak,
          contrast: spot.contrast,
          t: now,
        });
      }
      const tracks = this.tracker.snapshot(w, h, now);
      return {
        tracks,
        stats: { ...statsBase, candidatePixels: 0, blobCount: 0, acceptedBlobs: 0, procMs: elapsed(t0) },
      };
    }

    buildIntegral(this.Y, w, h, this.integral);
    const radius = localRadiusFor(w);
    const candidatePixels = buildMask(this.Y, this.integral, w, h, radius, t, lum.mean, lum.std, this.mask);
    const raw = candidatePixels > 0 ? labelComponents(this.mask, rgba, this.Y, w, h, this.labels, this.stack) : [];
    const accepted: ScoredBlob[] = [];
    for (const rb of raw) {
      const f = computeFeatures(rb, this.integral, w, h);
      if (opts.mode === "ir") {
        if (rejectIrBlob(f, w, h, t)) continue;
        accepted.push({ ...f, score: scoreIrBlob(f, w, h) });
      } else {
        if (rejectBlob(f, w, h, opts.zoom, t)) continue;
        accepted.push({ ...f, score: scoreLensBlob(f, w, h, opts.zoom) });
      }
    }
    const tracks = this.tracker.update(accepted, w, h, now, motion);
    return {
      tracks,
      stats: {
        ...statsBase,
        candidatePixels,
        blobCount: raw.length,
        acceptedBlobs: accepted.length,
        procMs: elapsed(t0),
      },
    };
  }
}

function elapsed(t0: number): number {
  return (typeof performance !== "undefined" ? performance.now() : Date.now()) - t0;
}
