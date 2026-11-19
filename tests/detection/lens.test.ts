import { describe, expect, it } from "vitest";
import { DetectorPipeline } from "@/lib/detection/pipeline";
import type { Confidence, PipelineOptions, TrackView } from "@/lib/detection/types";
import { H, W, darkBg, drawDot, fillRect, makeFrame, rng, texture } from "./helpers";

const OPTS: PipelineOptions = { mode: "lens", sensitivity: "normal", zoom: 1 };
const FRAME_MS = 66; // ~15 fps
const rank: Record<Confidence, number> = { none: 0, low: 1, possible: 2, likely: 3 };

function near(tracks: TrackView[], x: number, y: number, tol = 6): TrackView | undefined {
  return tracks.find((t) => Math.hypot(t.x * W - x, t.y * H - y) <= tol);
}

describe("lens detection – single frame", () => {
  it("detects a 2–4 px bright dot on a dark noisy background", () => {
    for (const r of [1, 1.5, 2]) {
      const p = new DetectorPipeline();
      const f = makeFrame(darkBg, rng(10), 10);
      drawDot(f, 200.3, 120.6, r);
      const res = p.process(f, W, H, OPTS, 0);
      expect(res.stats.acceptedBlobs).toBe(1);
      const t = near(res.tracks, 200.3, 120.6, 2);
      expect(t).toBeDefined();
      expect(t!.blobScore).toBeGreaterThan(0.6);
    }
  });

  it("does not trigger on plain noise", () => {
    const p = new DetectorPipeline();
    const res = p.process(makeFrame(darkBg, rng(11), 14), W, H, OPTS, 0);
    expect(res.stats.acceptedBlobs).toBe(0);
  });
});

describe("lens detection – temporal", () => {
  it("a dot persisting over 12 frames with small global motion reaches Likely fast", () => {
    const p = new DetectorPipeline();
    const r = rng(20);
    let firstPossible = -1;
    let firstLikely = -1;
    let last: TrackView | undefined;
    for (let i = 0; i < 12; i++) {
      const f = makeFrame(darkBg, r, 10);
      const x = 240 + i * 1.3 + Math.sin(i) * 0.4;
      const y = 130 + i * 0.6;
      drawDot(f, x, y, 1.6);
      const res = p.process(f, W, H, OPTS, i * FRAME_MS);
      last = near(res.tracks, x, y);
      if (last && firstPossible < 0 && rank[last.confidence] >= 2) firstPossible = i;
      if (last && firstLikely < 0 && last.confidence === "likely") firstLikely = i;
    }
    expect(last?.confidence).toBe("likely");
    // ≤ 300 ms → amber, ≤ 600 ms → red at 15 fps
    expect(firstPossible).toBeGreaterThanOrEqual(0);
    expect(firstPossible * FRAME_MS).toBeLessThanOrEqual(300);
    expect(firstLikely * FRAME_MS).toBeLessThanOrEqual(600);
  });

  it("rejects a large bright area (lamp / window)", () => {
    const p = new DetectorPipeline();
    const r = rng(30);
    for (let i = 0; i < 12; i++) {
      const f = makeFrame(darkBg, r, 8);
      fillRect(f, 150, 80, 40, 30, 255);
      const res = p.process(f, W, H, OPTS, i * FRAME_MS);
      expect(res.stats.acceptedBlobs).toBe(0);
      expect(res.tracks.every((t) => rank[t.confidence] < 2)).toBe(true);
    }
  });

  it("rejects a thin bright streak", () => {
    const p = new DetectorPipeline();
    const r = rng(31);
    for (let i = 0; i < 12; i++) {
      const f = makeFrame(darkBg, r, 8);
      fillRect(f, 100, 140, 60, 2, 255);
      fillRect(f, 300, 60, 1, 40, 255); // vertical hairline too
      const res = p.process(f, W, H, OPTS, i * FRAME_MS);
      expect(res.stats.acceptedBlobs).toBe(0);
    }
  });

  it("a glint that vanishes after 3 frames never reaches Likely", () => {
    const p = new DetectorPipeline();
    const r = rng(40);
    for (let i = 0; i < 15; i++) {
      const f = makeFrame(darkBg, r, 10);
      if (i < 3) drawDot(f, 180, 100, 1.6);
      const res = p.process(f, W, H, OPTS, i * FRAME_MS);
      expect(res.tracks.every((t) => t.confidence !== "likely")).toBe(true);
    }
  });

  it("a glint sliding relative to the scene never reaches Likely, while scene-locked dots do", () => {
    const p = new DetectorPipeline();
    const r = rng(41);
    let lensA: TrackView | undefined;
    let lensB: TrackView | undefined;
    for (let i = 0; i < 16; i++) {
      const ox = i * 2; // camera pan: scene moves +2 px / frame
      const f = makeFrame(texture(ox, 0), r, 3);
      drawDot(f, 120 + ox, 90, 1.6);
      drawDot(f, 330 + ox, 200, 1.6);
      // specular glint sliding across a glossy surface (+7 px / frame relative)
      const gx = 150 + ox + i * 7;
      drawDot(f, gx, 160, 1.6);
      const res = p.process(f, W, H, OPTS, i * FRAME_MS);
      const g = near(res.tracks, gx, 160, 4);
      if (g) expect(g.confidence).not.toBe("likely");
      lensA = near(res.tracks, 120 + ox, 90);
      lensB = near(res.tracks, 330 + ox, 200);
    }
    expect(lensA?.confidence).toBe("likely");
    expect(lensB?.confidence).toBe("likely");
  });

  it("a flickering glint (unstable brightness / size) never reaches Likely", () => {
    const p = new DetectorPipeline();
    const r = rng(42);
    for (let i = 0; i < 16; i++) {
      const f = makeFrame(darkBg, r, 10);
      // present every other frame, size jumping around
      if (i % 2 === 0) drawDot(f, 260, 150, i % 4 === 0 ? 1 : 3.5);
      const res = p.process(f, W, H, OPTS, i * FRAME_MS);
      expect(res.tracks.every((t) => t.confidence !== "likely")).toBe(true);
    }
  });

  it("drops tracks unseen for more than 500 ms", () => {
    const p = new DetectorPipeline();
    const r = rng(43);
    for (let i = 0; i < 5; i++) {
      const f = makeFrame(darkBg, r, 10);
      drawDot(f, 200, 100, 1.6);
      p.process(f, W, H, OPTS, i * FRAME_MS);
    }
    const res = p.process(makeFrame(darkBg, r, 10), W, H, OPTS, 5 * FRAME_MS + 600);
    expect(res.tracks.length).toBe(0);
  });

  it("marks a track safe and remembers the spot when it reappears", () => {
    const p = new DetectorPipeline();
    const r = rng(44);
    let id = -1;
    for (let i = 0; i < 6; i++) {
      const f = makeFrame(darkBg, r, 10);
      drawDot(f, 200, 100, 1.6);
      const res = p.process(f, W, H, OPTS, i * FRAME_MS);
      id = near(res.tracks, 200, 100)!.id;
    }
    p.tracker.markSafe(id, 6 * FRAME_MS);
    // disappears long enough to be dropped, then reappears
    p.process(makeFrame(darkBg, r, 10), W, H, OPTS, 2000);
    const f = makeFrame(darkBg, r, 10);
    drawDot(f, 201, 100, 1.6);
    const res = p.process(f, W, H, OPTS, 2066);
    const t = near(res.tracks, 201, 100);
    expect(t?.safe).toBe(true);
    expect(t?.id).not.toBe(id);
  });
});
