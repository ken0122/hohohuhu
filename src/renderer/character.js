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
  const appendOverlay = (parent, descriptor) => {
    const element = svg.ownerDocument.createElementNS("http://www.w3.org/2000/svg", descriptor.tag);
    for (const [name, value] of Object.entries(descriptor.attributes)) element.setAttribute(name, value);
    for (const child of descriptor.children || []) appendOverlay(element, child);
    parent.append(element);
  };
  for (const overlay of definition.overlays || []) appendOverlay(svg, overlay);
  const parts = {};
  for (const [name, selector] of Object.entries(definition.parts)) {
    parts[name] = selector === null ? svg : svg.querySelector(selector);
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
  if (definition.eyes) svg.style.setProperty("--eye-open", definition.eyes.open + "px");
  const character = createCharacterMotion(svg, parts, definition, reduced);
  character.definition = definition;
  return character;
}
