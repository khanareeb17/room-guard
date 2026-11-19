/**
 * Generates PWA icons (shield + lens glyph) from SVG.
 * Run once: `node scripts/generate-icons.mjs` (uses `sharp`, which ships with Next.js).
 * The generated PNGs are committed, so this isn't part of the build.
 */
import { writeFileSync, mkdirSync } from "node:fs";
import sharp from "sharp";

const glyph = (scale = 1) => {
  const t = (512 - 512 * scale) / 2;
  return `<g transform="translate(${t} ${t}) scale(${scale})">
    <path d="M256 40 72 108v132c0 118 78 204 184 232 106-28 184-114 184-232V108L256 40Z" fill="#14b8a6"/>
    <path d="M256 82 108 136v104c0 96 62 166 148 190 86-24 148-94 148-190V136L256 82Z" fill="#0a1020"/>
    <circle cx="256" cy="246" r="92" fill="none" stroke="#2dd4bf" stroke-width="30"/>
    <circle cx="256" cy="246" r="40" fill="#2dd4bf"/>
    <circle cx="282" cy="220" r="15" fill="#ffffff"/>
  </g>`;
};

const svg = (bg, scale, rounded) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  ${bg ? `<rect width="512" height="512" ${rounded ? 'rx="112"' : ""} fill="#0a1020"/>` : ""}
  ${glyph(scale)}
</svg>`;

mkdirSync("public/icons", { recursive: true });
const anySvg = svg(true, 0.92, true);
const maskSvg = svg(true, 0.72, false); // safe zone: inner 80%
writeFileSync("src/app/icon.svg", svg(false, 1, false));

await sharp(Buffer.from(anySvg)).resize(192, 192).png().toFile("public/icons/icon-192.png");
await sharp(Buffer.from(anySvg)).resize(512, 512).png().toFile("public/icons/icon-512.png");
await sharp(Buffer.from(maskSvg)).resize(512, 512).png().toFile("public/icons/maskable-512.png");
await sharp(Buffer.from(svg(true, 0.8, false))).resize(180, 180).png().toFile("src/app/apple-icon.png");
console.log("icons written");
