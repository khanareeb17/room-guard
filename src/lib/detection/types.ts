/**
 * Shared types for the detection pipeline.
 * PURE module: no DOM access, safe in workers and in tests.
 */

export type Sensitivity = "low" | "normal" | "high";
export type DetectMode = "lens" | "ir";

/** Internal confidence levels. "low" is never shown to the user unless debug is on. */
export type Confidence = "none" | "low" | "possible" | "likely";

/** Result of torch verification for a track. */
export type Verdict = "unverified" | "verifying" | "reflection" | "light" | "inconclusive";

export interface Thresholds {
  /** Absolute luminance floor (0–255). */
  abs: number;
  /** Minimum local contrast (Y − local mean). */
  contrast: number;
  /** Pixel must be ≥ frameMean + k·frameStd. */
  k: number;
}

/** Raw connected-component statistics accumulated while flood-filling. */
export interface RawBlob {
  area: number;
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  /** Luminance-weighted centroid. */
  cx: number;
  cy: number;
  peakY: number;
  meanY: number;
  meanR: number;
  meanG: number;
  meanB: number;
  touchesEdge: boolean;
}

/** Blob with derived shape / colour / surround features. */
export interface BlobFeatures extends RawBlob {
  width: number;
  height: number;
  fill: number;
  aspect: number;
  hue: number; // degrees 0–360
  sat: number; // 0–1
  surroundY: number;
  contrast: number; // peakY − surroundY
}

export interface ScoredBlob extends BlobFeatures {
  score: number;
}

/** What the tracker exposes to the UI (plain, structured-cloneable). */
export interface TrackView {
  id: number;
  /** Normalised centre in the analysed frame (0–1). */
  x: number;
  y: number;
  /** Normalised radius (relative to frame width). */
  r: number;
  confidence: Confidence;
  /** 0–1 overall lens-likeness. */
  value: number;
  verdict: Verdict;
  safe: boolean;
  hits: number;
  ageMs: number;
  peakY: number;
  hue: number;
  sat: number;
  /** Debug details */
  blobScore: number;
  brightnessCv: number;
  drift: number;
}

export interface FrameStats {
  width: number;
  height: number;
  mean: number;
  std: number;
  /** Fraction of pixels with Y ≥ 245 (saturation / too-bright hint). */
  brightFraction: number;
  candidatePixels: number;
  blobCount: number;
  acceptedBlobs: number;
  motionX: number;
  motionY: number;
  procMs: number;
}

export interface PipelineResult {
  tracks: TrackView[];
  stats: FrameStats;
}

export interface PipelineOptions {
  mode: DetectMode;
  sensitivity: Sensitivity;
  /** Hardware zoom factor (1 = none). Loosens the max-area filter. */
  zoom: number;
}

export interface VerifySample {
  /** Torch state requested by the controller at the time the frame was captured. */
  requested: boolean;
  frameMean: number;
  /** Local peak luminance at the track position. */
  peak: number;
  /** Local contrast: peak − mean of a ring around the spot. */
  contrast: number;
  t: number;
}

export interface VerifyOutcome {
  verdict: Exclude<Verdict, "unverified" | "verifying">;
  onContrast: number;
  offContrast: number;
  ratio: number;
  usedMeasuredState: boolean;
}
