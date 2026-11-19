"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Camera, ScanEye, Info, X, CheckSquare, Square as SquareIcon } from "lucide-react";
import { useApp } from "@/components/AppProvider";
import { Button } from "@/components/ui/Button";
import { Sheet } from "@/components/ui/Sheet";
import { RoomPicker } from "@/components/RoomPicker";
import { useCamera, cameraPrecheck, type Facing } from "@/hooks/useCamera";
import { useCameraControls } from "@/hooks/useCameraControls";
import { useWakeLock } from "@/hooks/useWakeLock";
import { useDetector, type DetectorEvent } from "@/hooks/useDetector";
import { useAlerts } from "@/hooks/useAlerts";
import { captureFrame } from "@/lib/capture";
import { saveCapture, type CandidateRecord, type CandidateVerdict } from "@/lib/storage";
import { hotspotsForRoom } from "@/lib/checklist-data";
import { inAppBrowserName } from "@/lib/env";
import { splitDuration, uid } from "@/lib/format";
import type { Sensitivity, TrackView } from "@/lib/detection/types";
import type { I18nKey } from "@/lib/i18n";
import { CameraStage, type DigitalZoom } from "./CameraStage";
import { markerLabel, type MarkerLabels } from "./DetectionOverlay";
import { ScanHud } from "./ScanHud";
import { BottomControls } from "./BottomControls";
import { CandidateSheet } from "./CandidateSheet";
import { CameraError } from "./CameraError";
import { CoachOverlay } from "./CoachOverlay";
import { DebugPanel } from "./DebugPanel";

const SENS_ORDER: Sensitivity[] = ["low", "normal", "high"];
const SENS_KEY: Record<Sensitivity, I18nKey> = { low: "sensLow", normal: "sensNormal", high: "sensHigh" };

function whereKey(x: number, y: number): I18nKey {
  const col = x < 0.34 ? 0 : x > 0.66 ? 2 : 1;
  const row = y < 0.34 ? 0 : y > 0.66 ? 2 : 1;
  const keys: I18nKey[][] = [
    ["whereUpperLeft", "whereUpper", "whereUpperRight"],
    ["whereLeft", "whereCenter", "whereRight"],
    ["whereLowerLeft", "whereLower", "whereLowerRight"],
  ];
  return keys[row][col];
}

interface Summary {
  ms: number;
  captures: number;
  records: CandidateRecord[];
}

export function ScannerScreen({
  mode,
  initialFacing,
  autoStart = false,
}: {
  mode: "lens" | "ir";
  initialFacing: Facing;
  autoStart?: boolean;
}) {
  const app = useApp();
  const { t, settings, updateSettings, stay, roomName, navigate, toast, testVideo, updateRoom } = app;
  const [started, setStarted] = useState(autoStart);
  const [facing, setFacing] = useState<Facing>(initialFacing);
  const [video, setVideo] = useState<HTMLVideoElement | null>(null);
  const [showCoach, setShowCoach] = useState(mode === "lens" && !settings.coached);
  const [sheetId, setSheetId] = useState<number | null>(null);
  const [sheetTrack, setSheetTrack] = useState<TrackView | null>(null);
  const [roomOpen, setRoomOpen] = useState(false);
  const [coverageOpen, setCoverageOpen] = useState(false);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [noTorchDismissed, setNoTorchDismissed] = useState(false);
  const [digitalZoom, setDigitalZoom] = useState<DigitalZoom | null>(null);
  const [capturing, setCapturing] = useState(false);
  const [captures, setCaptures] = useState(0);
  const [announcement, setAnnouncement] = useState("");
  const records = useRef(new Map<number, CandidateRecord>());
  const liveMs = useRef(0);
  const liveSince = useRef<number | null>(null);

  const room = stay.currentRoom;
  const usingFile = !!testVideo;
  const precheck = useMemo(() => (usingFile ? null : cameraPrecheck()), [usingFile]);
  const inApp = useMemo(() => (usingFile ? null : inAppBrowserName()), [usingFile]);

  const cam = useCamera({ enabled: started && !usingFile && !precheck, facing, video: usingFile ? null : video });
  const controls = useCameraControls(cam.track, {
    autoTorch: mode === "lens",
    glintBoost: mode === "lens" && settings.glintBoost,
  });
  const live = usingFile ? started : cam.status === "live";
  useWakeLock(started && live);

  const hwZoom = controls.zoom.supported ? controls.zoom.value / Math.max(0.1, controls.zoom.min) : 1;
  const { ctrl, snap } = useDetector(video, {
    active: started && live && !summary,
    mode,
    sensitivity: settings.sensitivity,
    zoom: hwZoom,
    debug: settings.debug,
    autoVerify: settings.autoVerify && !showCoach,
    torch: controls.torch,
  });
  const alerts = useAlerts({ sound: settings.sound, vibration: settings.vibration, active: started && live && !summary });

  // Feed the Geiger counter.
  useEffect(() => {
    alerts.setLevel(snap.bestLevel, snap.bestValue);
  }, [alerts, snap.bestLevel, snap.bestValue]);

  // Track live time for the room.
  useEffect(() => {
    if (live && started && !summary) {
      liveSince.current = performance.now();
      return () => {
        if (liveSince.current !== null) liveMs.current += performance.now() - liveSince.current;
        liveSince.current = null;
      };
    }
  }, [live, started, summary]);

  // Mirror the front camera preview (detection coordinates are un-mirrored in the overlay).
  const mirror = !usingFile && facing === "user";

  // Detection events → alerts, announcements, records.
  const tRef = useRef(t);
  useEffect(() => {
    tRef.current = t;
  }, [t]);
  useEffect(() => {
    return ctrl.onEvent((e: DetectorEvent) => {
      const tt = tRef.current;
      if (e.type === "level") {
        const tr = e.track;
        if (tr.safe) return;
        const where = tt(whereKey(tr.x, tr.y));
        const level = tr.confidence === "likely" ? "likely" : "possible";
        alerts.alert(level);
        if (mode === "ir") setAnnouncement(tt("announceIr", { where }));
        else setAnnouncement(tt(level === "likely" ? "announceLikely" : "announcePossible", { where }));
        const prev = records.current.get(tr.id);
        const verdict: CandidateVerdict = mode === "ir" ? "ir" : level;
        if (!prev || (prev.verdict === "possible" && level === "likely"))
          records.current.set(tr.id, { id: uid(), at: Date.now(), mode, verdict });
      } else if (e.type === "verdict") {
        if (e.verdict === "reflection") alerts.alert("reflection");
        else if (e.verdict === "light") alerts.alert("light");
        const v = e.verdict;
        if (v === "reflection" || v === "light" || v === "inconclusive") {
          const prev = records.current.get(e.trackId);
          records.current.set(e.trackId, { id: prev?.id ?? uid(), at: Date.now(), mode, verdict: v });
        }
        if (e.track) setSheetTrack((s) => (s && s.id === e.trackId ? e.track! : s));
      }
    });
  }, [ctrl, alerts, mode]);

  const labels: MarkerLabels = useMemo(
    () => ({
      possible: t("markerPossible"),
      likely: t("markerLikely"),
      light: t("markerLight"),
      ir: t("markerIr"),
      safe: t("markerSafe"),
    }),
    [t],
  );

  const getTracks = useCallback(() => ctrl.tracks, [ctrl]);
  const getVerifyingId = useCallback(() => ctrl.verifyingId, [ctrl]);
  const getTrack = useCallback((id: number) => ctrl.tracks.find((x) => x.id === id), [ctrl]);

  // Keep the sheet's track fresh while it exists.
  const liveSheetTrack = sheetId !== null ? (snap.tracks.find((x) => x.id === sheetId) ?? sheetTrack) : null;

  const start = () => {
    alerts.unlock();
    setSummary(null);
    records.current.clear();
    liveMs.current = 0;
    setCaptures(0);
    ctrl.resetSession();
    setStarted(true);
  };

  const stop = () => {
    const extra = liveSince.current !== null ? performance.now() - liveSince.current : 0;
    const ms = liveMs.current + extra;
    liveMs.current = ms;
    liveSince.current = null;
    const recs = [...records.current.values()];
    updateRoom(room, (r) => ({
      ...r,
      scanMs: mode === "lens" ? r.scanMs + ms : r.scanMs,
      irScanMs: mode === "ir" ? r.irScanMs + ms : r.irScanMs,
      lensScans: r.lensScans + (mode === "lens" ? 1 : 0),
      irScans: r.irScans + (mode === "ir" ? 1 : 0),
      candidates: [...r.candidates, ...recs],
    }));
    setSheetId(null);
    setSummary({ ms, captures, records: recs });
    setStarted(false);
    setDigitalZoom(null);
  };

  const capture = async () => {
    if (!video || capturing) return;
    setCapturing(true);
    try {
      const tracks = ctrl.tracks;
      const best = tracks
        .filter((x) => !x.safe)
        .map((x) => markerLabel(x, mode, labels))
        .filter(Boolean) as string[];
      const verdict = best.includes(labels.likely)
        ? labels.likely
        : best.includes(labels.light)
          ? labels.light
          : (best[0] ?? (mode === "ir" ? t("nothingFoundIr") : t("nothingFound")));
      const roomLabel = roomName(room);
      const { full, thumb, width, height } = await captureFrame(video, tracks, mode, {
        room: roomLabel,
        verdict,
        timestamp: new Date().toLocaleString(),
        labelFor: (x) => markerLabel(x, mode, labels),
      });
      await saveCapture(
        {
          id: uid(),
          createdAt: Date.now(),
          roomId: room,
          roomName: roomLabel,
          mode,
          verdict,
          width,
          height,
          bytes: full.size + thumb.size,
        },
        full,
        thumb,
      );
      setCaptures((c) => c + 1);
      const url = URL.createObjectURL(thumb);
      toast(t("captured"), { thumb: url, tone: "success" });
      setTimeout(() => URL.revokeObjectURL(url), 6000);
    } catch {
      toast(t("captureFailed"), { tone: "error" });
    } finally {
      setCapturing(false);
    }
  };

  const openTrack = (id: number) => {
    const tr = ctrl.tracks.find((x) => x.id === id) ?? null;
    setSheetId(id);
    setSheetTrack(tr);
    if (mode === "lens" && tr && !tr.safe && (tr.verdict === "unverified" || tr.verdict === "inconclusive")) {
      void ctrl.verify(id);
    }
  };

  const onTapEmpty = ({ sx, sy }: { nx: number; ny: number; sx: number; sy: number }) => {
    if (controls.zoom.supported) {
      const z = controls.zoom;
      void z.set(z.value > z.min + 0.05 ? z.min : Math.min(z.max, z.min * 2.5));
    } else {
      setDigitalZoom((d) => (d ? null : { scale: 2.2, ox: sx, oy: sy }));
    }
  };

  const cycleSensitivity = () => {
    const i = SENS_ORDER.indexOf(settings.sensitivity);
    updateSettings({ sensitivity: SENS_ORDER[(i + 1) % SENS_ORDER.length] });
  };

  // Hint line.
  const s = snap.stats;
  let hint: I18nKey = mode === "ir" ? "hintIrScanning" : "hintMoveSlowly";
  let hintTone: "normal" | "warn" | "alert" = "normal";
  if (snap.verifyingId !== null) hint = "hintVerifying";
  else if (s && mode === "ir" && s.mean >= 70) {
    hint = "irNotDark";
    hintTone = "warn";
  } else if (s && mode === "lens" && (s.brightFraction > 0.05 || s.mean > 175)) {
    hint = "hintTooBright";
    hintTone = "warn";
  } else if (s && mode === "lens" && s.mean < 10 && !controls.torch.on) {
    hint = "hintTooDark";
    hintTone = "warn";
  } else if (snap.bestLevel === "likely") {
    hint = "hintTapRing";
    hintTone = "alert";
  } else if (snap.bestLevel === "possible") hint = "hintHoldSteady";
  else if (s && mode === "lens" && s.mean > 110) hint = "hintLightsOff";
  else if (s && Math.hypot(s.motionX, s.motionY) > 0.03) hint = "hintMoveSlowly";
  else if (mode === "lens" && snap.spotsChecked > 0 && Math.floor(snap.at / 6000) % 2 === 1) hint = "hintMoveCloser";

  const roomKind = app.rooms.find((r) => r.id === room)?.kind ?? "other";
  const hotspots = hotspotsForRoom(roomKind);
  const checked = new Set(stay.rooms[room]?.checked ?? []);
  const toggleHotspot = (id: string) =>
    updateRoom(room, (r) => ({
      ...r,
      checked: r.checked.includes(id) ? r.checked.filter((x) => x !== id) : [...r.checked, id],
    }));

  const srCandidates = snap.tracks.filter((x) => markerLabel(x, mode, labels) && !x.safe);

  // ---------- Render ----------
  if (precheck || (inApp && cam.error)) {
    return (
      <div className="min-h-dvh bg-bg">
        <CameraError kind={precheck ?? "inapp"} onRetry={cam.retry} onBack={() => navigate("home")} />
      </div>
    );
  }

  if (!started && !summary) {
    return (
      <div className="flex min-h-dvh flex-col bg-bg px-5 safe-top safe-bottom">
        <div className="flex items-center justify-between py-2">
          <Button variant="ghost" onClick={() => navigate("home")}>
            {t("back")}
          </Button>
          <button
            type="button"
            onClick={() => setRoomOpen(true)}
            className="min-h-11 rounded-full border border-line px-4 text-sm"
          >
            {t("room")}: <strong>{roomName(room)}</strong>
          </button>
        </div>
        <div className="flex flex-1 flex-col items-center justify-center gap-6 text-center">
          <span className="flex h-24 w-24 items-center justify-center rounded-full bg-accent/15 text-accent">
            {mode === "lens" ? <ScanEye size={48} aria-hidden /> : <Camera size={48} aria-hidden />}
          </span>
          <div>
            <h1 className="text-3xl font-bold">{mode === "lens" ? t("scanLensTitle") : t("scanIrTitle")}</h1>
            <p className="mx-auto mt-2 max-w-xs text-muted">{mode === "lens" ? t("onb3Body") : t("irDarkRoom")}</p>
          </div>
          {usingFile && <p className="text-sm text-amber-300">{t("testVideoActive", { name: testVideo!.name })}</p>}
          <Button variant="primary" size="lg" block className="max-w-sm" onClick={start}>
            {t("tapToStartCamera")}
          </Button>
          <p className="text-sm text-faint">{t("privacyLine")}</p>
        </div>
        <RoomPicker open={roomOpen} onClose={() => setRoomOpen(false)} />
      </div>
    );
  }

  const sensLabel = t(SENS_KEY[settings.sensitivity]);
  const showNoTorch = mode === "lens" && live && !usingFile && cam.track && !controls.torch.supported && !noTorchDismissed;

  return (
    <div className="fixed inset-0 z-40 overflow-hidden bg-black text-white">
      {started && cam.error && !usingFile ? (
        <div className="absolute inset-0 overflow-y-auto bg-bg">
          <CameraError kind={cam.error} onRetry={cam.retry} onBack={() => navigate("home")} />
        </div>
      ) : (
        <>
          <CameraStage
            setVideo={setVideo}
            video={video}
            mirror={mirror}
            fileUrl={usingFile ? testVideo!.url : null}
            getTracks={getTracks}
            getVerifyingId={getVerifyingId}
            mode={mode}
            debug={settings.debug}
            labels={labels}
            digitalZoom={digitalZoom}
            onTapTrack={openTrack}
            onTapEmpty={onTapEmpty}
          />
          {/* Centre reticle */}
          <div className="pointer-events-none absolute left-1/2 top-1/2 z-10 h-16 w-16 -translate-x-1/2 -translate-y-1/2" aria-hidden>
            <span className="absolute left-0 top-0 h-4 w-4 border-l-2 border-t-2 border-white/60" />
            <span className="absolute right-0 top-0 h-4 w-4 border-r-2 border-t-2 border-white/60" />
            <span className="absolute bottom-0 left-0 h-4 w-4 border-b-2 border-l-2 border-white/60" />
            <span className="absolute bottom-0 right-0 h-4 w-4 border-b-2 border-r-2 border-white/60" />
          </div>
          {!live && started && !summary && (
            <div className="absolute inset-0 z-10 flex items-center justify-center text-white/80">{t("cameraStarting")}</div>
          )}
        </>
      )}

      {!summary && !cam.error && (
        <>
          <ScanHud
            mode={mode}
            roomLabel={roomName(room)}
            onRoom={() => setRoomOpen(true)}
            torch={controls.torch}
            boost={controls.glintBoost}
            sensitivityLabel={sensLabel}
            spots={snap.spotsChecked}
            running={snap.running && live}
            hint={t(hint)}
            hintTone={hintTone}
            sound={settings.sound}
            onToggleSound={() => {
              alerts.unlock();
              updateSettings({ sound: !settings.sound });
            }}
            coverageLabel={`${t("coverage")} ${hotspots.filter((h) => checked.has(h.id)).length}/${hotspots.length}`}
            onCoverage={() => setCoverageOpen(true)}
          />

          {showNoTorch && (
            <div className="absolute inset-x-3 top-48 z-20 rounded-2xl border border-amber/40 bg-black/80 p-3 text-sm backdrop-blur" role="note">
              <div className="flex items-start gap-2">
                <Info size={18} className="mt-0.5 shrink-0 text-amber" aria-hidden />
                <div className="flex-1">
                  <p className="font-semibold text-amber-200">{t("noTorchTitle")}</p>
                  <p className="mt-1 text-white/90">{t("noTorchBody")}</p>
                  <p className="mt-1 text-white/60">{t("noTorchWhy")}</p>
                </div>
                <button
                  type="button"
                  aria-label={t("dismiss")}
                  onClick={() => setNoTorchDismissed(true)}
                  className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-full hover:bg-white/10"
                >
                  <X size={18} />
                </button>
              </div>
            </div>
          )}

          {settings.debug && (
            <DebugPanel snap={snap} ctrl={ctrl} caps={controls.caps} cameraLabel={usingFile ? testVideo!.name : cam.activeLabel} />
          )}

          <BottomControls
            mode={mode}
            torch={controls.torch}
            onTorch={() => void controls.torch.set(!controls.torch.on)}
            onCapture={capture}
            capturing={capturing}
            sensitivityLabel={sensLabel}
            onSensitivity={cycleSensitivity}
            canSwitch={!usingFile && cam.devices.length > 1}
            onSwitch={cam.switchCamera}
            onFlipFacing={() => setFacing((f) => (f === "user" ? "environment" : "user"))}
            zoom={controls.zoom}
            onStop={stop}
          />

          {/* Screen-reader access to current candidates */}
          <div className="sr-only">
            {srCandidates.map((c) => (
              <button key={c.id} type="button" onClick={() => openTrack(c.id)}>
                {markerLabel(c, mode, labels)}, {t(whereKey(c.x, c.y))}
              </button>
            ))}
          </div>
        </>
      )}
      <div className="sr-only" aria-live="polite" role="status">
        {announcement}
      </div>

      {showCoach && started && !summary && (
        <CoachOverlay
          onDone={() => {
            setShowCoach(false);
            updateSettings({ coached: true });
          }}
        />
      )}

      <CandidateSheet
        open={sheetId !== null}
        track={liveSheetTrack}
        onClose={() => setSheetId(null)}
        video={video}
        getTrack={getTrack}
        mirror={mirror}
        mode={mode}
        torchSupported={controls.torch.supported}
        verifying={snap.verifyingId !== null && snap.verifyingId === sheetId}
        onVerify={() => sheetId !== null && void ctrl.verify(sheetId)}
        onCapture={capture}
        onMarkSafe={() => {
          if (sheetId === null) return;
          ctrl.markSafe(sheetId);
          const prev = records.current.get(sheetId);
          if (prev) records.current.set(sheetId, { ...prev, verdict: "safe" });
          toast(t("markedSafe"));
          setSheetId(null);
        }}
      />

      <Sheet open={coverageOpen} onClose={() => setCoverageOpen(false)} title={t("coverageTitle")} closeLabel={t("close")}>
        <p className="mb-3 text-sm text-muted">{t("coverageHint")}</p>
        <ul className="grid gap-2 pb-2">
          {hotspots.map((h) => (
            <li key={h.id}>
              <button
                type="button"
                role="checkbox"
                aria-checked={checked.has(h.id)}
                onClick={() => toggleHotspot(h.id)}
                className="flex min-h-12 w-full items-center gap-3 rounded-2xl bg-surface-2 px-3 text-left"
              >
                {checked.has(h.id) ? (
                  <CheckSquare size={22} className="shrink-0 text-accent" aria-hidden />
                ) : (
                  <SquareIcon size={22} className="shrink-0 text-faint" aria-hidden />
                )}
                <span>{h.text[settings.lang].t}</span>
              </button>
            </li>
          ))}
        </ul>
      </Sheet>

      <RoomPicker
        open={roomOpen}
        onClose={() => setRoomOpen(false)}
        onPick={() => {
          ctrl.resetSession();
        }}
      />

      {summary && <SummarySheet summary={summary} mode={mode} onRestart={start} />}
    </div>
  );
}

function SummarySheet({ summary, mode, onRestart }: { summary: Summary; mode: "lens" | "ir"; onRestart: () => void }) {
  const { t, navigate, roomName, stay } = useApp();
  const [roomOpen, setRoomOpen] = useState(false);
  const { m, s } = splitDuration(summary.ms);
  const counts = new Map<string, number>();
  for (const r of summary.records) counts.set(r.verdict, (counts.get(r.verdict) ?? 0) + 1);
  const concerning = summary.records.filter((r) => r.verdict !== "safe");
  const verdictLabel: Record<string, I18nKey> = {
    possible: "markerPossible",
    likely: "markerLikely",
    reflection: "verdictReflection",
    light: "verdictLight",
    inconclusive: "verdictInconclusive",
    safe: "markerSafe",
    ir: "markerIr",
  };
  return (
    <div className="absolute inset-0 z-50 overflow-y-auto bg-bg/95 px-5 text-ink safe-top safe-bottom">
      <div className="mx-auto max-w-md py-6">
        <h2 className="text-2xl font-bold">{t("summaryTitle")}</h2>
        <p className="text-muted">{roomName(stay.currentRoom)}</p>
        <dl className="mt-5 grid grid-cols-3 gap-2 text-center">
          <div className="rounded-2xl bg-surface p-3">
            <dt className="text-xs text-muted">{t("timeScanned")}</dt>
            <dd className="text-lg font-semibold tabular-nums">{m > 0 ? t("minutesShort", { m, s }) : t("secondsShort", { s })}</dd>
          </div>
          <div className="rounded-2xl bg-surface p-3">
            <dt className="text-xs text-muted">{t("candidatesFound")}</dt>
            <dd className="text-lg font-semibold tabular-nums">{concerning.length}</dd>
          </div>
          <div className="rounded-2xl bg-surface p-3">
            <dt className="text-xs text-muted">{t("capturesSaved")}</dt>
            <dd className="text-lg font-semibold tabular-nums">{summary.captures}</dd>
          </div>
        </dl>
        {counts.size > 0 && (
          <ul className="mt-4 space-y-1 text-sm">
            {[...counts.entries()].map(([k, n]) => (
              <li key={k} className="flex justify-between rounded-xl bg-surface-2 px-3 py-2">
                <span>{t(verdictLabel[k] ?? "candidate")}</span>
                <span className="tabular-nums">{n}</span>
              </li>
            ))}
          </ul>
        )}
        <div className={`mt-5 rounded-2xl border p-4 ${concerning.length ? "border-amber/40 bg-amber/10" : "border-line bg-surface"}`}>
          <p className="font-semibold">
            {concerning.length ? t("somethingFound") : mode === "ir" ? t("nothingFoundIr") : t("nothingFound")}
          </p>
          <p className="mt-2 text-sm text-muted">{t("completeChecklistReminder")}</p>
        </div>
        <div className="mt-6 grid gap-2">
          <Button variant="primary" onClick={() => navigate("checklist")}>
            {t("openChecklist")}
          </Button>
          <Button onClick={() => setRoomOpen(true)}>{t("scanAnotherRoom")}</Button>
          {concerning.length > 0 && <Button onClick={() => navigate("found")}>{t("foundSomething")}</Button>}
          <Button variant="ghost" onClick={() => navigate("limits")}>
            {t("seeLimits")}
          </Button>
          <Button variant="ghost" onClick={() => navigate("home")}>
            {t("backHome")}
          </Button>
        </div>
      </div>
      <RoomPicker open={roomOpen} onClose={() => setRoomOpen(false)} onPick={onRestart} />
    </div>
  );
}
