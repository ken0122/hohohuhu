import { createMascot } from "./mascot.js";
import { createGame, updateGame, GAME_HUD_HEIGHT } from "./game-state.js";
const canvas = document.querySelector("#game");
const context = canvas.getContext("2d");
const spriteHost = document.querySelector("#game-pet");
const sprite = await createMascot(spriteHost, { eyelids: false });
const scoreElement = document.querySelector("#score");
const levelMessage = document.querySelector("#level-message");
const exitButton = document.querySelector("#exit");
const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
export const game = createGame(window.innerWidth, window.innerHeight);
const pet = game.pet;
const roundElement = document.querySelector("#round");
const speedElement = document.querySelector("#speed");
document.documentElement.style.setProperty("--game-hud-height",`${GAME_HUD_HEIGHT}px`);
spriteHost.style.width = spriteHost.style.height = `${pet.size}px`;
let previousTime = performance.now();

function resize() {
  const ratio = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.round(window.innerWidth * ratio);
  canvas.height = Math.round(window.innerHeight * ratio);
  context.setTransform(ratio, 0, 0, ratio, 0, 0);
  if (!pet.x) {
    pet.x = window.innerWidth / 2;
    pet.y = window.innerHeight / 2;
  }
}

function showLevelMessage(text) {
  levelMessage.textContent = text;
  levelMessage.classList.remove("show");
  requestAnimationFrame(() => levelMessage.classList.add("show"));
}

function handleKey(event) {
  const directions = {
    ArrowLeft: [-1, 0],
    ArrowRight: [1, 0],
    ArrowUp: [0, -1],
    ArrowDown: [0, 1],
  };
  if (event.key === "Escape" || event.key === "Esc" || event.keyCode === 27) return window.bluepet.exitGame();
  const direction = directions[event.key];
  if (!direction) return;
  event.preventDefault();
  pet.vx = direction[0] * pet.speed;
  pet.vy = direction[1] * pet.speed;
}

function update(dt) {
  if (updateGame(game, dt, window.innerWidth, window.innerHeight)) {
    roundElement.textContent = game.level;
    speedElement.textContent = (pet.speed / 280).toFixed(2) + "×";
    showLevelMessage("下一盘 · 速度 ×1.3");
  }
  scoreElement.textContent = game.score;
}

function draw(time) {
  context.clearRect(0, 0, window.innerWidth, window.innerHeight);
  for (const pellet of game.pellets) {
    const breathing = reducedMotion ? 1 : 1 + Math.sin(time / 420 + pellet.glow) * .12;
    context.beginPath();
    context.arc(pellet.x, pellet.y, pellet.radius * breathing, 0, Math.PI * 2);
    context.fillStyle = pellet.radius > 5 ? "#ffda67" : "#fff0a6";
    context.shadowColor = "rgba(255, 218, 103, .58)";
    context.shadowBlur = pellet.radius > 5 ? 18 : 9;
    context.fill();
  }
  context.shadowBlur = 0;
  const scale = 1 + game.pulse * .12;
  spriteHost.style.transform = `translate(${pet.x - pet.size / 2}px, ${pet.y - pet.size / 2}px) scale(${scale})`;
  sprite.motion({ x: pet.vx, y: pet.vy, gait: pet.vx || pet.vy ? "run" : "idle" });
}

function frame(time) {
  const dt = Math.min(.05, (time - previousTime) / 1000);
  previousTime = time;
  if (!document.hidden) update(dt);
  draw(time);
  requestAnimationFrame(frame);
}

window.addEventListener("resize", resize);
document.addEventListener("visibilitychange", () => document.body.classList.toggle("is-paused", document.hidden));
window.addEventListener("keydown", handleKey);
exitButton.addEventListener("click", () => window.bluepet.exitGame());
resize();
showLevelMessage("慢慢来，沿着豆豆走。");
requestAnimationFrame(frame);
