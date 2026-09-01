import { BrowserWindow, dialog, ipcMain } from "electron";
import { open, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { BLUE_ONE_EYE, BLACK_CAT, SUNNY_YELLOW } from "./characters.js";
import { inspectCharacterImage, MAX_IMAGE_BYTES } from "./character-import.js";
import { createCharacterStore } from "./character-store.js";
import { brand, t } from "./i18n.js";

const dirname = path.dirname(fileURLToPath(import.meta.url));
export async function createCharacterLibrary({ directory, onChange, onOpen, bindEditingShortcuts, analyzeImage, locale = () => "zh-CN", backgroundColor = () => "#fbfcff", shouldForceClose = () => false }) {
  const store = await createCharacterStore(directory);
  const sources = new Map(await Promise.all([BLUE_ONE_EYE, BLACK_CAT, SUNNY_YELLOW].map(async definition => [
    definition.id, await readFile(path.join(dirname, "../assets", definition.asset), "utf8"),
  ])));
  let window, choosing = false, dirty = false, closingPrompt = false, forceClose = false;
  const fromLibrary = event => window && !window.isDestroyed() && event.sender === window.webContents && event.senderFrame === window.webContents.mainFrame;
  function source(id) {
    const entry = store.source(id);
    return { ...entry, svg: entry.builtin ? sources.get(entry.id) : entry.svg };
  }
  async function chooseImage() {
    if (choosing) throw new Error("正在选择图片，请稍候。");
    choosing = true;
    const owner = window;
    try {
      const rights = await dialog.showMessageBox(owner, {
        type: "warning",
        title: t(locale(), "imageRightsTitle"),
        message: t(locale(), "imageRightsMessage"),
        detail: t(locale(), "imageRightsDetail"),
        buttons: [t(locale(), "imageRightsConfirm"), t(locale(), "cancel")],
        defaultId: 1,
        cancelId: 1,
      });
      if (rights.response !== 0 || owner.isDestroyed()) return null;
      const result = await dialog.showOpenDialog(owner, {
        title: t(locale(), "chooseImageTitle"),
        message: t(locale(), "chooseImageMessage"),
        buttonLabel: t(locale(), "chooseImageButton"),
        properties: ["openFile"],
        filters: [{ name: "PNG / JPG", extensions: ["png", "jpg", "jpeg"] }],
      });
      if (result.canceled || !result.filePaths[0] || owner.isDestroyed()) return null;
      const handle = await open(result.filePaths[0], "r");
      let bytes;
      try {
        const stat = await handle.stat();
        if (!stat.isFile() || stat.size > MAX_IMAGE_BYTES) throw new Error("请选择不超过 10 MB 的图片文件。");
        const buffer = Buffer.alloc(MAX_IMAGE_BYTES + 1);
        const { bytesRead } = await handle.read(buffer, 0, buffer.length, 0);
        bytes = buffer.subarray(0, bytesRead);
      } finally { await handle.close(); }
      const info = inspectCharacterImage(bytes);
      return { ...info, bytes: new Uint8Array(bytes), name: path.basename(result.filePaths[0]).replace(/\.[^.]+$/, "").replace(/[\x00-\x1f\x7f]/g, "").slice(0, 40) || "我的角色" };
    } finally { choosing = false; }
  }
  const handlers = {
    list: () => store.catalog(), source,
    choose: chooseImage,
    analyze: value => analyzeImage(value),
    async select(id) { const value = await store.select(id); onChange(); return value; },
    async import(value) { const result = await store.import(value); onChange(); return result; },
    async update(value) { const result = await store.update(value?.id, value); onChange(); return result; },
    async remove(id) { const result = await store.remove(id); onChange(); return result; },
  };
  for (const [name, handle] of Object.entries(handlers)) ipcMain.handle("characters:" + name, async (event, value) => {
    if (!fromLibrary(event)) return { ok: false, error: "无效的角色库窗口。" };
    try { return { ok: true, value: await handle(value) }; }
    catch (error) { return { ok: false, error: error.code ? "无法读取图片，请确认文件可用后重试。" : error.message }; }
  });
  ipcMain.on("characters:close", event => { if (fromLibrary(event)) window.close(); });
  ipcMain.on("characters:dirty", (event, value) => { if (fromLibrary(event)) dirty = value === true; });
  return {
    source,
    async cycle() {
      const catalog = store.catalog();
      const index = catalog.items.findIndex(item => item.id === catalog.selected);
      const next = catalog.items[(index + 1) % catalog.items.length];
      const value = await store.select(next.id);
      onChange();
      return value;
    },
    get window() { return window; },
    show() {
      onOpen();
      if (window && !window.isDestroyed()) { window.show(); window.focus(); return; }
      const win = window = new BrowserWindow({
        title: t(locale(), "libraryTitle", { brand: brand(locale()) }), width: 820, height: 800, minWidth: 720, minHeight: 620,
        backgroundColor: backgroundColor(), show: false,
        webPreferences: { preload: path.join(dirname, "character-preload.cjs"), sandbox: true, contextIsolation: true, nodeIntegration: false },
      });
      bindEditingShortcuts(win);
      win.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
      win.webContents.on("will-navigate", event => event.preventDefault());
      win.once("ready-to-show", () => { win.show(); win.focus(); });
      win.on("close", event => {
        if (!dirty || forceClose || shouldForceClose()) return;
        event.preventDefault();
        if (closingPrompt) return;
        closingPrompt = true;
        dialog.showMessageBox(win, {
          type: "warning", title: t(locale(), "discardTitle"), message: t(locale(), "discardMessage"),
          detail: t(locale(), "discardDetail"),
          buttons: [t(locale(), "keepEditing"), t(locale(), "discardClose")], defaultId: 0, cancelId: 0,
        }).then(({ response }) => {
          closingPrompt = false;
          if (response === 1 && !win.isDestroyed()) { forceClose = true; win.close(); }
        });
      });
      win.once("closed", () => {
        if (window === win) window = undefined;
        dirty = false; closingPrompt = false; forceClose = false;
      });
      win.loadFile(path.join(dirname, "renderer/character-library.html"));
    },
  };
}
