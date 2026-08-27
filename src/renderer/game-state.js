export const GAME_PET_SIZE = 64;
export const GAME_HUD_HEIGHT = 96;
export const speedForLevel = level => 280 * 1.1 ** (Math.max(1, Math.floor(level)) - 1);
const topOfPlay = GAME_HUD_HEIGHT + GAME_PET_SIZE / 2 + 12;

export function makePellets(level, width, height, random = Math.random) {
  return Array.from({ length: Math.min(16 + level * 4, 42) }, (_, index) => ({
    x: 36 + random() * (width - 72), y: topOfPlay + random() * Math.max(0,height - GAME_PET_SIZE/2 - 12 - topOfPlay),
    radius: index % 9 === 0 ? 9 : 5, glow: random() * Math.PI * 2,
  }));
}
export function createGame(width, height, random = Math.random) {
  return {
    pet: { x: width / 2, y: Math.max(topOfPlay,height / 2), size: GAME_PET_SIZE, vx: 0, vy: 0, speed: speedForLevel(1) },
    pellets: makePellets(1, width, height, random), score: 0, level: 1, pulse: 0,
  };
}
function hitsPellet(start, end, pellet, radius) {
  const dx = end.x - start.x, dy = end.y - start.y;
  const lengthSquared = dx * dx + dy * dy;
  const t = lengthSquared ? Math.max(0, Math.min(1, ((pellet.x-start.x)*dx+(pellet.y-start.y)*dy)/lengthSquared)) : 0;
  return Math.hypot(pellet.x-start.x-t*dx,pellet.y-start.y-t*dy) < radius + pellet.radius;
}
export function updateGame(game, dt, width, height, random = Math.random) {
  const { pet } = game, start = { x: pet.x, y: pet.y }, half = pet.size / 2;
  pet.x += pet.vx * dt; pet.y += pet.vy * dt;
  // Swept collision avoids skipping beans as later rounds get faster.
  game.pellets = game.pellets.filter(pellet => {
    if (!hitsPellet(start, pet, pellet, half)) return true;
    game.score += pellet.radius > 5 ? 5 : 1; game.pulse = 1;
    return false;
  });
  if (pet.x < -half) pet.x = width + half;
  if (pet.x > width + half) pet.x = -half;
  if (pet.y < topOfPlay) { pet.y = topOfPlay; pet.vy = Math.abs(pet.vy); }
  if (pet.y > height-half-12) { pet.y = height-half-12; pet.vy = -Math.abs(pet.vy); }
  const cleared = game.pellets.length === 0;
  if (cleared) {
    game.level++;
    const ratio = speedForLevel(game.level) / pet.speed;
    pet.speed = speedForLevel(game.level); pet.vx *= ratio; pet.vy *= ratio;
    game.pellets = makePellets(game.level, width, height, random);
  }
  game.pulse = Math.max(0, game.pulse - dt * 5);
  return cleared;
}
