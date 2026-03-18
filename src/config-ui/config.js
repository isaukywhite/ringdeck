import { migrateLegacyProgram, migrateIcon } from './utils.js';
import { getConfig, setConfig, setActiveProfileIndex, setExpandedSlice } from './state.js';
import { render } from './render.js';

export async function loadConfig() {
  let config = await globalThis.api.getConfig();
  // Migrate legacy format if needed
  if (config.slices && !config.profiles) {
    config = {
      profiles: [{
        id: "default",
        name: "Default",
        shortcut: config.shortcut || "",
        slices: config.slices,
      }],
    };
  }
  for (const profile of config.profiles) {
    for (const s of profile.slices) {
      migrateLegacyProgram(s);
      migrateIcon(s);
    }
  }
  setConfig(config);
  setActiveProfileIndex(0);
  setExpandedSlice(-1);
  render();
}

export async function saveConfig() {
  try {
    await globalThis.api.saveConfig(getConfig());
    const btn = document.getElementById("save-btn");
    const status = document.getElementById("save-status");
    if (!btn || !status) return;
    btn.textContent = "Saved";
    btn.classList.add("saved");
    status.textContent = "Changes saved";
    status.classList.add("visible");
    setTimeout(() => {
      btn.textContent = "Save";
      btn.classList.remove("saved");
      status.textContent = "";
      status.classList.remove("visible");
    }, 1500);
  } catch (e) {
    alert("Failed to save: " + e);
  }
}
