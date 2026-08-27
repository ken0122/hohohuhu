import { createMascot } from "./mascot.js";
import { idleDelay } from "./eye-motion.js";
import { REACTIONS, clickReaction, createStrokeGesture } from "./pet-interactions.js";
import { createPetDrag } from "./pet-drag.js";
const body = document.body;
const form = document.querySelector("#chat-form");
const input = document.querySelector("#message");
const reply = document.querySelector("#reply");
const status = document.querySelector(".speech__status");
const speech = document.querySelector(".speech");
const sendButton = form.querySelector("button[type='submit']");
const pet = document.querySelector("#pet");
const hint = document.querySelector("#pet-hint");
const character = await createMascot(document.querySelector("#character"));
let mode = "dodge", chatOpen = false, near = false, pending = false;
let reactionTimer, hintTimer, hoverTimer, lastReaction = 0;
let moving = false, holdTimer, pressPoint, suppressClick = false;
const gesture = createStrokeGesture();
const reactionCounts = {};
let visible = false, hovering = false, idleTimer, idleFinish, idleCount = 0;
let lastReactionKind;
let dragging = false;
const reduced = matchMedia("(prefers-reduced-motion: reduce)");
const drag = createPetDrag(pet, {
  enabled: () => mode === "pet" && visible && !chatOpen,
  onPress() { moving = false; body.classList.remove("is-moving"); stopIdle(); character.reset(); },
  onStart() {
    resetReaction(); character.reset(); dragging = true; suppressClick = true;
    body.classList.add("is-dragging");
  },
  onEnd({ dragged, cancelled }) {
    dragging = false; body.classList.remove("is-dragging");
    clearTimeout(holdTimer); pressPoint = undefined; gesture.reset();
    if (dragged || cancelled) { suppressClick = true; lastReaction = performance.now(); }
    scheduleIdle();
  },
});

function stopIdle() {
  clearTimeout(idleTimer); idleTimer = undefined;
  clearTimeout(idleFinish); idleFinish = undefined;
  if (body.dataset.reaction?.startsWith("idle-")) {
    delete body.dataset.reaction; character.reset();
  }
}
function scheduleIdle() {
  if (idleTimer || idleFinish || mode !== "pet" || !visible || document.hidden || chatOpen || moving || drag.pressed || near || hovering || reduced.matches || body.dataset.reaction) return;
  idleTimer = setTimeout(() => {
    idleTimer = undefined;
    body.dataset.reaction = ++idleCount % 2 ? "idle-look" : "idle-stretch";
    if (body.dataset.reaction === "idle-look") character.motion({ x: idleCount % 4 === 1 ? -1 : 1, y: -.2 });
    idleFinish = setTimeout(() => {
      idleFinish = undefined;
      delete body.dataset.reaction; character.reset(); scheduleIdle();
    }, 1500);
  }, idleDelay());
}
document.addEventListener("visibilitychange", () => { stopIdle(); scheduleIdle(); });
reduced.addEventListener("change", () => { stopIdle(); scheduleIdle(); });

function react(kind, message) {
  if (mode !== "pet" || chatOpen || !visible || moving || dragging) return;
  if (lastReactionKind === kind && performance.now() - lastReaction < 1800) return;
  stopIdle();
  clearTimeout(reactionTimer);
  clearTimeout(hintTimer);
  clearTimeout(hoverTimer);
  body.dataset.reaction = kind;
  lastReaction = performance.now();
  lastReactionKind = kind;
  character.react(kind);
  const { duration, messages } = REACTIONS[kind];
  const count = reactionCounts[kind] || 0;
  hint.textContent = message || messages[count % messages.length];
  reactionCounts[kind] = count + 1;
  reactionTimer = setTimeout(() => { delete body.dataset.reaction; hint.textContent = ""; scheduleIdle(); }, duration);
}
function resetReaction() {
  stopIdle();
  clearTimeout(holdTimer); pressPoint = undefined; suppressClick = false;
  clearTimeout(reactionTimer); clearTimeout(hoverTimer); clearTimeout(hintTimer);
  delete body.dataset.reaction;
  body.classList.remove("is-affectionate");
  near = false; hovering = false; hint.textContent = ""; gesture.reset();
}
function proximity({ near: isNear, x, y }) {
  if (mode !== "pet" || chatOpen || moving || drag.pressed) return;
  body.classList.toggle("is-affectionate", isNear);
  if (isNear) { stopIdle(); character.motion({ x, y, gait: "idle" }); }
  else if (near) character.reset();
  if (isNear && !near && performance.now() - lastReaction > 1600) react("shy", "你来啦");
  if (isNear && performance.now() - lastReaction > 5000) react("nuzzle", "蹭蹭你");
  near = isNear;
  if (!near) scheduleIdle();
}
window.bluepet.onState(state => {
  const changedMode = mode !== state.mode;
  const changedChat = chatOpen !== state.chatOpen;
  mode = state.mode; chatOpen = state.chatOpen; visible = state.visible;
  character.setActive(visible);
  body.dataset.mode = mode;
  body.classList.toggle("chat-open", chatOpen);
  body.classList.toggle("is-paused", !state.visible);
  speech.inert = !chatOpen;
  speech.setAttribute("aria-hidden", String(!chatOpen));
  if (changedMode || changedChat || !state.visible) { drag.cancel(); moving = false; body.classList.remove("is-moving"); resetReaction(); character.reset(); }
  scheduleIdle();
  if (chatOpen && state.visible) setTimeout(() => { if (chatOpen) input.focus(); }, 60);
  if (changedChat && !chatOpen && !pending) input.value = "";
  if (changedMode && mode === "pet" && !chatOpen && state.visible) {
    hint.textContent = "↑ ↓ ← → 移动 · 长按抱抱";
    clearTimeout(hintTimer);
    hintTimer = setTimeout(() => { hint.textContent = ""; }, 2500);
  }
});
window.bluepet.onPetMotion(motion => {
  if (drag.pressed) return;
  const nextMoving = mode === "pet" && motion.gait === "run";
  if (nextMoving && !moving) resetReaction();
  if (mode === "dodge" || nextMoving || moving) character.motion(motion);
  moving = nextMoving;
  body.classList.toggle("is-moving", moving);
  if (!moving) scheduleIdle();
});
window.bluepet.onPetProximity(proximity);
window.bluepet.ready();

form.addEventListener("submit", async event => {
  event.preventDefault();
  const message = input.value.trim();
  if (!message || pending) return;
  pending = true; body.classList.add("is-thinking");
  status.textContent = "听见啦"; reply.textContent = "正在悄悄回你…";
  input.disabled = true; sendButton.disabled = true;
  try {
    reply.textContent = await window.bluepet.sendChat(message);
    status.textContent = "只告诉你"; input.value = "";
  } catch {
    status.textContent = "没接住";
    reply.textContent = "暂时没连上，请检查网络和本机 DeepSeek 配置后再试。";
  } finally {
    pending = false; body.classList.remove("is-thinking");
    input.disabled = false; sendButton.disabled = false;
    if (chatOpen) input.focus();
  }
});
document.querySelector("#dismiss").addEventListener("click", () => window.bluepet.dismissChat());
window.addEventListener("keydown", event => {
  if (mode === "pet" && !chatOpen && event.key.startsWith("Arrow")) event.preventDefault();
  if (event.key === "Escape" && chatOpen) window.bluepet.dismissChat();
});
function point(event) {
  const rect = pet.getBoundingClientRect();
  return { x: (event.clientX - rect.x) / rect.width, y: (event.clientY - rect.y) / rect.height };
}
pet.addEventListener("click", event => {
  if (mode !== "pet" || chatOpen) return;
  window.bluepet.focusPet();
  if (suppressClick) { suppressClick = false; return; }
  const { x, y } = event.detail === 0 ? { x: .5, y: .5 } : point(event);
  react(clickReaction(x, y));
});
pet.addEventListener("pointerdown", event => {
  if (mode !== "pet" || chatOpen || moving || event.button !== 0) return;
  clearTimeout(holdTimer); clearTimeout(hoverTimer);
  suppressClick = false; pressPoint = point(event);
  holdTimer = setTimeout(() => { suppressClick = true; react("cuddle"); }, 650);
});
pet.addEventListener("pointerup", () => { clearTimeout(holdTimer); pressPoint = undefined; });
pet.addEventListener("pointercancel", () => {
  clearTimeout(holdTimer); pressPoint = undefined; gesture.reset();
});
pet.addEventListener("pointerenter", () => {
  if (mode !== "pet" || chatOpen || moving || drag.pressed) return;
  hovering = true; stopIdle();
  body.classList.add("is-affectionate");
  clearTimeout(hoverTimer);
  hoverTimer = setTimeout(() => react("nuzzle", "再陪我一会儿"), 1100);
});
pet.addEventListener("pointerleave", () => {
  if (drag.pressed) return;
  hovering = false;
  clearTimeout(hoverTimer); clearTimeout(holdTimer); pressPoint = undefined; gesture.reset();
  scheduleIdle();
});
pet.addEventListener("pointermove", event => {
  if (mode !== "pet" || chatOpen || moving || dragging) return;
  const { x, y } = point(event);
  if (pressPoint && Math.hypot(x - pressPoint.x, y - pressPoint.y) > .18) {
    clearTimeout(holdTimer); pressPoint = undefined;
  }
  const kind = gesture.move(x, y, performance.now());
  if (kind) react(kind);
});
