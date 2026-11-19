"use client";
import { AlertTriangle, Copy, Lock, VideoOff, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { useApp } from "@/components/AppProvider";
import type { CameraErrorKind } from "@/hooks/useCamera";
import { isIOS } from "@/lib/env";

export function CameraError({ kind, onRetry, onBack }: { kind: CameraErrorKind; onRetry: () => void; onBack: () => void }) {
  const { t, toast } = useApp();
  const map = {
    insecure: { icon: Lock, title: t("errInsecureTitle"), body: t("errInsecureBody") },
    denied: { icon: VideoOff, title: t("errDeniedTitle"), body: t("errDeniedBody") },
    notfound: { icon: VideoOff, title: t("errNotFoundTitle"), body: t("errNotFoundBody") },
    busy: { icon: AlertTriangle, title: t("errBusyTitle"), body: t("errBusyBody") },
    inapp: { icon: ExternalLink, title: t("errInAppTitle"), body: t("errInAppBody") },
    unsupported: { icon: VideoOff, title: t("errUnsupportedTitle"), body: t("errUnsupportedBody") },
    unknown: { icon: AlertTriangle, title: t("errUnknownTitle"), body: t("errUnknownBody") },
  }[kind];
  const Icon = map.icon;
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href.split("#")[0]);
      toast(t("linkCopied"), { tone: "success" });
    } catch {
      window.prompt(t("copyLink"), window.location.href.split("#")[0]);
    }
  };
  const ios = isIOS();
  return (
    <div className="flex min-h-[70dvh] flex-col items-center justify-center gap-4 px-6 text-center" role="alert">
      <span className="flex h-16 w-16 items-center justify-center rounded-full bg-amber/15 text-amber">
        <Icon size={32} aria-hidden />
      </span>
      <h2 className="text-2xl font-semibold">{map.title}</h2>
      <p className="max-w-sm text-muted">{map.body}</p>
      {kind === "denied" && (
        <div className="max-w-sm space-y-2 rounded-2xl border border-line bg-surface p-4 text-left text-sm">
          <p className={ios ? "opacity-70" : "font-medium"}>{t("errDeniedAndroid")}</p>
          <p className={ios ? "font-medium" : "opacity-70"}>{t("errDeniedIos")}</p>
        </div>
      )}
      <div className="mt-2 flex w-full max-w-sm flex-col gap-2">
        {kind === "inapp" && (
          <Button variant="primary" icon={<Copy size={20} />} onClick={copy}>
            {t("copyLink")}
          </Button>
        )}
        {kind !== "insecure" && kind !== "unsupported" && (
          <Button variant={kind === "inapp" ? "secondary" : "primary"} onClick={onRetry}>
            {t("tryAgain")}
          </Button>
        )}
        <Button variant="ghost" onClick={onBack}>
          {t("backHome")}
        </Button>
      </div>
    </div>
  );
}
