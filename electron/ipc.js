const { ipcMain, app, dialog, nativeImage } = require("electron");
const path = require("node:path");
const fs = require("node:fs");
const { captureException, saveTelemetryConsent, setSentryEnabled, getSentryEnabled } = require("./telemetry");
const { getConfig, setConfig, getActiveProfileIndex, saveConfigToDisk } = require("./config");
const { executeAction } = require("./actions");
const { getMainWindow, getRingWindow } = require("./windows");
const { registerAllShortcuts } = require("./shortcuts");

// ─── IPC ───

ipcMain.handle("get_app_version", () => app.getVersion());

ipcMain.handle("get_telemetry_consent", () => getSentryEnabled());

ipcMain.handle("set_telemetry_consent", (_e, consent) => {
  saveTelemetryConsent(consent);
  setSentryEnabled(consent);
});

ipcMain.handle("get_config", () => getConfig());

ipcMain.handle("get_active_profile", () => {
  const config = getConfig();
  const activeProfileIndex = getActiveProfileIndex();
  return {
    profileIndex: activeProfileIndex,
    profile: config.profiles[activeProfileIndex] || config.profiles[0],
  };
});

ipcMain.handle("save_config", (_e, newConfig) => {
  // Preserve settings from main process (renderer may have stale copy)
  // Deep copy to avoid race condition with concurrent saveSettings calls
  const config = getConfig();
  newConfig.settings = JSON.parse(JSON.stringify(config.settings || {}));
  saveConfigToDisk(newConfig);
  setConfig(newConfig);

  // Re-register all shortcuts (any could have changed)
  registerAllShortcuts();

  // Update ring window live with active profile
  const { sendRingData } = require("./windows");
  const activeProfileIndex = getActiveProfileIndex();
  sendRingData(activeProfileIndex);
});

ipcMain.handle("execute_action", (_e, index) => {
  const config = getConfig();
  const activeProfileIndex = getActiveProfileIndex();
  const profile = config.profiles[activeProfileIndex];
  if (!profile) throw new Error("Invalid profile index");
  const slice = profile.slices[index];
  if (!slice) throw new Error("Invalid slice index");
  executeAction(slice.action);
});

ipcMain.handle("hide_ring", () => {
  const ringWindow = getRingWindow();
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
        }
      } catch (_) { /* .lnk resolution failed, use original path */ }
    }

    // macOS: .app bundles
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

    const icon = await app.getFileIcon(resolvedPath, { size: "large" });
    if (icon && !icon.isEmpty()) {
      const dataUrl = icon.toDataURL();
      // Validate that the data URL is actually an image
      if (dataUrl && dataUrl.startsWith("data:image/")) {
        return dataUrl;
      }
    }
    return null;
  } catch (e) {
    captureException(e, { filePath });
    return null;
  }
});

ipcMain.handle("execute_submenu_action", (_e, parentIndex, childIndex) => {
  const config = getConfig();
  const activeProfileIndex = getActiveProfileIndex();
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

    const mainWindow = getMainWindow();
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

// ─── Ring appearance ───

ipcMain.handle("get_ring_color", () => {
  const config = getConfig();
  return (config.settings && config.settings.ringColor) || "#0A84FF";
});

ipcMain.handle("get_ring_size", () => {
  const config = getConfig();
  return (config.settings && config.settings.ringSize) || "medium";
});

ipcMain.handle("set_ring_color", (_e, hex) => {
  const config = getConfig();
  if (!config.settings) config.settings = {};
  config.settings.ringColor = hex;
  saveConfigToDisk(config);
});

ipcMain.handle("set_ring_size", (_e, size) => {
  const config = getConfig();
  if (!config.settings) config.settings = {};
  config.settings.ringSize = size;
  saveConfigToDisk(config);

  // Resize ring window immediately if it exists
  const ringWindow = getRingWindow();
  if (ringWindow && !ringWindow.isDestroyed() && ringWindow.isVisible()) {
    const RING_SIZES = require("./windows").RING_SIZES;
    const winSize = RING_SIZES[size] || 550;
    const bounds = ringWindow.getBounds();
    const cx = bounds.x + Math.round(bounds.width / 2);
    const cy = bounds.y + Math.round(bounds.height / 2);
    const half = Math.round(winSize / 2);
    ringWindow.setBounds({ x: cx - half, y: cy - half, width: winSize, height: winSize });
  }
});

ipcMain.handle("save_settings", (_e, settings) => {
  const config = getConfig();
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
    }
  }

  // Apply error reporting
  if (settings.sendErrorReports !== prevSettings.sendErrorReports) {
    const enabled = !!settings.sendErrorReports;
    setSentryEnabled(enabled);
    saveTelemetryConsent(enabled);
  }
});

module.exports = {};
