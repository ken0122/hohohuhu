import { installLocalization, onLocaleChanged } from "./localize.js";
const hint = document.querySelector("#pet-hint");
let lastMeasurement;
function measureHint() {
  if (!hint.textContent) return;
  // offsetHeight excludes the entrance animation. Leave room for the final
  // rotation, top border/shadow and the 12px tail inset below the bubble.
  const height = Math.ceil(hint.offsetHeight + hint.offsetWidth * Math.sin(Math.PI / 180) + 18);
  const value = { message: hint.textContent, locale: document.documentElement.lang, width: innerWidth, height };
  const key = JSON.stringify(value);
  if (key === lastMeasurement) return;
  lastMeasurement = key;
  window.bluepetHint.reportSize(value);
}

window.bluepetHint.onMessage((payload) => {
  const { message, anchorX } = typeof payload === "string" ? { message: payload } : payload;
  hint.textContent = message;
  if (Number.isFinite(anchorX)) hint.style.setProperty("--hint-anchor-x", `${anchorX}px`);
  document.body.dataset.visible = String(Boolean(message));
  measureHint();
});
new ResizeObserver(measureHint).observe(hint);
window.addEventListener("resize", measureHint);
onLocaleChanged(measureHint);
await installLocalization();
await document.fonts.ready;
measureHint();
