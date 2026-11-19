"use client";
import { useState } from "react";
import { Check, Plus } from "lucide-react";
import { Sheet } from "@/components/ui/Sheet";
import { Button } from "@/components/ui/Button";
import { useApp } from "@/components/AppProvider";

export function RoomPicker({ open, onClose, onPick }: { open: boolean; onClose: () => void; onPick?: (id: string) => void }) {
  const { t, rooms, roomName, stay, updateStay } = useApp();
  const [name, setName] = useState("");
  const pick = (id: string) => {
    updateStay((s) => ({ ...s, currentRoom: id }));
    onPick?.(id);
    onClose();
  };
  const add = () => {
    const n = name.trim().slice(0, 40);
    if (!n) return;
    const id = `custom-${Date.now().toString(36)}`;
    updateStay((s) => ({ ...s, customRooms: [...s.customRooms, { id, kind: "other", name: n }], currentRoom: id }));
    setName("");
    onPick?.(id);
    onClose();
  };
  return (
    <Sheet open={open} onClose={onClose} title={t("pickRoom")} closeLabel={t("close")}>
      <div className="grid grid-cols-2 gap-2">
        {rooms.map((r) => (
          <button
            key={r.id}
            type="button"
            onClick={() => pick(r.id)}
            aria-pressed={stay.currentRoom === r.id}
            className={`flex min-h-14 items-center justify-between rounded-2xl border px-4 text-left ${
              stay.currentRoom === r.id ? "border-accent bg-accent/10 text-ink" : "border-line bg-surface-2 text-ink"
            }`}
          >
            <span className="truncate">{roomName(r.id)}</span>
            {stay.currentRoom === r.id && <Check size={18} className="text-accent" aria-hidden />}
          </button>
        ))}
      </div>
      <form
        className="mt-4 flex gap-2 pb-2"
        onSubmit={(e) => {
          e.preventDefault();
          add();
        }}
      >
        <label className="sr-only" htmlFor="custom-room">
          {t("customRoomPlaceholder")}
        </label>
        <input
          id="custom-room"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={t("customRoomPlaceholder")}
          className="min-h-12 flex-1 rounded-2xl border border-line bg-surface-2 px-4 text-ink placeholder:text-faint"
        />
        <Button type="submit" variant="primary" icon={<Plus size={18} />} disabled={!name.trim()}>
          {t("add")}
        </Button>
      </form>
    </Sheet>
  );
}
