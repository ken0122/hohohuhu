import { app, BrowserWindow } from "electron";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";

// Separate development preview, not the pet application: no tray, shortcuts,
// provider config, preload or changes to the running pet's mode/visibility.
const root = new URL("../", import.meta.url);
const work = new URL("work/", root);
await mkdir(work, { recursive: true });
app.setPath("userData", await mkdtemp(fileURLToPath(new URL("character-preview-", work))));
const verify = process.argv.includes("--verify");
const keepOpen = process.argv.includes("--keep-open");
// Retain the native window after the async ready callback returns. Interactive
// previews must not depend on the verifier's long-lived local variables.
let previewWindow;
app.setName("黑猫动作预览");
app.whenReady().then(async () => {
  const win = previewWindow = new BrowserWindow({
    width: 880, height: 860, title: "黑猫 · SVG 转换预览", backgroundColor: "#f7f8fc",
    show: false,
    webPreferences: { contextIsolation: true, sandbox: true, nodeIntegration: false },
  });
  win.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  win.webContents.on("will-navigate", event => event.preventDefault());
  win.on("closed", () => { previewWindow = undefined; });
  function showPreview() {
    if (win.isMinimized()) win.restore();
    win.show();
    app.focus({ steal: true });
    win.focus();
    console.log("READY 黑猫动作预览已加载并显示；窗口保持打开，关闭窗口即可退出。");
  }
  try {
    await win.loadFile(fileURLToPath(new URL("src/renderer/character-preview.html", root)));
    const js = code => win.webContents.executeJavaScript(code).catch(error => { throw new Error(code.slice(0, 100) + ": " + error.message); });
    const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
    async function until(fn) {
      const deadline = Date.now() + 5000;
      while (!await fn()) {
        if (Date.now() >= deadline) throw new Error("预览未达到预期状态");
        await wait(30);
      }
    }
    await until(() => js("document.body.dataset.ready === 'true' || document.body.dataset.error === 'true'"));
    if (await js("document.body.dataset.error === 'true'")) throw new Error(await js("document.querySelector('#status').textContent"));
    if (!verify) { showPreview(); return; }
    win.show();
    await until(() => js("document.body.dataset.ready === 'true'"));
    assert.deepEqual(await js("Array.from(document.querySelectorAll('.character-host'),h=>h.getBoundingClientRect().width)"), [176, 84, 64]);
    assert.equal(await js("document.querySelectorAll('.mascot-svg').length"), 3);
    const sourcePaths = await js("Array.from(document.querySelectorAll('.mascot-svg path'),p=>p.getAttribute('d'))");
    win.webContents.debugger.attach("1.3");
    const media = value => win.webContents.debugger.sendCommand("Emulation.setEmulatedMedia", { features: [{ name: "prefers-reduced-motion", value }] });
    await media("no-preference");
    await js("document.querySelector('button[data-gait=walk]').click()");
    await until(() => js("Array.from(document.querySelectorAll('.mascot-svg')).every(s=>s.getAnimations({subtree:true}).length>0)"));
    await until(() => js("getComputedStyle(document.querySelector('#desktop .character-gait-outline')).d !== 'path(\"' + document.querySelector('#desktop .character-gait-outline').getAttribute('d') + '\")'"));
    await js("document.querySelector('button[data-gait=run]').click()");
    await until(() => js("Array.from(document.querySelectorAll('.character-gait-outline')).every(p=>p.getAnimations()[0]?.effect.getTiming().duration===220)"));
    await js("Array.from(document.querySelectorAll('.mascot-svg')).forEach(s=>s.getAnimations({subtree:true}).forEach(a=>{a.pause();a.currentTime=a.effect.getTiming().duration/4}))");
    await js("new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))");
    await writeFile(new URL("black-cat-gait-preview.png", work), (await win.webContents.capturePage()).toPNG());
    await js("document.querySelector('#pause').click()");
    assert.equal(await js("document.querySelector('#desktop svg').getAnimations({subtree:true}).length"), 0);
    await js("document.querySelector('#resume').click()");
    await until(() => js("document.querySelector('#desktop svg').getAnimations({subtree:true}).length > 0"));
    await media("reduce");
    await until(() => js("document.querySelector('#desktop svg').getAnimations({subtree:true}).length === 0"));
    await media("no-preference");
    await until(() => js("!matchMedia('(prefers-reduced-motion: reduce)').matches"));
    await js("document.querySelector('button[data-reaction=hop]').click()");
    assert.equal(await js("getComputedStyle(document.querySelector('#desktop .character-root')).animationName"), "happy-hop");
    await js("document.querySelector('button[data-gait=idle]').click()");
    assert.deepEqual(await js("Array.from(document.querySelectorAll('.mascot-svg path'),p=>p.getAttribute('d'))"), sourcePaths);
    await js("new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))");
    const png = (await win.webContents.capturePage()).toPNG();
    await writeFile(new URL("black-cat-preview.png", work), png);
    console.log("PASS black-cat preview: source paths, 84/64px, gait, reaction, pause/resume and live reduced motion");
    win.webContents.debugger.detach();
    if (keepOpen) {
      // Reset verification-only media overrides before handing control over.
      showPreview();
      assert.equal(win.isVisible(), true);
    } else app.quit();
  } catch (error) {
    console.error(error.message);
    app.exit(1);
  }
});
app.on("activate", () => {
  if (!previewWindow || previewWindow.isDestroyed()) return;
  if (previewWindow.isMinimized()) previewWindow.restore();
  previewWindow.show(); previewWindow.focus();
});
app.on("window-all-closed", () => app.quit());
