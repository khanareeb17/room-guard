"use client";
import { useEffect } from "react";
import { AppProvider, useApp } from "./AppProvider";
import { Toasts } from "./ui/Toasts";
import { Onboarding } from "./Onboarding";
import { useIsClient } from "@/hooks/useIsClient";
import { HomeView } from "./views/HomeView";
import { LensScanView } from "./views/LensScanView";
import { IrScanView } from "./views/IrScanView";
import { ChecklistView } from "./views/ChecklistView";
import { MirrorTestView } from "./views/MirrorTestView";
import { FoundSomethingView } from "./views/FoundSomethingView";
import { ReportView } from "./views/ReportView";
import { LimitsView } from "./views/LimitsView";
import { SettingsView } from "./views/SettingsView";
import { registerServiceWorker } from "@/lib/sw-register";

function Shell() {
  const { view, settings } = useApp();
  const client = useIsClient();

  useEffect(() => {
    document.documentElement.lang = settings.lang === "ur" ? "ur-Latn" : "en";
  }, [settings.lang]);

  useEffect(() => {
    registerServiceWorker();
  }, []);

  let content: React.ReactNode;
  switch (view) {
    case "scan":
      content = <LensScanView />;
      break;
    case "ir":
      content = <IrScanView />;
      break;
    case "checklist":
      content = <ChecklistView />;
      break;
    case "mirror":
      content = <MirrorTestView />;
      break;
    case "found":
      content = <FoundSomethingView />;
      break;
    case "report":
      content = <ReportView />;
      break;
    case "limits":
      content = <LimitsView />;
      break;
    case "settings":
      content = <SettingsView />;
      break;
    default:
      content = <HomeView />;
  }

  return (
    <>
      <div key={view} className="min-h-dvh animate-fade-in">
        {content}
      </div>
      {client && !settings.onboarded && <Onboarding />}
      <Toasts />
    </>
  );
}

export function App() {
  return (
    <AppProvider>
      <Shell />
    </AppProvider>
  );
}
