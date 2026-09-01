import { installLocalization } from "./localize.js";
const hint = document.querySelector("#pet-hint");

window.bluepetHint.onMessage((payload) => {
  const { message, anchorX } = typeof payload === "string" ? { message: payload } : payload;
  hint.textContent = message;
  if (Number.isFinite(anchorX)) hint.style.setProperty("--hint-anchor-x", `${anchorX}px`);
  document.body.dataset.visible = String(Boolean(message));
});
await installLocalization();
