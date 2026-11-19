import { describe, expect, it } from "vitest";
import { DetectorPipeline } from "@/lib/detection/pipeline";
import { irColourScore, isDarkEnoughForIr } from "@/lib/detection/irDetect";
import type { PipelineOptions } from "@/lib/detection/types";
import { H, W, drawDot, makeFrame, rng } from "./helpers";

const IR: PipelineOptions = { mode: "ir", sensitivity: "normal", zoom: 1 };

describe("IR detection", () => {
  it("detects a purple-tinted small blob in a dark frame", () => {
    const p = new DetectorPipeline();
    const r = rng(60);
    let found = false;
    for (let i = 0; i < 8; i++) {
      const f = makeFrame(() => 12, r, 5);
      drawDot(f, 300, 90, 2, [215, 120, 255]);
      const res = p.process(f, W, H, IR, i * 66);
      expect(isDarkEnoughForIr(res.stats.mean)).toBe(true);
      const t = res.tracks.find((tr) => Math.hypot(tr.x * W - 300, tr.y * H - 90) < 5);
      if (t && (t.confidence === "possible" || t.confidence === "likely")) found = true;
    }
    expect(found).toBe(true);
  });

  it("detects a regularly flickering IR LED", () => {
    const p = new DetectorPipeline();
    const r = rng(61);
    let found = false;
    for (let i = 0; i < 14; i++) {
      const f = makeFrame(() => 12, r, 5);
      if (i % 3 !== 2) drawDot(f, 150, 180, 1.5, [240, 225, 255]);
      const res = p.process(f, W, H, IR, i * 66);
      if (res.tracks.some((tr) => tr.confidence === "possible" || tr.confidence === "likely")) found = true;
    }
    expect(found).toBe(true);
  });

  it("ignores a saturated green standby LED", () => {
    const p = new DetectorPipeline();
    const r = rng(62);
    for (let i = 0; i < 10; i++) {
      const f = makeFrame(() => 12, r, 5);
      drawDot(f, 150, 180, 2, [40, 255, 60]);
      const res = p.process(f, W, H, IR, i * 66);
      expect(res.stats.acceptedBlobs).toBe(0);
    }
    expect(irColourScore({ hue: 120, sat: 0.8, meanR: 40, meanG: 255, meanB: 60 })).toBe(0);
  });
});
