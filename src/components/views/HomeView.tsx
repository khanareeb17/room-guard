"use client";
import { useRef, useState } from "react";
import {
  ScanEye,
  Moon,
  ListChecks,
  Eye,
  Siren,
  FileText,
  Info,
  Settings,
  Download,
  Smartphone,
  ExternalLink,
  ChevronRight,
  ShieldCheck,
} from "lucide-react";
import { useApp } from "@/components/AppProvider";
import { Button } from "@/components/ui/Button";
import { ProgressRing } from "@/components/ui/ProgressRing";
import { ConfirmSheet } from "@/components/ui/ConfirmSheet";
import { Logo } from "@/components/Logo";
import { useInstallPrompt } from "@/hooks/useInstallPrompt";
import { useIsClient } from "@/hooks/useIsClient";
import { inAppBrowserName, isIOS, isMobile, isStandalone } from "@/lib/env";
import { overallProgress } from "@/lib/progress";
import { clearCaptures } from "@/lib/storage";
import type { View } from "@/hooks/useHashView";
import type { I18nKey } from "@/lib/i18n";

const CARDS: { view: View; icon: typeof Moon; title: I18nKey; sub: I18nKey }[] = [
  { view: "ir", icon: Moon, title: "irScan", sub: "irScanSub" },
  { view: "checklist", icon: ListChecks, title: "checklist", sub: "checklistSub" },
  { view: "mirror", icon: Eye, title: "mirrorTest", sub: "mirrorTestSub" },
  { view: "found", icon: Siren, title: "foundSomething", sub: "foundSomethingSub" },
  { view: "report", icon: FileText, title: "report", sub: "reportSub" },
  { view: "limits", icon: Info, title: "limits", sub: "limitsSub" },
];

export function HomeView() {
  const { t, navigate, stay, rooms, settings, updateSettings, resetStay, toast } = useApp();
  const client = useIsClient();
  const { canInstall, install } = useInstallPrompt();
  const [confirmNew, setConfirmNew] = useState(false);
  const taps = useRef<number[]>([]);

  const prog = overallProgress(stay, rooms);
  const inApp = client ? inAppBrowserName() : null;
  const desktop = client && !isMobile();
  const iosTip = client && isIOS() && !isStandalone();

  const onLogoTap = () => {
    const now = Date.now();
    taps.current = [...taps.current.filter((x) => now - x < 2000), now];
    if (taps.current.length >= 5) {
      taps.current = [];
      updateSettings({ debug: !settings.debug });
      toast(`${t("debug")}: ${!settings.debug ? "on" : "off"}`);
    }
  };

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href.split("#")[0]);
      toast(t("linkCopied"), { tone: "success" });
    } catch {
      window.prompt(t("copyLink"), window.location.href.split("#")[0]);
    }
  };

  return (
    <main className="mx-auto max-w-lg px-4 pb-12 safe-top">
      <header className="flex items-center gap-3 pt-2">
        <button type="button" onClick={onLogoTap} aria-label={t("appName")} className="rounded-xl">
          <Logo size={44} />
        </button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold tracking-tight">{t("appName")}</h1>
        </div>
        <button
          type="button"
          onClick={() => navigate("settings")}
          aria-label={t("settings")}
          className="inline-flex min-h-12 min-w-12 items-center justify-center rounded-full hover:bg-white/5"
        >
          <Settings size={24} />
        </button>
      </header>
      <p className="mt-3 text-lg text-ink/90">{t("tagline")}</p>
      <p className="mt-2 flex items-center gap-2 text-sm text-accent">
        <ShieldCheck size={16} aria-hidden /> {t("privacyLine")}
      </p>

      {inApp && (
        <div className="mt-4 rounded-2xl border border-amber/40 bg-amber/10 p-4" role="alert">
          <p className="font-semibold text-amber-200">{t("errInAppTitle")}</p>
          <p className="mt-1 text-sm text-ink/85">{t("errInAppBody")}</p>
          <Button className="mt-3" size="sm" icon={<ExternalLink size={16} />} onClick={copyLink}>
            {t("copyLink")}
          </Button>
        </div>
      )}
      {desktop && (
        <p className="mt-4 flex items-center gap-2 rounded-2xl border border-line bg-surface px-4 py-3 text-sm text-muted">
          <Smartphone size={18} aria-hidden /> {t("bestOnPhone")}
        </p>
      )}

      <Button
        variant="primary"
        size="lg"
        block
        className="mt-6 !min-h-20 text-xl shadow-lg shadow-accent/10"
        icon={<ScanEye size={28} aria-hidden />}
        onClick={() => navigate("scan")}
      >
        <span className="flex flex-col items-start leading-tight">
          <span>{t("startLensScan")}</span>
          <span className="text-sm font-normal opacity-80">{t("lensScanSub")}</span>
        </span>
      </Button>

      <section className="mt-5 flex items-center gap-4 rounded-3xl border border-line bg-surface p-4" aria-label={t("overallProgress")}>
        <ProgressRing value={prog.total ? prog.done / prog.total : 0} label={t("overallProgress")} />
        <div className="flex-1">
          <p className="font-medium">{t("overallProgress")}</p>
          <p className="text-sm text-muted">{t("checkedOf", { done: prog.done, total: prog.total })}</p>
        </div>
        <Button size="sm" variant="outline" onClick={() => setConfirmNew(true)}>
          {t("newStay")}
        </Button>
      </section>

      <nav className="mt-4 grid grid-cols-2 gap-3">
        {CARDS.map(({ view, icon: Icon, title, sub }) => (
          <button
            key={view}
            type="button"
            onClick={() => navigate(view)}
            className={`flex min-h-32 flex-col justify-between rounded-3xl border p-4 text-left transition-colors hover:bg-surface-2 ${
              view === "found" ? "border-amber/30 bg-amber/5" : "border-line bg-surface"
            }`}
          >
            <Icon size={26} className={view === "found" ? "text-amber" : "text-accent"} aria-hidden />
            <span>
              <span className="flex items-center justify-between font-semibold">
                {t(title)} <ChevronRight size={16} className="text-faint" aria-hidden />
              </span>
              <span className="mt-0.5 block text-xs text-muted">{t(sub)}</span>
            </span>
          </button>
        ))}
      </nav>

      {(canInstall || iosTip) && (
        <section className="mt-5 rounded-3xl border border-line bg-surface p-4">
          {canInstall ? (
            <Button block variant="secondary" icon={<Download size={20} />} onClick={install}>
              {t("installApp")}
            </Button>
          ) : (
            <p className="text-sm text-muted">{t("iosInstallTip")}</p>
          )}
          <p className="mt-2 text-center text-xs text-faint">{t("offlineReady")}</p>
        </section>
      )}

      <ConfirmSheet
        open={confirmNew}
        title={t("newStay")}
        body={t("newStayConfirm")}
        confirmLabel={t("confirm")}
        cancelLabel={t("cancel")}
        danger
        onClose={() => setConfirmNew(false)}
        onConfirm={() => {
          resetStay();
          void clearCaptures();
        }}
      />
    </main>
  );
}
