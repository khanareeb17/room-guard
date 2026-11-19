import type { FrameStats, PipelineOptions, TrackView, VerifyOutcome } from "@/lib/detection/types";

export type ToWorker =
  | { type: "config"; opts: PipelineOptions; debug: boolean }
  | { type: "reset" }
  | { type: "clear-tracks" }
  | { type: "mark-safe"; id: number; t: number }
  | { type: "verify-start"; id: number }
  | { type: "verify-finish" }
  | { type: "frame"; w: number; h: number; t: number; torch: boolean; bitmap?: ImageBitmap; buffer?: ArrayBuffer };

export type FromWorker =
  | { type: "ready"; offscreen: boolean }
  | { type: "error"; message: string }
  | { type: "verify-started"; id: number; ok: boolean }
  | { type: "verdict"; result: { trackId: number; outcome: VerifyOutcome; samples: number } | null }
  | {
      type: "result";
      tracks: TrackView[];
      stats: FrameStats;
      t: number;
      mask?: Uint8Array;
      maskW?: number;
      maskH?: number;
    };
