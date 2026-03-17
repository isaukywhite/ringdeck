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
  net,
} = require("electron");
const path = require("node:path");
const fs = require("node:fs");
const crypto = require("node:crypto");
const os = require("node:os");

// ─── Error Reporting (GlitchTip via Sentry API) ───

const SENTRY_KEY = "77683c1f1e2c4cb48f396713891d691d";
const SENTRY_URL = "https://ringdeckglitchtip.i2tech.dev/api/1/store/";
const TELEMETRY_PATH = path.join(app.getPath("userData"), "telemetry.json");

function getTelemetryConsent() {
  try {
    const data = JSON.parse(fs.readFileSync(TELEMETRY_PATH, "utf-8"));
    return data.consent;
  } catch {
    return null;
  }
}

function saveTelemetryConsent(consent) {
  fs.writeFileSync(TELEMETRY_PATH, JSON.stringify({ consent }, null, 2));
}

let sentryEnabled = getTelemetryConsent() === true;

function captureException(err, extra) {
  if (!sentryEnabled) return;
  const payload = {
    event_id: crypto.randomUUID().replaceAll("-", ""),
    timestamp: new Date().toISOString(),
    platform: "node",
    level: "error",
    release: `ringdeck@${app.getVersion()}`,
    environment: app.isPackaged ? "production" : "development",
    contexts: {
      os: { name: process.platform, version: os.release() },
      runtime: { name: "Electron", version: process.versions.electron },
    },
    exception: {
      values: [{
        type: err.name || "Error",
        value: err.message || String(err),
        stacktrace: err.stack ? { frames: parseStack(err.stack) } : undefined,
      }],
    },
    extra: extra || {},
  };

  try {
    const url = `${SENTRY_URL}?sentry_key=${SENTRY_KEY}`;
    const req = net.request({ method: "POST", url });
    req.setHeader("Content-Type", "application/json");
    req.on("response", (res) => {
      console.log("[RingDeck] Error report sent, status:", res.statusCode);
    });
    req.on("error", (e) => {
      console.error("[RingDeck] Error report failed:", e.message);
    });
    req.write(JSON.stringify(payload));
    req.end();
  } catch {}
}

function parseStack(stack) {
  return stack.split("\n").slice(1).reverse().map((line) => {
    const m = line.match(/at\s+(?:(.+?)\s+)?\(?(.*?):(\d+):(\d+)\)?/);
    if (!m) return { filename: line.trim(), lineno: 0, colno: 0, function: "?" };
    return { function: m[1] || "?", filename: m[2], lineno: +m[3], colno: +m[4] };
  }).filter((f) => f.lineno > 0);
}

function setSentryEnabled(enabled) {
  sentryEnabled = enabled;
}

async function askTelemetryConsent() {
  const icon = nativeImage.createFromPath(
    path.join(__dirname, "..", "logo_ring_2_1.png")
  );
  const { response } = await dialog.showMessageBox({
    type: "question",
    icon,
    buttons: ["Yes, send anonymous reports", "No, thanks"],
    defaultId: 0,
    cancelId: 1,
    title: "RingDeck — Error Reporting",
    message: "Help improve RingDeck?",
    detail: "Would you like to send anonymous crash and error reports? No personal data is collected — only technical information to help fix bugs.",
  });
  const consent = response === 0;
  saveTelemetryConsent(consent);
  return consent;
}

// ─── Global Error Handlers ───

process.on("uncaughtException", (err) => {
  console.error("[RingDeck] Uncaught exception:", err);
  captureException(err);
});

process.on("unhandledRejection", (reason) => {
  console.error("[RingDeck] Unhandled rejection:", reason);
  if (reason instanceof Error) captureException(reason);
});

// ─── Config ───

const CONFIG_PATH = path.join(app.getPath("userData"), "config.json");

const DEFAULT_SETTINGS = {
  ringColor: '#0A84FF',
  ringSize: 'medium',
  closeToTray: true,
};

const RING_SCALE = { tiny: 0.45, mini: 0.6, small: 0.75, medium: 1, large: 1.3 };

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
          path: String.raw`C:\Program Files\Google\Chrome\Application\chrome.exe`,
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
  // Migrate: add settings if missing
  if (!cfg.settings) {
    cfg.settings = { ...DEFAULT_SETTINGS };
    saveConfigToDisk(cfg);
  }
  return cfg;
}

function loadConfig() {
  try {
    if (fs.existsSync(CONFIG_PATH)) {
      const raw = JSON.parse(fs.readFileSync(CONFIG_PATH, "utf-8"));
      return migrateConfig(raw);
    }
  } catch (e) {
    captureException(e);
    console.error("[RingDeck] Config load error:", e);
  }
  const defaults = getDefaultConfig();
  saveConfigToDisk(defaults);
  return structuredClone(defaults);
}

function saveConfigToDisk(cfg) {
  fs.mkdirSync(path.dirname(CONFIG_PATH), { recursive: true });
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(cfg, null, 2));
}

function getRingColor() {
  return (config.settings && config.settings.ringColor) || "#0A84FF";
}

function getRingWindowSize() {
  const size = (config.settings && config.settings.ringSize) || "medium";
  const scale = RING_SCALE[size] || 1;
  return Math.round(550 * scale);
}

// ─── Actions ───

const { spawn } = require("node:child_process");
const { shell } = require("electron");

function executeAction(action) {
  const platform = process.platform;

  switch (action.type) {
    case "Script": {
      let child;
      if (platform === "win32") {
        if (action.command.startsWith("powershell")) {
          // Write script to temp .ps1 file to avoid argument escaping issues
          const raw = action.command.replace(/^powershell(?:\.exe)?\s*(?:-Command|-c)?\s*/i, '');
          const tmpFile = path.join(os.tmpdir(), `ringdeck-ps-${Date.now()}.ps1`);
          console.log("[RingDeck] PS raw script:", raw.substring(0, 200));
          console.log("[RingDeck] PS temp file:", tmpFile);
          fs.writeFileSync(tmpFile, raw, "utf8");
          child = spawn("powershell.exe", [ // NOSONAR — user-configured action
            "-NoProfile", "-WindowStyle", "Hidden", "-ExecutionPolicy", "Bypass", "-File", tmpFile
          ], {
            detached: true, stdio: ["ignore", "pipe", "pipe"], shell: false, windowsHide: true
          });
          child.stdout.on("data", (d) => console.log("[RingDeck] PS stdout:", d.toString()));
          child.stderr.on("data", (d) => console.error("[RingDeck] PS stderr:", d.toString()));
          child.on("close", (code) => {
            console.log("[RingDeck] PS exit code:", code);
            try { fs.unlinkSync(tmpFile); } catch { /* temp file cleanup */ }
          });
        } else {
          child = spawn("cmd", ["/c", action.command], { // NOSONAR — user-configured action
            detached: true, stdio: "ignore", shell: false, windowsHide: true
          });
        }
      } else {
        child = spawn("sh", ["-c", action.command], { detached: true, stdio: "ignore" }); // NOSONAR — user-configured action
      }
      child.on("error", (err) => { captureException(err); console.error("Script spawn error:", err); });
      child.unref();
      break;
    }
    case "Program": {
      if (platform === "darwin" && action.path.endsWith(".app")) {
        // macOS: use 'open -a' for .app bundles
        const args = ["-a", action.path];
        if (action.args?.length) {
          args.push("--args", ...action.args);
        }
        const child = spawn("open", args, { detached: true, stdio: "ignore" }); // NOSONAR — user-configured action
        child.on("error", (err) => { captureException(err); console.error("Program spawn error:", err); });
        child.unref();
      } else {
        // Windows & Linux: use Electron shell.openPath (native, reliable)
        shell.openPath(action.path).then((err) => {
          if (err) { captureException(new Error("shell.openPath: " + err)); console.error("shell.openPath error:", err); }
        });
      }
      break;
    }
    case "System":
      console.log("System action not yet implemented:", action.action);
      break;
    case "Submenu":
      // Submenu navigation is handled by the ring renderer, not here
      break;
  }
}

// ─── Windows ───

let mainWindow = null;
let ringWindow = null;
let ringReady = false;
let isQuitting = false;
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
    if (isQuitting) return; // Let it close during app.quit()

    const closeToTray = config.settings?.closeToTray !== false;
    if (closeToTray) {
      e.preventDefault();
      mainWindow.hide();
    } else {
      // closeToTray is OFF — quit the entire app
      isQuitting = true;
      if (tray) { tray.destroy(); tray = null; }
      if (ringWindow && !ringWindow.isDestroyed()) ringWindow.destroy();
      globalShortcut.unregisterAll();
      app.quit();
    }
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

  ringWindow.webContents.on("did-finish-load", () => {
    ringReady = true;
    // Pre-load slices so ring is ready before first activation
    sendRingData(activeProfileIndex);
  });

  ringWindow.on("blur", () => {
    if (!ringWindow.isDestroyed()) ringWindow.hide();
  });
}

function sendRingData(profileIndex) {
  const profile = config.profiles[profileIndex];
  if (profile && ringWindow && !ringWindow.isDestroyed()) {
    ringWindow.webContents.send("ring-data", {
      slices: profile.slices,
      color: getRingColor(),
      size: (config.settings && config.settings.ringSize) || "medium",
    });
  }
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

  const winSize = getRingWindowSize();
  const half = Math.round(winSize / 2);
  const cursor = screen.getCursorScreenPoint();
  const x = Math.round(cursor.x - half);
  const y = Math.round(cursor.y - half);
  ringWindow.setBounds({ x, y, width: winSize, height: winSize });

  // Send latest slices and show
  sendRingData(profileIndex);
  ringWindow.show();
  ringWindow.focus();
}

// ─── Global Shortcut ───

let registeredShortcuts = [];

function registerAllShortcuts() {
  // Unregister all previous shortcuts
  for (const s of registeredShortcuts) {
    try { globalShortcut.unregister(s); } catch (e) { captureException(e); }
  }
  registeredShortcuts = [];

  // Register one shortcut per profile
  for (let i = 0; i < config.profiles.length; i++) {
    const profile = config.profiles[i];
    if (!profile.shortcut) continue;

    // Map Super to Meta for Electron
    const mapped = profile.shortcut.replaceAll("Super", "Meta");
    const idx = i; // capture for closure

    try {
      globalShortcut.register(mapped, () => showRingAtCursor(idx));
      registeredShortcuts.push(mapped);
    } catch (e) {
      captureException(e, { profile: profile.name, shortcut: mapped });
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
        isQuitting = true;
        if (tray) { tray.destroy(); tray = null; }
        if (ringWindow && !ringWindow.isDestroyed()) ringWindow.destroy();
        globalShortcut.unregisterAll();
        if (mainWindow && !mainWindow.isDestroyed()) mainWindow.destroy();
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

ipcMain.handle("get_app_version", () => app.getVersion());

ipcMain.handle("get_telemetry_consent", () => sentryEnabled);

ipcMain.handle("set_telemetry_consent", (_e, consent) => {
  saveTelemetryConsent(consent);
  setSentryEnabled(consent);
});

ipcMain.handle("get_config", () => config);

ipcMain.handle("get_active_profile", () => {
  return {
    profileIndex: activeProfileIndex,
    profile: config.profiles[activeProfileIndex] || config.profiles[0],
  };
});

ipcMain.handle("get_ring_color", () => getRingColor());

ipcMain.handle("get_ring_size", () => {
  return (config.settings && config.settings.ringSize) || "medium";
});

ipcMain.handle("set_ring_color", (_e, hex) => {
  if (!config.settings) config.settings = {};
  config.settings.ringColor = hex;
  saveConfigToDisk(config);
});

ipcMain.handle("set_ring_size", (_e, size) => {
  if (!config.settings) config.settings = {};
  config.settings.ringSize = size;
  saveConfigToDisk(config);
});

ipcMain.handle("save_settings", (_e, settings) => {
  const prevSettings = config.settings || {};
  config.settings = settings;
  saveConfigToDisk(config);

  // Apply launch at startup
  if (settings.launchAtStartup !== prevSettings.launchAtStartup) {
    try {
      app.setLoginItemSettings({
        openAtLogin: !!settings.launchAtStartup,
        name: "RingDeck",
      });
    } catch (e) {
      captureException(e);
      console.error("[RingDeck] Failed to set login item:", e);
    }
  }

  // Apply error reporting
  if (settings.sendErrorReports !== prevSettings.sendErrorReports) {
    const enabled = !!settings.sendErrorReports;
    setSentryEnabled(enabled);
    saveTelemetryConsent(enabled);
  }
});

ipcMain.handle("save_config", (_e, newConfig) => {
  // Preserve settings from main process (renderer may have stale copy)
  newConfig.settings = config.settings;
  saveConfigToDisk(newConfig);
  config = newConfig;

  // Re-register all shortcuts (any could have changed)
  registerAllShortcuts();

  // Update ring window live with active profile
  if (ringReady) {
    sendRingData(activeProfileIndex);
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

ipcMain.handle("get_file_icon", async (_e, filePath) => {
  try {
    let resolvedPath = filePath;

    // Resolve .lnk shortcuts on Windows to their target exe
    if (process.platform === "win32" && filePath.toLowerCase().endsWith(".lnk")) {
      try {
        const { execSync } = require("node:child_process");
        const ps = `(New-Object -ComObject WScript.Shell).CreateShortcut('${filePath.replace(/'/g, "''")}').TargetPath`;
        const target = execSync(`powershell -NoProfile -Command "${ps}"`, {
          encoding: "utf8",
          windowsHide: true,
          timeout: 5000,
        }).trim();
        if (target && fs.existsSync(target)) {
          resolvedPath = target;
          console.log("[RingDeck] Resolved .lnk to:", resolvedPath);
        }
      } catch (e) {
        console.warn("[RingDeck] .lnk resolution failed, using original path:", e.message);
      }
    }

    // macOS: .app bundles — extract .icns manually (app.getFileIcon can crash)
    if (process.platform === "darwin" && resolvedPath.endsWith(".app")) {
      const icnsPath = path.join(resolvedPath, "Contents", "Resources");
      if (fs.existsSync(icnsPath)) {
        const files = fs.readdirSync(icnsPath);
        const icns = files.find((f) => f.endsWith(".icns"));
        if (icns) {
          const img = nativeImage.createFromPath(path.join(icnsPath, icns));
          if (!img.isEmpty()) {
            return img.resize({ width: 64, height: 64 }).toDataURL();
          }
        }
      }
      return null;
    }

    // All platforms: use Electron's built-in icon extraction
    const icon = await app.getFileIcon(resolvedPath, { size: "large" });
    if (icon && !icon.isEmpty()) {
      const dataUrl = icon.toDataURL();
      // Validate that the data URL is actually an image
      if (dataUrl && dataUrl.startsWith("data:image/")) {
        console.log("[RingDeck] Icon extracted for:", path.basename(resolvedPath), "size:", icon.getSize());
        return dataUrl;
      }
    }

    console.warn("[RingDeck] Icon extraction returned empty for:", resolvedPath);
    return null;
  } catch (e) {
    captureException(e, { filePath });
    console.error("[RingDeck] get_file_icon error:", e.message);
    return null;
  }
});

ipcMain.handle("execute_submenu_action", (_e, parentIndex, childIndex) => {
  const profile = config.profiles[activeProfileIndex];
  if (!profile) throw new Error("Invalid profile index");
  const parentSlice = profile.slices[parentIndex];
  if (!parentSlice || parentSlice.action?.type !== "Submenu") throw new Error("Invalid parent slice");
  const childSlice = parentSlice.action.slices[childIndex];
  if (!childSlice) throw new Error("Invalid child slice index");
  executeAction(childSlice.action);
});

ipcMain.handle("open_file_dialog", async () => {
  try {
    const platform = process.platform;
    let defaultPath;
    let filters;

    if (platform === "darwin") {
      defaultPath = "/Applications";
      filters = [{ name: "Applications", extensions: ["app"] }];
    } else if (platform === "win32") {
      defaultPath = String.raw`C:\Program Files`;
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
  } catch (e) {
    captureException(e);
    console.error("[RingDeck] open_file_dialog error:", e);
    return null;
  }
});

// ─── App Lifecycle ───

// ─── Single Instance Lock ───

const gotLock = app.requestSingleInstanceLock();

if (gotLock) {
  app.on("second-instance", () => {
    if (mainWindow) {
      mainWindow.show();
      mainWindow.focus();
    }
  });
} else {
  app.exit(0);
}

app.whenReady().then(async () => { // NOSONAR
  // Set dock icon
  const appIcon = nativeImage.createFromPath(
    path.join(__dirname, "..", "logo_ring_2_1.png")
  );
  if (process.platform === "darwin" && app.dock) {
    app.dock.setIcon(appIcon);
  }

  // Ask for telemetry consent on first launch
  if (getTelemetryConsent() === null) {
    const consent = await askTelemetryConsent();
    setSentryEnabled(consent);
  }

  createMainWindow();
  createRingWindow();
  setupTray();
  registerAllShortcuts();
});

app.on("window-all-closed", () => {
  // Keep running in tray on macOS
});
