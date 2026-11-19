"use client";
import { useRef, useState } from "react";
import { Film, Trash2, RotateCcw } from "lucide-react";
import { useApp } from "@/components/AppProvider";
import { ViewHeader } from "@/components/ui/ViewHeader";
import { Card } from "@/components/ui/Card";
import { Toggle } from "@/components/ui/Toggle";
import { Segmented } from "@/components/ui/Segmented";
import { Button } from "@/components/ui/Button";
import { ConfirmSheet } from "@/components/ui/ConfirmSheet";
import { LANG_LABELS, type Lang } from "@/lib/i18n";
import { clearCaptures } from "@/lib/storage";
import type { Sensitivity } from "@/lib/detection/types";

export function SettingsView() {
  const { t, settings, updateSettings, resetStay, toast, testVideo, setTestVideo, navigate } = useApp();
  const [confirm, setConfirm] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  return (
    <main className="mx-auto max-w-lg px-4 pb-12">
      <ViewHeader title={t("settings")} />
      <p className="mb-4 text-muted">{t("settingsIntro")}</p>

      <Card className="mb-4 space-y-4">
        <div>
          <p className="mb-1 font-medium">{t("sensitivity")}</p>
          <p className="mb-2 text-sm text-muted">{t("sensitivityHint")}</p>
          <Segmented<Sensitivity>
            label={t("sensitivity")}
            value={settings.sensitivity}
            onChange={(v) => updateSettings({ sensitivity: v })}
            options={[
              { value: "low", label: t("sensLow") },
              { value: "normal", label: t("sensNormal") },
              { value: "high", label: t("sensHigh") },
            ]}
          />
        </div>
        <div>
          <p className="mb-2 font-medium">{t("language")}</p>
          <Segmented<Lang>
            label={t("language")}
            value={settings.lang}
            onChange={(v) => updateSettings({ lang: v })}
            options={(Object.keys(LANG_LABELS) as Lang[]).map((l) => ({ value: l, label: LANG_LABELS[l] }))}
          />
        </div>
      </Card>

      <Card className="mb-4 divide-y divide-line/60">
        <Toggle label={t("glintBoost")} hint={t("glintBoostHint")} checked={settings.glintBoost} onChange={(v) => updateSettings({ glintBoost: v })} />
        <Toggle label={t("autoVerify")} hint={t("autoVerifyHint")} checked={settings.autoVerify} onChange={(v) => updateSettings({ autoVerify: v })} />
        <Toggle label={t("sound")} checked={settings.sound} onChange={(v) => updateSettings({ sound: v })} />
        <Toggle label={t("vibration")} checked={settings.vibration} onChange={(v) => updateSettings({ vibration: v })} />
        <Toggle label={t("showDebug")} hint={t("debugHint")} checked={settings.debug} onChange={(v) => updateSettings({ debug: v })} />
      </Card>

      {settings.debug && (
        <Card className="mb-4">
          <p className="font-medium">{t("testVideo")}</p>
          <p className="mb-3 text-sm text-muted">{t("testVideoHint")}</p>
          <input
            ref={fileRef}
            type="file"
            accept="video/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) {
                setTestVideo({ url: URL.createObjectURL(f), name: f.name });
                navigate("scan");
              }
              e.target.value = "";
            }}
          />
          {testVideo && <p className="mb-2 text-sm text-amber-300">{t("testVideoActive", { name: testVideo.name })}</p>}
          <div className="flex flex-wrap gap-2">
            <Button icon={<Film size={18} />} onClick={() => fileRef.current?.click()}>
              {t("testVideo")}
            </Button>
            {testVideo && <Button onClick={() => setTestVideo(null)}>{t("testVideoClear")}</Button>}
          </div>
        </Card>
      )}

      <div className="grid gap-2">
        <Button icon={<RotateCcw size={18} />} onClick={() => updateSettings({ onboarded: false, coached: false })}>
          {t("replayOnboarding")}
        </Button>
        <Button variant="danger" icon={<Trash2 size={18} />} onClick={() => setConfirm(true)}>
          {t("clearData")}
        </Button>
      </div>

      <ConfirmSheet
        open={confirm}
        title={t("clearAll")}
        body={t("clearAllConfirm")}
        confirmLabel={t("clearAll")}
        cancelLabel={t("cancel")}
        danger
        onClose={() => setConfirm(false)}
        onConfirm={async () => {
          resetStay();
          await clearCaptures();
          toast(t("cleared"));
        }}
      />
    </main>
  );
}
