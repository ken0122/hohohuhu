import { createEyeMotion } from "./eye-motion.js";
import { gaitFrames } from "./shape-motion.js";

function transformFrames(gait) {
  const height = gait === "run" ? 2 : 1;
  return [
    { transform: "translateY(0) scale(1)", offset: 0 },
    { transform: `translateY(-${height}px) scale(.99,1.01)`, offset: .5 },
    { transform: "translateY(0) scale(1)", offset: 1 },
  ];
}

// Runtime receives already-bound nodes. It does not load files, know SVG
// selectors, change native window motion, or execute code from a character pack.
export function createCharacterMotion(svg, parts, definition, reduced) {
  const doc = svg.ownerDocument;
  const target = definition.gait.kind === "outline" ? parts.body : parts.root;
  const path = definition.gait.kind === "outline" ? target.getAttribute("d") : null;
  const frames = Object.fromEntries(["walk", "run"].map(gait => [gait,
    path === null ? transformFrames(gait) : gaitFrames(path, gait, definition.gait),
  ]));
  const eyes = createEyeMotion(parts.lid, reduced, definition.eyes, doc);
  let animation, gait = "idle", facing = 1, active = true, destroyed = false;

  function faceMotion(x, nextGait) {
    if (nextGait === "idle" || !Number.isFinite(x) || Math.abs(x) < .01) return;
    facing = x < 0 ? -1 : 1;
    svg.dataset.facing = facing < 0 ? "left" : "right";
    svg.style.setProperty("--facing", String(facing));
  }

  function animateShape() {
    animation?.cancel();
    animation = undefined;
    if (!destroyed && active && gait !== "idle" && !reduced.matches) {
      animation = target.animate(frames[gait], {
        duration: definition.gait[gait + "Duration"], iterations: Infinity, easing: "linear",
      });
      if (doc.hidden) animation.pause();
    }
  }
  function visibilityChanged() {
    if (doc.hidden) animation?.pause(); else if (active) animation?.play();
  }
  function clearPose() {
    gait = "idle";
    svg.dataset.gait = gait;
    delete svg.dataset.looking;
    delete svg.dataset.cursorGaze;
    delete svg.dataset.reaction;
    svg.style.removeProperty("--gaze-x");
    svg.style.removeProperty("--gaze-y");
    animateShape();
  }
  doc.addEventListener("visibilitychange", visibilityChanged);
  reduced.addEventListener("change", animateShape);
  svg.dataset.gait = gait;
  svg.dataset.facing = "right";
  svg.style.setProperty("--facing", "1");
  svg.dataset.active = "true";

  return {
    svg,
    setActive(value) {
      if (destroyed || active === Boolean(value)) return;
      active = Boolean(value);
      svg.dataset.active = String(active);
      eyes.setActive(active);
      animateShape();
    },
    react(kind) {
      if (destroyed) return;
      if (!kind) { delete svg.dataset.reaction; return; }
      if (!active) return;
      svg.dataset.reaction = kind;
      eyes.react(kind);
    },
    motion({ x = 0, y = 0, gait: nextGait = "idle", gaze } = {}) {
      if (destroyed) return;
      if (!["walk", "run"].includes(nextGait)) nextGait = "idle";
      faceMotion(x, nextGait);
      if (parts.pupil && definition.gaze) {
        if (gaze === null) {
          delete svg.dataset.looking;
          delete svg.dataset.cursorGaze;
          svg.style.removeProperty("--gaze-x");
          svg.style.removeProperty("--gaze-y");
        } else {
          svg.dataset.cursorGaze = String(Boolean(gaze));
          const look = gaze ?? { x, y };
          const magnitude = Math.hypot(look.x, look.y);
          if (Number.isFinite(magnitude) && (gaze || magnitude)) {
            svg.dataset.looking = "true";
            const radiusX = definition.gaze.radiusX || definition.gaze.radius;
            const radiusY = definition.gaze.radiusY || definition.gaze.radius;
            // Pupils live inside the mirrored artwork. Reverse their local X
            // offset so the final on-screen gaze still points at the cursor.
            svg.style.setProperty("--gaze-x", (magnitude ? look.x / magnitude * radiusX * facing : 0).toFixed(2) + "px");
            svg.style.setProperty("--gaze-y", (magnitude ? look.y / magnitude * radiusY : 0).toFixed(2) + "px");
          }
        }
      }
      if (nextGait !== gait) {
        gait = nextGait; svg.dataset.gait = gait; animateShape();
      }
    },
    reset() {
      if (destroyed) return;
      clearPose();
      eyes.reset();
    },
    destroy() {
      if (destroyed) return;
      destroyed = true;
      clearPose();
      svg.dataset.active = "false";
      eyes.destroy();
      doc.removeEventListener("visibilitychange", visibilityChanged);
      reduced.removeEventListener("change", animateShape);
    },
  };
}
