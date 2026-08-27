import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import os from "node:os";
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
  screen,
  Tray,
} from "electron";
import { cleanClaudeReply, clamp, MODES, nextDodgeVelocity } from "./core.js";

const dirname = path.dirname(fileURLToPath(import.meta.url));
const assetPath = path.join(dirname, "../assets/blue-one-eye-mascot.svg");
const petPage = path.join(dirname, "renderer/pet.html");
const gamePage = path.join(dirname, "renderer/game.html");
const preloadPath = path.join(dirname, "preload.cjs");
const PET_SIZE = 118;
const CHAT_SIZE = { width: 368, height: 282 };
const HIDE_SHORTCUT = process.env.BLUEPET_HIDE_SHORTCUT || "Control+Alt+B";
const CHAT_SHORTCUT = process.env.BLUEPET_CHAT_SHORTCUT || "Control+Alt+Space";
const requestedMode = process.argv.find((argument) => argument.startsWith("--mode="))?.split("=")[1];
const initialMode = Object.values(MODES).includes(requestedMode) ? requestedMode : MODES.DODGE;
const SYSTEM_PROMPT = [
  "你是一只住在用户桌面上的蓝色单眼小宠物。",
  "性格乖巧、亲昵、略微害羞，偶尔撒娇，但不油腻、不说教。",
  "用用户的语言回答，只说一句自然短句，不使用 Markdown，最多 50 个字符。",
  "不要声称你操作了电脑，不要索取敏感信息。",
].join("");

let petWindow;
let gameWindow;
let tray;
let mode = MODES.DODGE;
let hidden = false;
let chatOpen = false;
let dodgeTimer;
let basePetPosition = { x: 80, y: 160 };
let velocity = { x: 48, y: 25 };
let lastTick = Date.now();

const hasLock = app.requestSingleInstanceLock();
if (!hasLock) app.quit();

app.on("second-instance", () => {
  hidden = false;
  if (mode === MODES.PACMAN) gameWindow?.show();
  else petWindow?.showInactive();
});

function currentDisplay() {
  const center = { x: basePetPosition.x + PET_SIZE / 2, y: basePetPosition.y + PET_SIZE / 2 };
  return screen.getDisplayNearestPoint(center);
}

function boundedPosition(position, bounds = currentDisplay().workArea) {
  return {
    x: Math.round(clamp(position.x, bounds.x, bounds.x + bounds.width - PET_SIZE)),
    y: Math.round(clamp(position.y, bounds.y, bounds.y + bounds.height - PET_SIZE)),
  };
}

function placePet(position) {
  basePetPosition = boundedPosition(position);
  if (!chatOpen && petWindow && !petWindow.isDestroyed()) {
    petWindow.setPosition(basePetPosition.x, basePetPosition.y, false);
  }
}

function restorePetFrame() {
  chatOpen = false;
  petWindow.setFocusable(false);
  petWindow.setBounds({ ...basePetPosition, width: PET_SIZE, height: PET_SIZE }, false);
  petWindow.setIgnoreMouseEvents(mode === MODES.DODGE, { forward: true });
  petWindow.webContents.send("chat:close");
}

function showChat() {
  if (mode === MODES.PACMAN) setMode(MODES.PET);
  hidden = false;
  const bounds = currentDisplay().workArea;
  const x = clamp(
    basePetPosition.x - (CHAT_SIZE.width - PET_SIZE) / 2,
    bounds.x,
    bounds.x + bounds.width - CHAT_SIZE.width,
  );
  const y = clamp(
    basePetPosition.y - (CHAT_SIZE.height - PET_SIZE),
    bounds.y,
    bounds.y + bounds.height - CHAT_SIZE.height,
  );
  chatOpen = true;
  petWindow.setIgnoreMouseEvents(false);
  petWindow.setFocusable(true);
  petWindow.setBounds({ x: Math.round(x), y: Math.round(y), ...CHAT_SIZE }, false);
  petWindow.show();
  app.focus({ steal: true });
  petWindow.focus();
  petWindow.webContents.send("chat:open");
  rebuildTrayMenu();
}

function toggleHidden() {
  hidden = !hidden;
  if (hidden) {
    petWindow?.hide();
    gameWindow?.hide();
  } else if (mode === MODES.PACMAN) {
    gameWindow?.show();
  } else {
    petWindow?.showInactive();
  }
  rebuildTrayMenu();
}

function stopDodgeLoop() {
  if (dodgeTimer) clearInterval(dodgeTimer);
  dodgeTimer = undefined;
}

function startDodgeLoop() {
  stopDodgeLoop();
  lastTick = Date.now();
  dodgeTimer = setInterval(() => {
    if (hidden || chatOpen || mode !== MODES.DODGE || !petWindow) return;
    const now = Date.now();
    const dt = Math.min(0.08, (now - lastTick) / 1000);
    lastTick = now;
    const cursor = screen.getCursorScreenPoint();
    const display = screen.getDisplayNearestPoint({
      x: basePetPosition.x + PET_SIZE / 2,
      y: basePetPosition.y + PET_SIZE / 2,
    });
    const petCenter = {
      x: basePetPosition.x + PET_SIZE / 2,
      y: basePetPosition.y + PET_SIZE / 2,
    };
    velocity = nextDodgeVelocity({
      petCenter,
      cursor,
      velocity,
      dt,
      bounds: display.workArea,
    });
    placePet({
      x: basePetPosition.x + velocity.x * dt,
      y: basePetPosition.y + velocity.y * dt,
    });
    petWindow.webContents.send("pet:motion", {
      fleeing: Math.hypot(petCenter.x - cursor.x, petCenter.y - cursor.y) < 170,
      facing: velocity.x < 0 ? "left" : "right",
    });
  }, 32);
}

function startPetProximityLoop() {
  stopDodgeLoop();
  dodgeTimer = setInterval(() => {
    if (hidden || mode !== MODES.PET || !petWindow) return;
    const cursor = screen.getCursorScreenPoint();
    const bounds = petWindow.getBounds();
    const center = { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height - 55 };
    petWindow.webContents.send("pet:proximity", Math.hypot(cursor.x - center.x, cursor.y - center.y) < 105);
  }, 50);
}

function pinPet() {
  const display = screen.getDisplayNearestPoint(screen.getCursorScreenPoint());
  placePet({
    x: display.workArea.x + display.workArea.width - PET_SIZE - 28,
    y: display.workArea.y + display.workArea.height - PET_SIZE - 24,
  });
}

function createGameWindow() {
  const display = screen.getDisplayNearestPoint(screen.getCursorScreenPoint());
  gameWindow = new BrowserWindow({
    ...display.bounds,
    frame: false,
    transparent: true,
    resizable: false,
    movable: false,
    fullscreenable: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    show: false,
    webPreferences: {
      preload: preloadPath,
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
    },
  });
  gameWindow.setAlwaysOnTop(true, "screen-saver");
  gameWindow.loadFile(gamePage);
  gameWindow.webContents.on("before-input-event", (event, input) => {
    if (input.type === "keyDown" && (input.key === "Escape" || input.code === "Escape")) {
      event.preventDefault();
      setMode(MODES.PET);
    }
  });
  gameWindow.once("ready-to-show", () => {
    if (!hidden) {
      gameWindow.show();
      app.focus({ steal: true });
      gameWindow.focus();
    }
  });
  gameWindow.on("closed", () => {
    gameWindow = undefined;
    if (mode === MODES.PACMAN) setMode(MODES.PET);
  });
}

function setMode(nextMode) {
  if (!Object.values(MODES).includes(nextMode)) return;
  stopDodgeLoop();
  restorePetFrame();
  if (gameWindow && !gameWindow.isDestroyed()) {
    gameWindow.removeAllListeners("closed");
    gameWindow.close();
    gameWindow = undefined;
  }
  mode = nextMode;
  petWindow.webContents.send("mode:changed", mode);

  if (mode === MODES.DODGE) {
    petWindow.setIgnoreMouseEvents(true, { forward: true });
    if (!hidden) petWindow.showInactive();
    startDodgeLoop();
  } else if (mode === MODES.PET) {
    pinPet();
    petWindow.setIgnoreMouseEvents(false);
    if (!hidden) petWindow.showInactive();
    startPetProximityLoop();
  } else {
    petWindow.hide();
    createGameWindow();
  }
  rebuildTrayMenu();
}

function rebuildTrayMenu() {
  if (!tray) return;
  const menu = Menu.buildFromTemplate([
    { label: "Dodge · 自由让路", type: "radio", checked: mode === MODES.DODGE, click: () => setMode(MODES.DODGE) },
    { label: "Pet · 固定陪伴", type: "radio", checked: mode === MODES.PET, click: () => setMode(MODES.PET) },
    { label: "Pac-Man · 吃颗豆豆", type: "radio", checked: mode === MODES.PACMAN, click: () => setMode(MODES.PACMAN) },
    { type: "separator" },
    { label: `和它说句话  ${CHAT_SHORTCUT.replaceAll("Control", "⌃").replaceAll("Alt", "⌥").replaceAll("+", "")}`, click: showChat },
    { label: hidden ? "让它回来" : "老板来了，藏好", accelerator: HIDE_SHORTCUT, click: toggleHidden },
    { type: "separator" },
    {
      label: "登录时自动启动",
      type: "checkbox",
      checked: app.getLoginItemSettings().openAtLogin,
      enabled: app.isPackaged,
      click: (item) => app.setLoginItemSettings({ openAtLogin: item.checked }),
    },
    { label: "退出 Blue One-Eye Pet", role: "quit" },
  ]);
  tray.setContextMenu(menu);
  tray.setToolTip(`Blue One-Eye Pet · ${mode}`);
}

function registerShortcut(accelerator, handler, label) {
  if (!globalShortcut.register(accelerator, handler) && Notification.isSupported()) {
    new Notification({
      title: "Blue One-Eye Pet 快捷键冲突",
      body: `${label}（${accelerator}）已被占用，可通过环境变量修改。`,
    }).show();
  }
}

function createPetWindow() {
  const display = screen.getPrimaryDisplay();
  basePetPosition = {
    x: display.workArea.x + display.workArea.width - PET_SIZE - 28,
    y: display.workArea.y + display.workArea.height - PET_SIZE - 24,
  };
  petWindow = new BrowserWindow({
    ...basePetPosition,
    width: PET_SIZE,
    height: PET_SIZE,
    frame: false,
    transparent: true,
    resizable: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    show: false,
    focusable: false,
    hasShadow: false,
    webPreferences: {
      preload: preloadPath,
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
    },
  });
  petWindow.setAlwaysOnTop(true, "floating");
  petWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  petWindow.setIgnoreMouseEvents(true, { forward: true });
  petWindow.loadFile(petPage);
  petWindow.once("ready-to-show", () => {
    if (initialMode === MODES.DODGE) {
      petWindow.showInactive();
      startDodgeLoop();
    } else {
      setMode(initialMode);
    }
  });
  petWindow.on("closed", () => {
    petWindow = undefined;
  });
}

function resolveClaudePath() {
  const candidates = [
    process.env.BLUEPET_CLAUDE_PATH,
    "/opt/homebrew/bin/claude",
    "/usr/local/bin/claude",
    path.join(os.homedir(), ".local/bin/claude"),
  ].filter(Boolean);
  return candidates.find((candidate) => path.isAbsolute(candidate) && existsSync(candidate));
}

async function askClaude(prompt) {
  const claudePath = resolveClaudePath();
  if (!claudePath) throw new Error("没有找到 Claude Code。请先安装 claude，或设置 BLUEPET_CLAUDE_PATH。");
  const safePrompt = String(prompt).trim().slice(0, 500);
  if (!safePrompt) throw new Error("悄悄说点什么吧。");

  return new Promise((resolve, reject) => {
    const child = spawn(
      claudePath,
      [
        "-p",
        "--no-session-persistence",
        "--disable-slash-commands",
        "--tools",
        "",
        "--system-prompt",
        SYSTEM_PROMPT,
        safePrompt,
      ],
      { cwd: os.tmpdir(), env: process.env, stdio: ["ignore", "pipe", "pipe"] },
    );
    let output = "";
    let errorOutput = "";
    const timeout = setTimeout(() => child.kill("SIGTERM"), 45_000);
    child.stdout.on("data", (chunk) => {
      if (output.length < 8_000) output += chunk.toString();
    });
    child.stderr.on("data", (chunk) => {
      if (errorOutput.length < 2_000) errorOutput += chunk.toString();
    });
    child.on("error", reject);
    child.on("close", (code, signal) => {
      clearTimeout(timeout);
      if (signal) return reject(new Error("我想了太久，脑袋冒烟啦。再问一次好吗？"));
      if (code !== 0) {
        if (process.argv.includes("--dev") && errorOutput.trim()) console.error(errorOutput.trim());
        return reject(new Error("Claude Code 暂时没回应，请检查本机 provider 后再试。"));
      }
      const reply = cleanClaudeReply(output);
      if (!reply) return reject(new Error("我刚刚走神了，再说一次好吗？"));
      resolve(reply);
    });
  });
}

ipcMain.handle("chat:send", (_event, prompt) => askClaude(prompt));
ipcMain.on("chat:dismiss", restorePetFrame);
ipcMain.on("game:exit", () => setMode(MODES.PET));
ipcMain.on("mode:set", (_event, nextMode) => setMode(nextMode));

app.whenReady().then(() => {
  if (process.platform === "darwin") app.dock.hide();
  createPetWindow();
  const trayImage = nativeImage.createFromPath(assetPath).resize({ width: 18, height: 18 });
  tray = new Tray(trayImage);
  tray.on("click", () => (hidden ? toggleHidden() : showChat()));
  rebuildTrayMenu();
  registerShortcut(HIDE_SHORTCUT, toggleHidden, "快速隐藏");
  registerShortcut(CHAT_SHORTCUT, showChat, "聊天");
});

app.on("will-quit", () => {
  stopDodgeLoop();
  globalShortcut.unregisterAll();
});

app.on("window-all-closed", () => {});
