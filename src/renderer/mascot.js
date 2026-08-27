import { gaitFrames } from "./shape-motion.js";
import { createEyeMotion } from "./eye-motion.js";

export async function createMascot(host, { eyelids = true } = {}) {
  // Render the supplied SVG itself, not a redraw. The asset stays byte-for-byte
  // unchanged; only its existing body path gets a temporary CSS d animation.
  const source = await window.bluepet.loadMascot();
  const parsed = new DOMParser().parseFromString(source, "image/svg+xml");
  if (parsed.querySelector("parsererror")) throw new Error("Invalid mascot SVG");
  const svg = document.importNode(parsed.documentElement, true);
  svg.classList.add("mascot-svg");
  svg.dataset.gait = "idle";
  // Game-only runtime variant; never edit the supplied SVG asset.
  if (!eyelids) svg.querySelector(".lid")?.remove();
  host.replaceChildren(svg);
  const body = svg.querySelector("path.body");
  const originalPath = body.getAttribute("d");
  const frames = { walk: gaitFrames(originalPath, "walk"), run: gaitFrames(originalPath, "run") };
  const reduced = matchMedia("(prefers-reduced-motion: reduce)");
  const eyes = createEyeMotion(svg.querySelector(".lid"), reduced);
  let animation, gait = "idle";
  function animateShape() {
    animation?.cancel();
    animation = undefined;
    if (gait !== "idle" && !reduced.matches) {
      animation = body.animate(frames[gait], { duration: gait === "run" ? 220 : 680, iterations: Infinity, easing: "linear" });
      if (document.hidden) animation.pause();
    }
  }
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) animation?.pause(); else animation?.play();
  });
  reduced.addEventListener("change", animateShape);
  return {
    svg,
    setActive: eyes.setActive,
    react: eyes.react,
    motion({ x = 0, y = 0, gait: nextGait = "idle", gaze }) {
      svg.dataset.cursorGaze = String(Boolean(gaze));
      const look = gaze ?? { x, y };
      const magnitude = Math.hypot(look.x, look.y);
      if (gaze || magnitude) {
        svg.dataset.looking = "true";
        svg.style.setProperty("--gaze-x", (magnitude ? look.x / magnitude * 4 : 0).toFixed(2) + "px");
        svg.style.setProperty("--gaze-y", (magnitude ? look.y / magnitude * 4 : 0).toFixed(2) + "px");
      }
      if (!["walk", "run"].includes(nextGait)) nextGait = "idle";
      if (nextGait !== gait) { gait = nextGait; svg.dataset.gait = gait; animateShape(); }
    },
    reset() {
      gait = "idle"; svg.dataset.gait = gait; delete svg.dataset.looking;
      delete svg.dataset.cursorGaze;
      animateShape();
    },
  };
}
