import { createMascot } from "./mascot.js";
const canvas = document.querySelector("#game");
const context = canvas.getContext("2d");
const spriteHost = document.querySelector("#game-pet");
const sprite = await createMascot(spriteHost, { eyelids: false });
const scoreElement = document.querySelector("#score");
const levelMessage = document.querySelector("#level-message");
const exitButton = document.querySelector("#exit");
const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const pet = { x: 0, y: 0, size: 72, vx: 0, vy: 0, speed: 280, facing: 1 };
let pellets = [];
let score = 0;
let previousTime = performance.now();
let level = 1;
let pulse = 0;

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

function makePellets(count = Math.min(16 + level * 4, 42)) {
  pellets = Array.from({ length: count }, (_, index) => ({
    x: 36 + Math.random() * (window.innerWidth - 72),
    y: 100 + Math.random() * (window.innerHeight - 148),
    radius: index % 9 === 0 ? 9 : 5,
    glow: Math.random() * Math.PI * 2,
  }));
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
  if (direction[0]) pet.facing = direction[0];
}

function update(dt) {
  pet.x += pet.vx * dt;
  pet.y += pet.vy * dt;
  const half = pet.size / 2;
  if (pet.x < -half) pet.x = window.innerWidth + half;
  if (pet.x > window.innerWidth + half) pet.x = -half;
  if (pet.y < 78) { pet.y = 78; pet.vy = Math.abs(pet.vy); }
  if (pet.y > window.innerHeight - half) { pet.y = window.innerHeight - half; pet.vy = -Math.abs(pet.vy); }

  pellets = pellets.filter((pellet) => {
    const eaten = Math.hypot(pet.x - pellet.x, pet.y - pellet.y) < half + pellet.radius;
    if (eaten) {
      score += pellet.radius > 5 ? 5 : 1;
      scoreElement.textContent = score;
      pulse = 1;
    }
    return !eaten;
  });
  if (!pellets.length) {
    level += 1;
    showLevelMessage(`第 ${level} 盘，再来一口`);
    makePellets();
  }
  pulse = Math.max(0, pulse - dt * 5);
}

function draw(time) {
  context.clearRect(0, 0, window.innerWidth, window.innerHeight);
  for (const pellet of pellets) {
    const breathing = reducedMotion ? 1 : 1 + Math.sin(time / 420 + pellet.glow) * .12;
    context.beginPath();
    context.arc(pellet.x, pellet.y, pellet.radius * breathing, 0, Math.PI * 2);
    context.fillStyle = pellet.radius > 5 ? "#ffda67" : "#fff0a6";
    context.shadowColor = "rgba(255, 218, 103, .58)";
    context.shadowBlur = pellet.radius > 5 ? 18 : 9;
    context.fill();
  }
  context.shadowBlur = 0;
  const scale = 1 + pulse * .12;
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
makePellets();
showLevelMessage("方向键，开吃");
requestAnimationFrame(frame);
