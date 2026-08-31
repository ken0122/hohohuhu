import { createCharacterMotion } from "./character-motion.js";

const mounted = new WeakMap();

// Prepare first: a bad binding must not tear down a working character.
export function mountCharacter(host, svg, definition, options) {
  const character = createCharacter(svg, definition, options);
  mounted.get(host)?.destroy();
  host.replaceChildren(svg);
  mounted.set(host, character);
  const dispose = character.destroy;
  character.destroy = () => {
    dispose();
    if (mounted.get(host) === character) mounted.delete(host);
  };
  return character;
}

// Bind a trusted, detached SVG. This is deliberately not a sanitizer or a user
// upload API. Keep source artwork untouched; annotate only its runtime clone.
export function createCharacter(svg, definition, {
  eyelids = true,
  reduced = svg.ownerDocument.defaultView.matchMedia("(prefers-reduced-motion: reduce)"),
} = {}) {
  if (svg.namespaceURI !== "http://www.w3.org/2000/svg" || svg.localName !== "svg") {
    throw new Error("Character artwork must be SVG");
  }
  // Keep direction, gait and reactions on separate runtime layers. This lets
  // every trusted or imported character inherit mirroring without rewriting
  // its source artwork or fighting the transform used by its gait animation.
  const facing = svg.ownerDocument.createElementNS("http://www.w3.org/2000/svg", "g");
  const content = svg.ownerDocument.createElementNS("http://www.w3.org/2000/svg", "g");
  facing.classList.add("character-facing");
  content.classList.add("character-content");
  for (const child of Array.from(svg.childNodes)) content.append(child);
  facing.append(content);
  svg.append(facing);
  const appendOverlay = (parent, descriptor) => {
    const element = svg.ownerDocument.createElementNS("http://www.w3.org/2000/svg", descriptor.tag);
    for (const [name, value] of Object.entries(descriptor.attributes)) element.setAttribute(name, value);
    for (const child of descriptor.children || []) appendOverlay(element, child);
    parent.append(element);
  };
  for (const overlay of definition.overlays || []) appendOverlay(content, overlay);
  const parts = {};
  for (const [name, selector] of Object.entries(definition.parts)) {
    parts[name] = selector === null ? content : svg.querySelector(selector);
    if (!parts[name]) throw new Error(`Missing character part: ${name}`);
  }
  if (!eyelids && parts.lid) { parts.lid.remove(); parts.lid = null; }
  svg.classList.add("mascot-svg");
  svg.setAttribute("aria-hidden", "true");
  svg.setAttribute("focusable", "false");
  svg.dataset.character = definition.id;
  for (const [name, element] of Object.entries(parts)) element?.classList.add("character-" + name);
  if (definition.gaze) {
    svg.style.setProperty("--pupil-offset-x", definition.gaze.offsetX + "px");
    svg.style.setProperty("--pupil-offset-y", definition.gaze.offsetY + "px");
  }
  const interactionParts = definition.interactionParts || [];
  const origin = (kinds, fallback) => {
    const matches = interactionParts.filter(part => kinds.includes(part.kind));
    if (!matches.length) return fallback;
    const selected = matches.sort((a, b) => b.confidence - a.confidence)[0].box;
    return [`${((selected[0] + selected[2] / 2) * 100).toFixed(1)}%`, `${((selected[1] + selected[3] / 2) * 100).toFixed(1)}%`];
  };
  const [headX, headY] = origin(["head", "eye", "ear"], ["50%", "30%"]);
  const [bodyX, bodyY] = origin(["body"], ["50%", "70%"]);
  svg.style.setProperty("--head-origin-x", headX); svg.style.setProperty("--head-origin-y", headY);
  svg.style.setProperty("--body-origin-x", bodyX); svg.style.setProperty("--body-origin-y", bodyY);
  if (definition.eyes) svg.style.setProperty("--eye-open", definition.eyes.open + "px");
  const character = createCharacterMotion(svg, parts, definition, reduced);
  character.definition = definition;
  return character;
}
