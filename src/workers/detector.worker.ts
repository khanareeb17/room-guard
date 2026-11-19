/**
 * Detection worker: receives downscaled frames (ImageBitmap or raw RGBA
 * buffer), runs the pure-TS pipeline and posts back tracks + stats.
 */
import { DetectorPipeline } from "@/lib/detection/pipeline";
import type { PipelineOptions } from "@/lib/detection/types";
import type { ToWorker } from "./protocol";

interface WorkerScope {
  postMessage(msg: unknown, transfer?: Transferable[]): void;
  onmessage: ((e: MessageEvent<ToWorker>) => void) | null;
}
const scope = self as unknown as WorkerScope;

const pipeline = new DetectorPipeline();
let opts: PipelineOptions = { mode: "lens", sensitivity: "normal", zoom: 1 };
let debug = false;
let frameNo = 0;

let canvas: OffscreenCanvas | null = null;
let ctx: OffscreenCanvasRenderingContext2D | null = null;
let offscreenOk = false;
try {
  if (typeof OffscreenCanvas !== "undefined") {
    canvas = new OffscreenCanvas(4, 4);
    ctx = canvas.getContext("2d", { willReadFrequently: true }) as OffscreenCanvasRenderingContext2D | null;
    offscreenOk = !!ctx;
  }
} catch {
  offscreenOk = false;
}
scope.postMessage({ type: "ready", offscreen: offscreenOk });

scope.onmessage = (e) => {
  const msg = e.data;
  switch (msg.type) {
    case "config":
      opts = msg.opts;
      debug = msg.debug;
      return;
    case "reset":
      pipeline.reset();
      return;
    case "clear-tracks":
      pipeline.tracker.clearTracks();
      return;
    case "mark-safe":
      pipeline.tracker.markSafe(msg.id, msg.t);
      return;
    case "verify-start":
      scope.postMessage({ type: "verify-started", id: msg.id, ok: pipeline.startVerify(msg.id) });
      return;
    case "verify-finish": {
      const r = pipeline.finishVerify();
      scope.postMessage({ type: "verdict", result: r });
      return;
    }
    case "frame": {
      const { w, h } = msg;
      let data: Uint8ClampedArray;
      try {
        if (msg.bitmap) {
          if (!canvas || !ctx) throw new Error("no offscreen");
          if (canvas.width !== w || canvas.height !== h) {
            canvas.width = w;
            canvas.height = h;
          }
          ctx.drawImage(msg.bitmap, 0, 0, w, h);
          msg.bitmap.close();
          data = ctx.getImageData(0, 0, w, h).data;
        } else if (msg.buffer) {
          data = new Uint8ClampedArray(msg.buffer);
        } else return;
      } catch (err) {
        scope.postMessage({ type: "error", message: String(err) });
        return;
      }
      const result = pipeline.process(data, w, h, opts, msg.t, msg.torch);
      frameNo++;
      if (debug && frameNo % 3 === 0) {
        const mask = pipeline.getMask().slice();
        scope.postMessage({ type: "result", ...result, t: msg.t, mask, maskW: w, maskH: h }, [mask.buffer]);
      } else {
        scope.postMessage({ type: "result", ...result, t: msg.t });
      }
      return;
    }
  }
};
