import { BASIC_PROFILE } from "../character-profile.js";

// Backwards-compatible export for small consumers. Runtime selection belongs to
// createInteractionPolicy so every character can resolve the same intent in its
// own voice and motion.
export const REACTIONS = BASIC_PROFILE.reactions;

export function createInteractionPolicy(getDefinition, { now = () => performance.now() } = {}) {
  const histories = new Map();
  function current() {
    const definition = getDefinition();
    const profile = definition?.profile || BASIC_PROFILE;
    let history = histories.get(definition?.id);
    if (!history) {
      history = { lines: new Map(), triggers: [], idle: 0, lastIntent: undefined, lastAt: -Infinity };
      histories.set(definition?.id, history);
    }
    return { profile, history };
  }
  function outcome(recipe, key, history, extra = {}) {
    const count = history.lines.get(key) || 0;
    history.lines.set(key, count + 1);
    return {
      kind: recipe.motion,
      duration: recipe.duration,
      message: recipe.messages[count % recipe.messages.length],
      ...extra,
    };
  }
  return {
    reaction(intent) {
      const { profile, history } = current(), time = now(), egg = profile.easterEgg;
      if (intent === egg.trigger.intent) {
        history.triggers = history.triggers.filter(value => time - value <= egg.trigger.windowMs);
        history.triggers.push(time);
        if (history.triggers.length >= egg.trigger.count) {
          history.triggers = [];
          history.lastIntent = "egg:" + egg.id;
          history.lastAt = time;
          return outcome(egg.reaction, history.lastIntent, history, { easterEgg: egg.id });
        }
      }
      if (history.lastIntent === intent && time - history.lastAt < 1800) return undefined;
      const selected = profile.reactions[intent];
      if (!selected) return undefined;
      history.lastIntent = intent;
      history.lastAt = time;
      return outcome(selected, "reaction:" + intent, history);
    },
    proximity(stage) {
      const { profile, history } = current();
      const selected = profile.proximity[stage];
      return selected && outcome(selected, "proximity:" + stage, history);
    },
    idle() {
      const { profile, history } = current();
      const index = history.idle++ % profile.idle.length;
      return outcome(profile.idle[index], "idle:" + index, history);
    },
  };
}

function recognizedZone(x, y, parts) {
  const inside = part => x >= part.box[0] && y >= part.box[1] && x <= part.box[0] + part.box[2] && y <= part.box[1] + part.box[3];
  const matches = parts.filter(inside).sort((a, b) => a.box[2] * a.box[3] - b.box[2] * b.box[3]);
  if (matches.some(part => ["head", "eye", "ear"].includes(part.kind))) return "head";
  if (matches.some(part => part.kind === "tail")) return "cheek";
  const body = matches.find(part => part.kind === "body");
  if (!body) return undefined;
  const localX = (x - body.box[0]) / body.box[2], localY = (y - body.box[1]) / body.box[3];
  if (localY >= .58) return "belly";
  if (localX < .28 || localX > .72) return "cheek";
  return "face";
}
export function petZone(x, y, parts = []) {
  const recognized = recognizedZone(x, y, parts);
  if (recognized) return recognized;
  if (y < .4) return "head";
  if (y >= .6) return "belly";
  if (x < .35 || x > .65) return "cheek";
  return "face";
}
export function clickReaction(x, y, parts) {
  return { head: "shy", belly: "poke", cheek: "nuzzle", face: "hop" }[petZone(x, y, parts)];
}

// Normalized coordinates keep gestures consistent as the pet's size changes.
export function createStrokeGesture({ getParts = () => [] } = {}) {
  let previous, distance = 0, reversals = 0, direction = 0;
  const reset = () => { previous = undefined; distance = 0; reversals = 0; direction = 0; };
  return {
    reset,
    move(x, y, time) {
      const zone = petZone(x, y, getParts());
      if (!previous || time - previous.time > 650 || previous.zone !== zone) {
        reset(); previous = { x, y, time, zone }; return;
      }
      const dx = x - previous.x;
      distance += Math.hypot(dx, y - previous.y);
      if (Math.abs(dx) > .035) {
        const nextDirection = Math.sign(dx);
        if (direction && nextDirection !== direction) reversals++;
        direction = nextDirection;
      }
      previous = { x, y, time, zone };
      const kind = zone === "head" && distance > .55 ? "headpat"
        : zone === "belly" && distance > .65 && reversals >= 2 ? "tickle" : undefined;
      if (kind) reset();
      return kind;
    },
  };
}
