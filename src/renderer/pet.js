const body = document.body;
const form = document.querySelector("#chat-form");
const input = document.querySelector("#message");
const reply = document.querySelector("#reply");
const status = document.querySelector(".speech__status");
const sendButton = form.querySelector("button[type='submit']");
const dismissButton = document.querySelector("#dismiss");
const pet = document.querySelector("#pet");

function openChat() {
  body.classList.add("chat-open");
  document.querySelector(".speech").setAttribute("aria-hidden", "false");
  setTimeout(() => input.focus(), 60);
}

function closeChat() {
  body.classList.remove("chat-open", "is-thinking");
  document.querySelector(".speech").setAttribute("aria-hidden", "true");
  input.value = "";
}

async function submitMessage(event) {
  event.preventDefault();
  const message = input.value.trim();
  if (!message || body.classList.contains("is-thinking")) return;
  body.classList.add("is-thinking");
  status.textContent = "在认真想";
  reply.textContent = message.length > 26 ? `${message.slice(0, 26)}…` : message;
  input.disabled = true;
  sendButton.disabled = true;
  try {
    reply.textContent = await window.bluepet.sendChat(message);
    status.textContent = "只告诉你";
    input.value = "";
  } catch (error) {
    status.textContent = "没接住";
    reply.textContent = error?.message || "刚刚走神了，再说一次好吗？";
  } finally {
    body.classList.remove("is-thinking");
    input.disabled = false;
    sendButton.disabled = false;
    input.focus();
  }
}

function dismiss() {
  window.bluepet.dismissChat();
}

form.addEventListener("submit", submitMessage);
dismissButton.addEventListener("click", dismiss);
pet.addEventListener("mouseenter", () => body.classList.add("is-affectionate"));
pet.addEventListener("mouseleave", () => body.classList.remove("is-affectionate"));
window.addEventListener("keydown", (event) => {
  if (event.key === "Escape") dismiss();
});
window.bluepet.onChatOpen(openChat);
window.bluepet.onChatClose(closeChat);
window.bluepet.onModeChanged((mode) => {
  body.dataset.mode = mode;
  body.classList.remove("is-affectionate");
});
window.bluepet.onPetProximity((near) => body.classList.toggle("is-affectionate", near));
window.bluepet.onPetMotion(({ fleeing, facing }) => {
  body.classList.toggle("is-fleeing", fleeing);
  body.dataset.facing = facing;
});
