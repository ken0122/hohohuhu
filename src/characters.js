import { BASIC_PROFILE, BLACK_CAT_PROFILE, BLUE_ONE_EYE_PROFILE, SUNNY_YELLOW_PROFILE, validateCharacterProfile } from "./character-profile.js";
import { localizedBuiltinProfile, localizedCustomProfile } from "./localized-profiles.js";

// App-owned bindings, not an import format. Untrusted artwork/metadata must be
// validated by a future importer before it can reach the renderer.
export const BLUE_ONE_EYE = Object.freeze({
  id: "blue-one-eye",
  asset: "blue-one-eye-mascot.svg",
  parts: Object.freeze({ root: ".mascot", body: "path.body", pupil: ".pupil", lid: ".lid" }),
  gaze: Object.freeze({ x: 31 / 64, y: 29.5 / 64, radius: 4, offsetX: -4, offsetY: -.3 }),
  eyes: Object.freeze({ open: -20, blink: 10, reaction: 5, shy: -4 }),
  profile: BLUE_ONE_EYE_PROFILE,
  affection: Object.freeze({
    symbols: Object.freeze(["♥", "♥", "♥"]), color: "#6e89f1",
    shadow: "0 2px 7px rgba(37, 64, 155, .24)",
  }),
  gait: Object.freeze({
    kind: "outline", startY: 42, depth: 14, originX: 12, width: 40,
    walkAmplitude: .8, runAmplitude: 2.1, walkDuration: 680, runDuration: 220,
  }),
});

// Minimal binding for a trusted static SVG: no assumed eyes or selectors. The
// renderer may derive a lower-outline gait from a suitable path, but never
// persists that derivative or invents limbs.
export const BASIC_SVG = Object.freeze({
  id: "basic-svg",
  parts: Object.freeze({ root: null }),
  gaze: null,
  eyes: null,
  profile: BASIC_PROFILE,
  affection: Object.freeze({
    symbols: Object.freeze(["✦", "·", "✦"]), color: "#f4f1e8",
    shadow: "0 1px 3px rgba(17, 17, 17, .78), 0 2px 7px rgba(17, 17, 17, .28)",
  }),
  gait: Object.freeze({ kind: "auto", walkDuration: 680, runDuration: 220 }),
});

// Trusted runtime decoration for the built-in cat. The converted source remains
// reproducible and untouched; arbitrary imports never receive this eye rig.
export const BLACK_CAT = Object.freeze({
  ...BASIC_SVG,
  id: "black-cat",
  asset: "characters/black-cat/character.svg",
  parts: Object.freeze({ root: null, pupil: ".cat-pupils" }),
  gaze: Object.freeze({ x: 22 / 64, y: 29.5 / 64, radius: 1.15, offsetX: 0, offsetY: 0 }),
  profile: BLACK_CAT_PROFILE,
  interactionParts: Object.freeze([
    Object.freeze({ kind: "body", confidence: 1, box: Object.freeze([.06, .12, .55, .82]) }),
    Object.freeze({ kind: "tail", confidence: 1, box: Object.freeze([.58, .65, .36, .26]) }),
  ]),
  overlays: Object.freeze([Object.freeze({
    tag: "g", attributes: Object.freeze({ class: "cat-pupils", fill: "#111111", "aria-hidden": "true" }),
    children: Object.freeze([
      Object.freeze({ tag: "circle", attributes: Object.freeze({ cx: "11.9", cy: "29.55", r: ".82" }) }),
      Object.freeze({ tag: "circle", attributes: Object.freeze({ cx: "32", cy: "29.55", r: ".82" }) }),
    ]),
  })]),
  affection: Object.freeze({
    symbols: Object.freeze(["✦", "♥", "✦"]), color: "#f2bc52",
    shadow: "0 1px 3px rgba(17, 17, 17, .72), 0 2px 7px rgba(112, 72, 8, .34)",
  }),
});

// Project-authored mascot promoted from the color-import desktop fixture. Its
// pupils are app-owned so the shared gaze and facing controllers stay exact.
export const SUNNY_YELLOW = Object.freeze({
  ...BASIC_SVG,
  id: "sunny-yellow",
  asset: "characters/sunny-yellow/character.svg",
  parts: Object.freeze({ root: null, pupil: ".sunny-pupils" }),
  gaze: Object.freeze({ x: 32.9 / 64, y: 29.3 / 64, radius: 1.2, offsetX: 0, offsetY: 0 }),
  profile: SUNNY_YELLOW_PROFILE,
  overlays: Object.freeze([Object.freeze({
    tag: "g", attributes: Object.freeze({ class: "sunny-pupils", fill: "#ff8f70", "aria-hidden": "true" }),
    children: Object.freeze([
      Object.freeze({ tag: "circle", attributes: Object.freeze({ cx: "26.9", cy: "29.3", r: "1.3" }) }),
      Object.freeze({ tag: "circle", attributes: Object.freeze({ cx: "38.9", cy: "29.3", r: "1.3" }) }),
    ]),
  })]),
  interactionParts: Object.freeze([
    Object.freeze({ kind: "head", confidence: 1, box: Object.freeze([.22, .21, .56, .36]) }),
    Object.freeze({ kind: "body", confidence: 1, box: Object.freeze([.23, .24, .54, .68]) }),
    Object.freeze({ kind: "eye", confidence: 1, box: Object.freeze([.34, .38, .32, .16]) }),
    Object.freeze({ kind: "ear", confidence: 1, box: Object.freeze([.25, .08, .5, .22]) }),
    Object.freeze({ kind: "tail", confidence: 1, box: Object.freeze([.72, .38, .2, .32]) }),
  ]),
  affection: Object.freeze({
    symbols: Object.freeze(["✦", "☀", "✦"]), color: "#f4a340",
    shadow: "0 1px 3px rgba(112, 72, 8, .3), 0 2px 7px rgba(244, 163, 64, .3)",
  }),
});

function importedEyeRig(parts = [], detected) {
  const eyes = parts
    .filter(part => part.kind === "eye")
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, 4);
  const head = parts.find(part => part.kind === "head");
  let points = detected?.eyes?.length ? detected.eyes : eyes.flatMap(({ box: [x, y, width, height] }) => {
    const cy = y + height / 2;
    return width / height > 1.8
      ? [{ x: x + width * .3, y: cy, size: height }, { x: x + width * .7, y: cy, size: height }]
      : [{ x: x + width / 2, y: cy, size: Math.min(width, height) }];
  });
  if (!points.length) {
    const [x, y, width, height] = head?.box || [0, 0, 1, 1];
    points = [{ x: x + width / 2, y: y + height * .38, size: Math.min(width, height) * .18 }];
  }
  const anchor = points.reduce((sum, point) => ({ x: sum.x + point.x, y: sum.y + point.y }), { x: 0, y: 0 });
  anchor.x /= points.length; anchor.y /= points.length;
  const radiusX = Math.max(1.15, Math.min(...points.map(point => point.travelX ? point.travelX * 64 : 1.15)));
  const radiusY = Math.max(1.15, Math.min(...points.map(point => point.travelY ? point.travelY * 64 : 1.15)));
  return {
    overlays: Object.freeze([
      ...(points.some(point => point.mask) ? [Object.freeze({
        tag: "g", attributes: Object.freeze({ class: "imported-eye-masks", "aria-hidden": "true" }),
        children: Object.freeze(points.filter(point => point.mask).map(point => Object.freeze({
          tag: "ellipse", attributes: Object.freeze({
            cx: (point.x * 64).toFixed(2), cy: (point.y * 64).toFixed(2),
            rx: (point.mask.rx * 64).toFixed(2), ry: (point.mask.ry * 64).toFixed(2), fill: point.mask.fill,
          }),
        }))),
      })] : []),
      Object.freeze({
      tag: "g",
      attributes: Object.freeze({ class: "imported-pupils", fill: "#17234b", stroke: "#f7f3e8", "stroke-width": ".28", "aria-hidden": "true" }),
      children: Object.freeze(points.map(point => Object.freeze({
        tag: "circle",
        attributes: Object.freeze({
          cx: (point.x * 64).toFixed(2), cy: (point.y * 64).toFixed(2),
          r: point.radius
            ? Math.max(.55, Math.min(1.2, point.radius * 64)).toFixed(2)
            : Math.max(.55, Math.min(1.2, point.size * 64 * .13)).toFixed(2),
        }),
      }))),
    }),
    ]),
    gaze: Object.freeze({ x: anchor.x, y: anchor.y, radius: 1.15, radiusX, radiusY, offsetX: 0, offsetY: 0 }),
  };
}

export function characterDefinition(id, profile, analysis, detectedEyeRig, locale) {
  if (id === BLUE_ONE_EYE.id) return locale ? { ...BLUE_ONE_EYE, profile: localizedBuiltinProfile(id, BLUE_ONE_EYE.profile, locale) } : BLUE_ONE_EYE;
  if (id === BLACK_CAT.id) return locale ? { ...BLACK_CAT, profile: localizedBuiltinProfile(id, BLACK_CAT.profile, locale) } : BLACK_CAT;
  if (id === SUNNY_YELLOW.id) return locale ? { ...SUNNY_YELLOW, profile: localizedBuiltinProfile(id, SUNNY_YELLOW.profile, locale) } : SUNNY_YELLOW;
  const rig = importedEyeRig(analysis?.parts, detectedEyeRig);
  const customProfile = profile ? validateCharacterProfile(profile) : BASIC_PROFILE;
  return {
    ...BASIC_SVG,
    id,
    parts: Object.freeze({ root: null, pupil: ".imported-pupils" }),
    gaze: rig.gaze,
    overlays: rig.overlays,
    profile: locale ? localizedCustomProfile(customProfile, locale, analysis) : customProfile,
    interactionParts: analysis?.parts || Object.freeze([]),
  };
}
