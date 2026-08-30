// App-owned bindings, not an import format. Untrusted artwork/metadata must be
// validated by a future importer before it can reach the renderer.
export const BLUE_ONE_EYE = Object.freeze({
  id: "blue-one-eye",
  asset: "blue-one-eye-mascot.svg",
  parts: Object.freeze({ root: ".mascot", body: "path.body", pupil: ".pupil", lid: ".lid" }),
  gaze: Object.freeze({ x: 31 / 64, y: 29.5 / 64, radius: 4, offsetX: -4, offsetY: -.3 }),
  eyes: Object.freeze({ open: -20, blink: 10, reaction: 5, shy: -4 }),
  affection: Object.freeze({
    symbols: Object.freeze(["♥", "♥", "♥"]), color: "#6e89f1",
    shadow: "0 2px 7px rgba(37, 64, 155, .24)",
  }),
  gait: Object.freeze({
    kind: "outline", startY: 42, depth: 14, originX: 12, width: 40,
    walkAmplitude: .8, runAmplitude: 2.1, walkDuration: 680, runDuration: 220,
  }),
});

// Minimal binding for a trusted static SVG: no assumed eyes, limbs or body path.
// Generic motion transforms the whole image; it does not invent anatomy.
export const BASIC_SVG = Object.freeze({
  id: "basic-svg",
  parts: Object.freeze({ root: null }),
  gaze: null,
  eyes: null,
  affection: Object.freeze({
    symbols: Object.freeze(["✦", "·", "✦"]), color: "#f4f1e8",
    shadow: "0 1px 3px rgba(17, 17, 17, .78), 0 2px 7px rgba(17, 17, 17, .28)",
  }),
  gait: Object.freeze({ kind: "transform", walkDuration: 680, runDuration: 220 }),
});

// Trusted runtime decoration for the built-in cat. The converted source remains
// reproducible and untouched; arbitrary imports never receive this eye rig.
export const BLACK_CAT = Object.freeze({
  ...BASIC_SVG,
  id: "black-cat",
  asset: "characters/black-cat/character.svg",
  parts: Object.freeze({ root: null, pupil: ".cat-pupils" }),
  gaze: Object.freeze({ x: 22 / 64, y: 29.5 / 64, radius: 1.15, offsetX: 0, offsetY: 0 }),
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

export function characterDefinition(id) {
  if (id === BLUE_ONE_EYE.id) return BLUE_ONE_EYE;
  if (id === BLACK_CAT.id) return BLACK_CAT;
  return { ...BASIC_SVG, id };
}
