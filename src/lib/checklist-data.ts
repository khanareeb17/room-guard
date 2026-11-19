import type { Lang } from "./i18n";
import type { RoomKind } from "./rooms";

export interface ChecklistItem {
  id: string;
  text: Record<Lang, { t: string; h: string }>;
  /** Priority per room kind (lower = shown first). Missing kind = not shown there. */
  rooms: Partial<Record<RoomKind, number>>;
}

const ALL = (p: number): Partial<Record<RoomKind, number>> => ({ bedroom: p, bathroom: p, living: p, kitchen: p, other: p });

export const CHECKLIST: ChecklistItem[] = [
  {
    id: "facing-bed",
    text: {
      en: { t: "Area facing the bed", h: "Stand at the bed and look at everything pointed toward it — shelves, TV, decor, vents." },
      ur: { t: "Bed ke saamne wala hissa", h: "Bed ke paas khare ho kar har us cheez ko dekhein jis ka rukh bed ki taraf ho — shelf, TV, decor, vents." },
    },
    rooms: { bedroom: 1, other: 30 },
  },
  {
    id: "shower",
    text: {
      en: { t: "Shower / bath area", h: "Check walls, ceiling, shelves, drains and fixtures around the shower and bath for tiny holes or dark dots." },
      ur: { t: "Shower / bath ki jagah", h: "Shower aur bath ke gird deewarein, chhat, shelf, naali aur fittings mein chhote surakh ya kaale nuqte dekhein." },
    },
    rooms: { bathroom: 1 },
  },
  {
    id: "facing-toilet",
    text: {
      en: { t: "Area facing the toilet / shower", h: "Look at everything that has a view of the toilet or shower — cabinets, shelves, vents, decor." },
      ur: { t: "Toilet / shower ke saamne wala hissa", h: "Har woh cheez dekhein jahan se toilet ya shower nazar aata ho — cabinet, shelf, vents, decor." },
    },
    rooms: { bathroom: 2 },
  },
  {
    id: "smoke",
    text: {
      en: { t: "Smoke / CO detectors", h: "Look for a small glossy dot or hole on the face. Count detectors — an extra one in a bedroom or bathroom is a red flag." },
      ur: { t: "Smoke / CO detector", h: "Samne chhota chamakdaar nuqta ya surakh dekhein. Ginti karein — bedroom ya bathroom mein extra detector khatre ki alamat hai." },
    },
    rooms: { bedroom: 2, bathroom: 6, living: 1, kitchen: 2, other: 1 },
  },
  {
    id: "clocks",
    text: {
      en: { t: "Alarm clocks & digital clocks", h: "Check the front panel and any dark plastic window. Lens Scan the display from 1 m." },
      ur: { t: "Alarm clock aur digital clock", h: "Saamne ka panel aur koi bhi kaali plastic khirki check karein. 1 m se display ka Lens Scan karein." },
    },
    rooms: { bedroom: 3, living: 6, kitchen: 8, other: 2 },
  },
  {
    id: "chargers",
    text: {
      en: { t: "USB wall chargers & power adapters", h: "Is something plugged in with nothing attached? Look for a tiny hole on the face. Unplug it if unsure." },
      ur: { t: "USB wall charger aur power adapter", h: "Kuch bila wajah plug mein laga hai? Samne chhota surakh dekhein. Shak ho to plug nikaal dein." },
    },
    rooms: { bedroom: 4, bathroom: 9, living: 3, kitchen: 4, other: 3 },
  },
  {
    id: "power-strips",
    text: {
      en: { t: "Power strips & extension boards", h: "Check the ends and the side facing the room for a small dot or pinhole." },
      ur: { t: "Power strip aur extension board", h: "Kinare aur kamre ki taraf wali side par chhota nuqta ya pinhole dekhein." },
    },
    rooms: { bedroom: 8, living: 7, kitchen: 7, other: 4 },
  },
  {
    id: "tv",
    text: {
      en: { t: "TV, set-top box & soundbar", h: "Scan the bezel, the box's front panel and the soundbar grille. Look for lights that stay on when they're off." },
      ur: { t: "TV, set-top box aur soundbar", h: "TV ka kinara, box ka front panel aur soundbar ki jaali scan karein. Band hone par bhi jalti lights dekhein." },
    },
    rooms: { bedroom: 5, living: 2, other: 5 },
  },
  {
    id: "speakers",
    text: {
      en: { t: "Smart speakers", h: "Check the top and front. A speaker pointed at the bed or sofa deserves a closer look." },
      ur: { t: "Smart speaker", h: "Upar aur saamne check karein. Bed ya sofe ki taraf rukh wala speaker ghaur se dekhein." },
    },
    rooms: { bedroom: 9, living: 4, kitchen: 6, other: 6 },
  },
  {
    id: "purifiers",
    text: {
      en: { t: "Air purifiers & humidifiers", h: "Look into the vents and the control panel for a dark lens." },
      ur: { t: "Air purifier aur humidifier", h: "Vents aur control panel mein kaala lens dekhein." },
    },
    rooms: { bedroom: 12, living: 9, other: 7 },
  },
  {
    id: "vents",
    text: {
      en: { t: "AC vents & ceiling vents", h: "Shine your light through the slats. A lens behind a grille still glints." },
      ur: { t: "AC vents aur chhat ke vents", h: "Jaali ke beech roshni daalein. Jaali ke peeche lens bhi chamakta hai." },
    },
    rooms: { bedroom: 6, bathroom: 4, living: 8, kitchen: 9, other: 8 },
  },
  {
    id: "corners",
    text: {
      en: { t: "Wall & ceiling corners", h: "Sweep corners slowly, especially high corners that overlook the room." },
      ur: { t: "Deewar aur chhat ke kone", h: "Kono ko aahista scan karein, khaas taur par oonche kone jahan se poora kamra nazar aata ho." },
    },
    rooms: ALL(10),
  },
  {
    id: "lights",
    text: {
      en: { t: "Light fixtures & lamps", h: "Check lamp bases, shades and ceiling fittings. Turn lamps off before scanning." },
      ur: { t: "Light fittings aur lamp", h: "Lamp ka base, shade aur chhat ki fittings check karein. Scan se pehle lamp band karein." },
    },
    rooms: { bedroom: 7, bathroom: 7, living: 5, kitchen: 5, other: 9 },
  },
  {
    id: "frames",
    text: {
      en: { t: "Picture frames & wall art", h: "Look for a tiny hole in the art or the frame. Gently lift and look behind if you can." },
      ur: { t: "Tasveeri frame aur wall art", h: "Tasveer ya frame mein chhota surakh dekhein. Mumkin ho to aahista utha kar peeche dekhein." },
    },
    rooms: { bedroom: 10, living: 10, other: 10 },
  },
  {
    id: "mirrors",
    text: {
      en: { t: "Mirrors", h: "Do the Mirror Test, especially for mirrors facing the bed, shower or toilet." },
      ur: { t: "Aaine", h: "Aaina Test karein, khaas taur par bed, shower ya toilet ke saamne wale aaine." },
    },
    rooms: { bedroom: 11, bathroom: 3, living: 14, other: 11 },
  },
  {
    id: "shelves",
    text: {
      en: { t: "Bookshelves & decor", h: "Scan books, boxes, figurines and odd objects facing the bed or sofa." },
      ur: { t: "Kitabon ki shelf aur decor", h: "Bed ya sofe ki taraf rukh wali kitabein, dabbe, mujasme aur ajeeb cheezein scan karein." },
    },
    rooms: { bedroom: 13, living: 11, other: 12 },
  },
  {
    id: "plants",
    text: {
      en: { t: "Plants (real or fake)", h: "Look between leaves and around the pot for wires or a small lens." },
      ur: { t: "Paude (asli ya naqli)", h: "Patton ke beech aur gamle ke gird taar ya chhota lens dekhein." },
    },
    rooms: { bedroom: 16, bathroom: 12, living: 12, kitchen: 10, other: 13 },
  },
  {
    id: "tissue",
    text: {
      en: { t: "Tissue boxes", h: "Check the box for a hole that doesn't belong, especially near the bed or toilet." },
      ur: { t: "Tissue box", h: "Dabbe mein be-maqsad surakh dekhein, khaas taur par bed ya toilet ke paas." },
    },
    rooms: { bedroom: 14, bathroom: 8, living: 15, other: 14 },
  },
  {
    id: "toys",
    text: {
      en: { t: "Stuffed toys", h: "Eyes and noses can hide lenses. Scan them and squeeze gently for hard parts." },
      ur: { t: "Naram khilone", h: "Aankhon aur naak mein lens chhup sakta hai. Scan karein aur sakht hisse ke liye halka dabayein." },
    },
    rooms: { bedroom: 15, living: 16, other: 15 },
  },
  {
    id: "fresheners",
    text: {
      en: { t: "Air fresheners", h: "Plug-in and wall-mounted fresheners are common disguises. Check the front for a dot." },
      ur: { t: "Air freshener", h: "Plug-in aur deewar wale freshener aam bhes hain. Saamne nuqta dekhein." },
    },
    rooms: { bedroom: 17, bathroom: 5, living: 17, kitchen: 11, other: 16 },
  },
  {
    id: "hooks",
    text: {
      en: { t: "Coat hooks & towel hooks", h: "Thick or oddly shaped hooks can hide a camera. Look at the face of the hook." },
      ur: { t: "Coat aur tauliye ke hook", h: "Mote ya ajeeb shakal ke hook mein camera chhup sakta hai. Hook ka saamna dekhein." },
    },
    rooms: { bedroom: 18, bathroom: 10, living: 18, other: 17 },
  },
  {
    id: "outlets",
    text: {
      en: { t: "Wall outlets & switch plates", h: "Look for a tiny hole that isn't part of the socket. Plates that look newer than others are suspicious." },
      ur: { t: "Socket aur switch plates", h: "Aisa chhota surakh dekhein jo socket ka hissa na ho. Baaqi se nayi lagne wali plates mashkook hain." },
    },
    rooms: { bedroom: 19, bathroom: 11, living: 19, kitchen: 3, other: 18 },
  },
  {
    id: "holes",
    text: {
      en: { t: "Screws or holes in odd places", h: "A single screw or hole in a smooth wall or ceiling, especially facing a bed or shower." },
      ur: { t: "Ajeeb jagah pech ya surakh", h: "Hamwaar deewar ya chhat mein akela pech ya surakh, khaas taur par bed ya shower ki taraf." },
    },
    rooms: { bedroom: 20, bathroom: 13, living: 20, kitchen: 12, other: 19 },
  },
  {
    id: "kitchen-appliances",
    text: {
      en: { t: "Kitchen appliances", h: "Microwave, coffee machine and fridge front panels — look for a lens-like dot." },
      ur: { t: "Kitchen appliances", h: "Microwave, coffee machine aur fridge ke front panel — lens jaisa nuqta dekhein." },
    },
    rooms: { kitchen: 1, other: 20 },
  },
];

export function itemsForRoom(kind: RoomKind): ChecklistItem[] {
  return CHECKLIST.filter((i) => i.rooms[kind] !== undefined).sort(
    (a, b) => (a.rooms[kind] ?? 99) - (b.rooms[kind] ?? 99),
  );
}

/** Short hotspot list shown as chips on the scan screen. */
export function hotspotsForRoom(kind: RoomKind, max = 8): ChecklistItem[] {
  return itemsForRoom(kind).slice(0, max);
}
