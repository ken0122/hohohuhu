import { BLUE_ONE_EYE, BLACK_CAT, SUNNY_YELLOW, characterDefinition } from "../characters.js";
import { validateGeneratedSvg } from "../character-import.js";
import { profileFromAnalysis } from "../character-profile.js";
import { mapPartBox } from "../character-vectorize.js";
import { mountCharacter } from "./character.js";
import { deriveImportedEyeRig } from "./imported-eye-rig.js";

const $ = selector => document.querySelector(selector), api = window.characterLibrary;
let catalog, selected, previewEntry, draft, characters = [], busy = false, paused = false, previewGait = "idle", reactionTimer, worker, originalUrl;
function status(message, error = false) { $("#status").textContent = message; $("#status").dataset.error = String(error); }
async function request(promise) { const result = await promise; if (!result.ok) throw new Error(result.error); return result.value; }
function controls() {
  const importing = draft?.mode === "import", editing = draft?.mode === "edit";
  document.querySelectorAll("button:not(#close)").forEach(button => { button.disabled = busy; });
  $("#motions").disabled = busy || !characters.length;
  $("#apply").disabled = busy || !selected || Boolean(draft?.blocked) || (!draft && selected.id === catalog?.selected);
  const current = !draft && selected?.id === catalog?.selected;
  $("#apply").textContent = importing ? "添加并使用" : editing ? "保存修改" : current ? "正在使用" : "使用角色";
  $("#apply").classList.toggle("is-current", current);
  $("#remove").hidden = !selected || selected.builtin || Boolean(draft);
  $("#edit").hidden = !selected || selected.builtin || Boolean(draft);
  $("#cancel").hidden = !draft;
  $("#cancel").textContent = editing ? "取消编辑" : "放弃添加";
  $("#choose").textContent = importing ? "换张图…" : "添加角色…";
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
    const detail = document.createElement("small"); detail.textContent = item.builtin ? "内置" : "已添加";
    button.append(top, detail);
    button.addEventListener("click", () => operation(async () => {
      if (draft && !confirm("放弃未保存的修改，查看其他角色？")) return;
      if (draft) api.setDirty(false);
      await showEntry(item);
    }));
    return button;
  }));
}
function clearOriginal() { if (originalUrl) URL.revokeObjectURL(originalUrl); originalUrl = undefined; $("#original-slot").replaceChildren(); $("#original").hidden = true; }
const PART_LABELS = { body:"身体",head:"头",eye:"眼睛",mouth:"嘴",ear:"耳朵",arm:"手臂",leg:"腿",tail:"尾巴",accessory:"配饰" };
const INTERACTION_LABELS = { headpat:"摸头",tickle:"挠痒",poke:"戳一戳",cuddle:"抱抱",nuzzle:"贴贴",hop:"点击脸部",shy:"点击头部" };
function partRow(part = { kind: "accessory", confidence: 1, box: [.25,.25,.5,.5] }) {
  const row = document.createElement("div"); row.className = "part-row";
  const kind = document.createElement("select"); kind.setAttribute("aria-label", "部件类型");
  for (const [value, label] of Object.entries(PART_LABELS)) {
    const option = document.createElement("option"); option.value = value; option.textContent = label; kind.append(option);
  }
  kind.value = part.kind;
  row.append(kind, ...part.box.map((value, index) => {
    const input = document.createElement("input"); input.type = "number"; input.min = "0"; input.max = "1"; input.step = ".01"; input.value = value.toFixed(2);
    input.setAttribute("aria-label", ["左边界", "上边界", "宽度", "高度"][index]); return input;
  }));
  const remove = document.createElement("button"); remove.type = "button"; remove.textContent = "×";
  remove.setAttribute("aria-label", `移除${PART_LABELS[part.kind] || "部件"}`); remove.addEventListener("click", () => row.remove()); row.append(remove);
  return row;
}
function renderAnalysis(analysis) {
  const labels = { pass: "素材符合要求", warn: "素材需要确认", reject: "请更换图片" };
  $(".analysis-heading").dataset.decision = analysis.quality.decision;
  $("#quality-label").textContent = labels[analysis.quality.decision];
  $("#quality-explanation").textContent = analysis.quality.explanation;
  $("#persona-identity").value = analysis.persona.identity;
  $("#persona-archetype").value = analysis.persona.archetype;
  $("#persona-voice").value = analysis.persona.voice;
  $("#persona-summary").value = analysis.persona.summary;
  $("#persona-traits").value = analysis.persona.traits.join("、");
  $("#dialogue-list").replaceChildren(...Object.entries(INTERACTION_LABELS).map(([intent, label]) => {
    const field = document.createElement("label"); field.textContent = label;
    const input = document.createElement("input"); input.dataset.dialogue = intent; input.maxLength = 203; input.value = analysis.dialogue[intent].join("｜"); field.append(input); return field;
  }));
  $("#egg-label").value = analysis.easterEgg.label;
  $("#egg-trigger").value = analysis.easterEgg.triggerIntent;
  $("#egg-description").value = analysis.easterEgg.description;
  $("#egg-message").value = analysis.easterEgg.message;
  $("#parts-list").replaceChildren(...analysis.parts.map(partRow));
}
function editedAnalysis() {
  const traits = $("#persona-traits").value.split(/[、,，]/).map(value => value.trim()).filter(Boolean);
  const parts = Array.from(document.querySelectorAll(".part-row"), row => ({
    kind: row.querySelector("select").value,
    confidence: 1,
    box: Array.from(row.querySelectorAll("input"), input => Number(input.value)),
  }));
  const dialogue = Object.fromEntries(Array.from(document.querySelectorAll("[data-dialogue]"), input => [
    input.dataset.dialogue,
    input.value.split(/[｜|]/).map(value => value.trim()).filter(Boolean),
  ]));
  return {
    ...draft.analysis,
    persona: {
      archetype: $("#persona-archetype").value,
      voice: $("#persona-voice").value,
      identity: $("#persona-identity").value,
      summary: $("#persona-summary").value,
      traits,
    },
    dialogue,
    easterEgg: { label: $("#egg-label").value, triggerIntent: $("#egg-trigger").value, description: $("#egg-description").value, message: $("#egg-message").value },
    parts,
  };
}
async function mount(entry) {
  if (!entry.builtin) validateGeneratedSvg(entry.svg);
  const parsed = new DOMParser().parseFromString(entry.svg, "image/svg+xml");
  if (parsed.querySelector("parsererror")) throw new Error("SVG 无法读取，请重新导入。");
  const eyeRig = entry.builtin ? null : await deriveImportedEyeRig(entry.svg, entry.analysis?.parts);
  const definition = characterDefinition(entry.id, entry.profile, entry.analysis, eyeRig);
  const { persona, easterEgg } = definition.profile;
  clearTimeout(reactionTimer);
  characters = Array.from(document.querySelectorAll(".character-host"), host => mountCharacter(host, document.importNode(parsed.documentElement, true), definition, { eyelids: host.id !== "game" }));
  paused = false; previewGait = "idle"; $("#pause").textContent = "暂停预览"; $("#pause").setAttribute("aria-pressed", "false");
  document.querySelectorAll("[data-gait]").forEach(button => button.setAttribute("aria-pressed", String(button.dataset.gait === "idle")));
  $("#personality").textContent = persona.traits.join(" · ");
  $("#easter-egg").textContent = `彩蛋 · ${easterEgg.label}`;
  $("#egg-preview").dataset.reaction = easterEgg.reaction.motion;
  $("#egg-preview").dataset.duration = String(easterEgg.reaction.duration);
  $("#capabilities").textContent = entry.id === BLUE_ONE_EYE.id ? "原有下摆形变与眼睛动作。" : entry.id === BLACK_CAT.id ? "整体起伏与轻跳；眼睛会跟随，尾巴保持静态。" : entry.id === SUNNY_YELLOW.id ? "整体起伏与轻跳；珊瑚色眼睛会跟随，尾巴保持静态。" : entry.analysis ? `整体动作；已识别 ${entry.analysis.parts.length} 个可修正互动部件。` : "整体起伏与轻跳；没有部件分析。";
}
async function showEntry(item) {
  const entry = await request(api.source(item.id));
  await mount(entry); selected = item; previewEntry = entry; draft = undefined; clearOriginal();
  $("#draft-fields").hidden = true; $("#art-caption").hidden = true; $("#name").textContent = item.name;
  $("#selection-status").textContent = item.id === catalog.selected ? "当前角色" : `预览中 · 当前角色 ${catalog.items.find(entry => entry.id === catalog.selected)?.name}`;
  renderCatalog();
  status(catalog.warning || "", Boolean(catalog.warning));
}
function convert(bytes) {
  return new Promise((resolve, reject) => {
    const task = worker = new Worker(new URL("./character-convert-worker.js", import.meta.url), { type: "module" });
    const timer = setTimeout(() => finish(new Error("转换超时，请使用更小、更简洁的图片。")), 10000);
    function finish(error, result) { clearTimeout(timer); task.terminate(); if (worker === task) worker = undefined; error ? reject(error) : resolve(result); }
    task.onmessage = ({data}) => finish(data.ok ? null : new Error(data.error), data);
    task.onerror = event => { event.preventDefault(); finish(new Error("图片转换失败，请重新导出 PNG/JPG 后重试。")); };
    task.postMessage(bytes);
  });
}
$("#choose").addEventListener("click", () => operation(async () => {
  if (draft && !confirm("放弃未保存的修改，添加新角色？")) return;
  const input = await request(api.choose());
  if (!input) return;
  status("正在处理图片并分析角色，最多约 30 秒…");
  const [conversion, rawAnalysis] = await Promise.all([
    convert(input.bytes),
    request(api.analyze({ bytes: input.bytes, mime: input.mime })),
  ]);
  const svg = conversion.svg;
  const analysis = {
    ...rawAnalysis,
    parts: rawAnalysis.parts.map(part => ({ ...part, box: mapPartBox(part.box, input.width, input.height, conversion.transform) })),
  };
  const profile = profileFromAnalysis(analysis);
  await mount({ id: "draft", svg, profile, analysis, builtin: false });
  draft = { mode: "import", svg, name: input.name, analysis, blocked: analysis.quality.decision === "reject" };
  selected = { id: "draft", name: input.name, builtin: false };
  clearOriginal(); originalUrl = URL.createObjectURL(new Blob([input.bytes], { type: input.mime }));
  const image = new Image(); image.id = "original-image"; image.alt = "导入的原图"; image.src = originalUrl;
  $("#original-slot").replaceChildren(image); $("#original").hidden = false;
  $("#name").textContent = "添加新角色"; $("#character-name").value = input.name; $("#draft-fields").hidden = false; $("#art-caption").hidden = false;
  renderAnalysis(analysis);
  $("#selection-status").textContent = `不会覆盖 · 当前角色：${catalog.items.find(entry => entry.id === catalog.selected)?.name}`;
  api.setDirty(true);
  renderCatalog();
  status(draft.blocked ? "这张图不符合要求，请换一张。" : "分析好了。确认一下，也可以直接修改。", draft.blocked);
}));
$("#apply").addEventListener("click", () => operation(async () => {
  const mode = draft?.mode, targetId = draft?.id || selected.id;
  catalog = await request(mode === "import"
    ? api.import({ svg: draft.svg, name: $("#character-name").value, analysis: editedAnalysis() })
    : mode === "edit"
      ? api.update({ id: targetId, name: $("#character-name").value, analysis: editedAnalysis() })
      : api.select(selected.id));
  api.setDirty(false);
  await showEntry(catalog.items.find(item => item.id === (mode === "edit" ? targetId : catalog.selected)));
  characters.forEach(character => character.react("hop"));
  reactionTimer = setTimeout(() => characters.forEach(character => character.react(null)), 800);
  status(mode === "edit" ? "修改已保存。" : mode === "import" ? "新角色已添加并开始使用。" : "已切换角色。");
}));
$("#cancel").addEventListener("click", () => operation(async () => {
  const targetId = draft?.mode === "edit" ? draft.id : catalog.selected;
  api.setDirty(false);
  await showEntry(catalog.items.find(item => item.id === targetId));
  status("未保存的修改已放弃。");
}));
$("#edit").addEventListener("click", () => operation(async () => {
  if (!selected || selected.builtin || !previewEntry?.analysis) return;
  draft = { mode: "edit", id: selected.id, svg: previewEntry.svg, name: selected.name, analysis: previewEntry.analysis, blocked: false };
  $("#name").textContent = `编辑 ${selected.name}`;
  $("#selection-status").textContent = selected.id === catalog.selected ? "正在编辑当前角色" : `正在编辑 · 当前角色：${catalog.items.find(entry => entry.id === catalog.selected)?.name}`;
  $("#character-name").value = selected.name;
  $("#draft-fields").hidden = false;
  renderAnalysis(previewEntry.analysis);
  api.setDirty(true); renderCatalog();
  status("改完后点“保存修改”。");
}));
$("#remove").addEventListener("click", () => operation(async () => {
  if (!confirm(`删除“${selected.name}”？不会删除原图。正在使用时会换回呼噜呼噜。`)) return;
  catalog = await request(api.remove(selected.id));
  await showEntry(catalog.items.find(item => item.id === catalog.selected)); status("角色已删除，原图还在。");
}));
$("#motions").addEventListener("click", event => {
  const button = event.target.closest("button"); if (!button || busy) return;
  if (button.id === "pause") { paused = !paused; characters.forEach(character => character.setActive(!paused)); button.textContent = paused ? "继续预览" : "暂停预览"; button.setAttribute("aria-pressed", String(paused)); $("#motion-status").textContent = paused ? "动作预览已暂停。" : "动作预览已继续。"; return; }
  clearTimeout(reactionTimer); paused = false; $("#pause").textContent = "暂停预览"; $("#pause").setAttribute("aria-pressed", "false");
  characters.forEach(character => { character.setActive(true); character.reset(); if (button.dataset.gait) character.motion({ gait: button.dataset.gait }); if (button.dataset.reaction) character.react(button.dataset.reaction); });
  if (button.dataset.gait) previewGait = button.dataset.gait;
  document.querySelectorAll("[data-gait]").forEach(item => item.setAttribute("aria-pressed", String(item.dataset.gait === (button.dataset.gait || "idle"))));
  if (button.dataset.reaction) reactionTimer = setTimeout(() => characters.forEach(character => character.react(null)), Number(button.dataset.duration) || 800);
  $("#motion-status").textContent = "预览：" + button.textContent + "。系统开启“减少动态效果”时，装饰动作会停用。";
});
$("#add-part").addEventListener("click", () => $("#parts-list").append(partRow()));
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
