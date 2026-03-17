const { BrowserWindow, screen } = require("electron");
const path = require("node:path");
const { getConfig, getActiveProfileIndex, setActiveProfileIndex } = require("./config");

// ─── Windows ───

let mainWindow = null;
let ringWindow = null;
let tray = null;

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 700,
    height: 550,
    show: false,
    icon: path.join(__dirname, "..", "logo_ring_2_1.png"),
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.loadFile(path.join(__dirname, "..", "dist", "index.html"));

  mainWindow.on("close", (e) => {
    e.preventDefault();
    mainWindow.hide();
  });
}

function createRingWindow() {
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

  ringWindow.on("blur", () => {
    if (!ringWindow.isDestroyed()) ringWindow.hide();
  });
}

function showRingAtCursor(profileIndex) {
  // Guard: ignore repeated shortcut triggers (key repeat) if ring is already visible
  if (ringWindow && !ringWindow.isDestroyed() && ringWindow.isVisible()) {
    return;
  }

  setActiveProfileIndex(profileIndex);
  if (!ringWindow || ringWindow.isDestroyed()) {
    createRingWindow();
  }
  const cursor = screen.getCursorScreenPoint();
  const x = Math.round(cursor.x - 275);
  const y = Math.round(cursor.y - 275);
  ringWindow.setBounds({ x, y, width: 550, height: 550 });

  // Send active profile slices to the ring window
  const config = getConfig();
  const profile = config.profiles[profileIndex];
  if (profile) {
    const json = JSON.stringify(profile.slices);
    ringWindow.webContents.executeJavaScript(
      `window.__updateSlices(${json})`
    );
  }

  ringWindow.show();
  ringWindow.focus();
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

module.exports = {
  createMainWindow,
  createRingWindow,
  showRingAtCursor,
  getMainWindow,
  getRingWindow,
  getTray,
  setTray,
};
