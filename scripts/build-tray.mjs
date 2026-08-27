import { readFile } from "node:fs/promises";
import sharp from "sharp";

const assets = new URL("../assets/", import.meta.url);
const source = await readFile(new URL("blue-one-eye-mascot.svg", assets), "utf8");
const body = source.match(/class="body" d="([^"]+)"/)[1];
// Derive the original horns and hem as a fine template outline, with a single eye.
// Black is an alpha mask for the system tint, not a fixed visible color.
const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="4 1 56 62">
<path d="${body}" fill="none" stroke="black" stroke-width="3.5" stroke-linejoin="round"/>
<ellipse cx="31" cy="30" rx="9.5" ry="8.5" fill="none" stroke="black" stroke-width="3"/>
<circle cx="33" cy="30" r="3.6" fill="black"/>
</svg>`;
for (const scale of [1, 2]) {
  await sharp(Buffer.from(svg)).resize(18 * scale, 18 * scale, { fit: "contain", background: "#00000000" })
    .png().toFile(new URL(scale === 1 ? "tray.png" : "tray@2x.png", assets).pathname);
}
console.log("Generated system-tinted outline tray icons (1x / 2x).");
