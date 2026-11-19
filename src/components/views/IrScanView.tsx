"use client";
import { useState } from "react";
import { Check, Moon, TvMinimal, X, AlertTriangle } from "lucide-react";
import { useApp } from "@/components/AppProvider";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ViewHeader } from "@/components/ui/ViewHeader";
import { ScannerScreen } from "@/components/scanner/ScannerScreen";
import { CameraError } from "@/components/scanner/CameraError";
import { useCamera, type Facing } from "@/hooks/useCamera";

export function IrScanView() {
  const { t, settings, updateSettings } = useApp();
  const [phase, setPhase] = useState<"intro" | "test" | "scan">("intro");
  const [testFacing, setTestFacing] = useState<Facing>("user");

  if (phase === "test") {
    return (
      <IrSelfTest
        facing={testFacing}
        onResult={(saw) => {
          updateSettings(testFacing === "user" ? { irFront: saw } : { irRear: saw });
          setPhase("intro");
        }}
        onCancel={() => setPhase("intro")}
      />
    );
  }

  if (phase === "scan") {
    const facing: Facing = settings.irFront === false && settings.irRear === true ? "environment" : "user";
    return <ScannerScreen mode="ir" initialFacing={facing} autoStart />;
  }

  const cams = [settings.irFront ? t("irFront") : null, settings.irRear ? t("irRear") : null].filter(Boolean);
  const neither = settings.irFront === false && settings.irRear === false;

  return (
    <main className="mx-auto max-w-lg px-4 pb-10">
      <ViewHeader title={t("scanIrTitle")} />
      <p className="mb-4 text-lg">{t("irIntro")}</p>
      <Card className="mb-4">
        <div className="mb-2 flex items-center gap-2">
          <TvMinimal size={22} className="text-accent" aria-hidden />
          <h2 className="text-lg font-semibold">{t("irSelfTestTitle")}</h2>
        </div>
        <p className="mb-4 text-muted">{t("irSelfTestBody")}</p>
        <div className="grid grid-cols-2 gap-2">
          {(["user", "environment"] as Facing[]).map((f) => {
            const res = f === "user" ? settings.irFront : settings.irRear;
            return (
              <Button
                key={f}
                onClick={() => {
                  setTestFacing(f);
                  setPhase("test");
                }}
                icon={res === true ? <Check size={18} className="text-accent" /> : res === false ? <X size={18} className="text-red-300" /> : null}
              >
                {f === "user" ? t("irTestFront") : t("irTestRear")}
              </Button>
            );
          })}
        </div>
        {cams.length > 0 && <p className="mt-3 text-sm text-accent">{t("irWorksOn", { cams: cams.join(", ") })}</p>}
        {neither && (
          <p className="mt-3 flex gap-2 text-sm text-amber-200">
            <AlertTriangle size={18} className="shrink-0" aria-hidden />
            {t("irNeither")}
          </p>
        )}
      </Card>
      <Card className="mb-6">
        <div className="flex items-start gap-3">
          <Moon size={22} className="mt-0.5 shrink-0 text-accent" aria-hidden />
          <p className="text-muted">{t("irDarkRoom")}</p>
        </div>
        <p className="mt-2 text-sm text-faint">{t("irUsingFront")}</p>
      </Card>
      <Button variant="primary" size="lg" block onClick={() => setPhase("scan")}>
        {t("irStartScan")}
      </Button>
    </main>
  );
}

function IrSelfTest({ facing, onResult, onCancel }: { facing: Facing; onResult: (saw: boolean) => void; onCancel: () => void }) {
  const { t, navigate } = useApp();
  const [video, setVideo] = useState<HTMLVideoElement | null>(null);
  const cam = useCamera({ enabled: true, facing, video });
  if (cam.error) {
    return (
      <div className="min-h-dvh bg-bg">
        <CameraError kind={cam.error} onRetry={cam.retry} onBack={() => navigate("home")} />
      </div>
    );
  }
  return (
    <div className="fixed inset-0 z-40 bg-black text-white">
      <video
        ref={setVideo}
        playsInline
        muted
        autoPlay
        className="absolute inset-0 h-full w-full object-cover"
        style={facing === "user" ? { transform: "scaleX(-1)" } : undefined}
      />
      <div className="safe-top absolute inset-x-0 top-0 bg-gradient-to-b from-black/80 to-transparent p-4 pb-10">
        <p className="text-center text-lg font-semibold">{facing === "user" ? t("irTestFront") : t("irTestRear")}</p>
        <p className="mt-1 text-center text-white/85">{t("irSelfTestBody")}</p>
      </div>
      <div className="safe-bottom absolute inset-x-0 bottom-0 grid gap-2 bg-gradient-to-t from-black/85 to-transparent p-4 pt-12">
        <Button variant="primary" size="lg" onClick={() => onResult(true)}>
          {t("irSawLight")}
        </Button>
        <Button size="lg" onClick={() => onResult(false)}>
          {t("irNoLight")}
        </Button>
        <Button variant="ghost" onClick={onCancel}>
          {t("cancel")}
        </Button>
      </div>
    </div>
  );
}
