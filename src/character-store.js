import { mkdir, open, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { BLUE_ONE_EYE, BLACK_CAT } from "./characters.js";
import { validateGeneratedSvg } from "./character-import.js";

export const BUILTIN_CHARACTERS = Object.freeze([
  { id: BLUE_ONE_EYE.id, name: "呼噜呼噜", builtin: true },
  { id: BLACK_CAT.id, name: "黑猫", builtin: true },
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
  const file = path.join(directory, "characters-v1.json");
  let data = { version: 1, selected: BLUE_ONE_EYE.id, items: [] }, warning = "", writable = true;
  try {
    const handle = await open(file, "r");
    let contents;
    try {
      const buffer = Buffer.alloc(11 * 1024 * 1024 + 1);
      const { bytesRead } = await handle.read(buffer, 0, buffer.length, 0);
      if (bytesRead === buffer.length) throw new Error("too large");
      contents = buffer.subarray(0, bytesRead).toString("utf8");
    } finally { await handle.close(); }
    const parsed = JSON.parse(contents);
    if (parsed.version !== 1 || !Array.isArray(parsed.items) || parsed.items.length > 20) throw new Error("schema");
    const ids = new Set();
    for (const item of parsed.items) {
      if (!validId(item.id) || ids.has(item.id)) throw new Error("id");
      ids.add(item.id); nameOf(item.name); validateGeneratedSvg(item.svg);
    }
    if (!isBuiltin(parsed.selected) && !ids.has(parsed.selected)) throw new Error("selection");
    data = { version: 1, selected: parsed.selected, items: parsed.items.map(({id,name,svg}) => ({id,name,svg})) };
  } catch (error) {
    if (error.code !== "ENOENT") {
      warning = "本地角色库无法读取，已临时使用呼噜呼噜。原文件未覆盖；请备份并移走 characters-v1.json 后重启。";
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
        await writeFile(file + ".tmp", JSON.stringify(next), { mode: 0o600 });
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
      return { id: item.id, svg: item.svg, builtin: false };
    },
    select(id) { return mutate(current => {
      if (!isBuiltin(id) && !current.items.some(item => item.id === id)) throw new Error("找不到这个角色。");
      return { ...current, selected: id };
    }); },
    import(value) { return mutate(current => {
      if (current.items.length >= 20) throw new Error("本地角色最多 20 个，请先移除不需要的角色。");
      const item = { id: "local-" + randomUUID(), name: nameOf(value?.name), svg: validateGeneratedSvg(value?.svg) };
      return { ...current, selected: item.id, items: [...current.items, item] };
    }); },
    remove(id) { return mutate(current => {
      if (!validId(id) || !current.items.some(item => item.id === id)) throw new Error("只能移除本地导入的角色。");
      return { ...current, selected: current.selected === id ? BLUE_ONE_EYE.id : current.selected, items: current.items.filter(item => item.id !== id) };
    }); },
  };
}
