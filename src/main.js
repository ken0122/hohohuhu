import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { app, BrowserWindow, globalShortcut, ipcMain, Menu, nativeImage, Notification, powerMonitor, screen, Tray } from "electron";
import { clamp, controlVelocity, fitPet, MODES, nextDodgeVelocity, petShouldShow } from "./core.js";
import { askClaude } from "./chat.js";

const dirname = path.dirname(fileURLToPath(import.meta.url));
const PET_SIZE = 144;
const CHAT_SIZE = { width: 368, height: 300 };
const HIDE_SHORTCUT = process.env.BLUEPET_HIDE_SHORTCUT || "Control+Alt+B";
const CHAT_SHORTCUT = process.env.BLUEPET_CHAT_SHORTCUT || "Control+Alt+Space";
const requestedMode = process.argv.find(arg => arg.startsWith("--mode="))?.split("=")[1];
const initialMode = Object.values(MODES).includes(requestedMode) ? requestedMode : MODES.DODGE;
const state = { mode: initialMode, manualHidden: false, chatOpen: false, controlActive: false };
let petWindow, gameWindow, tray, trayMenu, loop;
let petReady = false, quitting = false, menuOpen = false;
let position = { x: 80, y: 160 }, velocity = { x: 48, y: 25 };
let lastTick = performance.now(), lastRecovery = 0;
const keys = new Set();
const webPreferences = { preload: path.join(dirname, "preload.cjs"), contextIsolation: true,
  sandbox: true, nodeIntegration: false, backgroundThrottling: false };

function send(channel, payload) {
  if (petReady && petWindow && !petWindow.isDestroyed()) petWindow.webContents.send(channel, payload);
}
function currentDisplay() {
  return screen.getDisplayNearestPoint({ x: Math.round(position.x + PET_SIZE / 2), y: Math.round(position.y + PET_SIZE / 2) });
}
function cursorDisplay() { return screen.getDisplayNearestPoint(screen.getCursorScreenPoint()); }
function pinPet(display = cursorDisplay()) {
  const b = display.workArea;
  position = fitPet({ x: b.x + b.width - PET_SIZE - 28, y: b.y + b.height - PET_SIZE - 24 }, b, PET_SIZE);
}
function stopControl() {
  keys.clear(); state.controlActive = false;
  send("pet:motion", { x: 0, y: 0, gait: "idle" });
}
function normalFrame() {
  position = fitPet(position, currentDisplay().workArea, PET_SIZE);
  return { x: Math.round(position.x), y: Math.round(position.y), width: PET_SIZE, height: PET_SIZE };
}
function petFrame() {
  const frame = normalFrame();
  if (!state.chatOpen) return frame;
  const b = currentDisplay().workArea;
  return { x: Math.round(clamp(position.x - (CHAT_SIZE.width - PET_SIZE) / 2, b.x, b.x + b.width - CHAT_SIZE.width)),
    y: Math.round(clamp(position.y - (CHAT_SIZE.height - PET_SIZE), b.y, b.y + b.height - CHAT_SIZE.height)), ...CHAT_SIZE };
}
function raiseWindow(win) {
  win.setAlwaysOnTop(true, "screen-saver");
  win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true, skipTransformProcessType: true });
}

// One authority for native visibility, frame, focusability and renderer state.
function syncPet({ focus = false } = {}) {
  if (!petReady || !petWindow || petWindow.isDestroyed()) return;
  raiseWindow(petWindow);
  const focusable = state.chatOpen || state.mode === MODES.CONTROL || state.mode === MODES.PET;
  petWindow.setFocusable(focusable);
  petWindow.setBounds(petFrame(), false);
  petWindow.setOpacity(1);
  petWindow.setIgnoreMouseEvents(state.mode === MODES.DODGE && !state.chatOpen, { forward: true });
  const visible = petShouldShow(state);
  send("pet:state", { ...state, visible });
  if (visible) {
    if (petWindow.isMinimized()) petWindow.restore();
    petWindow.showInactive();
    if (focus && focusable) {
      app.focus({ steal: true }); petWindow.show(); petWindow.focus();
      state.controlActive = state.mode === MODES.CONTROL && !state.chatOpen;
    }
  } else petWindow.hide();
}
export function restorePetFrame() {
  state.chatOpen = false; stopControl();
  syncPet({ focus: state.mode === MODES.CONTROL && !state.manualHidden });
}
export function showChat() {
  if (state.mode === MODES.PACMAN) setMode(MODES.PET);
  stopControl(); state.manualHidden = false; state.chatOpen = true;
  syncPet({ focus: true }); rebuildTrayMenu();
}
export function toggleHidden() {
  // Unexpectedly hidden windows recover on the first press.
  const target = state.mode === MODES.PACMAN ? gameWindow : petWindow;
  const currentlyVisible = !state.manualHidden && target?.isVisible();
  state.manualHidden = Boolean(currentlyVisible);
  stopControl();
  if (!state.manualHidden) {
    position = fitPet(position, cursorDisplay().workArea, PET_SIZE);
    recoverWindows({ focus: true });
  } else { syncPet(); gameWindow?.hide(); }
  rebuildTrayMenu();
}
function closeGame() {
  if (!gameWindow) return;
  const win = gameWindow; gameWindow = undefined;
  win.removeAllListeners("closed"); win.close();
}
function createGameWindow() {
  const win = new BrowserWindow({ ...cursorDisplay().bounds, frame: false, transparent: true, resizable: false,
    movable: false, fullscreenable: false, alwaysOnTop: true, skipTaskbar: true, show: false, hasShadow: false, webPreferences });
  gameWindow = win; raiseWindow(win);
  win.webContents.on("before-input-event", (event, input) => {
    if (input.type === "keyDown" && input.key === "Escape") { event.preventDefault(); setMode(MODES.PET); }
  });
  win.once("ready-to-show", () => {
    if (gameWindow === win && state.mode === MODES.PACMAN && !state.manualHidden) {
      win.show(); app.focus({ steal: true }); win.focus();
    }
  });
  win.on("closed", () => {
    if (gameWindow === win) { gameWindow = undefined; if (!quitting) setMode(MODES.PET); }
  });
  win.webContents.on("render-process-gone", () => {
    if (!quitting && gameWindow === win) { closeGame(); if (state.mode === MODES.PACMAN) createGameWindow(); }
  });
  win.loadFile(path.join(dirname, "renderer/game.html"));
}
export function setMode(nextMode) {
  if (!Object.values(MODES).includes(nextMode)) return;
  closeGame(); stopControl();
  state.mode = nextMode; state.chatOpen = false;
  state.manualHidden = false; // Choosing a specific mode is an explicit reveal.
  if (nextMode === MODES.PET) pinPet();
  else position = fitPet(position, cursorDisplay().workArea, PET_SIZE);
  syncPet({ focus: nextMode === MODES.CONTROL });
  if (nextMode === MODES.PACMAN) createGameWindow();
  rebuildTrayMenu();
}
export function recoverWindows({ focus = false } = {}) {
  if (quitting) return;
  position = fitPet(position, currentDisplay().workArea, PET_SIZE);
  if (!petWindow || petWindow.isDestroyed()) createPetWindow();
  else syncPet({ focus });
  if (state.mode === MODES.PACMAN && !state.manualHidden) {
    if (!gameWindow || gameWindow.isDestroyed()) createGameWindow();
    else {
      raiseWindow(gameWindow); gameWindow.setBounds(cursorDisplay().bounds); gameWindow.showInactive();
      if (focus) { app.focus({ steal: true }); gameWindow.show(); gameWindow.focus(); }
    }
  }
}
function tick() {
  const now = performance.now(), dt = Math.min(.06, (now - lastTick) / 1000); lastTick = now;
  if (!petReady || menuOpen || state.manualHidden || state.mode === MODES.PACMAN) return;
  if (now - lastRecovery > 1500) {
    lastRecovery = now;
    if (petShouldShow(state) && !petWindow.isVisible()) syncPet();
  }
  if (state.chatOpen) return;
  const cursor = screen.getCursorScreenPoint();
  if (state.mode === MODES.PET) {
    const x = cursor.x - position.x - PET_SIZE / 2, y = cursor.y - position.y - PET_SIZE + 60;
    send("pet:proximity", { near: Math.hypot(x, y) < 110, x, y }); return;
  }
  if (state.mode === MODES.DODGE) {
    velocity = nextDodgeVelocity({ petCenter: { x: position.x + PET_SIZE / 2, y: position.y + PET_SIZE / 2 }, cursor, velocity, dt, bounds: currentDisplay().workArea });
  } else velocity = state.controlActive ? controlVelocity(keys) : { x: 0, y: 0 };
  position = fitPet({ x: position.x + velocity.x * dt, y: position.y + velocity.y * dt }, currentDisplay().workArea, PET_SIZE);
  petWindow.setPosition(Math.round(position.x), Math.round(position.y), false);
  send("pet:motion", { ...velocity, gait: Math.hypot(velocity.x, velocity.y) > 0 ? (state.mode === MODES.CONTROL ? "run" : "walk") : "idle" });
}
function controlInput(event, input) {
  if (state.mode !== MODES.CONTROL || state.chatOpen || state.manualHidden) return;
  if (input.type === "keyDown" && input.key === "Escape") { event.preventDefault(); setMode(MODES.PET); return; }
  if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(input.key)) return;
  // Let Chromium receive keydown: cancelling it here can suppress the matching
  // native keyup on macOS. The renderer suppresses only scrolling/default actions.
  if (input.type === "keyDown") { keys.add(input.key); state.controlActive = true; }
  if (input.type === "keyUp") keys.delete(input.key);
}
function createPetWindow() {
  petReady = false;
  const win = new BrowserWindow({ ...normalFrame(), frame: false, transparent: true, resizable: false,
    alwaysOnTop: true, skipTaskbar: true, show: false, focusable: false, acceptFirstMouse: true, hasShadow: false, webPreferences });
  petWindow = win; raiseWindow(win);
  win.webContents.on("before-input-event", controlInput);
  win.on("blur", stopControl);
  win.on("focus", () => { state.controlActive = state.mode === MODES.CONTROL && !state.chatOpen; });
  win.webContents.on("did-finish-load", () => {
    petReady = true; syncPet({ focus: state.chatOpen || state.mode === MODES.CONTROL });
  });
  win.webContents.on("render-process-gone", () => { if (!quitting) { petReady = false; win.reload(); } });
  win.on("closed", () => {
    if (petWindow === win) { petWindow = undefined; petReady = false; if (!quitting) createPetWindow(); }
  });
  win.loadFile(path.join(dirname, "renderer/pet.html"));
}
function rebuildTrayMenu() {
  if (!tray || quitting) return;
  trayMenu = Menu.buildFromTemplate([
    ...[[MODES.DODGE, "Dodge · 自由让路"], [MODES.PET, "Pet · 固定陪伴"], [MODES.CONTROL, "Control · 方向键控制"], [MODES.PACMAN, "Pac-Man · 吃颗豆豆"]]
      .map(([value, label]) => ({ id: value, label, type: "radio", checked: state.mode === value, click: () => setMode(value) })),
    { type: "separator" },
    { id: "chat", label: "和它说句话", accelerator: CHAT_SHORTCUT, registerAccelerator: false, click: showChat },
    { id: "hide", label: state.manualHidden ? "让它回来" : "老板来了，藏好", accelerator: HIDE_SHORTCUT, registerAccelerator: false, click: toggleHidden },
    { id: "recover", label: "找回宠物到当前屏幕", click: () => { state.manualHidden = false; pinPet(); recoverWindows({ focus: true }); rebuildTrayMenu(); } },
    { type: "separator" },
    { label: "登录时自动启动", type: "checkbox", checked: app.getLoginItemSettings().openAtLogin, enabled: app.isPackaged,
      click: item => app.setLoginItemSettings({ openAtLogin: item.checked }) },
    { label: "退出 Blue One-Eye Pet", role: "quit" },
  ]);
  trayMenu.on("menu-will-show", () => { menuOpen = true; keys.clear(); });
  trayMenu.on("menu-will-close", () => {
    menuOpen = false;
  });
  tray.setContextMenu(trayMenu);
  tray.setToolTip("Blue One-Eye Pet · " + state.mode);
  // No tray click callback: opening the menu never reveals or activates the pet.
}
function registerShortcut(accelerator, handler, label) {
  let registered = false;
  try { registered = globalShortcut.register(accelerator, handler); } catch { /* invalid custom accelerator */ }
  if (!registered) {
    console.error(label + "快捷键注册失败：" + accelerator);
    if (Notification.isSupported()) new Notification({ title: "Blue One-Eye Pet 快捷键不可用", body: label + "快捷键无效或已被占用，请使用菜单或修改环境变量。" }).show();
  }
}
const mascotSource = readFileSync(path.join(dirname, "../assets/blue-one-eye-mascot.svg"), "utf8");
ipcMain.handle("mascot:source", event => {
  if (event.sender !== petWindow?.webContents && event.sender !== gameWindow?.webContents) throw new Error("Invalid sender");
  return mascotSource;
});
ipcMain.on("pet:ready", event => { if (fromPet(event)) { petReady = true; syncPet(); } });
function fromPet(event) { return event.sender === petWindow?.webContents && event.senderFrame === petWindow.webContents.mainFrame; }
ipcMain.handle("chat:send", (event, prompt) => { if (!fromPet(event)) throw new Error("Invalid sender"); return askClaude(prompt); });
ipcMain.on("chat:dismiss", event => { if (fromPet(event)) restorePetFrame(); });
ipcMain.on("control:focus", event => { if (fromPet(event) && state.mode === MODES.CONTROL) syncPet({ focus: true }); });
ipcMain.on("game:exit", event => { if (event.sender === gameWindow?.webContents) setMode(MODES.PET); });

const hasLock = app.requestSingleInstanceLock();
if (!hasLock) app.quit();
app.on("second-instance", (_event, argv) => {
  const next = argv.find(arg => arg.startsWith("--mode="))?.split("=")[1];
  if (Object.values(MODES).includes(next)) setMode(next);
  else { state.manualHidden = false; recoverWindows({ focus: state.chatOpen }); rebuildTrayMenu(); }
});
export const ready = app.whenReady().then(() => {
  if (!hasLock) return;
  if (process.platform === "darwin") app.dock.hide();
  Menu.setApplicationMenu(null);
  pinPet(); createPetWindow();
  const trayImage = nativeImage.createFromPath(path.join(dirname, "../assets/tray.png"));
  // The requested fixed white silhouette must not be recolored by macOS.
  trayImage.setTemplateImage(false);
  tray = new Tray(trayImage);
  if (trayImage.isEmpty() && process.platform === "darwin") tray.setTitle("宠");
  rebuildTrayMenu();
  registerShortcut(HIDE_SHORTCUT, toggleHidden, "快速隐藏");
  registerShortcut(CHAT_SHORTCUT, showChat, "聊天");
  loop = setInterval(tick, 32);
  if (initialMode === MODES.PACMAN) createGameWindow();
  for (const event of ["display-added", "display-removed", "display-metrics-changed"]) screen.on(event, () => recoverWindows());
  for (const event of ["resume", "unlock-screen"]) powerMonitor.on(event, () => { recoverWindows(); });
  app.on("activate", () => recoverWindows());
});
function prepareQuit() { quitting = true; clearInterval(loop); }
app.on("before-quit", prepareQuit);
app.on("will-quit", () => globalShortcut.unregisterAll());
app.on("window-all-closed", () => {});

// Test code runs in the main process; this API is not exposed to renderers or a port.
export function getRuntime() { return { state: { ...state }, position: { ...position }, petWindow, gameWindow, tray, trayMenu, menuOpen }; }
export function shutdown(code = 0) { prepareQuit(); globalShortcut.unregisterAll(); app.exit(code); }
process.once("SIGTERM", () => shutdown());
process.once("SIGINT", () => shutdown());
