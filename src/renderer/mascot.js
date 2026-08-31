import { characterDefinition } from "../characters.js";
import { validateGeneratedSvg } from "../character-import.js";
import { mountCharacter } from "./character.js";
import { deriveImportedEyeRig } from "./imported-eye-rig.js";

// Stable facade: swapping artwork never reloads the game/chat or native window.
export async function createMascot(host, { eyelids = true } = {}) {
  let current, serial = 0, destroyed = false, active = true, motion = {}, reaction;
  async function reload() {
    const version = ++serial;
    const entry = await window.bluepet.loadCharacter();
    if (destroyed || version !== serial) return;
    if (!entry.builtin) validateGeneratedSvg(entry.svg);
    const eyeRig = entry.builtin ? null : await deriveImportedEyeRig(entry.svg, entry.analysis?.parts);
    if (destroyed || version !== serial) return;
    const definition = characterDefinition(entry.id, entry.profile, entry.analysis, eyeRig);
    const parsed = new DOMParser().parseFromString(entry.svg, "image/svg+xml");
    if (parsed.querySelector("parsererror")) throw new Error("Invalid character SVG");
    const svg = document.importNode(parsed.documentElement, true);
    current = mountCharacter(host, svg, definition, { eyelids });
    current.setActive(active); current.motion(motion); current.react(reaction);
    delete host.dataset.characterError;
    host.dispatchEvent(new Event("character-mounted", { bubbles: true }));
  }
  const unsubscribe = window.bluepet.onCharacterChanged(() => {
    reload().catch(() => { host.dataset.characterError = "true"; });
  });
  try { await reload(); while (!current) await reload(); } catch (error) { unsubscribe(); throw error; }
  return {
    get svg() { return current.svg; },
    get definition() { return current.definition; },
    setActive(value) { active = Boolean(value); current.setActive(active); },
    motion(value = {}) { motion = value; current.motion(value); },
    react(value) { reaction = value; current.react(value); },
    reset() { motion = {}; reaction = undefined; current.reset(); },
    destroy() { destroyed = true; ++serial; unsubscribe(); current?.destroy(); },
  };
}
