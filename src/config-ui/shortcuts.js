import { activeProfile, getActiveRecorder, setActiveRecorder } from './state.js';
import { render } from './render.js';

export function stopRecording() {
  const activeRecorder = getActiveRecorder();
  if (activeRecorder) {
    activeRecorder.cleanup();
    setActiveRecorder(null);
  }
}

export function startRecording() {
  stopRecording();

  const box = document.getElementById("shortcut-box");
  const display = document.getElementById("shortcut-display");
  const action = document.getElementById("shortcut-action");

  display.textContent = "Press keys...";
  box.classList.add("recording");
  action.textContent = "Cancel";

  function onKeyDown(e) {
    e.preventDefault();
    e.stopPropagation();

    const mods = [];
    if (e.ctrlKey) mods.push("Ctrl");
    if (e.altKey) mods.push("Alt");
    if (e.shiftKey) mods.push("Shift");
    if (e.metaKey) mods.push("Super");

    if (["Control", "Alt", "Shift", "Meta"].includes(e.key)) {
      display.textContent = mods.join(" + ") + " + ...";
      return;
    }

    if (e.key === "Escape" && mods.length === 0) {
      cancel();
      return;
    }

    const keyMap = {
      " ": "Space", ArrowUp: "Up", ArrowDown: "Down",
      ArrowLeft: "Left", ArrowRight: "Right",
      Escape: "Escape", Enter: "Enter", Tab: "Tab",
      Backspace: "Backspace", Delete: "Delete",
    };
    const key = keyMap[e.key] || e.key.toUpperCase();
    mods.push(key);
    const shortcutStr = mods.join("+");
    const profile = activeProfile();
    if (profile) profile.shortcut = shortcutStr;
    finish();
  }

  function onKeyUp(e) {
    const mods = [];
    if (e.ctrlKey) mods.push("Ctrl");
    if (e.altKey) mods.push("Alt");
    if (e.shiftKey) mods.push("Shift");
    if (e.metaKey) mods.push("Super");
    display.textContent = mods.length === 0 ? "Press keys..." : mods.join(" + ") + " + ...";
  }

  function cancel() {
    cleanup();
    setActiveRecorder(null);
    box.classList.remove("recording");
    display.textContent = (activeProfile()?.shortcut) || "Not set";
    action.textContent = "Record";
  }

  function finish() {
    cleanup();
    setActiveRecorder(null);
    render();
  }

  function cleanup() {
    document.removeEventListener("keydown", onKeyDown, true);
    document.removeEventListener("keyup", onKeyUp, true);
  }

  document.addEventListener("keydown", onKeyDown, true);
  document.addEventListener("keyup", onKeyUp, true);

  box.onclick = (e) => {
    e.stopPropagation();
    cancel();
  };

  setActiveRecorder({ cleanup });
}
