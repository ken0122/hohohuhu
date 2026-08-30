import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { BLUE_ONE_EYE, BLACK_CAT, BASIC_SVG } from "../src/characters.js";
import { createCharacter, mountCharacter } from "../src/renderer/character.js";

const source = readFileSync(new URL("../assets/blue-one-eye-mascot.svg", import.meta.url), "utf8");
const originalPath = source.match(/class="body" d="([^"]+)"/)[1];
class Signals extends EventTarget {
  listeners = new Set();
  addEventListener(type, listener) { this.listeners.add(listener); super.addEventListener(type, listener); }
  removeEventListener(type, listener) { this.listeners.delete(listener); super.removeEventListener(type, listener); }
}
function fixture({ basic = false, reducedMotion = false, definition } = {}) {
  const doc = new Signals(), reduced = new Signals();
  const classes = new Map();
  doc.hidden = false; reduced.matches = reducedMotion;
  doc.defaultView = { matchMedia: () => reduced };
  function element() {
    const properties = new Map();
    return {
      ownerDocument: doc, dataset: {}, classList: new Set(), animations: [], children: [], attributes: new Map(),
      style: {
        setProperty: (key, value) => properties.set(key, value),
        removeProperty: key => properties.delete(key),
        getPropertyValue: key => properties.get(key),
      },
      animate(frames, options) {
        const animation = {
          frames, options, playState: "running",
          cancel() { this.playState = "idle"; },
          pause() { this.playState = "paused"; },
          play() { this.playState = "running"; },
        };
        this.animations.push(animation);
        return animation;
      },
      setAttribute(name, value) { this.attributes.set(name, value); if (name === "class") classes.set(value, this); },
      append(child) { this.children.push(child); },
      remove() { this.removed = true; },
    };
  }
  doc.createElementNS = () => element();
  const selectedDefinition = definition || (basic ? BASIC_SVG : BLUE_ONE_EYE);
  const generic = selectedDefinition === BASIC_SVG || selectedDefinition === BLACK_CAT;
  const svg = element(), root = generic ? svg : element(), body = element(), pupil = element(), lid = element();
  svg.namespaceURI = "http://www.w3.org/2000/svg"; svg.localName = "svg";
  svg.querySelector = selector => classes.get(selector.slice(1)) || (generic ? null : ({ ".mascot": root, "path.body": body, ".pupil": pupil, ".lid": lid })[selector]);
  body.getAttribute = () => originalPath;
  return { svg, root, body, pupil, lid, doc, reduced, definition: selectedDefinition, classes };
}

test("original binding keeps path gait, gaze and a lidless game variant", t => {
  const f = fixture();
  const character = createCharacter(f.svg, f.definition, { eyelids: false });
  t.after(() => character.destroy());
  assert.equal(f.lid.removed, true);
  character.motion({ gait: "run", gaze: { x: 3, y: 4 } });
  assert.equal(f.body.animations[0].options.duration, 220);
  assert.ok(f.body.animations[0].frames.every(frame => frame.d));
  assert.equal(f.svg.style.getPropertyValue("--gaze-x"), "2.40px");
  assert.equal(f.svg.style.getPropertyValue("--gaze-y"), "3.20px");
  character.reset();
  assert.equal(f.body.animations[0].playState, "idle");
  assert.equal(f.body.getAttribute("d"), originalPath);
  assert.equal(f.svg.dataset.looking, undefined);
});

test("basic SVG needs no anatomy and pauses, resumes and resets generic gait", t => {
  const f = fixture({ basic: true });
  const character = createCharacter(f.svg, f.definition);
  t.after(() => character.destroy());
  character.motion({ gait: "walk", gaze: { x: 1, y: 2 } });
  const first = f.root.animations[0];
  assert.ok(first.frames.every(frame => frame.transform && !frame.d));
  assert.equal(f.svg.dataset.looking, undefined);
  character.motion({ gait: "walk" });
  assert.equal(f.root.animations.length, 1, "same gait does not restart every frame");
  f.doc.hidden = true; f.doc.dispatchEvent(new Event("visibilitychange"));
  assert.equal(first.playState, "paused");
  f.doc.hidden = false; f.doc.dispatchEvent(new Event("visibilitychange"));
  assert.equal(first.playState, "running");
  character.setActive(false);
  assert.equal(first.playState, "idle");
  character.react("hop");
  assert.equal(f.svg.dataset.reaction, undefined);
  character.setActive(true);
  assert.equal(f.root.animations.at(-1).playState, "running");
  character.motion({ gait: "unknown" });
  assert.equal(f.svg.dataset.gait, "idle");
  assert.equal(f.root.animations.at(-1).playState, "idle");
});

test("black cat adds two runtime-only pupils with bounded shared gaze", t => {
  const f = fixture({ definition: BLACK_CAT });
  const character = createCharacter(f.svg, f.definition);
  t.after(() => character.destroy());
  const pupils = f.classes.get("cat-pupils");
  assert.equal(pupils.children.length, 2);
  assert.deepEqual(pupils.children.map(child => child.attributes.get("r")), [".82", ".82"]);
  character.motion({ gaze: { x: 30, y: 40 } });
  assert.equal(f.svg.style.getPropertyValue("--gaze-x"), "0.69px");
  assert.equal(f.svg.style.getPropertyValue("--gaze-y"), "0.92px");
  character.motion({ gaze: null });
  assert.equal(f.svg.dataset.looking, undefined);
  assert.equal(f.svg.style.getPropertyValue("--gaze-x"), undefined);
  assert.equal(source.includes("cat-pupils"), false, "source artwork stays unchanged");
});

test("startup and live reduced motion gate both gait and eye controllers", t => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const f = fixture({ reducedMotion: true });
  const character = createCharacter(f.svg, f.definition);
  t.after(() => character.destroy());
  character.motion({ gait: "walk" }); character.react("headpat");
  t.mock.timers.tick(8000);
  assert.equal(f.lid.animations.length, 0);
  assert.equal(f.body.animations.length, 0);
  f.reduced.matches = false; f.reduced.dispatchEvent(new Event("change"));
  character.react("headpat");
  const eye = f.lid.animations.at(-1), body = f.body.animations.at(-1);
  assert.equal(eye.playState, "running"); assert.equal(body.playState, "running");
  f.reduced.matches = true; f.reduced.dispatchEvent(new Event("change"));
  assert.equal(eye.playState, "idle"); assert.equal(body.playState, "idle");
  t.mock.timers.tick(8000);
  assert.equal(f.lid.animations.length, 1);
});

test("destroy removes timers and subscriptions; stale callbacks cannot revive a character", t => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const f = fixture();
  const character = createCharacter(f.svg, f.definition);
  character.motion({ gait: "run" }); character.react("shy");
  const eye = f.lid.animations[0], body = f.body.animations[0];
  character.destroy(); character.destroy();
  eye.onfinish();
  f.doc.dispatchEvent(new Event("visibilitychange"));
  f.reduced.dispatchEvent(new Event("change"));
  character.setActive(true); character.motion({ gait: "walk" }); character.react("headpat");
  t.mock.timers.tick(20000);
  assert.equal(eye.playState, "idle"); assert.equal(body.playState, "idle");
  assert.equal(f.lid.animations.length, 1); assert.equal(f.body.animations.length, 1);
  assert.equal(f.doc.listeners.size, 0); assert.equal(f.reduced.listeners.size, 0);
  assert.equal(f.svg.dataset.reaction, undefined);
});

test("mount validates before replacing and disposes the previous character", t => {
  const first = fixture({ basic: true }), second = fixture({ basic: true });
  const host = { replaceChildren(svg) { this.child = svg; } };
  const old = mountCharacter(host, first.svg, first.definition);
  t.after(() => old.destroy());
  old.motion({ gait: "walk" });
  assert.throws(() => mountCharacter(host, second.svg, BLUE_ONE_EYE), /Missing character part/);
  assert.equal(host.child, first.svg);
  assert.equal(first.root.animations[0].playState, "running");
  const next = mountCharacter(host, second.svg, second.definition);
  t.after(() => next.destroy());
  assert.equal(host.child, second.svg);
  assert.equal(first.root.animations[0].playState, "idle");
  assert.equal(first.doc.listeners.size, 0);
  old.destroy(); next.react("poke");
  assert.equal(second.svg.dataset.reaction, "poke");
});
