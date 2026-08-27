import { createMascot } from "./mascot.js";
import { idleDelay } from "./eye-motion.js";
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
let reactionTimer, hintTimer, hoverTimer, lastReaction = 0, strokeDistance = 0, lastPointer;
let clickCount = 0;
let visible = false, hovering = false, idleTimer, idleFinish, idleCount = 0;
let lastReactionKind;
const reduced = matchMedia("(prefers-reduced-motion: reduce)");

function stopIdle() {
  clearTimeout(idleTimer); idleTimer = undefined;
  clearTimeout(idleFinish); idleFinish = undefined;
  if (body.dataset.reaction?.startsWith("idle-")) {
    delete body.dataset.reaction; character.reset();
  }
}
function scheduleIdle() {
  if (idleTimer || idleFinish || mode !== "pet" || !visible || document.hidden || chatOpen || near || hovering || reduced.matches || body.dataset.reaction) return;
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
  if (mode !== "pet" || chatOpen || !visible) return;
  if (lastReactionKind === kind && performance.now() - lastReaction < 1800) return;
  stopIdle();
  clearTimeout(reactionTimer);
  clearTimeout(hoverTimer);
  body.dataset.reaction = kind;
  lastReaction = performance.now();
  lastReactionKind = kind;
  character.react(kind);
  hint.textContent = message;
  const duration = { nuzzle: 1100, headpat: 1000, hop: 700, shy: 800 }[kind];
  reactionTimer = setTimeout(() => { delete body.dataset.reaction; hint.textContent = ""; scheduleIdle(); }, duration);
}
function resetReaction() {
  stopIdle();
  clearTimeout(reactionTimer); clearTimeout(hoverTimer); clearTimeout(hintTimer);
  delete body.dataset.reaction;
  body.classList.remove("is-affectionate");
  near = false; hovering = false; hint.textContent = ""; strokeDistance = 0; lastPointer = undefined;
}
function proximity({ near: isNear, x, y }) {
  if (mode !== "pet" || chatOpen) return;
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
  if (changedMode || changedChat || !state.visible) { resetReaction(); character.reset(); }
  scheduleIdle();
  if (chatOpen && state.visible) setTimeout(() => { if (chatOpen) input.focus(); }, 60);
  if (changedChat && !chatOpen && !pending) input.value = "";
  if (mode === "control" && !chatOpen && state.visible) {
    hint.textContent = "↑ ↓ ← → · Esc 退出";
    clearTimeout(hintTimer);
    hintTimer = setTimeout(() => { hint.textContent = ""; }, 2500);
  }
});
window.bluepet.onPetMotion(motion => character.motion(motion));
window.bluepet.onPetProximity(proximity);
window.bluepet.ready();

form.addEventListener("submit", async event => {
  event.preventDefault();
  const message = input.value.trim();
  if (!message || pending) return;
  pending = true; body.classList.add("is-thinking");
  status.textContent = "在认真想"; reply.textContent = "稍等，我想想怎么说…";
  input.disabled = true; sendButton.disabled = true;
  try {
    reply.textContent = await window.bluepet.sendChat(message);
    status.textContent = "只告诉你"; input.value = "";
  } catch {
    status.textContent = "没接住";
    reply.textContent = "暂时没连上，请检查本机 Claude Code 后再试。";
  } finally {
    pending = false; body.classList.remove("is-thinking");
    input.disabled = false; sendButton.disabled = false;
    if (chatOpen) input.focus();
  }
});
document.querySelector("#dismiss").addEventListener("click", () => window.bluepet.dismissChat());
window.addEventListener("keydown", event => {
  if (mode === "control" && !chatOpen && event.key.startsWith("Arrow")) event.preventDefault();
  if (event.key === "Escape" && chatOpen) window.bluepet.dismissChat();
});
pet.addEventListener("click", () => {
  if (mode === "control") return window.bluepet.focusControl();
  clickCount++;
  react(clickCount % 2 ? "hop" : "shy", clickCount % 2 ? "嘿嘿！" : "有点害羞…");
});
pet.addEventListener("pointerenter", () => {
  if (mode !== "pet") return;
  hovering = true; stopIdle();
  body.classList.add("is-affectionate");
  clearTimeout(hoverTimer);
  hoverTimer = setTimeout(() => react("nuzzle", "再陪我一会儿"), 1100);
});
pet.addEventListener("pointerleave", () => {
  hovering = false;
  clearTimeout(hoverTimer); lastPointer = undefined; strokeDistance = 0;
  scheduleIdle();
});
pet.addEventListener("pointermove", event => {
  if (mode !== "pet") return;
  const rect = pet.getBoundingClientRect();
  if (lastPointer && event.clientY < rect.y + rect.height * .6) {
    strokeDistance += Math.abs(event.clientX - lastPointer.x);
    if (strokeDistance > 50) { react("headpat", "摸摸头，好舒服"); strokeDistance = 0; }
  }
  lastPointer = { x: event.clientX, y: event.clientY };
});
