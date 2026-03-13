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

function getDefaultConfig() {
  const platform = process.platform;
  let slices;

  if (platform === "win32") {
    slices = [
      {
        label: "Terminal",
        icon: "terminal",
        action: {
          type: "Program",
          path: "wt.exe",
          args: [],
        },
      },
      {
        label: "Browser",
        icon: "globe",
        action: {
          type: "Program",
          path: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
          args: [],
        },
      },
    ];
  } else if (platform === "linux") {
    slices = [
      {
        label: "Terminal",
        icon: "terminal",
        action: {
          type: "Script",
          command: "x-terminal-emulator",
        },
      },
      {
        label: "Browser",
        icon: "globe",
        action: {
          type: "Script",
          command: "xdg-open https://google.com",
        },
      },
    ];
  } else {
    // macOS
    slices = [
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
    ];
  }

  return {
    profiles: [
      {
        id: "default",
        name: "Default",
        shortcut: "Alt+Space",
        slices,
      },
    ],
  };
}

let config = loadConfig();
let activeProfileIndex = 0;

function migrateConfig(cfg) {
  // Migrate legacy format (shortcut + slices) to profiles format
  if (cfg.slices && !cfg.profiles) {
    const migrated = {
      profiles: [
        {
          id: "default",
          name: "Default",
          shortcut: cfg.shortcut || "Alt+Space",
          slices: cfg.slices,
        },
      ],
    };
    saveConfigToDisk(migrated);
    return migrated;
  }
  return cfg;
}

function loadConfig() {
  try {
    if (fs.existsSync(CONFIG_PATH)) {
      const raw = JSON.parse(fs.readFileSync(CONFIG_PATH, "utf-8"));
      return migrateConfig(raw);
    }
  } catch {}
  const defaults = getDefaultConfig();
  saveConfigToDisk(defaults);
  return structuredClone(defaults);
}

function saveConfigToDisk(cfg) {
  fs.mkdirSync(path.dirname(CONFIG_PATH), { recursive: true });
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(cfg, null, 2));
}

// ─── Actions ───

const { spawn, exec } = require("child_process");

function executeAction(action) {
  const platform = process.platform;

  switch (action.type) {
    case "Script": {
      if (platform === "win32") {
        spawn("cmd", ["/c", action.command], { detached: true, stdio: "ignore", shell: false });
      } else {
        spawn("sh", ["-c", action.command], { detached: true, stdio: "ignore" });
      }
      break;
    }
    case "Program": {
      if (platform === "darwin" && action.path.endsWith(".app")) {
        // macOS: use 'open -a' for .app bundles
        const args = ["-a", action.path];
        if (action.args?.length) {
          args.push("--args", ...action.args);
        }
        spawn("open", args, { detached: true, stdio: "ignore" });
      } else if (platform === "win32") {
        // Windows: spawn the executable directly
        const programPath = action.path;
        const programArgs = action.args || [];
        spawn(programPath, programArgs, {
          detached: true,
          stdio: "ignore",
          shell: true,
        });
      } else if (platform === "linux") {
        // Linux: use xdg-open for .desktop or direct spawn for binaries
        if (action.path.endsWith(".desktop")) {
          spawn("gtk-launch", [path.basename(action.path, ".desktop")], {
            detached: true,
            stdio: "ignore",
          });
        } else {
          spawn(action.path, action.args || [], {
            detached: true,
            stdio: "ignore",
          });
        }
      } else {
        // Fallback: try spawning directly
        spawn(action.path, action.args || [], {
          detached: true,
          stdio: "ignore",
        });
      }
      break;
    }
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

function showRingAtCursor(profileIndex) {
  // Guard: ignore repeated shortcut triggers (key repeat) if ring is already visible
  if (ringWindow && !ringWindow.isDestroyed() && ringWindow.isVisible()) {
    return;
  }

  activeProfileIndex = profileIndex;
  if (!ringWindow || ringWindow.isDestroyed()) {
    createRingWindow();
  }
  const cursor = screen.getCursorScreenPoint();
  const x = Math.round(cursor.x - 200);
  const y = Math.round(cursor.y - 200);
  ringWindow.setBounds({ x, y, width: 400, height: 400 });

  // Send active profile slices to the ring window
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

// ─── Global Shortcut ───

let registeredShortcuts = [];

function registerAllShortcuts() {
  // Unregister all previous shortcuts
  for (const s of registeredShortcuts) {
    try { globalShortcut.unregister(s); } catch {}
  }
  registeredShortcuts = [];

  // Register one shortcut per profile
  for (let i = 0; i < config.profiles.length; i++) {
    const profile = config.profiles[i];
    if (!profile.shortcut) continue;

    // Map Super to Meta for Electron
    const mapped = profile.shortcut.replace(/Super/g, "Meta");
    const idx = i; // capture for closure

    try {
      globalShortcut.register(mapped, () => showRingAtCursor(idx));
      registeredShortcuts.push(mapped);
    } catch (e) {
      console.error(`Failed to register shortcut for profile "${profile.name}":`, mapped, e);
    }
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

ipcMain.handle("get_active_profile", () => {
  return {
    profileIndex: activeProfileIndex,
    profile: config.profiles[activeProfileIndex] || config.profiles[0],
  };
});

ipcMain.handle("save_config", (_e, newConfig) => {
  saveConfigToDisk(newConfig);
  config = newConfig;

  // Re-register all shortcuts (any could have changed)
  registerAllShortcuts();

  // Update ring window live with active profile
  if (ringWindow && config.profiles[activeProfileIndex]) {
    const json = JSON.stringify(config.profiles[activeProfileIndex].slices);
    ringWindow.webContents.executeJavaScript(
      `window.__updateSlices(${json})`
    );
  }
});

ipcMain.handle("execute_action", (_e, index) => {
  const profile = config.profiles[activeProfileIndex];
  if (!profile) throw new Error("Invalid profile index");
  const slice = profile.slices[index];
  if (!slice) throw new Error("Invalid slice index");
  executeAction(slice.action);
});

ipcMain.handle("hide_ring", () => {
  if (ringWindow && !ringWindow.isDestroyed()) ringWindow.hide();
});

ipcMain.handle("open_file_dialog", async () => {
  const platform = process.platform;
  let defaultPath;
  let filters;

  if (platform === "darwin") {
    defaultPath = "/Applications";
    filters = [{ name: "Applications", extensions: ["app"] }];
  } else if (platform === "win32") {
    defaultPath = "C:\\Program Files";
    filters = [
      { name: "Executables", extensions: ["exe", "cmd", "bat", "lnk"] },
      { name: "All Files", extensions: ["*"] },
    ];
  } else {
    defaultPath = "/usr/bin";
    filters = [{ name: "All Files", extensions: ["*"] }];
  }

  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ["openFile"],
    defaultPath,
    filters,
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
  registerAllShortcuts();
});

app.on("window-all-closed", () => {
  // Keep running in tray on macOS
});
