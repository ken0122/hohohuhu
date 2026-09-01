import { createEyeMotion } from "./eye-motion.js";
import { automaticGaitProfile, bipedSupport, bodyBoxGaitProfile, cubicOutline, gaitFrames, outlineBounds } from "./shape-motion.js";

const SVG_NS = "http://www.w3.org/2000/svg";
let rasterGaitSerial = 0;

function transformFrames(gait) {
  const height = gait === "run" ? 2 : 1;
  return [
    { transform: "translateY(0) scale(1)", offset: 0 },
    { transform: `translateY(-${height}px) scale(.99,1.01)`, offset: .5 },
    { transform: "translateY(0) scale(1)", offset: 1 },
  ];
}

function hasObviousFeet(definition) {
  return (definition.interactionParts || []).some(part => part.kind === "leg" && part.confidence >= .65);
}

function strongestBody(definition) {
  return (definition.interactionParts || [])
    .filter(part => part.kind === "body")
    .sort((a, b) => b.confidence - a.confidence)[0];
}

function derivedOutlineGait(parts, definition) {
  if (hasObviousFeet(definition) || typeof parts.root?.querySelectorAll !== "function") return null;
  const candidates = [];
  for (const path of parts.root.querySelectorAll("path[d]")) {
    if (path.getAttribute("fill") === "none") continue;
    try {
      const d = path.getAttribute("d"), bounds = outlineBounds(cubicOutline(d));
      const width = bounds.maxX - bounds.minX, height = bounds.maxY - bounds.minY;
      if (width >= 8 && height >= 8) candidates.push({ path, d, area: width * height });
    } catch {
      // Decorative or unsupported paths do not prevent the safe transform gait.
    }
  }
  const selected = candidates.sort((a, b) => b.area - a.area)[0];
  const body = strongestBody(definition);
  return selected ? { target: selected.path, path: selected.d, profile: automaticGaitProfile(selected.d, body?.box) } : null;
}

function rasterDisplacementMap(profile) {
  const stripes = 32, width = 64 / stripes, gradients = [], rects = [];
  for (let index = 0; index < stripes; index++) {
    const x = index * width, progress = Math.max(0, Math.min(1, (x + width / 2 - profile.originX) / profile.width));
    const blue = Math.round(128 + bipedSupport(progress) * 127);
    const id = "g" + index;
    gradients.push(`<linearGradient id="${id}" x1="0" y1="${profile.startY}" x2="0" y2="${profile.startY + profile.depth}" gradientUnits="userSpaceOnUse"><stop stop-color="rgb(128,128,128)"/><stop offset="1" stop-color="rgb(128,128,${blue})"/></linearGradient>`);
    rects.push(`<rect x="${x}" y="${profile.startY}" width="${width}" height="${profile.depth}" fill="url(#${id})"/>`);
  }
  return `<svg xmlns="${SVG_NS}" viewBox="0 0 64 64"><defs>${gradients.join("")}</defs><rect width="64" height="64" fill="rgb(128,128,128)"/>${rects.join("")}</svg>`;
}

function derivedRasterGait(svg, parts, definition) {
  if (hasObviousFeet(definition) || typeof parts.root?.querySelector !== "function") return null;
  const target = parts.root.querySelector('image[href^="data:image/png;base64,"]');
  if (!target) return null;
  const doc = svg.ownerDocument, profile = bodyBoxGaitProfile(strongestBody(definition)?.box);
  const defs = doc.createElementNS(SVG_NS, "defs"), filter = doc.createElementNS(SVG_NS, "filter");
  const map = doc.createElementNS(SVG_NS, "feImage"), displacement = doc.createElementNS(SVG_NS, "feDisplacementMap");
  const id = `character-gait-filter-${++rasterGaitSerial}`;
  filter.setAttribute("id", id); filter.setAttribute("x", "-8"); filter.setAttribute("y", "-8");
  filter.setAttribute("width", "80"); filter.setAttribute("height", "80"); filter.setAttribute("filterUnits", "userSpaceOnUse");
  filter.setAttribute("primitiveUnits", "userSpaceOnUse"); filter.setAttribute("color-interpolation-filters", "sRGB");
  map.setAttribute("href", "data:image/svg+xml;charset=utf-8," + encodeURIComponent(rasterDisplacementMap(profile)));
  map.setAttribute("x", "0"); map.setAttribute("y", "0"); map.setAttribute("width", "64"); map.setAttribute("height", "64");
  map.setAttribute("preserveAspectRatio", "none"); map.setAttribute("result", "gait-map");
  displacement.setAttribute("in", "SourceGraphic"); displacement.setAttribute("in2", "gait-map"); displacement.setAttribute("scale", "0");
  displacement.setAttribute("xChannelSelector", "R"); displacement.setAttribute("yChannelSelector", "B");
  displacement.classList.add("character-gait-displacement"); filter.append(map, displacement); defs.append(filter); svg.append(defs);
  target.setAttribute("filter", `url(#${id})`); target.classList.add("character-gait-raster");
  return {
    target, displacement, profile,
    dispose() { target.removeAttribute("filter"); defs.remove(); },
  };
}

// Runtime receives already-bound nodes. It does not load files, know SVG
// selectors, change native window motion, or execute code from a character pack.
export function createCharacterMotion(svg, parts, definition, reduced) {
  const doc = svg.ownerDocument;
  const derived = definition.gait.kind === "auto" ? derivedOutlineGait(parts, definition) : null;
  const raster = definition.gait.kind === "auto" && !derived ? derivedRasterGait(svg, parts, definition) : null;
  const outlined = definition.gait.kind === "outline"
    ? { target: parts.body, path: parts.body.getAttribute("d"), profile: definition.gait }
    : derived;
  const target = outlined?.target || raster?.target || parts.root;
  const path = outlined?.path || null;
  if (outlined) target.classList.add("character-gait-outline");
  const frames = Object.fromEntries(["walk", "run"].map(gait => [gait,
    path === null ? transformFrames(gait) : gaitFrames(path, gait, outlined.profile),
  ]));
  const eyes = createEyeMotion(parts.lid, reduced, definition.eyes, doc);
  const view = doc.defaultView;
  let animation, waveFrame, gait = "idle", facing = 1, active = true, destroyed = false;

  function faceMotion(x, nextGait) {
    if (nextGait === "idle" || !Number.isFinite(x) || Math.abs(x) < .01) return;
    facing = x < 0 ? -1 : 1;
    svg.dataset.facing = facing < 0 ? "left" : "right";
    svg.style.setProperty("--facing", String(facing));
  }

  function stopWave() {
    if (waveFrame !== undefined && typeof view.cancelAnimationFrame === "function") view.cancelAnimationFrame(waveFrame);
    waveFrame = undefined;
    raster?.displacement.setAttribute("scale", "0");
  }
  function updateWave() {
    waveFrame = undefined;
    if (!raster || !animation || animation.playState !== "running" || destroyed || !active || reduced.matches || doc.hidden) return;
    const duration = definition.gait[gait + "Duration"], current = Number(animation.currentTime) || 0;
    const amplitude = raster.profile[gait + "Amplitude"];
    raster.displacement.setAttribute("scale", (amplitude * 2 * Math.sin(current / duration * Math.PI * 2)).toFixed(3));
    if (typeof view.requestAnimationFrame === "function") waveFrame = view.requestAnimationFrame(updateWave);
  }
  function startWave() {
    if (raster && waveFrame === undefined && typeof view.requestAnimationFrame === "function") waveFrame = view.requestAnimationFrame(updateWave);
  }
  function animateShape() {
    animation?.cancel();
    stopWave();
    animation = undefined;
    if (!destroyed && active && gait !== "idle" && !reduced.matches) {
      animation = target.animate(raster ? [{ opacity: 1 }, { opacity: 1 }] : frames[gait], {
        duration: definition.gait[gait + "Duration"], iterations: Infinity, easing: "linear",
      });
      if (doc.hidden) animation.pause();
      else startWave();
    }
  }
  function visibilityChanged() {
    if (doc.hidden) { animation?.pause(); stopWave(); }
    else if (active) { animation?.play(); startWave(); }
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
      raster?.dispose();
      doc.removeEventListener("visibilitychange", visibilityChanged);
      reduced.removeEventListener("change", animateShape);
    },
  };
}
