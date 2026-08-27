import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const mascot = await readFile(path.join(root, "assets/blue-one-eye-mascot.svg"));
const plate = Buffer.from(`
  <svg width="1024" height="1024" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="plate" x1="0" y1="0" x2="1" y2="1">
        <stop stop-color="#F6F8FF"/>
        <stop offset="1" stop-color="#DCE5FF"/>
      </linearGradient>
    </defs>
    <rect x="36" y="36" width="952" height="952" rx="224" fill="url(#plate)"/>
  </svg>
`);

const resizedMascot = await sharp(mascot).resize(690, 690).png().toBuffer();
await sharp(plate)
  .composite([{ input: resizedMascot, left: 167, top: 162 }])
  .png()
  .toFile(path.join(root, "assets/icon.png"));

console.log("Generated assets/icon.png");
