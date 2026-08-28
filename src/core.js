export const MODES = Object.freeze({
  DODGE: "dodge",
  PET: "pet",
  PACMAN: "pacman",
});
export const PET_FRAME_SIZE = 132;
export const PET_SPRITE_SIZE = 84;
export const CHAT_SIZE = Object.freeze({ width: 272, height: 242 });
export const CHAT_OFFSET = Object.freeze({
  x: (CHAT_SIZE.width - PET_FRAME_SIZE) / 2,
  y: CHAT_SIZE.height - PET_FRAME_SIZE,
});
export const SPEECH_RECT = Object.freeze({ x: 12, y: 10, width: 248, height: 140 });
export function chatMotionBounds(bounds) {
  return {
    x: bounds.x + CHAT_OFFSET.x,
    y: bounds.y + CHAT_OFFSET.y,
    width: bounds.width - CHAT_OFFSET.x * 2,
    height: bounds.height - CHAT_OFFSET.y,
  };
}
export function chatFrame(position, bounds) {
  return {
    x: clamp(position.x - CHAT_OFFSET.x, bounds.x, bounds.x + bounds.width - CHAT_SIZE.width),
    y: clamp(position.y - CHAT_OFFSET.y, bounds.y, bounds.y + bounds.height - CHAT_SIZE.height),
    ...CHAT_SIZE,
  };
}
export function cursorInSpeech(cursor, frame) {
  const x = cursor.x - frame.x,
    y = cursor.y - frame.y;
  return (
    x >= SPEECH_RECT.x &&
    x <= SPEECH_RECT.x + SPEECH_RECT.width &&
    y >= SPEECH_RECT.y &&
    y <= SPEECH_RECT.y + SPEECH_RECT.height
  );
}
export function normalizeMode(mode) {
  return mode === "control" ? MODES.PET : mode;
}
export function editingAction(input, platform) {
  const primaryModifier = platform === "darwin" ? input.meta : input.control;
  if (input.type !== "keyDown" || !primaryModifier || input.alt) return;
  return {
    a: "selectAll",
    c: "copy",
    v: "paste",
    x: "cut",
    z: input.shift ? "redo" : "undo",
  }[input.key.toLowerCase()];
}
export function nextMode(mode) {
  const order = [MODES.DODGE, MODES.PET, MODES.PACMAN];
  return order[(order.indexOf(normalizeMode(mode)) + 1) % order.length];
}

export function clamp(value, min, max) {
  return Math.min(Math.max(min, max), Math.max(min, value));
}

// Keep fractional coordinates in the simulation; round only native window bounds.
export function fitPet(position, bounds, size = PET_FRAME_SIZE) {
  return {
    x: clamp(position.x, bounds.x, bounds.x + bounds.width - size),
    y: clamp(position.y, bounds.y, bounds.y + bounds.height - size),
  };
}

export function validDragPoint(point) {
  return (
    point &&
    Number.isFinite(point.x) &&
    Number.isFinite(point.y) &&
    Math.abs(point.x) < 1000000 &&
    Math.abs(point.y) < 1000000
  );
}
export function dragPosition(origin, start, cursor, bounds) {
  return fitPet({ x: origin.x + cursor.x - start.x, y: origin.y + cursor.y - start.y }, bounds);
}

export function gazeDirection(x, y) {
  const length = Math.hypot(x, y);
  return length ? { x: x / length, y: y / length } : { x: 0, y: 0 };
}

export function controlVelocity(keys, speed = 300) {
  const x = Number(keys.has("ArrowRight")) - Number(keys.has("ArrowLeft"));
  const y = Number(keys.has("ArrowDown")) - Number(keys.has("ArrowUp"));
  const direction = gazeDirection(x, y);
  return { x: direction.x * speed, y: direction.y * speed };
}

export function petShouldShow({ mode, manualHidden }) {
  return !manualHidden && mode !== MODES.PACMAN;
}

export function limitUnicode(text, maxLength = 50) {
  const normalized = String(text).trim();
  const segmenter =
    typeof Intl.Segmenter === "function"
      ? new Intl.Segmenter(undefined, { granularity: "grapheme" })
      : null;
  const characters = segmenter
    ? Array.from(segmenter.segment(normalized), ({ segment }) => segment)
    : Array.from(normalized);
  if (characters.length <= maxLength) return normalized;

  const candidate = characters.slice(0, Math.max(1, maxLength - 1)).join("");
  const boundary = Math.max(
    candidate.lastIndexOf(" "),
    candidate.lastIndexOf("。"),
    candidate.lastIndexOf("！"),
    candidate.lastIndexOf("？"),
    candidate.lastIndexOf("!"),
    candidate.lastIndexOf("?"),
    candidate.lastIndexOf("，"),
    candidate.lastIndexOf(","),
    candidate.lastIndexOf("；"),
    candidate.lastIndexOf(";"),
  );
  const natural =
    boundary >= Math.floor(maxLength * 0.55)
      ? candidate.slice(0, boundary + (candidate[boundary] === " " ? 0 : 1))
      : candidate;
  return `${natural.trimEnd()}…`;
}

export function cleanClaudeReply(text) {
  return limitUnicode(
    String(text)
      .replace(/^```(?:text)?\s*/i, "")
      .replace(/```$/i, "")
      .trim()
      .replace(/^[“\"]|[”\"]$/g, "")
      .replace(/\s+/g, " "),
  );
}

export function nextDodgeVelocity({
  petCenter,
  cursor,
  velocity,
  dt,
  bounds,
  random = Math.random,
}) {
  const dx = petCenter.x - cursor.x;
  const dy = petCenter.y - cursor.y;
  const distance = Math.max(1, Math.hypot(dx, dy));
  let vx = velocity.x;
  let vy = velocity.y;

  if (distance < 170) {
    const urgency = (170 - distance) / 170;
    vx += (dx / distance) * 780 * urgency * dt;
    vy += (dy / distance) * 780 * urgency * dt;
  }

  const margin = 90;
  if (petCenter.x < bounds.x + margin) vx += 190 * dt;
  if (petCenter.x > bounds.x + bounds.width - margin) vx -= 190 * dt;
  if (petCenter.y < bounds.y + margin) vy += 190 * dt;
  if (petCenter.y > bounds.y + bounds.height - margin) vy -= 190 * dt;

  vx += (random() - 0.5) * 18 * dt;
  vy += (random() - 0.5) * 18 * dt;

  const speed = Math.hypot(vx, vy);
  const minSpeed = distance < 170 ? 115 : 28;
  const maxSpeed = distance < 170 ? 340 : 72;
  if (speed > maxSpeed) {
    vx = (vx / speed) * maxSpeed;
    vy = (vy / speed) * maxSpeed;
  } else if (speed < minSpeed) {
    const angle = speed > 0.1 ? Math.atan2(vy, vx) : random() * Math.PI * 2;
    vx = Math.cos(angle) * minSpeed;
    vy = Math.sin(angle) * minSpeed;
  }

  return { x: vx, y: vy };
}
