import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  app,
  BrowserWindow,
  globalShortcut,
  ipcMain,
  Menu,
  nativeImage,
  Notification,
  powerMonitor,
  screen,
  systemPreferences,
  safeStorage,
  Tray,
} from "electron";
import {
  CHAT_OFFSET,
  chatFrame,
  chatMotionBounds,
  cursorInSpeech,
  controlVelocity,
  editingAction,
  fitPet,
  MODES,
  petShouldShow,
  normalizeMode,
  nextMode,
  PET_FRAME_SIZE,
  PET_SPRITE_SIZE,
  validDragPoint,
  dragPosition,
} from "./core.js";
import { transitionState } from "./app-state.js";
import { createApiSettingsStore } from "./api-settings.js";
import { loadChatProvider } from "./chat-provider.js";
import { askClaude } from "./chat.js";
import { createDodgeMotion } from "./dodge.js";
import { arriveAt, launchVelocity } from "./mode-motion.js";

const dirname = path.dirname(fileURLToPath(import.meta.url));
const PET_SIZE = PET_FRAME_SIZE;
app.setName("呼噜呼噜");
const HIDE_SHORTCUT = process.env.BLUEPET_HIDE_SHORTCUT || "Control+Alt+B";
const CHAT_SHORTCUT = process.env.BLUEPET_CHAT_SHORTCUT || "Control+Alt+Space";
const MODE_SHORTCUT = process.env.BLUEPET_MODE_SHORTCUT || "Control+Alt+Command+M";
const requestedMode = normalizeMode(
  process.argv.find((arg) => arg.startsWith("--mode="))?.split("=")[1],
);
const initialMode = Object.values(MODES).includes(requestedMode) ? requestedMode : MODES.DODGE;
const state = { mode: initialMode, manualHidden: false, chatOpen: false, controlActive: false };
let petWindow, gameWindow, settingsWindow, apiSettingsStore, tray, trayMenu, loop;
let petReady = false,
  gameReady = false,
  quitting = false,
  menuOpen = false;
let position = { x: 80, y: 160 },
  velocity = { x: 48, y: 25 };
let lastTick = performance.now(),
  lastProximity = 0,
  lastCycle = -Infinity;
let reducedMotion = false;
let nativePosition;
let dragSession;
const dodge = createDodgeMotion();
let dodgeMotion;
let modeTransition, petHome;
let hideAnimation,
  hideSerial = 0,
  ignoringMouse;
const keys = new Set();
const webPreferences = {
  preload: path.join(dirname, "preload.cjs"),
  contextIsolation: true,
  sandbox: true,
  nodeIntegration: false,
  backgroundThrottling: false,
};

function dispatch(type, payload = {}) {
  Object.assign(state, transitionState(state, { type, ...payload }));
}

// The tray app has no application menu. Both input windows need native editing
// commands; handling them here also keeps clipboard access out of the bridge.
function bindEditingShortcuts(win) {
  win.webContents.on("before-input-event", (event, input) => {
    const action = editingAction(input, process.platform);
    if (!action) return;
    event.preventDefault();
    win.webContents[action]();
  });
}

function activeWindow() {
  return state.mode === MODES.PACMAN ? gameWindow : petWindow;
}

function send(channel, payload) {
  if (petReady && petWindow && !petWindow.isDestroyed())
    petWindow.webContents.send(channel, payload);
}
function sendPetMotion(motion, cursor = screen.getCursorScreenPoint()) {
  if (state.mode === MODES.DODGE && petReady && petWindow && !petWindow.isDestroyed()) {
    const frame = petWindow.getBounds();
    // SVG eye center (31, 29.5), mapped into the actual native frame.
    // Gaze is independent of escape velocity, including when chat/menu freezes movement.
    motion = {
      ...motion,
      gaze: {
        x: cursor.x - (frame.x + (frame.width - PET_SPRITE_SIZE) / 2 + (31 / 64) * PET_SPRITE_SIZE),
        y:
          cursor.y - (frame.y + frame.height - 7 - PET_SPRITE_SIZE + (29.5 / 64) * PET_SPRITE_SIZE),
      },
    };
  }
  send("pet:motion", motion);
}
function currentDisplay() {
  return screen.getDisplayNearestPoint({
    x: Math.round(position.x + PET_SIZE / 2),
    y: Math.round(position.y + PET_SIZE / 2),
  });
}
function cursorDisplay() {
  return screen.getDisplayNearestPoint(screen.getCursorScreenPoint());
}
function pinPet(display = cursorDisplay()) {
  const b = display.workArea;
  position = fitPet(
    { x: b.x + b.width - PET_SIZE - 28, y: b.y + b.height - PET_SIZE - 24 },
    b,
    PET_SIZE,
  );
  petHome = { ...position };
}
function cancelModeTransition() {
  modeTransition = undefined;
  velocity = { x: 0, y: 0 };
}
function movePetWindow() {
  if (state.chatOpen) constrainPetPosition();
  const frame = state.chatOpen ? petFrame() : position;
  const x = Math.round(frame.x),
    y = Math.round(frame.y);
  if (nativePosition?.x === x && nativePosition?.y === y) return;
  petWindow.setPosition(x, y, false);
  nativePosition = { x, y };
}
function stopControl() {
  keys.clear();
  dispatch("release-control");
  sendPetMotion({ x: 0, y: 0, gait: "idle" });
}
function endPetDrag() {
  if (!dragSession) return;
  dragSession = undefined;
  send("pet:drag-end");
}
function interruptInteraction({ preserveMotion = false } = {}) {
  endPetDrag();
  stopControl();
  dodge.reset();
  if (!preserveMotion) cancelModeTransition();
}
function handlePetDrag(event, request) {
  if (!fromPet(event) || !request) return;
  if (request.phase === "end") {
    endPetDrag();
    return;
  }
  if (
    state.mode !== MODES.PET ||
    state.chatOpen ||
    state.manualHidden ||
    menuOpen ||
    !petWindow.isVisible()
  ) {
    endPetDrag();
    send("pet:drag-end");
    return;
  }
  if (!validDragPoint(request.point)) return;
  if (request.phase === "start") {
    interruptInteraction();
    dragSession = { origin: { ...position }, start: request.point };
  } else if (request.phase === "move" && dragSession) {
    const display = screen.getDisplayNearestPoint({
      x: Math.round(request.point.x),
      y: Math.round(request.point.y),
    });
    position = dragPosition(dragSession.origin, dragSession.start, request.point, display.workArea);
    petHome = { ...position };
    movePetWindow();
  }
}
function normalFrame() {
  const fitted = fitPet(position, currentDisplay().workArea, PET_SIZE);
  return { x: Math.round(fitted.x), y: Math.round(fitted.y), width: PET_SIZE, height: PET_SIZE };
}
function petFrame() {
  if (!state.chatOpen) return normalFrame();
  const chat = chatFrame(position, currentDisplay().workArea);
  return { ...chat, x: Math.round(chat.x), y: Math.round(chat.y) };
}
function constrainPetPosition() {
  position = fitPet(position, currentDisplay().workArea, PET_SIZE);
  if (state.chatOpen) {
    const frame = chatFrame(position, currentDisplay().workArea);
    // Commit the clamped physics anchor explicitly; frame queries are read-only.
    position = { x: frame.x + CHAT_OFFSET.x, y: frame.y + CHAT_OFFSET.y };
  }
}
function ignorePetMouse(ignore) {
  if (ignoringMouse === ignore) return;
  petWindow.setIgnoreMouseEvents(ignore, { forward: true });
  ignoringMouse = ignore;
}
function cancelHide() {
  if (!hideAnimation) return;
  clearTimeout(hideAnimation.timer);
  if (!hideAnimation.win.isDestroyed()) hideAnimation.win.webContents.send("pet:hide-cancel");
  hideAnimation = undefined;
}
function finishHide(id) {
  if (hideAnimation?.id !== id) return;
  const { win } = hideAnimation;
  clearTimeout(hideAnimation.timer);
  hideAnimation = undefined;
  if (state.manualHidden) {
    if (!win.isDestroyed()) win.hide();
    syncWindows();
  }
}
function animateHide(win) {
  cancelHide();
  const id = ++hideSerial;
  hideAnimation = { id, win, timer: setTimeout(() => finishHide(id), 460) };
  win.setIgnoreMouseEvents(true, { forward: true });
  if (win === petWindow) ignoringMouse = true;
  win.blur();
  win.webContents.send("pet:hide", {
    id,
    reducedMotion: systemPreferences.getAnimationSettings().prefersReducedMotion,
  });
}
function raiseWindow(win) {
  win.setAlwaysOnTop(true, "screen-saver");
  win.setVisibleOnAllWorkspaces(true, {
    visibleOnFullScreen: true,
    skipTransformProcessType: true,
  });
}

// Both surfaces share the same visibility intent. Only explicit user actions
// request focus; watchdog recovery must not move or activate a healthy window.
function syncWindows({ focus = false, relocateGame = false } = {}) {
  if (quitting || (state.manualHidden && hideAnimation)) return;
  if (!state.manualHidden) cancelHide();
  syncPet({ focus });
  syncGame({ focus, relocateGame });
}

function syncPet({ focus = false } = {}) {
  if (!petReady || !petWindow || petWindow.isDestroyed()) return;
  raiseWindow(petWindow);
  const focusable = state.chatOpen || state.mode === MODES.PET;
  petWindow.setFocusable(focusable);
  constrainPetPosition();
  petWindow.setBounds(petFrame(), false);
  nativePosition = undefined;
  petWindow.setOpacity(1);
  ignorePetMouse(
    state.mode === MODES.DODGE &&
      (!state.chatOpen || !cursorInSpeech(screen.getCursorScreenPoint(), petWindow.getBounds())),
  );
  const visible = petShouldShow(state);
  send("pet:state", { ...state, visible });
  if (visible) {
    send("pet:hide-cancel");
    if (petWindow.isMinimized()) petWindow.restore();
    petWindow.showInactive();
    if (focus && focusable) {
      app.focus({ steal: true });
      petWindow.show();
      petWindow.focus();
      dispatch("focus");
    }
  } else petWindow.hide();
}
export function restorePetFrame() {
  interruptInteraction();
  dispatch("dismiss-chat");
  syncWindows({ focus: state.mode === MODES.PET && !state.manualHidden });
}
export function showChat() {
  interruptInteraction();
  if (state.mode === MODES.PACMAN) setMode(MODES.PET);
  dispatch("chat");
  syncWindows({ focus: true });
  rebuildTrayMenu();
}
export function toggleHidden() {
  interruptInteraction();
  // Unexpectedly hidden windows recover on the first press.
  const target = activeWindow();
  const currentlyVisible = !state.manualHidden && target?.isVisible();
  dispatch(currentlyVisible ? "hide" : "reveal");
  if (!state.manualHidden) {
    position = fitPet(position, cursorDisplay().workArea, PET_SIZE);
    recoverWindows({ focus: true });
  } else animateHide(target);
  rebuildTrayMenu();
}
function closeGame() {
  if (!gameWindow) return;
  const win = gameWindow;
  gameWindow = undefined;
  gameReady = false;
  win.removeAllListeners("closed");
  win.close();
}
function syncGame({ focus = false, relocateGame = false } = {}) {
  if (state.mode !== MODES.PACMAN) {
    closeGame();
    return;
  }
  if (!gameWindow || gameWindow.isDestroyed()) {
    if (!state.manualHidden) createGameWindow({ focus });
    return;
  }
  if (!gameReady) return;
  if (state.manualHidden) {
    if (!hideAnimation) gameWindow.hide();
    return;
  }
  raiseWindow(gameWindow);
  if (relocateGame) gameWindow.setBounds(cursorDisplay().bounds);
  gameWindow.setIgnoreMouseEvents(false);
  gameWindow.webContents.send("pet:hide-cancel");
  if (gameWindow.isMinimized()) gameWindow.restore();
  if (!gameWindow.isVisible()) gameWindow.showInactive();
  if (focus) {
    app.focus({ steal: true });
    gameWindow.show();
    gameWindow.focus();
  }
}
function createGameWindow({ focus = false } = {}) {
  gameReady = false;
  const win = new BrowserWindow({
    ...cursorDisplay().bounds,
    frame: false,
    transparent: true,
    resizable: false,
    movable: false,
    fullscreenable: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    show: false,
    hasShadow: false,
    webPreferences,
  });
  gameWindow = win;
  raiseWindow(win);
  win.webContents.on("before-input-event", (event, input) => {
    if (input.type === "keyDown" && input.key === "Escape") {
      event.preventDefault();
      setMode(MODES.PET);
    }
  });
  win.once("ready-to-show", () => {
    if (gameWindow === win) {
      gameReady = true;
      syncGame({ focus });
    }
  });
  win.on("closed", () => {
    if (gameWindow === win) {
      gameWindow = undefined;
      gameReady = false;
      if (!quitting) setMode(MODES.PET);
    }
  });
  win.webContents.on("render-process-gone", () => {
    if (!quitting && gameWindow === win) {
      closeGame();
      syncWindows();
    }
  });
  win.loadFile(path.join(dirname, "renderer/game.html"));
}
export function setMode(nextMode) {
  nextMode = normalizeMode(nextMode);
  if (!Object.values(MODES).includes(nextMode)) return;
  cancelHide();
  const previousMode = state.mode;
  const smooth =
    previousMode !== nextMode &&
    [previousMode, nextMode].every((mode) => mode === MODES.PET || mode === MODES.DODGE) &&
    !state.manualHidden &&
    !state.chatOpen &&
    petWindow?.isVisible();
  if (previousMode === MODES.PET && !modeTransition && !state.chatOpen) petHome = { ...position };
  const momentum = { ...velocity };
  interruptInteraction({ preserveMotion: true });
  closeGame();
  dispatch("mode", { mode: nextMode });
  modeTransition = undefined;
  if (smooth && !systemPreferences.getAnimationSettings().prefersReducedMotion) {
    velocity = momentum;
    modeTransition =
      nextMode === MODES.PET
        ? { target: fitPet(petHome || position, currentDisplay().workArea) }
        : { remaining: 0.8 };
  } else {
    velocity = { x: 0, y: 0 };
    if (nextMode === MODES.PET && previousMode !== MODES.PET)
      position = fitPet(petHome || position, currentDisplay().workArea);
    else position = fitPet(position, currentDisplay().workArea);
  }
  syncWindows({ focus: nextMode !== MODES.DODGE });
  rebuildTrayMenu();
}
export function cycleMode() {
  const now = performance.now();
  // A held key must not open/close the game repeatedly or reveal a hidden pet.
  if (state.manualHidden || now - lastCycle < 400) return;
  lastCycle = now;
  setMode(nextMode(state.mode));
}
export function recoverWindows({ focus = false, relocateGame = true } = {}) {
  if (quitting) return;
  interruptInteraction();
  position = fitPet(position, currentDisplay().workArea, PET_SIZE);
  if (!petWindow || petWindow.isDestroyed()) createPetWindow();
  syncWindows({ focus, relocateGame });
}
function tick() {
  const now = performance.now(),
    elapsed = (now - lastTick) / 1000,
    dt = Math.min(0.06, elapsed);
  if (elapsed < 0.004) return; // Bound IPC bursts without imposing a 60Hz ceiling.
  lastTick = now;
  if (!petReady || dragSession || state.manualHidden || state.mode === MODES.PACMAN) {
    dodge.reset();
    return;
  }
  const cursor = screen.getCursorScreenPoint();
  if (menuOpen) {
    dodge.reset();
    sendPetMotion({ x: 0, y: 0, gait: "idle" }, cursor);
    return;
  }
  if (state.chatOpen) {
    const overSpeech = cursorInSpeech(cursor, petWindow.getBounds());
    ignorePetMouse(state.mode === MODES.DODGE && !overSpeech);
    if (state.mode !== MODES.DODGE || overSpeech) {
      dodge.reset();
      velocity = { x: 0, y: 0 };
      dodgeMotion = undefined;
      sendPetMotion({ x: 0, y: 0, gait: "idle" }, cursor);
      return;
    }
  }
  const bounds = currentDisplay().workArea;
  const reduced = reducedMotion;
  if (reduced && modeTransition) cancelModeTransition();
  let arrivedPosition;
  if (modeTransition?.target) {
    const motion = arriveAt(position, velocity, modeTransition.target, dt, bounds);
    arrivedPosition = motion.position;
    velocity = motion.velocity;
    if (motion.done) modeTransition = undefined;
  } else if (state.mode === MODES.DODGE) {
    dodgeMotion = dodge.step({
      petCenter: {
        x: position.x + PET_SIZE / 2,
        y: position.y + (state.chatOpen ? 83 : PET_SIZE / 2),
      },
      cursor,
      dt: elapsed,
      bounds: state.chatOpen ? chatMotionBounds(bounds) : bounds,
      reducedMotion: reduced,
      allowWander: !state.chatOpen,
    });
    velocity = modeTransition
      ? launchVelocity(velocity, dodgeMotion.velocity, dt)
      : dodgeMotion.velocity;
    if (modeTransition) {
      modeTransition.remaining -= dt;
      if (modeTransition.remaining <= 0) modeTransition = undefined;
    }
  } else {
    dodge.reset();
    dodgeMotion = undefined;
    velocity = state.controlActive ? controlVelocity(keys) : { x: 0, y: 0 };
  }
  position =
    arrivedPosition ||
    fitPet({ x: position.x + velocity.x * dt, y: position.y + velocity.y * dt }, bounds, PET_SIZE);
  if (state.mode === MODES.PET && !modeTransition) petHome = { ...position };
  movePetWindow();
  const moving = Math.hypot(velocity.x, velocity.y) > 0;
  sendPetMotion(
    { ...velocity, gait: moving ? (state.mode === MODES.PET ? "run" : dodgeMotion.gait) : "idle" },
    cursor,
  );
  if (state.mode === MODES.PET && !moving && now - lastProximity >= 50) {
    lastProximity = now;
    const x = cursor.x - position.x - PET_SIZE / 2;
    const y = cursor.y - position.y - PET_SIZE + 7 + PET_SPRITE_SIZE / 2;
    send("pet:proximity", { near: Math.hypot(x, y) < 100, x, y });
  }
}
function controlInput(event, input) {
  if (state.mode !== MODES.PET || state.chatOpen || state.manualHidden) return;
  if (input.type === "keyDown" && input.key === "Escape") {
    event.preventDefault();
    interruptInteraction();
    petWindow.blur();
    return;
  }
  if (dragSession) return;
  if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(input.key)) return;
  // Let Chromium receive keydown: cancelling it here can suppress the matching
  // native keyup on macOS. The renderer suppresses only scrolling/default actions.
  if (input.type === "keyDown") {
    cancelModeTransition();
    keys.add(input.key);
    dispatch("focus");
  }
  if (input.type === "keyUp") keys.delete(input.key);
}
function createPetWindow() {
  petReady = false;
  nativePosition = undefined;
  ignoringMouse = undefined;
  const win = new BrowserWindow({
    ...normalFrame(),
    frame: false,
    transparent: true,
    resizable: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    show: false,
    focusable: false,
    acceptFirstMouse: true,
    hasShadow: false,
    webPreferences,
  });
  petWindow = win;
  raiseWindow(win);
  bindEditingShortcuts(win);
  win.webContents.on("before-input-event", controlInput);
  win.on("blur", () => interruptInteraction({ preserveMotion: true }));
  win.webContents.on("did-start-loading", endPetDrag);
  win.on("focus", () => dispatch("focus"));
  win.webContents.on("did-finish-load", () => {
    petReady = true;
    syncWindows({ focus: state.chatOpen });
  });
  win.webContents.on("render-process-gone", () => {
    if (!quitting) {
      petReady = false;
      win.reload();
    }
  });
  win.on("closed", () => {
    endPetDrag();
    if (petWindow === win) {
      petWindow = undefined;
      petReady = false;
      if (!quitting) createPetWindow();
    }
  });
  win.loadFile(path.join(dirname, "renderer/pet.html"));
}
function showApiSettings() {
  interruptInteraction({ preserveMotion: true });
  if (settingsWindow) {
    settingsWindow.show();
    settingsWindow.focus();
    return;
  }
  const win = new BrowserWindow({
    width: 480,
    height: 510,
    resizable: false,
    maximizable: false,
    title: "API 设置 · 呼噜呼噜",
    backgroundColor: "#fbfcff",
    show: false,
    webPreferences: {
      preload: path.join(dirname, "settings-preload.cjs"),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
    },
  });
  settingsWindow = win;
  win.setAlwaysOnTop(true, "screen-saver", 1);
  bindEditingShortcuts(win);
  win.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  win.webContents.on("will-navigate", (event) => event.preventDefault());
  win.once("ready-to-show", () => {
    win.show();
    win.focus();
  });
  win.on("closed", () => {
    settingsWindow = undefined;
  });
  win.loadFile(path.join(dirname, "renderer/settings.html"));
}
function fromSettings(event) {
  return (
    event.sender === settingsWindow?.webContents &&
    event.senderFrame === settingsWindow.webContents.mainFrame
  );
}
for (const [channel, method] of [
  ["load", "status"],
  ["save", "save"],
  ["clear", "clear"],
]) {
  ipcMain.handle("settings:" + channel, (event, value) => {
    if (!fromSettings(event)) return { ok: false, error: "无效的设置窗口。" };
    try {
      return { ok: true, value: apiSettingsStore[method](value) };
    } catch (error) {
      return { ok: false, error: error.message };
    }
  });
}
ipcMain.on("settings:close", (event) => {
  if (fromSettings(event)) settingsWindow.close();
});
function rebuildTrayMenu() {
  if (!tray || quitting) return;
  trayMenu = Menu.buildFromTemplate([
    ...[
      [MODES.DODGE, "Dodge · 自由让路"],
      [MODES.PET, "Pet · 互动与移动"],
      [MODES.PACMAN, "Pac-Man · 吃颗豆豆"],
    ].map(([value, label]) => ({
      id: value,
      label,
      type: "radio",
      checked: state.mode === value,
      click: () => setMode(value),
    })),
    { type: "separator" },
    {
      id: "cycle-mode",
      label: "切换到下一个模式",
      accelerator: MODE_SHORTCUT,
      registerAccelerator: false,
      click: cycleMode,
    },
    {
      id: "chat",
      label: "和它说句话",
      accelerator: CHAT_SHORTCUT,
      registerAccelerator: false,
      click: showChat,
    },
    {
      id: "hide",
      label: state.manualHidden ? "让它回来" : "老板来了，藏好",
      accelerator: HIDE_SHORTCUT,
      registerAccelerator: false,
      click: toggleHidden,
    },
    {
      id: "recover",
      label: "找回宠物到当前屏幕",
      click: () => {
        dispatch("reveal");
        pinPet();
        recoverWindows({ focus: true });
        rebuildTrayMenu();
      },
    },
    { type: "separator" },
    {
      label: "登录时自动启动",
      type: "checkbox",
      checked: app.getLoginItemSettings().openAtLogin,
      enabled: app.isPackaged,
      click: (item) => app.setLoginItemSettings({ openAtLogin: item.checked }),
    },
    { id: "api-settings", label: "API 设置…", click: showApiSettings },
    { id: "quit", label: "退出呼噜呼噜", click: () => app.quit() },
  ]);
  trayMenu.on("menu-will-show", () => {
    menuOpen = true;
    interruptInteraction({ preserveMotion: true });
  });
  trayMenu.on("menu-will-close", () => {
    menuOpen = false;
  });
  tray.setContextMenu(trayMenu);
  tray.setToolTip("呼噜呼噜 · " + state.mode);
  // No tray click callback: opening the menu never reveals or activates the pet.
}
function registerShortcut(accelerator, handler, label) {
  let registered = false;
  try {
    registered = globalShortcut.register(accelerator, handler);
  } catch {
    /* invalid custom accelerator */
  }
  if (!registered) {
    console.error(label + "快捷键注册失败：" + accelerator);
    if (Notification.isSupported())
      new Notification({
        title: "呼噜呼噜快捷键不可用",
        body: label + "快捷键无效或已被占用，请使用菜单或修改环境变量。",
      }).show();
  }
}
const mascotSource = readFileSync(path.join(dirname, "../assets/blue-one-eye-mascot.svg"), "utf8");
ipcMain.handle("mascot:source", (event) => {
  if (event.sender !== petWindow?.webContents && event.sender !== gameWindow?.webContents)
    throw new Error("Invalid sender");
  return mascotSource;
});
ipcMain.on("pet:ready", (event) => {
  if (fromPet(event)) {
    petReady = true;
    syncWindows();
  }
});
ipcMain.on("pet:frame", (event) => {
  if (fromPet(event)) tick();
});
function fromPet(event) {
  return (
    event.sender === petWindow?.webContents && event.senderFrame === petWindow.webContents.mainFrame
  );
}
ipcMain.handle("chat:send", (event, prompt) => {
  if (!fromPet(event)) throw new Error("Invalid sender");
  return askClaude(prompt, { provider: () => apiSettingsStore.provider() || loadChatProvider() });
});
ipcMain.on("chat:dismiss", (event) => {
  if (fromPet(event)) restorePetFrame();
});
ipcMain.on("pet:focus", (event) => {
  if (fromPet(event) && state.mode === MODES.PET && !state.chatOpen && !state.manualHidden)
    syncWindows({ focus: true });
});
ipcMain.on("pet:drag", handlePetDrag);
ipcMain.on("pet:hide-done", (event, id) => {
  if (
    hideAnimation &&
    event.sender === hideAnimation.win.webContents &&
    event.senderFrame === event.sender.mainFrame &&
    Number.isSafeInteger(id)
  )
    finishHide(id);
});
ipcMain.on("game:exit", (event) => {
  if (event.sender === gameWindow?.webContents) setMode(MODES.PET);
});

const hasLock = app.requestSingleInstanceLock();
if (!hasLock) app.quit();
app.on("second-instance", (_event, argv) => {
  const next = normalizeMode(argv.find((arg) => arg.startsWith("--mode="))?.split("=")[1]);
  if (Object.values(MODES).includes(next)) setMode(next);
  else {
    dispatch("reveal");
    recoverWindows({ focus: state.chatOpen });
    rebuildTrayMenu();
  }
});
export const ready = app.whenReady().then(() => {
  if (!hasLock) return;
  if (process.platform === "darwin") app.dock.hide();
  Menu.setApplicationMenu(null);
  apiSettingsStore = createApiSettingsStore({
    directory: app.getPath("userData"),
    secureStorage: safeStorage,
  });
  pinPet();
  createPetWindow();
  const trayImage = nativeImage.createFromPath(path.join(dirname, "../assets/tray.png"));
  // macOS owns the tint, including light/dark menu bars and selected menus.
  trayImage.setTemplateImage(true);
  tray = new Tray(trayImage);
  if (trayImage.isEmpty() && process.platform === "darwin") tray.setTitle("宠");
  rebuildTrayMenu();
  registerShortcut(HIDE_SHORTCUT, toggleHidden, "快速隐藏");
  registerShortcut(CHAT_SHORTCUT, showChat, "聊天");
  registerShortcut(MODE_SHORTCUT, cycleMode, "循环切换模式");
  reducedMotion = systemPreferences.getAnimationSettings().prefersReducedMotion;
  // Recovery is independent of rAF: an unexpectedly hidden window stops its
  // renderer clock, but must still be recoverable. Never unhide a manual hide.
  loop = setInterval(() => {
    reducedMotion = systemPreferences.getAnimationSettings().prefersReducedMotion;
    const ready = state.mode === MODES.PACMAN ? gameReady : petReady;
    if (ready && !state.manualHidden && !activeWindow()?.isVisible()) {
      recoverWindows({ relocateGame: false });
    }
  }, 500);
  if (initialMode === MODES.PACMAN) syncGame({ focus: true });
  for (const event of ["display-added", "display-removed", "display-metrics-changed"])
    screen.on(event, () => recoverWindows());
  for (const event of ["resume", "unlock-screen"])
    powerMonitor.on(event, () => {
      recoverWindows();
    });
  app.on("activate", () => {
    if (!dragSession) syncWindows();
  });
});
function prepareQuit() {
  quitting = true;
  clearInterval(loop);
  cancelHide();
}
app.on("before-quit", prepareQuit);
app.on("will-quit", () => globalShortcut.unregisterAll());
app.on("window-all-closed", () => {});

// Test code runs in the main process; this API is not exposed to renderers or a port.
export function getRuntime() {
  return {
    state: { ...state },
    position: { ...position },
    velocity: { ...velocity },
    modeTransition,
    petHome,
    petWindow,
    gameWindow,
    settingsWindow,
    tray,
    trayMenu,
    menuOpen,
    ignoringMouse,
    hiding: Boolean(hideAnimation),
    dragPending: Boolean(dragSession),
    dodgeMotion,
  };
}
export function shutdown(code = 0) {
  prepareQuit();
  globalShortcut.unregisterAll();
  app.exit(code);
}
process.once("SIGTERM", () => shutdown());
process.once("SIGINT", () => shutdown());
