import { describe, expect, it } from "vitest";
import { DetectorPipeline } from "@/lib/detection/pipeline";
import { analyzeVerification } from "@/lib/detection/torchVerify";
import type { PipelineOptions, VerifySample } from "@/lib/detection/types";
import { H, W, drawDot, makeFrame, rng } from "./helpers";

const OPTS: PipelineOptions = { mode: "lens", sensitivity: "normal", zoom: 1 };

/** Requested torch pattern off→on ×3 at ~4 frames per state, with 1 frame of device latency. */
function torchPattern(): { requested: boolean[]; actual: boolean[] } {
  const requested: boolean[] = [];
  for (let c = 0; c < 3; c++) {
    for (let k = 0; k < 4; k++) requested.push(false);
    for (let k = 0; k < 4; k++) requested.push(true);
  }
  const actual = requested.map((_, i) => (i === 0 ? true : requested[i - 1]));
  return { requested, actual };
}

function runVerify(spotStaysWhenOff: boolean) {
  const p = new DetectorPipeline();
  const r = rng(50);
  let t = 0;
  let id = -1;
  // Build up a track with the torch on (room lit by the torch: mean ≈ 60).
  for (let i = 0; i < 10; i++, t += 66) {
    const f = makeFrame(() => 60, r, 8);
    drawDot(f, 220, 140, 1.8);
    const res = p.process(f, W, H, OPTS, t, true);
    id = res.tracks.find((tr) => Math.hypot(tr.x * W - 220, tr.y * H - 140) < 5)!.id;
  }
  expect(p.startVerify(id)).toBe(true);
  const { requested, actual } = torchPattern();
  for (let i = 0; i < requested.length; i++, t += 66) {
    const f = makeFrame(() => (actual[i] ? 60 : 25), r, 8);
    if (actual[i] || spotStaysWhenOff) drawDot(f, 220, 140, 1.8);
    p.process(f, W, H, OPTS, t, requested[i]);
  }
  return p.finishVerify()!;
}

describe("torch verification", () => {
  it("brightness drops when the torch is off → reflection", () => {
    const out = runVerify(false);
    expect(out.outcome.verdict).toBe("reflection");
    expect(out.outcome.usedMeasuredState).toBe(true);
  });

  it("brightness stays when the torch is off → light source", () => {
    const out = runVerify(true);
    expect(out.outcome.verdict).toBe("light");
  });

  it("is inconclusive when the spot is never visible", () => {
    const samples: VerifySample[] = Array.from({ length: 16 }, (_, i) => ({
      requested: i % 8 >= 4,
      frameMean: i % 8 >= 4 ? 60 : 25,
      peak: 40,
      contrast: 5,
      t: i * 66,
    }));
    expect(analyzeVerification(samples).verdict).toBe("inconclusive");
  });

  it("falls back to requested state with latency skip when frame brightness doesn't change", () => {
    const samples: VerifySample[] = [];
    for (let c = 0; c < 3; c++) {
      for (let k = 0; k < 5; k++) samples.push({ requested: false, frameMean: 40, peak: 0, contrast: k < 1 ? 180 : 10, t: 0 });
      for (let k = 0; k < 5; k++) samples.push({ requested: true, frameMean: 40, peak: 0, contrast: k < 1 ? 10 : 180, t: 0 });
    }
    const out = analyzeVerification(samples);
    expect(out.usedMeasuredState).toBe(false);
    expect(out.verdict).toBe("reflection");
  });
});
