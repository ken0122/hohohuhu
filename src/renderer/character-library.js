import { BLUE_ONE_EYE, BLACK_CAT, characterDefinition } from "../characters.js";
import { validateGeneratedSvg } from "../character-import.js";
import { mountCharacter } from "./character.js";

const $ = selector => document.querySelector(selector), api = window.characterLibrary;
let catalog, selected, draft, characters = [], busy = false, paused = false, previewGait = "idle", reactionTimer, worker, originalUrl;
function status(message, error = false) { $("#status").textContent = message; $("#status").dataset.error = String(error); }
async function request(promise) { const result = await promise; if (!result.ok) throw new Error(result.error); return result.value; }
function controls() {
  document.querySelectorAll("button:not(#close)").forEach(button => { button.disabled = busy; });
  $("#motions").disabled = busy || !characters.length;
  $("#apply").disabled = busy || !selected || (!draft && selected.id === catalog?.selected);
  const current = !draft && selected?.id === catalog?.selected;
  $("#apply").textContent = draft ? "保存并使用" : current ? "已是当前角色" : "使用这个角色";
  $("#apply").classList.toggle("is-current", current);
  $("#remove").hidden = !selected || selected.builtin || Boolean(draft);
  $("#cancel").hidden = !draft;
  $("#character-name").disabled = busy;
  document.body.setAttribute("aria-busy", String(busy));
}
async function operation(fn) {
  if (busy) return;
  busy = true; controls();
  try { await fn(); } catch (error) { status(error.message, true); }
  finally { busy = false; controls(); }
}
function renderCatalog() {
  $("#catalog").replaceChildren(...catalog.items.map(item => {
    const button = document.createElement("button"); button.className = "entry"; button.dataset.id = item.id;
    button.setAttribute("aria-pressed", String(!draft && selected?.id === item.id));
    const top = document.createElement("span"); top.className = "entry__top";
    const name = document.createElement("span"); name.textContent = item.name; top.append(name);
    if (item.id === catalog.selected) { const current = document.createElement("span"); current.className = "current-badge"; current.textContent = "当前"; top.append(current); }
    const detail = document.createElement("small"); detail.textContent = item.builtin ? "内置角色" : "本地导入";
    button.append(top, detail);
    button.addEventListener("click", () => operation(() => showEntry(item)));
    return button;
  }));
}
function clearOriginal() { if (originalUrl) URL.revokeObjectURL(originalUrl); originalUrl = undefined; $("#original-slot").replaceChildren(); $("#original").hidden = true; }
function mount(entry) {
  if (!entry.builtin) validateGeneratedSvg(entry.svg);
  const parsed = new DOMParser().parseFromString(entry.svg, "image/svg+xml");
  if (parsed.querySelector("parsererror")) throw new Error("SVG 无法读取，请重新导入。");
  const definition = characterDefinition(entry.id);
  clearTimeout(reactionTimer);
  characters = Array.from(document.querySelectorAll(".character-host"), host => mountCharacter(host, document.importNode(parsed.documentElement, true), definition, { eyelids: host.id !== "game" }));
  paused = false; previewGait = "idle"; $("#pause").textContent = "暂停预览"; $("#pause").setAttribute("aria-pressed", "false");
  document.querySelectorAll("[data-gait]").forEach(button => button.setAttribute("aria-pressed", String(button.dataset.gait === "idle")));
  $("#capabilities").textContent = entry.id === BLUE_ONE_EYE.id ? "原有下摆形变与眼睛动作。" : entry.id === BLACK_CAT.id ? "整体起伏与轻跳；眼睛会跟随，尾巴保持静态。" : "整体起伏与轻跳；未自动识别可动部件。";
}
async function showEntry(item) {
  const entry = await request(api.source(item.id));
  mount(entry); selected = item; draft = undefined; clearOriginal();
  $("#draft-fields").hidden = true; $("#name").textContent = item.name;
  $("#selection-status").textContent = item.id === catalog.selected ? "当前角色" : `正在预览 · 当前是 ${catalog.items.find(entry => entry.id === catalog.selected)?.name}`;
  renderCatalog();
  status(catalog.warning || (item.id === catalog.selected ? "正在使用。切换形象不会重开游戏或改变隐藏状态。" : "这里只是预览，点击“使用这个角色”后才会切换。"), Boolean(catalog.warning));
}
function convert(bytes) {
  return new Promise((resolve, reject) => {
    const task = worker = new Worker(new URL("./character-convert-worker.js", import.meta.url), { type: "module" });
    const timer = setTimeout(() => finish(new Error("转换超时，请使用更小、更简洁的图片。")), 10000);
    function finish(error, svg) { clearTimeout(timer); task.terminate(); if (worker === task) worker = undefined; error ? reject(error) : resolve(svg); }
    task.onmessage = ({data}) => finish(data.ok ? null : new Error(data.error), data.svg);
    task.onerror = event => { event.preventDefault(); finish(new Error("图片转换失败，请重新导出 PNG/JPG 后重试。")); };
    task.postMessage(bytes);
  });
}
$("#choose").addEventListener("click", () => operation(async () => {
  if (draft && !confirm("换一张图片会放弃当前未保存的导入，继续吗？")) return;
  const input = await request(api.choose());
  if (!input) return;
  status("正在本地转换…原图不会上传。最多等待 10 秒。");
  const svg = await convert(input.bytes);
  mount({ id: "draft", svg, builtin: false });
  draft = { svg, name: input.name }; selected = { id: "draft", name: input.name, builtin: false };
  clearOriginal(); originalUrl = URL.createObjectURL(new Blob([input.bytes], { type: input.mime }));
  const image = new Image(); image.id = "original-image"; image.alt = "导入的原图"; image.src = originalUrl;
  $("#original-slot").replaceChildren(image); $("#original").hidden = false;
  $("#name").textContent = "预览导入结果"; $("#character-name").value = input.name; $("#draft-fields").hidden = false;
  $("#selection-status").textContent = `未保存草稿 · 当前是 ${catalog.items.find(entry => entry.id === catalog.selected)?.name}`;
  api.setDirty(true); $("#choose").textContent = "换一张图片…";
  renderCatalog(); status("转换完成，尚未保存。请检查轮廓与细节，满意后再保存并使用。");
}));
$("#apply").addEventListener("click", () => operation(async () => {
  catalog = await request(draft ? api.import({ svg: draft.svg, name: $("#character-name").value }) : api.select(selected.id));
  api.setDirty(false); $("#choose").textContent = "导入 PNG / JPG…";
  await showEntry(catalog.items.find(item => item.id === catalog.selected));
  characters.forEach(character => character.react("hop"));
  reactionTimer = setTimeout(() => characters.forEach(character => character.react(null)), 800);
  status("已使用并保存在本机。原有模式、聊天和游戏进度保持不变。");
}));
$("#cancel").addEventListener("click", () => operation(async () => {
  api.setDirty(false); $("#choose").textContent = "导入 PNG / JPG…";
  await showEntry(catalog.items.find(item => item.id === catalog.selected));
  status("已放弃未保存的导入。");
}));
$("#remove").addEventListener("click", () => operation(async () => {
  if (!confirm("移除这个本地角色？原始图片不受影响。若正在使用，将恢复呼噜呼噜。")) return;
  catalog = await request(api.remove(selected.id));
  await showEntry(catalog.items.find(item => item.id === catalog.selected)); status("已移除本地角色，原始图片未修改。");
}));
$("#motions").addEventListener("click", event => {
  const button = event.target.closest("button"); if (!button || busy) return;
  if (button.id === "pause") { paused = !paused; characters.forEach(character => character.setActive(!paused)); button.textContent = paused ? "继续预览" : "暂停预览"; button.setAttribute("aria-pressed", String(paused)); $("#motion-status").textContent = paused ? "动作预览已暂停。" : "动作预览已继续。"; return; }
  clearTimeout(reactionTimer); paused = false; $("#pause").textContent = "暂停预览"; $("#pause").setAttribute("aria-pressed", "false");
  characters.forEach(character => { character.setActive(true); character.reset(); if (button.dataset.gait) character.motion({ gait: button.dataset.gait }); if (button.dataset.reaction) character.react(button.dataset.reaction); });
  if (button.dataset.gait) previewGait = button.dataset.gait;
  document.querySelectorAll("[data-gait]").forEach(item => item.setAttribute("aria-pressed", String(item.dataset.gait === (button.dataset.gait || "idle"))));
  if (button.dataset.reaction) reactionTimer = setTimeout(() => characters.forEach(character => character.react(null)), 800);
  $("#motion-status").textContent = "预览：" + button.textContent + "。系统开启“减少动态效果”时，装饰动作会停用。";
});
$(".stage").addEventListener("pointermove", event => {
  const rect = $("#large").getBoundingClientRect();
  characters.forEach(character => character.motion({ gait: previewGait, gaze: { x: event.clientX - (rect.x + rect.width / 2), y: event.clientY - (rect.y + rect.height * .46) } }));
});
$(".stage").addEventListener("pointerleave", () => characters.forEach(character => character.motion({ gait: previewGait, gaze: null })));
$("#catalog").addEventListener("keydown", event => {
  if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return;
  const entries = Array.from(document.querySelectorAll(".entry")); if (!entries.length) return;
  const index = entries.indexOf(document.activeElement), next = event.key === "Home" ? 0 : event.key === "End" ? entries.length - 1 : Math.max(0, Math.min(entries.length - 1, index + (event.key === "ArrowDown" ? 1 : -1)));
  event.preventDefault(); entries[next].focus(); entries[next].click();
});
$("#close").addEventListener("click", () => api.close());
window.addEventListener("keydown", event => { if (event.key === "Escape") api.close(); });
window.addEventListener("pagehide", () => { worker?.terminate(); clearTimeout(reactionTimer); characters.forEach(character => character.destroy()); clearOriginal(); }, { once: true });
await operation(async () => { api.setDirty(false); catalog = await request(api.list()); await showEntry(catalog.items.find(item => item.id === catalog.selected)); document.body.dataset.ready = "true"; });
