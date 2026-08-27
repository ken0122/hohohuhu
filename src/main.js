import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { app, BrowserWindow, globalShortcut, ipcMain, Menu, nativeImage, Notification, powerMonitor, screen, systemPreferences, Tray } from "electron";
import { clamp, controlVelocity, fitPet, MODES, petShouldShow, normalizeMode, nextMode, PET_FRAME_SIZE, PET_SPRITE_SIZE, validDragPoint, dragPosition } from "./core.js";
import { askClaude } from "./chat.js";
import { createDodgeMotion } from "./dodge.js";
import { arriveAt, launchVelocity } from "./mode-motion.js";

const dirname = path.dirname(fileURLToPath(import.meta.url));
const PET_SIZE = PET_FRAME_SIZE;
const CHAT_SIZE = { width: 368, height: 300 };
const HIDE_SHORTCUT = process.env.BLUEPET_HIDE_SHORTCUT || "Control+Alt+B";
const CHAT_SHORTCUT = process.env.BLUEPET_CHAT_SHORTCUT || "Control+Alt+Space";
const MODE_SHORTCUT = process.env.BLUEPET_MODE_SHORTCUT || "Control+Alt+Command+M";
const requestedMode = normalizeMode(process.argv.find(arg => arg.startsWith("--mode="))?.split("=")[1]);
const initialMode = Object.values(MODES).includes(requestedMode) ? requestedMode : MODES.DODGE;
const state = { mode: initialMode, manualHidden: false, chatOpen: false, controlActive: false };
let petWindow, gameWindow, tray, trayMenu, loop;
let petReady = false, quitting = false, menuOpen = false;
let position = { x: 80, y: 160 }, velocity = { x: 48, y: 25 };
let lastTick = performance.now(), lastProximity = 0,lastCycle=-Infinity;
let reducedMotion=false;
let nativePosition;
let dragSession;
const dodge = createDodgeMotion();
let dodgeMotion;
let modeTransition,petHome;
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
  petHome={...position};
}
function cancelModeTransition() { modeTransition=undefined;velocity={x:0,y:0}; }
function movePetWindow() {
  const x=Math.round(position.x),y=Math.round(position.y);
  if(nativePosition?.x===x&&nativePosition?.y===y)return;
  petWindow.setPosition(x,y,false);nativePosition={x,y};
}
function stopControl() {
  keys.clear(); state.controlActive = false;
  send("pet:motion", { x: 0, y: 0, gait: "idle" });
}
function endPetDrag() {
  if (!dragSession) return;
  dragSession = undefined;
  send("pet:drag-end");
}
function handlePetDrag(event, request) {
  if (!fromPet(event) || !request) return;
  if (request.phase === "end") { endPetDrag(); return; }
  if (state.mode !== MODES.PET || state.chatOpen || state.manualHidden || menuOpen || !petWindow.isVisible()) {
    endPetDrag(); send("pet:drag-end"); return;
  }
  if (!validDragPoint(request.point)) return;
  if (request.phase === "start") {
    cancelModeTransition();
    stopControl();
    dragSession = { origin: { ...position }, start: request.point };
  } else if (request.phase === "move" && dragSession) {
    const display = screen.getDisplayNearestPoint({ x: Math.round(request.point.x), y: Math.round(request.point.y) });
    position = dragPosition(dragSession.origin, dragSession.start, request.point, display.workArea);
    petHome={...position};
    movePetWindow();
  }
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
  const focusable = state.chatOpen || state.mode === MODES.PET;
  petWindow.setFocusable(focusable);
  petWindow.setBounds(petFrame(), false);
  nativePosition=undefined;
  petWindow.setOpacity(1);
  petWindow.setIgnoreMouseEvents(state.mode === MODES.DODGE && !state.chatOpen, { forward: true });
  const visible = petShouldShow(state);
  send("pet:state", { ...state, visible });
  if (visible) {
    if (petWindow.isMinimized()) petWindow.restore();
    petWindow.showInactive();
    if (focus && focusable) {
      app.focus({ steal: true }); petWindow.show(); petWindow.focus();
      state.controlActive = state.mode === MODES.PET && !state.chatOpen;
    }
  } else petWindow.hide();
}
export function restorePetFrame() {
  dodge.reset();
  endPetDrag();
  state.chatOpen = false; stopControl();
  syncPet({ focus: state.mode === MODES.PET && !state.manualHidden });
}
export function showChat() {
  cancelModeTransition();
  dodge.reset();
  endPetDrag();
  if (state.mode === MODES.PACMAN) setMode(MODES.PET);
  stopControl(); state.manualHidden = false; state.chatOpen = true;
  syncPet({ focus: true }); rebuildTrayMenu();
}
export function toggleHidden() {
  cancelModeTransition();
  dodge.reset();
  endPetDrag();
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
  nextMode = normalizeMode(nextMode);
  if (!Object.values(MODES).includes(nextMode)) return;
  const previousMode=state.mode;
  const smooth=previousMode!==nextMode&&[previousMode,nextMode].every(mode=>mode===MODES.PET||mode===MODES.DODGE)
    &&!state.manualHidden&&!state.chatOpen&&petWindow?.isVisible();
  if(previousMode===MODES.PET&&!modeTransition&&!state.chatOpen)petHome={...position};
  const momentum={...velocity};
  dodge.reset();
  endPetDrag();
  closeGame(); stopControl();
  state.mode = nextMode; state.chatOpen = false;
  state.manualHidden = false; // Choosing a specific mode is an explicit reveal.
  modeTransition=undefined;
  if(smooth&&!systemPreferences.getAnimationSettings().prefersReducedMotion) {
    velocity=momentum;
    modeTransition=nextMode===MODES.PET?{target:fitPet(petHome||position,currentDisplay().workArea)}:{remaining:.8};
  } else {
    velocity={x:0,y:0};
    if(nextMode===MODES.PET&&previousMode!==MODES.PET)position=fitPet(petHome||position,currentDisplay().workArea);
    else position=fitPet(position,currentDisplay().workArea);
  }
  syncPet({ focus: nextMode === MODES.PET });
  if (nextMode === MODES.PACMAN) createGameWindow();
  rebuildTrayMenu();
}
export function cycleMode() {
  const now=performance.now();
  // A held key must not open/close the game repeatedly or reveal a hidden pet.
  if(state.manualHidden||now-lastCycle<400)return;
  lastCycle=now;setMode(nextMode(state.mode));
}
export function recoverWindows({ focus = false } = {}) {
  if (quitting) return;
  cancelModeTransition();
  dodge.reset();
  endPetDrag();
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
  const now = performance.now(), elapsed = (now-lastTick)/1000, dt = Math.min(.06,elapsed);
  if(elapsed<.004)return; // Bound IPC bursts without imposing a 60Hz ceiling.
  lastTick = now;
  if (!petReady || menuOpen || dragSession || state.manualHidden || state.mode === MODES.PACMAN) { dodge.reset(); return; }
  if (state.chatOpen) { dodge.reset(); return; }
  const cursor = screen.getCursorScreenPoint();
  const bounds=currentDisplay().workArea;
  const reduced=reducedMotion;
  if(reduced&&modeTransition)cancelModeTransition();
  let arrivedPosition;
  if(modeTransition?.target) {
    const motion=arriveAt(position,velocity,modeTransition.target,dt,bounds);
    arrivedPosition=motion.position;velocity=motion.velocity;
    if(motion.done)modeTransition=undefined;
  } else if (state.mode === MODES.DODGE) {
    dodgeMotion=dodge.step({petCenter:{x:position.x+PET_SIZE/2,y:position.y+PET_SIZE/2},cursor,dt:elapsed,bounds,
      reducedMotion:reduced});
    velocity=modeTransition?launchVelocity(velocity,dodgeMotion.velocity,dt):dodgeMotion.velocity;
    if(modeTransition) {modeTransition.remaining-=dt;if(modeTransition.remaining<=0)modeTransition=undefined;}
  } else { dodge.reset(); dodgeMotion=undefined; velocity = state.controlActive ? controlVelocity(keys) : { x: 0, y: 0 }; }
  position = arrivedPosition||fitPet({ x: position.x + velocity.x * dt, y: position.y + velocity.y * dt }, bounds, PET_SIZE);
  if(state.mode===MODES.PET&&!modeTransition)petHome={...position};
  movePetWindow();
  const moving = Math.hypot(velocity.x, velocity.y) > 0;
  send("pet:motion", { ...velocity, gait: moving ? (state.mode === MODES.PET ? "run" : dodgeMotion.gait) : "idle" });
  if (state.mode === MODES.PET && !moving && now-lastProximity>=50) {
    lastProximity=now;
    const x = cursor.x - position.x - PET_SIZE / 2;
    const y = cursor.y - position.y - PET_SIZE + 7 + PET_SPRITE_SIZE / 2;
    send("pet:proximity", { near: Math.hypot(x, y) < 100, x, y });
  }
}
function controlInput(event, input) {
  if (state.mode !== MODES.PET || state.chatOpen || state.manualHidden) return;
  if (input.type === "keyDown" && input.key === "Escape") { event.preventDefault(); cancelModeTransition(); endPetDrag(); stopControl(); petWindow.blur(); return; }
  if (dragSession) return;
  if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(input.key)) return;
  // Let Chromium receive keydown: cancelling it here can suppress the matching
  // native keyup on macOS. The renderer suppresses only scrolling/default actions.
  if (input.type === "keyDown") { cancelModeTransition(); keys.add(input.key); state.controlActive = true; }
  if (input.type === "keyUp") keys.delete(input.key);
}
function createPetWindow() {
  petReady = false;
  nativePosition=undefined;
  const win = new BrowserWindow({ ...normalFrame(), frame: false, transparent: true, resizable: false,
    alwaysOnTop: true, skipTaskbar: true, show: false, focusable: false, acceptFirstMouse: true, hasShadow: false, webPreferences });
  petWindow = win; raiseWindow(win);
  win.webContents.on("before-input-event", controlInput);
  win.on("blur", () => { endPetDrag(); stopControl(); });
  win.webContents.on("did-start-loading", endPetDrag);
  win.on("focus", () => { state.controlActive = state.mode === MODES.PET && !state.chatOpen; });
  win.webContents.on("did-finish-load", () => {
    petReady = true; syncPet({ focus: state.chatOpen });
  });
  win.webContents.on("render-process-gone", () => { if (!quitting) { petReady = false; win.reload(); } });
  win.on("closed", () => {
    endPetDrag();
    if (petWindow === win) { petWindow = undefined; petReady = false; if (!quitting) createPetWindow(); }
  });
  win.loadFile(path.join(dirname, "renderer/pet.html"));
}
function rebuildTrayMenu() {
  if (!tray || quitting) return;
  trayMenu = Menu.buildFromTemplate([
    ...[[MODES.DODGE, "Dodge · 自由让路"], [MODES.PET, "Pet · 互动与移动"], [MODES.PACMAN, "Pac-Man · 吃颗豆豆"]]
      .map(([value, label]) => ({ id: value, label, type: "radio", checked: state.mode === value, click: () => setMode(value) })),
    { type: "separator" },
    { id: "cycle-mode", label: "切换到下一个模式", accelerator: MODE_SHORTCUT, registerAccelerator: false, click: cycleMode },
    { id: "chat", label: "和它说句话", accelerator: CHAT_SHORTCUT, registerAccelerator: false, click: showChat },
    { id: "hide", label: state.manualHidden ? "让它回来" : "老板来了，藏好", accelerator: HIDE_SHORTCUT, registerAccelerator: false, click: toggleHidden },
    { id: "recover", label: "找回宠物到当前屏幕", click: () => { state.manualHidden = false; pinPet(); recoverWindows({ focus: true }); rebuildTrayMenu(); } },
    { type: "separator" },
    { label: "登录时自动启动", type: "checkbox", checked: app.getLoginItemSettings().openAtLogin, enabled: app.isPackaged,
      click: item => app.setLoginItemSettings({ openAtLogin: item.checked }) },
    { label: "退出 Blue One-Eye Pet", role: "quit" },
  ]);
  trayMenu.on("menu-will-show", () => { menuOpen = true; dodge.reset(); endPetDrag(); stopControl(); });
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
ipcMain.on("pet:frame",event=>{if(fromPet(event))tick();});
function fromPet(event) { return event.sender === petWindow?.webContents && event.senderFrame === petWindow.webContents.mainFrame; }
ipcMain.handle("chat:send", (event, prompt) => { if (!fromPet(event)) throw new Error("Invalid sender"); return askClaude(prompt); });
ipcMain.on("chat:dismiss", event => { if (fromPet(event)) restorePetFrame(); });
ipcMain.on("pet:focus", event => { if (fromPet(event) && state.mode === MODES.PET && !state.chatOpen && !state.manualHidden) syncPet({ focus: true }); });
ipcMain.on("pet:drag", handlePetDrag);
ipcMain.on("game:exit", event => { if (event.sender === gameWindow?.webContents) setMode(MODES.PET); });

const hasLock = app.requestSingleInstanceLock();
if (!hasLock) app.quit();
app.on("second-instance", (_event, argv) => {
  const next = normalizeMode(argv.find(arg => arg.startsWith("--mode="))?.split("=")[1]);
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
  registerShortcut(MODE_SHORTCUT, cycleMode, "循环切换模式");
  reducedMotion=systemPreferences.getAnimationSettings().prefersReducedMotion;
  // Recovery is independent of rAF: an unexpectedly hidden window stops its
  // renderer clock, but must still be recoverable. Never unhide a manual hide.
  loop = setInterval(()=>{
    reducedMotion=systemPreferences.getAnimationSettings().prefersReducedMotion;
    if(petReady&&petShouldShow(state)&&!petWindow.isVisible())syncPet();
  },500);
  if (initialMode === MODES.PACMAN) createGameWindow();
  for (const event of ["display-added", "display-removed", "display-metrics-changed"]) screen.on(event, () => recoverWindows());
  for (const event of ["resume", "unlock-screen"]) powerMonitor.on(event, () => { recoverWindows(); });
  app.on("activate", () => { if (!dragSession) syncPet(); });
});
function prepareQuit() { quitting = true; clearInterval(loop); }
app.on("before-quit", prepareQuit);
app.on("will-quit", () => globalShortcut.unregisterAll());
app.on("window-all-closed", () => {});

// Test code runs in the main process; this API is not exposed to renderers or a port.
export function getRuntime() { return { state: { ...state }, position: { ...position }, velocity:{...velocity}, modeTransition, petHome, petWindow, gameWindow, tray, trayMenu, menuOpen, dragPending: Boolean(dragSession), dodgeMotion }; }
export function shutdown(code = 0) { prepareQuit(); globalShortcut.unregisterAll(); app.exit(code); }
process.once("SIGTERM", () => shutdown());
process.once("SIGINT", () => shutdown());
