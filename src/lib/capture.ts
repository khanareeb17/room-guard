/**
 * Evidence capture: full-resolution frame from the <video> (not the
 * downscaled analysis frame) with markers, timestamp, room and verdict
 * burned in. Front-camera captures are stored un-mirrored (true image).
 */
import type { TrackView } from "./detection/types";

export interface CaptureLabels {
  room: string;
  verdict: string;
  timestamp: string;
  labelFor: (t: TrackView) => string | null;
}

function toBlob(c: HTMLCanvasElement, type: string, q: number): Promise<Blob> {
  return new Promise((resolve, reject) =>
    c.toBlob((b) => (b ? resolve(b) : reject(new Error("toBlob failed"))), type, q),
  );
}

export function markerColour(t: TrackView, mode: "lens" | "ir"): string {
  if (t.safe) return "#94a3b8";
  if (mode === "lens" && t.verdict === "light") return "#60a5fa";
  if (t.confidence === "likely" || t.verdict === "reflection") return "#ef4444";
  if (t.confidence === "possible") return "#f59e0b";
  return "#94a3b8";
}

export async function captureFrame(
  video: HTMLVideoElement,
  tracks: TrackView[],
  mode: "lens" | "ir",
  labels: CaptureLabels,
): Promise<{ full: Blob; thumb: Blob; width: number; height: number }> {
  const w = video.videoWidth;
  const h = video.videoHeight;
  if (!w || !h) throw new Error("video not ready");
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d");
  if (!ctx) throw new Error("no 2d context");
  ctx.drawImage(video, 0, 0, w, h);

  const unit = Math.max(2, Math.round(w / 400));
  for (const t of tracks) {
    const label = labels.labelFor(t);
    if (!label) continue;
    const x = t.x * w;
    const y = t.y * h;
    const r = Math.max(unit * 10, t.r * w * 4);
    const col = markerColour(t, mode);
    ctx.lineWidth = unit * 1.5;
    ctx.strokeStyle = col;
    ctx.beginPath();
    if (mode === "lens" && t.verdict === "light") ctx.rect(x - r, y - r, r * 2, r * 2);
    else ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.font = `600 ${unit * 7}px system-ui, sans-serif`;
    const tw = ctx.measureText(label).width;
    const ly = Math.max(unit * 10, y - r - unit * 4);
    ctx.fillStyle = "rgba(0,0,0,0.65)";
    ctx.fillRect(x - tw / 2 - unit * 3, ly - unit * 8, tw + unit * 6, unit * 10);
    ctx.fillStyle = col;
    ctx.textAlign = "center";
    ctx.fillText(label, x, ly);
  }

  // Footer with timestamp / room / verdict.
  const fh = unit * 16;
  ctx.fillStyle = "rgba(0,0,0,0.7)";
  ctx.fillRect(0, h - fh, w, fh);
  ctx.fillStyle = "#fff";
  ctx.textAlign = "left";
  ctx.font = `600 ${unit * 7}px system-ui, sans-serif`;
  ctx.fillText(`RoomGuard · ${labels.room} · ${labels.verdict}`, unit * 5, h - fh + unit * 7.5);
  ctx.font = `${unit * 6}px system-ui, sans-serif`;
  ctx.fillText(labels.timestamp, unit * 5, h - unit * 2.5);

  const full = await toBlob(c, "image/jpeg", 0.9);
  const tw = 480;
  const th = Math.round((h / w) * tw);
  const tc = document.createElement("canvas");
  tc.width = tw;
  tc.height = th;
  tc.getContext("2d")?.drawImage(c, 0, 0, tw, th);
  const thumb = await toBlob(tc, "image/jpeg", 0.8);
  return { full, thumb, width: w, height: h };
}

/** Live crop of the video around a normalised point (candidate sheet preview). */
export function drawCrop(
  video: HTMLVideoElement,
  canvas: HTMLCanvasElement,
  nx: number,
  ny: number,
  fraction = 0.18,
): void {
  const vw = video.videoWidth;
  const vh = video.videoHeight;
  const ctx = canvas.getContext("2d");
  if (!vw || !vh || !ctx) return;
  const size = Math.max(32, Math.round(Math.min(vw, vh) * fraction));
  const sx = Math.max(0, Math.min(vw - size, Math.round(nx * vw - size / 2)));
  const sy = Math.max(0, Math.min(vh - size, Math.round(ny * vh - size / 2)));
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(video, sx, sy, size, size, 0, 0, canvas.width, canvas.height);
  // crosshair
  const cx = ((nx * vw - sx) / size) * canvas.width;
  const cy = ((ny * vh - sy) / size) * canvas.height;
  ctx.strokeStyle = "rgba(255,255,255,0.8)";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(cx, cy, canvas.width * 0.12, 0, Math.PI * 2);
  ctx.stroke();
}
