import { createMascot } from "./mascot.js";
import { idleDelay } from "./eye-motion.js";
import { clickReaction, createInteractionPolicy, createStrokeGesture } from "./pet-interactions.js";
import { createPetDrag } from "./pet-drag.js";
import { installHideEffect } from "./hide-effect.js";
const body = document.body;
const form = document.querySelector("#chat-form");
const input = document.querySelector("#message");
const reply = document.querySelector("#reply");
const status = document.querySelector(".speech__status");
const speech = document.querySelector(".speech");
const sendButton = form.querySelector("button[type='submit']");
const pet = document.querySelector("#pet");
const hint = document.querySelector("#pet-hint");
function setHint(message = "") {
  hint.textContent = message;
  window.bluepet.setPetHint(message);
}
const characterHost = document.querySelector("#character");
const character = await createMascot(characterHost);
const interaction = createInteractionPolicy(() => character.definition);
const affectionSymbols = Array.from(document.querySelectorAll(".affection span"));
function applyCharacterPresentation() {
  const { id, affection, profile } = character.definition;
  body.dataset.character = id;
  const identity = profile?.persona?.identity || "桌面宠物";
  document.querySelector(".desktop-pet")?.setAttribute("aria-label", identity);
  pet.setAttribute("aria-label", `和${identity}互动`);
  affectionSymbols.forEach((symbol, index) => { symbol.textContent = affection.symbols[index]; });
  body.style.setProperty("--affection-color", affection.color);
  body.style.setProperty("--affection-shadow", affection.shadow);
}
applyCharacterPresentation();
characterHost.addEventListener("character-mounted", applyCharacterPresentation);
window.addEventListener("pagehide", () => { setHint(); character.destroy(); }, { once: true });
let mode = "dodge", chatOpen = false, near = false, pending = false;
let reactionTimer, hoverTimer, lastReaction = 0;
let moving = false, holdTimer, pressPoint, suppressClick = false;
const gesture = createStrokeGesture({ getParts: () => character.definition.interactionParts || [] });
let visible = false, hovering = false, idleTimer, idleFinish, idleHintTimer, idleCount = 0;
let dragging = false;
const IDLE_BUBBLE_HOLD_MS = 900;
const reduced = matchMedia("(prefers-reduced-motion: reduce)");
const hideEffect=await installHideEffect(pet,()=>{
  visible=false;drag.cancel();resetReaction();character.setActive(false);
});
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
  clearTimeout(idleHintTimer); idleHintTimer = undefined;
  if (body.dataset.reaction?.startsWith("idle-") || hint.dataset.idle === "true") {
    delete hint.dataset.idle;
    delete body.dataset.reaction; setHint(); character.reset();
  }
}
function scheduleIdle() {
  if (idleTimer || idleFinish || idleHintTimer || mode !== "pet" || !visible || document.hidden || chatOpen || moving || drag.pressed || near || hovering || reduced.matches || body.dataset.reaction) return;
  idleTimer = setTimeout(() => {
    idleTimer = undefined;
    const idle = interaction.idle();
    body.dataset.reaction = idle.kind;
    character.react(idle.kind);
    hint.dataset.idle = "true";
    setHint(idle.message);
    if (idle.kind === "idle-look") character.motion({ x: ++idleCount % 2 ? -1 : 1, y: -.2 });
    idleFinish = setTimeout(() => {
      idleFinish = undefined;
      delete body.dataset.reaction; character.reset();
      idleHintTimer = setTimeout(() => {
        idleHintTimer = undefined;
        delete hint.dataset.idle;
        setHint();
        scheduleIdle();
      }, IDLE_BUBBLE_HOLD_MS);
    }, idle.duration);
  }, idleDelay());
}
document.addEventListener("visibilitychange", () => { stopIdle(); scheduleIdle(); });
reduced.addEventListener("change", () => { stopIdle(); scheduleIdle(); });

function playReaction(selected) {
  if (mode !== "pet" || chatOpen || !visible || moving || dragging) return;
  if (!selected) return;
  stopIdle();
  clearTimeout(reactionTimer);
  clearTimeout(hoverTimer);
  body.dataset.reaction = selected.kind;
  lastReaction = performance.now();
  character.react(selected.kind);
  setHint(selected.message);
  if (selected.easterEgg) body.dataset.easterEgg = selected.easterEgg;
  reactionTimer = setTimeout(() => {
    delete body.dataset.reaction;
    delete body.dataset.easterEgg;
    character.react(null);
    setHint();
    scheduleIdle();
  }, selected.duration);
}
function react(intent) { playReaction(interaction.reaction(intent)); }
function resetReaction() {
  stopIdle();
  clearTimeout(holdTimer); pressPoint = undefined; suppressClick = false;
  clearTimeout(reactionTimer); clearTimeout(hoverTimer);
  delete body.dataset.reaction;
  delete body.dataset.easterEgg;
  character.react(null);
  body.classList.remove("is-affectionate");
  near = false; hovering = false; setHint(); gesture.reset();
}
function proximity({ near: isNear, x, y }) {
  if (mode !== "pet" || chatOpen || moving || drag.pressed) return;
  body.classList.toggle("is-affectionate", isNear);
  if (isNear) { stopIdle(); character.motion({ x, y, gait: "idle" }); }
  else if (near) character.reset();
  if (isNear && !near && performance.now() - lastReaction > 1600) playReaction(interaction.proximity("enter"));
  if (isNear && performance.now() - lastReaction > 5000) playReaction(interaction.proximity("dwell"));
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
});
window.bluepet.onPetMotion(motion => {
  if (drag.pressed) return;
  const nextMoving = mode === "pet" && motion.gait !== "idle";
  if (nextMoving && !moving) resetReaction();
  if (mode === "dodge" || mode === "pet") character.motion(motion);
  moving = nextMoving;
  body.classList.toggle("is-moving", moving);
  if (!moving) scheduleIdle();
});
window.bluepet.onPetProximity(proximity);
window.bluepet.ready();

// The visible renderer supplies the display-synchronised clock, instead of
// moving the native window on an unrelated 32ms main-process interval.
function desktopFrame() {
  if(visible&&!hideEffect.active&&!document.hidden&&!drag.pressed)window.bluepet.frame();
  requestAnimationFrame(desktopFrame);
}
requestAnimationFrame(desktopFrame);

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
  react(clickReaction(x, y, character.definition.interactionParts));
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
  window.bluepet.setPetHover(true);
  if (mode !== "pet" || chatOpen || moving || drag.pressed) return;
  hovering = true; stopIdle();
  body.classList.add("is-affectionate");
  clearTimeout(hoverTimer);
  hoverTimer = setTimeout(() => playReaction(interaction.proximity("dwell")), 1100);
});
pet.addEventListener("pointerleave", () => {
  window.bluepet.setPetHover(false);
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
