const { ipcMain, app, dialog, nativeImage } = require("electron");
const path = require("node:path");
const fs = require("node:fs");
const { captureException, saveTelemetryConsent, setSentryEnabled, getSentryEnabled } = require("./telemetry");
const { getConfig, setConfig, getActiveProfileIndex, saveConfigToDisk } = require("./config");
const { executeAction } = require("./actions");
const { getMainWindow, getRingWindow } = require("./windows");
const { registerAllShortcuts } = require("./shortcuts");

// ─── IPC ───

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
  saveConfigToDisk(newConfig);
  setConfig(newConfig);

  // Re-register all shortcuts (any could have changed)
  registerAllShortcuts();

  // Update ring window live with active profile
  const ringWindow = getRingWindow();
  const activeProfileIndex = getActiveProfileIndex();
  if (ringWindow && newConfig.profiles[activeProfileIndex]) {
    const json = JSON.stringify(newConfig.profiles[activeProfileIndex].slices);
    ringWindow.webContents.executeJavaScript(
      `window.__updateSlices(${json})`
    );
  }
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
  // app.getFileIcon crashes on macOS 26 + Electron 35 (native V8 SIGTRAP)
  // Use nativeImage.createFromPath for .app bundles on macOS instead
  try {
    if (process.platform === "darwin" && filePath.endsWith(".app")) {
      const icnsPath = path.join(filePath, "Contents", "Resources");
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
    const icon = await app.getFileIcon(filePath, { size: "large" });
    return icon.toDataURL();
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

module.exports = {};
