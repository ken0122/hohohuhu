import { BLACK_CAT } from "../characters.js";
import { mountCharacter } from "./character.js";

const characters = [], controls = document.querySelector("#controls"), status = document.querySelector("#status");
let reactionTimer;
function dispose() {
  clearTimeout(reactionTimer);
  characters.forEach(character => character.destroy());
}
window.addEventListener("pagehide", dispose, { once: true });
try {
  // Fixed bundled artwork only: no arbitrary path, upload or network endpoint.
  const response = await fetch(new URL("../../assets/" + BLACK_CAT.asset, import.meta.url));
  if (!response.ok) throw new Error("无法读取本地 SVG");
  const source = await response.text();
  const parsed = new DOMParser().parseFromString(source, "image/svg+xml");
  if (parsed.querySelector("parsererror")) throw new Error("SVG 格式错误");
  for (const host of document.querySelectorAll(".character-host")) {
    characters.push(mountCharacter(host, document.importNode(parsed.documentElement, true), BLACK_CAT));
  }
  controls.disabled = false;
  document.body.dataset.ready = "true";
  status.textContent = "静止 · 形象与动作分开保存，原 SVG 不会被动作改写。";
  controls.addEventListener("click", event => {
    const button = event.target.closest("button");
    if (!button) return;
    if (button.id === "pause" || button.id === "resume") {
      characters.forEach(character => character.setActive(button.id === "resume"));
      status.textContent = button.id === "pause" ? "已暂停" : "已恢复";
      return;
    }
    clearTimeout(reactionTimer);
    characters.forEach(character => {
      character.setActive(true);
      character.reset();
      if (button.dataset.gait) character.motion({ gait: button.dataset.gait });
      if (button.dataset.reaction) character.react(button.dataset.reaction);
    });
    if (button.dataset.reaction) reactionTimer = setTimeout(() => characters.forEach(character => character.react(null)), 800);
    status.textContent = button.textContent + " · 系统开启减少动态效果时，装饰动作会停用。";
  });
} catch (error) {
  dispose(); document.body.dataset.error = "true";
  status.textContent = error.message;
}
