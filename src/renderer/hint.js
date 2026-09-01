import { installLocalization } from "./localize.js";
const hint = document.querySelector("#pet-hint");

window.bluepetHint.onMessage((message) => {
  hint.textContent = message;
  document.body.dataset.visible = String(Boolean(message));
});
await installLocalization(() => {});
