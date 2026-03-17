const { app, Tray, Menu, nativeImage } = require("electron");
const path = require("node:path");

// ─── Initialize modules (side effects: global error handlers, IPC registrations) ───
const { getTelemetryConsent, askTelemetryConsent, setSentryEnabled } = require("./telemetry");
require("./config");
require("./actions");
const { createMainWindow, createRingWindow, getMainWindow, setTray } = require("./windows");
const { registerAllShortcuts } = require("./shortcuts");
require("./ipc");

// ─── Tray ───

function setupTray() {
  const iconPath = path.join(__dirname, "icon.png");
  const icon = nativeImage.createFromPath(iconPath).resize({ width: 18, height: 18 });
  const tray = new Tray(icon);

  const mainWindow = getMainWindow();
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

  setTray(tray);
}

// ─── Single Instance Lock ───

const gotLock = app.requestSingleInstanceLock();

if (gotLock) {
  app.on("second-instance", () => {
    const mainWindow = getMainWindow();
    if (mainWindow) {
      mainWindow.show();
      mainWindow.focus();
    }
  });
} else {
  app.exit(0);
}

// ─── App Lifecycle ───

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
