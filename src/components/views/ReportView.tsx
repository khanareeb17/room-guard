"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Download, Printer, Share2, Trash2 } from "lucide-react";
import { useApp } from "@/components/AppProvider";
import { ViewHeader } from "@/components/ui/ViewHeader";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { ProgressRing } from "@/components/ui/ProgressRing";
import { ConfirmSheet } from "@/components/ui/ConfirmSheet";
import { ImageViewer } from "@/components/ImageViewer";
import {
  clearCaptures,
  deleteCapture,
  getCaptureBlob,
  listCaptures,
  storageUsed,
  type CaptureMeta,
  type CandidateRecord,
} from "@/lib/storage";
import { roomProgress } from "@/lib/progress";
import { formatBytes, splitDuration } from "@/lib/format";
import type { I18nKey } from "@/lib/i18n";

const VERDICT_KEY: Record<CandidateRecord["verdict"], I18nKey> = {
  possible: "markerPossible",
  likely: "markerLikely",
  reflection: "verdictReflection",
  light: "verdictLight",
  inconclusive: "verdictInconclusive",
  safe: "markerSafe",
  ir: "markerIr",
};

export function ReportView() {
  const { t, stay, rooms, roomName, updateStay, resetStay, toast } = useApp();
  const [captures, setCaptures] = useState<CaptureMeta[]>([]);
  const [thumbs, setThumbs] = useState<Record<string, string>>({});
  const [used, setUsed] = useState(0);
  const [viewer, setViewer] = useState<{ meta: CaptureMeta; url: string } | null>(null);
  const [confirm, setConfirm] = useState(false);
  const [version, setVersion] = useState(0);
  const [now] = useState(() => new Date());

  // Load photo index + thumbnails (object URLs are revoked on change/unmount).
  useEffect(() => {
    let cancelled = false;
    const urls: string[] = [];
    (async () => {
      const list = await listCaptures();
      const map: Record<string, string> = {};
      for (const m of list) {
        const b = await getCaptureBlob(m.id, "thumb");
        if (b) {
          const u = URL.createObjectURL(b);
          urls.push(u);
          map[m.id] = u;
        }
      }
      const bytes = await storageUsed();
      if (cancelled) return;
      setCaptures(list);
      setThumbs(map);
      setUsed(bytes);
    })();
    return () => {
      cancelled = true;
      urls.forEach((u) => URL.revokeObjectURL(u));
    };
  }, [version]);

  const fmtDur = useCallback(
    (ms: number) => {
      const { m, s } = splitDuration(ms);
      return m > 0 ? t("minutesShort", { m, s }) : t("secondsShort", { s });
    },
    [t],
  );

  const reportRooms = useMemo(
    () =>
      rooms.filter((r) => {
        const rec = stay.rooms[r.id];
        return (rec && (rec.checked.length || rec.lensScans || rec.irScans)) || captures.some((c) => c.roomId === r.id);
      }),
    [rooms, stay.rooms, captures],
  );

  const verdictSummary = (recs: CandidateRecord[], mode: "lens" | "ir") => {
    const counts = new Map<string, number>();
    recs.filter((r) => r.mode === mode).forEach((r) => counts.set(r.verdict, (counts.get(r.verdict) ?? 0) + 1));
    return [...counts.entries()].map(([k, n]) => `${t(VERDICT_KEY[k as CandidateRecord["verdict"]])} ×${n}`).join(", ");
  };

  const textReport = () => {
    const lines = [t("reportTitle"), `${t("reportDate")}: ${now.toLocaleString()}`];
    if (stay.address) lines.push(`${t("address")}: ${stay.address}`);
    for (const r of reportRooms) {
      const rec = stay.rooms[r.id];
      const p = roomProgress(stay, r);
      lines.push("", `# ${roomName(r.id)}`, `${t("checklistProgress")}: ${p.done}/${p.total}`);
      if (rec?.lensScans) lines.push(`${t("lensResults")}: ${fmtDur(rec.scanMs)} — ${verdictSummary(rec.candidates, "lens") || t("nothingFound")}`);
      if (rec?.irScans) lines.push(`${t("irResults")}: ${fmtDur(rec.irScanMs)} — ${verdictSummary(rec.candidates, "ir") || t("nothingFoundIr")}`);
    }
    lines.push("", t("reportDisclaimer"));
    return lines.join("\n");
  };

  const share = async () => {
    const text = textReport();
    try {
      const files: File[] = [];
      for (const c of captures.slice(0, 10)) {
        const b = await getCaptureBlob(c.id, "full");
        if (b) files.push(new File([b], `roomguard-${c.roomName}-${c.createdAt}.jpg`.replace(/\s+/g, "_"), { type: "image/jpeg" }));
      }
      if (files.length && navigator.canShare?.({ files })) {
        await navigator.share({ title: t("reportTitle"), text, files });
      } else if (navigator.share) {
        await navigator.share({ title: t("reportTitle"), text });
      } else {
        toast(t("shareFailed"), { tone: "error" });
      }
    } catch (e) {
      if ((e as Error)?.name !== "AbortError") toast(t("shareFailed"), { tone: "error" });
    }
  };

  const download = async () => {
    for (const c of captures) {
      const b = await getCaptureBlob(c.id, "full");
      if (!b) continue;
      const url = URL.createObjectURL(b);
      const a = document.createElement("a");
      a.href = url;
      a.download = `roomguard-${c.roomName}-${new Date(c.createdAt).toISOString().replace(/[:.]/g, "-")}.jpg`.replace(/\s+/g, "_");
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
      await new Promise((r) => setTimeout(r, 250));
    }
  };

  const openViewer = async (meta: CaptureMeta) => {
    const b = await getCaptureBlob(meta.id, "full");
    if (b) setViewer({ meta, url: URL.createObjectURL(b) });
  };
  const closeViewer = useCallback(() => {
    setViewer((v) => {
      if (v) URL.revokeObjectURL(v.url);
      return null;
    });
  }, []);

  return (
    <main className="mx-auto max-w-lg px-4 pb-12">
      <div className="no-print">
        <ViewHeader title={t("report")} />
        <p className="mb-4 text-muted">{t("reportIntro")}</p>

        <Card className="mb-4">
          <label htmlFor="addr" className="mb-1 block font-medium">
            {t("address")}
          </label>
          <input
            id="addr"
            value={stay.address}
            onChange={(e) => updateStay((s) => ({ ...s, address: e.target.value.slice(0, 200) }))}
            placeholder={t("addressPlaceholder")}
            className="min-h-12 w-full rounded-2xl border border-line bg-surface-2 px-4 text-ink placeholder:text-faint"
          />
          <p className="mt-2 text-sm text-muted">
            {t("reportDate")}: {now.toLocaleString()}
          </p>
        </Card>

        <div className="mb-4 grid grid-cols-2 gap-2">
          <Button icon={<Share2 size={18} />} onClick={share}>
            {t("share")}
          </Button>
          <Button icon={<Download size={18} />} onClick={download} disabled={!captures.length}>
            {t("downloadPhotos")}
          </Button>
          <Button icon={<Printer size={18} />} onClick={() => window.print()} className="col-span-2">
            {t("printPdf")}
          </Button>
        </div>

        {reportRooms.length === 0 && <p className="mb-4 rounded-2xl border border-line bg-surface p-4 text-muted">{t("noData")}</p>}

        <div className="grid gap-3">
          {reportRooms.map((r) => {
            const rec = stay.rooms[r.id];
            const p = roomProgress(stay, r);
            const photos = captures.filter((c) => c.roomId === r.id);
            return (
              <Card key={r.id}>
                <div className="flex items-center gap-3">
                  <ProgressRing value={p.total ? p.done / p.total : 0} size={48} stroke={5} label={t("checklistProgress")} />
                  <div className="flex-1">
                    <h2 className="text-lg font-semibold">{roomName(r.id)}</h2>
                    <p className="text-sm text-muted">
                      {t("checklistProgress")}: {p.done}/{p.total}
                    </p>
                  </div>
                </div>
                <dl className="mt-3 space-y-1 text-sm">
                  <div className="flex justify-between gap-2">
                    <dt className="text-muted">{t("lensResults")}</dt>
                    <dd className="text-right">
                      {rec?.lensScans ? `${fmtDur(rec.scanMs)} · ${verdictSummary(rec.candidates, "lens") || t("nothingFound")}` : "—"}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-2">
                    <dt className="text-muted">{t("irResults")}</dt>
                    <dd className="text-right">
                      {rec?.irScans ? `${fmtDur(rec.irScanMs)} · ${verdictSummary(rec.candidates, "ir") || t("nothingFoundIr")}` : "—"}
                    </dd>
                  </div>
                </dl>
                <p className="mt-3 text-xs uppercase tracking-wide text-faint">{t("photos")}</p>
                {photos.length === 0 ? (
                  <p className="text-sm text-muted">{t("noPhotos")}</p>
                ) : (
                  <div className="mt-1 grid grid-cols-3 gap-2">
                    {photos.map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => openViewer(c)}
                        className="overflow-hidden rounded-xl border border-line"
                        aria-label={`${c.verdict} — ${new Date(c.createdAt).toLocaleString()}`}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        {thumbs[c.id] && <img src={thumbs[c.id]} alt="" className="aspect-[4/3] w-full object-cover" />}
                      </button>
                    ))}
                  </div>
                )}
              </Card>
            );
          })}
        </div>

        <p className="mt-6 text-center text-sm text-faint">{t("storageUsed", { size: formatBytes(used) })}</p>
        <p className="mt-2 text-center text-xs text-faint">{t("reportDisclaimer")}</p>
        <Button variant="danger" block className="mt-4" icon={<Trash2 size={18} />} onClick={() => setConfirm(true)}>
          {t("clearAll")}
        </Button>
      </div>

      {/* Print layout */}
      <section className="print-only print-report">
        <h1>{t("reportTitle")}</h1>
        <p>
          {t("reportDate")}: {now.toLocaleString()}
          <br />
          {t("address")}: {stay.address || "________________________________"}
        </p>
        {reportRooms.map((r) => {
          const rec = stay.rooms[r.id];
          const p = roomProgress(stay, r);
          return (
            <div key={r.id} className="room">
              <h2>{roomName(r.id)}</h2>
              <table>
                <tbody>
                  <tr>
                    <th>{t("checklistProgress")}</th>
                    <td>
                      {p.done}/{p.total}
                    </td>
                  </tr>
                  <tr>
                    <th>{t("lensResults")}</th>
                    <td>{rec?.lensScans ? `${fmtDur(rec.scanMs)} — ${verdictSummary(rec.candidates, "lens") || t("nothingFound")}` : "—"}</td>
                  </tr>
                  <tr>
                    <th>{t("irResults")}</th>
                    <td>{rec?.irScans ? `${fmtDur(rec.irScanMs)} — ${verdictSummary(rec.candidates, "ir") || t("nothingFoundIr")}` : "—"}</td>
                  </tr>
                </tbody>
              </table>
              {captures
                .filter((c) => c.roomId === r.id)
                .map((c) =>
                  thumbs[c.id] ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img key={c.id} src={thumbs[c.id]} alt={c.verdict} />
                  ) : null,
                )}
            </div>
          );
        })}
        <p style={{ marginTop: "16pt", fontSize: "9pt" }}>{t("reportDisclaimer")}</p>
      </section>

      {viewer && (
        <ImageViewer
          src={viewer.url}
          alt={viewer.meta.verdict}
          closeLabel={t("close")}
          deleteLabel={t("deletePhoto")}
          onClose={closeViewer}
          onDelete={async () => {
            await deleteCapture(viewer.meta.id);
            closeViewer();
            setVersion((v) => v + 1);
          }}
        />
      )}

      <ConfirmSheet
        open={confirm}
        title={t("clearAll")}
        body={t("clearAllConfirm")}
        confirmLabel={t("clearAll")}
        cancelLabel={t("cancel")}
        danger
        onClose={() => setConfirm(false)}
        onConfirm={async () => {
          await clearCaptures();
          resetStay();
          setVersion((v) => v + 1);
          toast(t("cleared"));
        }}
      />
    </main>
  );
}
