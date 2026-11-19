import type { I18nKey } from "./i18n";

export type RoomKind = "bedroom" | "bathroom" | "living" | "kitchen" | "other";

export interface RoomDef {
  id: string;
  kind: RoomKind;
  /** Built-in rooms use a translation key; custom rooms have a name. */
  labelKey?: I18nKey;
  name?: string;
}

export const BUILTIN_ROOMS: RoomDef[] = [
  { id: "bedroom1", kind: "bedroom", labelKey: "roomBedroom1" },
  { id: "bedroom2", kind: "bedroom", labelKey: "roomBedroom2" },
  { id: "bathroom", kind: "bathroom", labelKey: "roomBathroom" },
  { id: "living", kind: "living", labelKey: "roomLiving" },
  { id: "kitchen", kind: "kitchen", labelKey: "roomKitchen" },
  { id: "other", kind: "other", labelKey: "roomOther" },
];
