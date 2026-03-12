const {
  app,
  BrowserWindow,
  globalShortcut,
  ipcMain,
  dialog,
  Tray,
  Menu,
  screen,
  nativeImage,
} = require("electron");
const path = require("path");
const fs = require("fs");

// ─── Config ───

const CONFIG_PATH = path.join(app.getPath("userData"), "config.json");

const DEFAULT_CONFIG = {
  shortcut: "Alt+Space",
  slices: [
    {
      label: "Terminal",
      icon: "terminal",
      action: {
        type: "Program",
        path: "/System/Applications/Utilities/Terminal.app",
        args: [],
      },
    },
    {
      label: "Browser",
      icon: "globe",
      action: {
        type: "Program",
        path: "/Applications/Safari.app",
        args: [],
      },
    },
  ],
};

let config = loadConfig();

function loadConfig() {
  try {
    if (fs.existsSync(CONFIG_PATH)) {
      return JSON.parse(fs.readFileSync(CONFIG_PATH, "utf-8"));
    }
  } catch {}
  saveConfigToDisk(DEFAULT_CONFIG);
  return structuredClone(DEFAULT_CONFIG);
}

function saveConfigToDisk(cfg) {
  fs.mkdirSync(path.dirname(CONFIG_PATH), { recursive: true });
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(cfg, null, 2));
}

// ─── Actions ───

const { spawn } = require("child_process");

function executeAction(action) {
  switch (action.type) {
    case "Script":
      spawn("sh", ["-c", action.command], { detached: true, stdio: "ignore" });
      break;
    case "Program":
      if (action.path.endsWith(".app")) {
        const args = ["-a", action.path];
        if (action.args?.length) {
          args.push("--args", ...action.args);
        }
        spawn("open", args, { detached: true, stdio: "ignore" });
      } else {
        spawn(action.path, action.args || [], {
          detached: true,
          stdio: "ignore",
        });
      }
      break;
    case "System":
      console.log("System action not yet implemented:", action.action);
      break;
  }
}

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
    width: 400,
    height: 400,
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

function showRingAtCursor() {
  if (!ringWindow || ringWindow.isDestroyed()) {
    createRingWindow();
  }
  const cursor = screen.getCursorScreenPoint();
  const x = Math.round(cursor.x - 200);
  const y = Math.round(cursor.y - 200);
  ringWindow.setBounds({ x, y, width: 400, height: 400 });
  ringWindow.show();
  ringWindow.focus();
}

// ─── Global Shortcut ───

let currentShortcut = null;

function registerShortcut(accelerator) {
  if (currentShortcut) {
    globalShortcut.unregister(currentShortcut);
    currentShortcut = null;
  }

  // Map Super to Meta for Electron
  const mapped = accelerator.replace(/Super/g, "Meta");

  try {
    globalShortcut.register(mapped, showRingAtCursor);
    currentShortcut = mapped;
  } catch (e) {
    console.error("Failed to register shortcut:", mapped, e);
  }
}

// ─── Tray ───

function setupTray() {
  const iconPath = path.join(__dirname, "icon.png");
  const icon = nativeImage.createFromPath(iconPath).resize({ width: 18, height: 18 });
  tray = new Tray(icon);

  const menu = Menu.buildFromTemplate([
    {
      label: "Show Config",
      click: () => {
        mainWindow.show();
        mainWindow.focus();
      },
    },
    { type: "separator" },
    {
      label: "Quit",
      click: () => {
        mainWindow.destroy();
        app.quit();
      },
    },
  ]);

  tray.setContextMenu(menu);
  tray.on("click", () => {
    mainWindow.show();
    mainWindow.focus();
  });
}

// ─── IPC ───

ipcMain.handle("get_config", () => config);

ipcMain.handle("save_config", (_e, newConfig) => {
  const oldShortcut = config.shortcut;
  saveConfigToDisk(newConfig);

  if (oldShortcut !== newConfig.shortcut) {
    registerShortcut(newConfig.shortcut);
  }

  // Update ring window live
  if (ringWindow) {
    const json = JSON.stringify(newConfig.slices);
    ringWindow.webContents.executeJavaScript(
      `window.__updateSlices(${json})`
    );
  }

  config = newConfig;
});

ipcMain.handle("execute_action", (_e, index) => {
  const slice = config.slices[index];
  if (!slice) throw new Error("Invalid slice index");
  executeAction(slice.action);
});

ipcMain.handle("hide_ring", () => {
  if (ringWindow && !ringWindow.isDestroyed()) ringWindow.hide();
});

ipcMain.handle("open_file_dialog", async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ["openFile"],
    defaultPath: "/Applications",
    filters: [{ name: "Applications", extensions: ["app"] }],
  });
  if (result.canceled || !result.filePaths.length) return null;
  return result.filePaths[0];
});

// ─── App Lifecycle ───

app.whenReady().then(() => {
  // Set dock icon
  const appIcon = nativeImage.createFromPath(
    path.join(__dirname, "..", "logo_ring_2_1.png")
  );
  if (process.platform === "darwin" && app.dock) {
    app.dock.setIcon(appIcon);
  }

  createMainWindow();
  createRingWindow();
  setupTray();
  registerShortcut(config.shortcut);
});

app.on("window-all-closed", () => {
  // Keep running in tray on macOS
});
