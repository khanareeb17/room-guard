"use client";
import { Sheet } from "./Sheet";
import { Button } from "./Button";

export function ConfirmSheet({
  open,
  title,
  body,
  confirmLabel,
  cancelLabel,
  onConfirm,
  onClose,
  danger,
}: {
  open: boolean;
  title: string;
  body: string;
  confirmLabel: string;
  cancelLabel: string;
  onConfirm: () => void;
  onClose: () => void;
  danger?: boolean;
}) {
  return (
    <Sheet open={open} onClose={onClose} title={title} closeLabel={cancelLabel}>
      <p className="mb-5 text-muted">{body}</p>
      <div className="flex gap-3 pb-2">
        <Button block onClick={onClose}>
          {cancelLabel}
        </Button>
        <Button
          block
          variant={danger ? "danger" : "primary"}
          onClick={() => {
            onConfirm();
            onClose();
          }}
        >
          {confirmLabel}
        </Button>
      </div>
    </Sheet>
  );
}
