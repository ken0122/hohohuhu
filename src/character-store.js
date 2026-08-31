import { mkdir, open, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { BLUE_ONE_EYE, BLACK_CAT, SUNNY_YELLOW } from "./characters.js";
import { validateGeneratedSvg } from "./character-import.js";
import { validateCharacterAnalysis } from "./character-analysis.js";
import { BASIC_PROFILE, profileFromAnalysis } from "./character-profile.js";

export const BUILTIN_CHARACTERS = Object.freeze([
  { id: BLUE_ONE_EYE.id, name: "呼噜呼噜", builtin: true },
  { id: BLACK_CAT.id, name: "黑猫", builtin: true },
  { id: SUNNY_YELLOW.id, name: "小太阳", builtin: true },
]);
const isBuiltin = id => BUILTIN_CHARACTERS.some(item => item.id === id);
const validId = id => typeof id === "string" && /^local-[0-9a-f-]{36}$/.test(id);
function nameOf(value) {
  if (typeof value !== "string" || !value.trim() || value.length > 40 || /[\x00-\x1f\x7f]/.test(value))
    throw new Error("请填写 1–40 个字符的角色名称。");
  return value.trim();
}

// One bounded, atomically replaced local manifest. No filenames come from IPC.
export async function createCharacterStore(directory) {
  const file = path.join(directory, "characters-v2.json"), legacyFile = path.join(directory, "characters-v1.json");
  let data = { version: 2, selected: BLUE_ONE_EYE.id, items: [] }, warning = "", writable = true;
  let sourceFile = file;
  try {
    let handle;
    try { handle = await open(file, "r"); }
    catch (error) {
      if (error.code !== "ENOENT") throw error;
      sourceFile = legacyFile;
      handle = await open(legacyFile, "r");
    }
    let contents;
    try {
      const buffer = Buffer.alloc(16 * 1024 * 1024 + 1);
      const { bytesRead } = await handle.read(buffer, 0, buffer.length, 0);
      if (bytesRead === buffer.length) throw new Error("too large");
      contents = buffer.subarray(0, bytesRead).toString("utf8");
    } finally { await handle.close(); }
    const parsed = JSON.parse(contents);
    if (![1, 2].includes(parsed.version) || !Array.isArray(parsed.items) || parsed.items.length > 20) throw new Error("schema");
    const ids = new Set();
    for (const item of parsed.items) {
      if (!validId(item.id) || ids.has(item.id)) throw new Error("id");
      ids.add(item.id); nameOf(item.name); validateGeneratedSvg(item.svg);
      if (parsed.version === 2) {
        validateCharacterAnalysis(item.analysis);
      }
    }
    if (!isBuiltin(parsed.selected) && !ids.has(parsed.selected)) throw new Error("selection");
    data = {
      version: 2,
      selected: parsed.selected,
      items: parsed.items.map(({id,name,svg,analysis}) => {
        const normalizedAnalysis = validateCharacterAnalysis(parsed.version === 2 ? analysis : {
          version: 1,
          quality: Object.freeze({ decision: "warn", issues: Object.freeze(["unclear-parts"]), explanation: "旧版角色没有部件分析，请重新导入以补充。" }),
          persona: BASIC_PROFILE.persona,
          parts: Object.freeze([{ kind: "body", confidence: 1, box: Object.freeze([0, 0, 1, 1]) }]),
        });
        return { id, name, svg, profile: profileFromAnalysis(normalizedAnalysis), analysis: normalizedAnalysis };
      }),
    };
  } catch (error) {
    if (error.code !== "ENOENT") {
      warning = `本地角色库无法读取，已临时使用呼噜呼噜。原文件未覆盖；请备份并移走 ${path.basename(sourceFile)} 后重启。`;
      writable = false;
    }
  }
  let queue = Promise.resolve();
  function mutate(change) {
    const task = queue.then(async () => {
      if (!writable) throw new Error(warning);
      const next = change(data);
      try {
        await mkdir(directory, { recursive: true });
        const persisted = { ...next, items: next.items.map(({ id, name, svg, analysis }) => ({ id, name, svg, analysis })) };
        await writeFile(file + ".tmp", JSON.stringify(persisted), { mode: 0o600 });
        await rename(file + ".tmp", file);
      } catch { throw new Error("角色保存失败，请检查应用数据目录权限后重试。"); }
      data = next;
      return catalog();
    });
    queue = task.catch(() => {});
    return task;
  }
  function catalog() {
    return { selected: data.selected, warning, items: [...BUILTIN_CHARACTERS, ...data.items.map(({id,name}) => ({id,name,builtin:false}))] };
  }
  return {
    catalog,
    source(id = data.selected) {
      if (isBuiltin(id)) return { id, builtin: true };
      const item = data.items.find(item => item.id === id);
      if (!item) throw new Error("找不到这个角色，请重新选择。");
      return { id: item.id, svg: item.svg, profile: item.profile, analysis: item.analysis, builtin: false };
    },
    select(id) { return mutate(current => {
      if (!isBuiltin(id) && !current.items.some(item => item.id === id)) throw new Error("找不到这个角色。");
      return { ...current, selected: id };
    }); },
    import(value) { return mutate(current => {
      if (current.items.length >= 20) throw new Error("本地角色最多 20 个，请先移除不需要的角色。");
      const analysis = validateCharacterAnalysis(value?.analysis);
      const item = {
        id: "local-" + randomUUID(),
        name: nameOf(value?.name),
        svg: validateGeneratedSvg(value?.svg),
        profile: profileFromAnalysis(analysis),
        analysis,
      };
      return { ...current, selected: item.id, items: [...current.items, item] };
    }); },
    update(id, value) { return mutate(current => {
      if (!validId(id) || !current.items.some(item => item.id === id)) throw new Error("只能编辑自己添加的角色。");
      const analysis = validateCharacterAnalysis(value?.analysis);
      const items = current.items.map(item => item.id === id ? {
        ...item,
        name: nameOf(value?.name),
        profile: profileFromAnalysis(analysis),
        analysis,
      } : item);
      return { ...current, items };
    }); },
    remove(id) { return mutate(current => {
      if (!validId(id) || !current.items.some(item => item.id === id)) throw new Error("只能移除本地导入的角色。");
      return { ...current, selected: current.selected === id ? BLUE_ONE_EYE.id : current.selected, items: current.items.filter(item => item.id !== id) };
    }); },
  };
}
