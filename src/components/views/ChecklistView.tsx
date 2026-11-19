"use client";
import { useState } from "react";
import { CheckSquare, ScanEye, Square, Wifi, Lightbulb } from "lucide-react";
import { useApp } from "@/components/AppProvider";
import { ViewHeader } from "@/components/ui/ViewHeader";
import { Card } from "@/components/ui/Card";
import { ProgressRing } from "@/components/ui/ProgressRing";
import { itemsForRoom } from "@/lib/checklist-data";
import { overallProgress, roomProgress } from "@/lib/progress";
import type { I18nKey } from "@/lib/i18n";

const TIPS: I18nKey[] = ["tip1", "tip2", "tip3", "tip4", "tip5", "tip6"];

export function ChecklistView() {
  const { t, settings, stay, rooms, roomName, updateRoom, updateStay, navigate } = useApp();
  const [roomId, setRoomId] = useState(stay.currentRoom);
  const room = rooms.find((r) => r.id === roomId) ?? rooms[0];
  const items = itemsForRoom(room.kind);
  const checked = new Set(stay.rooms[room.id]?.checked ?? []);
  const rp = roomProgress(stay, room);
  const op = overallProgress(stay, rooms);

  const toggle = (id: string) =>
    updateRoom(room.id, (r) => ({
      ...r,
      checked: r.checked.includes(id) ? r.checked.filter((x) => x !== id) : [...r.checked, id],
    }));

  const pickRoom = (id: string) => {
    setRoomId(id);
    updateStay((s) => ({ ...s, currentRoom: id }));
  };

  return (
    <main className="mx-auto max-w-lg px-4 pb-12">
      <ViewHeader
        title={t("checklist")}
        right={<ProgressRing value={op.total ? op.done / op.total : 0} size={44} stroke={5} label={t("allRooms")} />}
      />
      <p className="mb-3 text-muted">{t("checklistIntro")}</p>

      <div className="-mx-4 mb-4 flex gap-2 overflow-x-auto px-4 pb-1" role="tablist" aria-label={t("room")}>
        {rooms.map((r) => {
          const p = roomProgress(stay, r);
          const active = r.id === room.id;
          return (
            <button
              key={r.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => pickRoom(r.id)}
              className={`flex min-h-11 shrink-0 items-center gap-2 rounded-full border px-4 text-sm ${
                active ? "border-accent bg-accent/15 text-ink" : "border-line bg-surface text-muted"
              }`}
            >
              {roomName(r.id)}
              <span className="tabular-nums text-xs opacity-80">
                {p.done}/{p.total}
              </span>
            </button>
          );
        })}
      </div>

      <Card className="mb-4 flex items-center gap-4">
        <ProgressRing value={rp.total ? rp.done / rp.total : 0} label={roomName(room.id)} />
        <div>
          <p className="font-semibold">{roomName(room.id)}</p>
          <p className="text-sm text-muted">{t("checkedOf", { done: rp.done, total: rp.total })}</p>
        </div>
      </Card>

      <ul className="grid gap-2">
        {items.map((it) => {
          const on = checked.has(it.id);
          const txt = it.text[settings.lang];
          return (
            <li key={it.id} className={`rounded-2xl border p-3 ${on ? "border-accent/30 bg-accent/5" : "border-line bg-surface"}`}>
              <button
                type="button"
                role="checkbox"
                aria-checked={on}
                onClick={() => toggle(it.id)}
                className="flex w-full items-start gap-3 text-left"
              >
                {on ? (
                  <CheckSquare size={26} className="mt-0.5 shrink-0 text-accent" aria-hidden />
                ) : (
                  <Square size={26} className="mt-0.5 shrink-0 text-faint" aria-hidden />
                )}
                <span className="flex-1">
                  <span className={`block font-medium ${on ? "text-ink/70 line-through decoration-accent/60" : ""}`}>{txt.t}</span>
                  <span className="mt-0.5 block text-sm text-muted">{txt.h}</span>
                </span>
              </button>
              <div className="mt-1 flex justify-end">
                <button
                  type="button"
                  onClick={() => {
                    updateStay((s) => ({ ...s, currentRoom: room.id }));
                    navigate("scan");
                  }}
                  className="inline-flex min-h-11 items-center gap-1.5 rounded-full px-3 text-sm text-accent hover:bg-accent/10"
                >
                  <ScanEye size={16} aria-hidden /> {t("scanThis")}
                </button>
              </div>
            </li>
          );
        })}
      </ul>

      <Card className="mt-6">
        <h2 className="mb-2 flex items-center gap-2 text-lg font-semibold">
          <Lightbulb size={20} className="text-accent" aria-hidden /> {t("tipsTitle")}
        </h2>
        <ul className="list-disc space-y-1 pl-5 text-sm text-ink/90">
          {TIPS.map((k) => (
            <li key={k}>{t(k)}</li>
          ))}
        </ul>
      </Card>

      <Card className="mt-4">
        <h2 className="mb-1 flex items-center gap-2 font-semibold">
          <Wifi size={18} className="text-muted" aria-hidden /> {t("networkTipTitle")}
        </h2>
        <p className="text-sm text-muted">{t("networkTipBody")}</p>
      </Card>
    </main>
  );
}
