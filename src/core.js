export const MODES = Object.freeze({
  DODGE: "dodge",
  PET: "pet",
  PACMAN: "pacman",
});

export function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

export function limitUnicode(text, maxLength = 50) {
  const normalized = String(text).trim();
  const segmenter = typeof Intl.Segmenter === "function"
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
  const natural = boundary >= Math.floor(maxLength * 0.55)
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

export function nextDodgeVelocity({ petCenter, cursor, velocity, dt, bounds, random = Math.random }) {
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
