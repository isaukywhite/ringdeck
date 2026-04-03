const { BrowserWindow, screen, globalShortcut } = require("electron");
const path = require("node:path");
const { getConfig, getActiveProfileIndex, setActiveProfileIndex } = require("./config");

// ─── Windows ───

let mainWindow = null;
let ringWindow = null;
let ringReady = false;
let isQuitting = false;
let tray = null;

const RING_SIZES = {
  tiny: 248,
  mini: 330,
  small: 420,
  medium: 550,
  large: 660,
};

function getRingWindowSize() {
  const config = getConfig();
  const size = (config.settings && config.settings.ringSize) || "medium";
  return RING_SIZES[size] || 550;
}

function getRingColor() {
  const config = getConfig();
  return (config.settings && config.settings.ringColor) || "#0A84FF";
}

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 700,
    height: 550,
    minWidth: 600,
    minHeight: 450,
    show: false,
    frame: false,
    transparent: false,
    icon: path.join(__dirname, "..", "logo_ring_2_1.png"),
    backgroundColor: "#0e0a1a",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.loadFile(path.join(__dirname, "..", "dist", "index.html"));
  mainWindow.setMenuBarVisibility(false);
  mainWindow.setMenu(null);

  mainWindow.once("ready-to-show", () => {
    mainWindow.show();
  });

  mainWindow.on("close", (e) => {
    if (isQuitting) return;

    const config = getConfig();
    const closeToTray = config.settings?.closeToTray !== false;
    if (closeToTray) {
      e.preventDefault();
      mainWindow.hide();
    } else {
      isQuitting = true;
      if (tray) { tray.destroy(); tray = null; }
      if (ringWindow && !ringWindow.isDestroyed()) ringWindow.destroy();
      globalShortcut.unregisterAll();
      const { app } = require("electron");
      app.quit();
    }
  });
}

function createRingWindow() {
  ringReady = false;
  ringWindow = new BrowserWindow({
    width: 550,
    height: 550,
    show: false,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    hasShadow: false,
    backgroundColor: "#00000000",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  ringWindow.loadFile(path.join(__dirname, "..", "dist", "ring.html"));

  ringWindow.webContents.on("did-finish-load", () => {
    ringReady = true;
    sendRingData(getActiveProfileIndex());
  });

  ringWindow.on("blur", () => {
    if (!ringWindow.isDestroyed()) ringWindow.hide();
  });
}

function sendRingData(profileIndex) {
  const config = getConfig();
  const profile = config.profiles[profileIndex];
  if (profile && ringWindow && !ringWindow.isDestroyed() && ringReady) {
    ringWindow.webContents.send("ring-data", {
      slices: profile.slices,
      color: getRingColor(),
      size: (config.settings && config.settings.ringSize) || "medium",
      performanceMode: (config.settings && config.settings.performanceMode) || false,
    });
  }
}

function showRingAtCursor(profileIndex) {
  if (ringWindow && !ringWindow.isDestroyed() && ringWindow.isVisible()) {
    return;
  }

  setActiveProfileIndex(profileIndex);
  if (!ringWindow || ringWindow.isDestroyed()) {
    createRingWindow();
  }

  const winSize = getRingWindowSize();
  const half = Math.round(winSize / 2);
  const cursor = screen.getCursorScreenPoint();
  const x = Math.round(cursor.x - half);
  const y = Math.round(cursor.y - half);
  ringWindow.setBounds({ x, y, width: winSize, height: winSize });

  sendRingData(profileIndex);

  const config = getConfig();
  const delayMs = config.settings?.ringDelayMs !== undefined ? config.settings.ringDelayMs : 30;

  if (delayMs > 0) {
    setTimeout(() => {
      if (ringWindow && !ringWindow.isDestroyed()) {
        ringWindow.show();
        ringWindow.focus();
      }
    }, delayMs);
  } else {
    ringWindow.show();
    ringWindow.focus();
  }
}

function getMainWindow() {
  return mainWindow;
}

function getRingWindow() {
  return ringWindow;
}

function getTray() {
  return tray;
}

function setTray(t) {
  tray = t;
}

function setIsQuitting(v) {
  isQuitting = v;
}

module.exports = {
  createMainWindow,
  createRingWindow,
  showRingAtCursor,
  sendRingData,
  getMainWindow,
  getRingWindow,
  getRingWindowSize,
  RING_SIZES,
  getTray,
  setTray,
  setIsQuitting,
};

