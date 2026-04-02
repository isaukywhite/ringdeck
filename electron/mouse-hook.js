const { captureException } = require("./telemetry");
const { getConfig } = require("./config");
const { showRingAtCursor } = require("./windows");

// ─── Mouse Hook (uiohook-napi) ───
// Listens to OS-level mouse button events to trigger RingDeck profiles.
// This enables hardware mouse buttons (e.g. MX Master 4 thumb/forward buttons)
// to act as ring triggers — replacing Logi Options+ entirely.

let uiohook = null;
let isRunning = false;
let captureMode = false;
let captureCallback = null;

// Button ID reference (uiohook-napi constants):
// 1 = Left, 2 = Right, 3 = Middle, 4 = Side/Back, 5 = Side/Forward
// MX Master 4: thumb button is typically button 4 or 5 depending on driver mapping.
// Run diagnose() first to confirm exact IDs on your hardware.

// Primary mouse buttons that MUST NOT be used as ring triggers.
// Binding these would break normal mouse interaction entirely.
const BLOCKED_BUTTONS = new Set([1, 2]);

function resolveProfileIndexById(profileId) {
  const config = getConfig();
  if (!config.profiles) return -1;
  return config.profiles.findIndex((p) => p.id === profileId);
}

function handleMouseButtonDown(event) {
  const { button } = event;

  // Never intercept primary mouse buttons — that would break normal click interaction.
  if (BLOCKED_BUTTONS.has(button)) return;

  // If capture mode is active, forward button ID to the waiting UI callback
  if (captureMode && captureCallback) {
    captureCallback(button);
    captureCallback = null;
    captureMode = false;
    return;
  }

  const config = getConfig();
  const bindings = config.mouseBindings || [];

  for (const binding of bindings) {
    if (binding.button === button) {
      const profileIndex = resolveProfileIndexById(binding.profileId);
      if (profileIndex >= 0) {
        showRingAtCursor(profileIndex);
      } else {
        console.warn(`[MouseHook] Profile "${binding.profileId}" not found for button ${button}`);
      }
      return; // first match wins
    }
  }
}

function handleMouseButtonUp(event) {
  const { button } = event;
  const config = getConfig();
  const activationMode = (config.settings && config.settings.activationMode) || 'click';
  if (activationMode !== 'release') return;

  const bindings = config.mouseBindings || [];
  for (const binding of bindings) {
    if (binding.button === button) {
      const { getRingWindow } = require("./windows");
      const rw = getRingWindow();
      if (rw && !rw.isDestroyed() && rw.isVisible()) {
        rw.webContents.send("hardware_trigger_released");
      }
      return;
    }
  }
}

function start() {
  if (isRunning) return;

  try {
    // Lazy-load to avoid crash if uiohook-napi is unavailable on the platform
    uiohook = require("uiohook-napi");
  } catch (e) {
    captureException(e);
    console.warn("[MouseHook] uiohook-napi not available — mouse button shortcuts disabled:", e.message);
    return;
  }

  try {
    uiohook.uIOhook.on("mousedown", handleMouseButtonDown);
    uiohook.uIOhook.on("mouseup", handleMouseButtonUp);
    uiohook.uIOhook.start();
    isRunning = true;
    console.log("[MouseHook] Started — listening for mouse button events.");
  } catch (e) {
    captureException(e);
    console.error("[MouseHook] Failed to start:", e);
  }
}

function stop() {
  if (!isRunning || !uiohook) return;
  try {
    uiohook.uIOhook.stop();
    isRunning = false;
    console.log("[MouseHook] Stopped.");
  } catch (e) {
    captureException(e);
    console.error("[MouseHook] Failed to stop:", e);
  }
}

/**
 * Enable capture mode: the next mouse button pressed will be forwarded
 * to the callback instead of triggering a ring. Used by the config UI
 * "Capture button" feature.
 * @param {(buttonId: number) => void} callback
 */
function startCapture(callback) {
  captureMode = true;
  captureCallback = callback;
}

function stopCapture() {
  captureMode = false;
  captureCallback = null;
}

/**
 * Diagnostic mode: logs every mouse button event with its ID.
 * Run this to discover which button ID corresponds to MX Master 4 thumb.
 * Usage: call diagnose(), press each physical button, check console output.
 */
function diagnose() {
  if (!uiohook) {
    try {
      uiohook = require("uiohook-napi");
    } catch (e) {
      console.error("[MouseHook] Cannot load uiohook-napi for diagnose:", e.message);
      return;
    }
  }
  console.log("[MouseHook] DIAGNOSE MODE — press each mouse button and observe the ID below:");
  uiohook.uIOhook.on("mousedown", (e) => console.log(`[MouseHook] DIAGNOSE: button=${e.button} x=${e.x} y=${e.y}`));
  uiohook.uIOhook.on("mouseup",   (e) => console.log(`[MouseHook] DIAGNOSE: button_up=${e.button}`));
  if (!isRunning) uiohook.uIOhook.start();
}

module.exports = { start, stop, startCapture, stopCapture, diagnose };
