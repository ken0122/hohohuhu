import { clamp } from "../core.js";

export const GAME_PET_SIZE = 64;
export const GAME_HUD_HEIGHT = 96;
export const speedForLevel = (level) => 280 * 1.3 ** (Math.max(1, Math.floor(level)) - 1);
const topOfPlay = GAME_HUD_HEIGHT + GAME_PET_SIZE / 2 + 12;
const bottomOfPlay = (height) => Math.max(topOfPlay, height - GAME_PET_SIZE / 2 - 12);

export function makePellets(level, width, height, random = Math.random) {
  return Array.from({ length: Math.min(16 + level * 4, 42) }, (_, index) => ({
    x: 36 + random() * Math.max(0, width - 72),
    y: topOfPlay + random() * (bottomOfPlay(height) - topOfPlay),
    radius: index % 9 === 0 ? 9 : 5,
    glow: random() * Math.PI * 2,
  }));
}

export function createGame(width, height, random = Math.random) {
  return {
    viewport: { width, height },
    pet: {
      x: width / 2,
      y: Math.max(topOfPlay, height / 2),
      size: GAME_PET_SIZE,
      vx: 0,
      vy: 0,
      speed: speedForLevel(1),
    },
    pellets: makePellets(1, width, height, random),
    score: 0,
    level: 1,
    pulse: 0,
  };
}

// Reflow the remaining beans, not a new round. Resizing must neither score a
// swept collision across the screen nor reset direction, level or speed.
export function resizeGame(game, width, height) {
  const previous = game.viewport;
  if (previous.width === width && previous.height === height) return;
  const remap = (value, min, oldMax, newMax) => {
    const fraction = oldMax > min ? clamp((value - min) / (oldMax - min), 0, 1) : 0.5;
    return min + fraction * (newMax - min);
  };
  for (const pellet of game.pellets) {
    pellet.x = remap(pellet.x, 36, Math.max(36, previous.width - 36), Math.max(36, width - 36));
    pellet.y = remap(pellet.y, topOfPlay, bottomOfPlay(previous.height), bottomOfPlay(height));
  }
  const half = game.pet.size / 2;
  game.pet.x = remap(game.pet.x, -half, previous.width + half, width + half);
  game.pet.y = remap(game.pet.y, topOfPlay, bottomOfPlay(previous.height), bottomOfPlay(height));
  game.viewport = { width, height };
}

function hitsPellet(start, end, pellet, radius) {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const lengthSquared = dx * dx + dy * dy;
  const t = lengthSquared
    ? clamp(((pellet.x - start.x) * dx + (pellet.y - start.y) * dy) / lengthSquared, 0, 1)
    : 0;
  return (
    Math.hypot(pellet.x - start.x - t * dx, pellet.y - start.y - t * dy) < radius + pellet.radius
  );
}

// Arrow-key movement is axis-aligned. Keep the boundary remainder and return
// only real traversed segments: teleporting across a wrap never eats beans.
// Complete traversals need one collision segment plus parity/modulo, avoiding
// an unbounded loop when later rounds cross the whole viewport in one frame.
function advanceAxis(position, velocity, dt, min, max, wrap) {
  position = clamp(position, min, max);
  const span = max - min;
  let direction = Math.sign(velocity);
  let remaining = Math.abs(velocity) * dt;
  if (!remaining || !span)
    return { position, velocity: span ? velocity : 0, segments: [[position, position]] };
  const edge = direction > 0 ? max : min;
  const toEdge = Math.abs(edge - position);
  if (remaining < toEdge) {
    const end = position + direction * remaining;
    return { position: end, velocity, segments: [[position, end]] };
  }
  const segments = [[position, edge]];
  remaining -= toEdge;
  if (wrap) {
    position = direction > 0 ? min : max;
  } else {
    position = edge;
    direction *= -1;
  }
  const traversals = Math.floor(remaining / span);
  if (traversals) {
    segments.push([min, max]);
    remaining %= span;
    if (!wrap && traversals % 2) {
      position = direction > 0 ? max : min;
      direction *= -1;
    }
  }
  const end = position + direction * remaining;
  segments.push([position, end]);
  return { position: end, velocity: Math.abs(velocity) * direction, segments };
}

export function updateGame(game, dt, width, height, random = Math.random) {
  resizeGame(game, width, height);
  const { pet } = game;
  const half = pet.size / 2;
  const horizontal = pet.vx !== 0;
  const axis = horizontal ? "x" : "y";
  const speedAxis = horizontal ? "vx" : "vy";
  const motion = advanceAxis(
    pet[axis],
    pet[speedAxis],
    Math.max(0, dt),
    horizontal ? -half : topOfPlay,
    horizontal ? width + half : bottomOfPlay(height),
    horizontal,
  );
  const segments = motion.segments.map(([start, end]) => [
    { x: pet.x, y: pet.y, [axis]: start },
    { x: pet.x, y: pet.y, [axis]: end },
  ]);
  pet[axis] = motion.position;
  pet[speedAxis] = motion.velocity;
  game.pellets = game.pellets.filter((pellet) => {
    if (!segments.some(([start, end]) => hitsPellet(start, end, pellet, half))) return true;
    game.score += pellet.radius > 5 ? 5 : 1;
    game.pulse = 1;
    return false;
  });
  const cleared = game.pellets.length === 0;
  if (cleared) {
    game.level++;
    const ratio = speedForLevel(game.level) / pet.speed;
    pet.speed = speedForLevel(game.level);
    pet.vx *= ratio;
    pet.vy *= ratio;
    game.pellets = makePellets(game.level, width, height, random);
  }
  game.pulse = Math.max(0, game.pulse - dt * 5);
  return cleared;
}
