import { readFile } from "node:fs/promises";
import sharp from "sharp";

const assets = new URL("../assets/", import.meta.url);
const source = await readFile(new URL("blue-one-eye-mascot.svg", assets), "utf8");
const body = source.match(/class="body" d="([^"]+)"/)[1];
// Transparent canvas, white silhouette, transparent eye with a white pupil.
const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="6 3 52 58">
<defs><mask id="eye"><rect width="64" height="64" fill="white"/><circle cx="31" cy="29.5" r="9.5" fill="black"/></mask></defs>
<path d="${body}" fill="white" mask="url(#eye)"/><circle cx="33" cy="29.5" r="4.5" fill="white"/>
</svg>`;
for (const scale of [1, 2]) {
  await sharp(Buffer.from(svg)).resize(18 * scale, 18 * scale, { fit: "contain", background: "#00000000" })
    .png().toFile(new URL(scale === 1 ? "tray.png" : "tray@2x.png", assets).pathname);
}
console.log("Generated transparent white tray icons (1x / 2x).");
