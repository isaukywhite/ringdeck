const { globalShortcut } = require("electron");
const { captureException } = require("./telemetry");
const { getConfig } = require("./config");
const { showRingAtCursor } = require("./windows");

// ─── Global Shortcut ───

let registeredShortcuts = [];

function registerAllShortcuts() {
  // Unregister all previous shortcuts
  for (const s of registeredShortcuts) {
    try { globalShortcut.unregister(s); } catch (e) { captureException(e); }
  }
  registeredShortcuts = [];

  const config = getConfig();

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

function getRegisteredShortcuts() {
  return registeredShortcuts;
}

module.exports = {
  registerAllShortcuts,
  getRegisteredShortcuts,
};
