import { appName } from './utils.js';
import { SUBMENU_TEMPLATES } from './templates.js';
import {
  getConfig, activeProfile,
  getExpandedSlice, setExpandedSlice,
  getDragSrcIndex, setDragSrcIndex,
  getActiveProfileIndex, setActiveProfileIndex,
  getSentryEnabled, setSentryEnabled,
  getActiveView, setActiveView,
  setAppVersion,
} from './state.js';
import { render, registerBindEvents } from './render.js';
import { startRecording } from './shortcuts.js';
import { saveConfig } from './config.js';
import { addProfile, deleteProfile } from './profiles.js';
import { openIconPicker, openSubIconPicker } from './icon-picker.js';

// ─── Load app version once ───

globalThis.api.getAppVersion().then(v => {
  if (v) setAppVersion(`v${v}`);
}).catch(() => { /* fallback */ });

// ─── Settings event bindings ───

let _colorDebounceTimer = null;
function debouncedSetRingColor(hex) {
  clearTimeout(_colorDebounceTimer);
  _colorDebounceTimer = setTimeout(() => {
    globalThis.api.setRingColor(hex);
  }, 150);
}

function showSaveToast() {
  let toast = document.getElementById('save-toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'save-toast';
    toast.className = 'save-toast';
    toast.textContent = '✓ Saved';
    document.body.appendChild(toast);
  }
  toast.classList.remove('show');
  void toast.offsetHeight;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 1500);
}

function bindSettingsEvents() {
  const config = getConfig();

  // Swatch clicks (built-in + custom)
  document.querySelectorAll('.swatch').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      if (e.target.closest('.swatch-delete')) return;
      const presetId = btn.dataset.presetId;
      const color = btn.dataset.presetColor;
      if (!config.settings) config.settings = {};
      config.settings.activePreset = presetId;
      config.settings.ringColor = color;
      await globalThis.api.setRingColor(color);
      await globalThis.api.saveSettings(config.settings);
      render();
    });
  });

  // Delete custom preset
  document.querySelectorAll('.swatch-delete').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const id = btn.dataset.deletePreset;
      if (!config.settings) return;
      config.settings.customPresets = (config.settings.customPresets || []).filter(p => p.id !== id);
      if (config.settings.activePreset === id) {
        config.settings.activePreset = 'nebula';
        config.settings.ringColor = '#0A84FF';
        await globalThis.api.setRingColor('#0A84FF');
      }
      await globalThis.api.saveSettings(config.settings);
      render();
    });
  });

  // Custom color picker
  const picker = document.getElementById('custom-color-picker');
  const hexInput = document.getElementById('custom-color-hex');
  if (picker) {
    picker.addEventListener('input', (e) => {
      const hex = e.target.value;
      if (hexInput) hexInput.value = hex;
      debouncedSetRingColor(hex);
    });
  }
  if (hexInput) {
    hexInput.addEventListener('change', () => {
      let hex = hexInput.value.trim();
      if (!hex.startsWith('#')) hex = '#' + hex;
      if (/^#[0-9A-Fa-f]{6}$/.test(hex)) {
        if (picker) picker.value = hex;
        globalThis.api.setRingColor(hex);
      }
    });
  }

  // Save custom preset
  const savePresetBtn = document.getElementById('save-preset-btn');
  if (savePresetBtn) {
    savePresetBtn.addEventListener('click', async () => {
      const nameInput = document.getElementById('custom-preset-name');
      const name = nameInput?.value.trim();
      const color = hexInput?.value.trim() || picker?.value || '#0A84FF';
      if (!name) { nameInput?.focus(); return; }
      if (!config.settings) config.settings = {};
      if (!config.settings.customPresets) config.settings.customPresets = [];
      const id = 'custom_' + Date.now();
      config.settings.customPresets.push({ id, name, color });
      config.settings.activePreset = id;
      config.settings.ringColor = color;
      await globalThis.api.setRingColor(color);
      await globalThis.api.saveSettings(config.settings);
      render();
    });
  }

  // Ring size buttons
  for (const btn of document.querySelectorAll('.size-btn')) {
    btn.addEventListener('click', async () => {
      if (!config.settings) config.settings = {};
      config.settings.ringSize = btn.dataset.size;
      await globalThis.api.setRingSize(btn.dataset.size);
      await globalThis.api.saveSettings(config.settings);
      render();
    });
  }

  // Toggles
  const startupToggle = document.getElementById('toggle-startup');
  const trayToggle = document.getElementById('toggle-tray');
  if (startupToggle) {
    startupToggle.addEventListener('change', async () => {
      if (!config.settings) config.settings = {};
      config.settings.launchAtStartup = startupToggle.checked;
      await globalThis.api.saveSettings(config.settings);
      showSaveToast();
    });
  }
  if (trayToggle) {
    trayToggle.addEventListener('change', async () => {
      if (!config.settings) config.settings = {};
      config.settings.closeToTray = trayToggle.checked;
      await globalThis.api.saveSettings(config.settings);
      showSaveToast();
    });
  }
  const errorToggle = document.getElementById('toggle-error-reports');
  if (errorToggle) {
    errorToggle.addEventListener('change', async () => {
      if (!config.settings) config.settings = {};
      config.settings.sendErrorReports = errorToggle.checked;
      setSentryEnabled(errorToggle.checked);
      await globalThis.api.setTelemetryConsent(errorToggle.checked);
      await globalThis.api.saveSettings(config.settings);
      showSaveToast();
    });
  }
}

// ─── Bind detail events for expanded action ───

function bindDetail(idx) {
  const profile = activeProfile();
  if (!profile) return;
  const s = profile.slices[idx];

  const labelInput = document.getElementById(`label-${idx}`);
  if (labelInput) {
    labelInput.addEventListener("input", (e) => {
      s.label = e.target.value;
      const nameEl = document.querySelector(`.action-card[data-card="${idx}"] .action-card-name`);
      if (nameEl) nameEl.textContent = s.label || "Untitled";
    });
    labelInput.addEventListener("click", (e) => e.stopPropagation());
  }

  const typeSelect = document.getElementById(`type-${idx}`);
  if (typeSelect) {
    typeSelect.addEventListener("click", (e) => e.stopPropagation());
    typeSelect.addEventListener("change", (e) => {
      if (e.target.value === "Script") {
        s.action = { type: "Script", command: "" };
      } else if (e.target.value === "Program") {
        s.action = { type: "Program", path: "", args: [] };
      } else if (e.target.value === "Submenu") {
        s.action = { type: "Submenu", slices: [] };
        s.icon = "squares-2x2";
      }
      render();
    });
  }

  const cmdInput = document.getElementById(`cmd-${idx}`);
  if (cmdInput) {
    cmdInput.addEventListener("click", (e) => e.stopPropagation());
    cmdInput.addEventListener("input", (e) => {
      s.action = { type: "Script", command: e.target.value };
      const desc = document.querySelector(`.action-card[data-card="${idx}"] .action-card-desc`);
      if (desc) desc.textContent = e.target.value || "No command";
    });
  }

  const browseBtn = document.getElementById(`browse-${idx}`);
  if (browseBtn) {
    browseBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      handleBrowseClick(s, idx);
    });
  }

  const argsInput = document.getElementById(`args-${idx}`);
  if (argsInput) {
    argsInput.addEventListener("click", (e) => e.stopPropagation());
    argsInput.addEventListener("input", (e) => {
      s.action.args = e.target.value ? e.target.value.split(" ") : [];
    });
  }

  const iconBtn = document.getElementById(`icon-btn-${idx}`);
  if (iconBtn) {
    iconBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      openIconPicker(idx);
    });
  }

  const deleteBtn = document.getElementById(`delete-${idx}`);
  if (deleteBtn) {
    deleteBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      const profile = activeProfile();
      if (profile) profile.slices.splice(idx, 1);
      setExpandedSlice(-1);
      render();
    });
  }

  if (s.action.type === "Submenu") {
    bindSubActionEvents(idx, s);
  }

  document.querySelector(`.action-detail[data-detail="${idx}"]`)?.addEventListener("click", (e) => e.stopPropagation());
}

async function handleBrowseClick(s, idx) {
  const selected = await globalThis.api.openFileDialog();
  if (selected) {
    s.action.path = selected;
    const name = appName(selected);
    const display = document.getElementById(`path-${idx}`);
    if (display) { display.textContent = name; display.classList.remove("empty"); }
    const desc = document.querySelector(`.action-card[data-card="${idx}"] .action-card-desc`);
    if (desc) desc.textContent = name;

    const iconDataUrl = await globalThis.api.getFileIcon(selected);
    if (iconDataUrl) {
      s.customIcon = iconDataUrl;
      const imgHtml = `<img src="${iconDataUrl}" style="width:20px;height:20px;" />`;
      const cardIcon = document.querySelector(`.action-card[data-card="${idx}"] .action-card-icon`);
      if (cardIcon) cardIcon.innerHTML = imgHtml;
      const iconEl = document.getElementById(`icon-btn-${idx}`);
      if (iconEl) iconEl.innerHTML = imgHtml;
      const previewNode = document.querySelector(`.ring-preview-node[data-preview="${idx}"] .preview-icon`);
      if (previewNode) previewNode.innerHTML = imgHtml;
    }
  }
}

function addSlice() {
  const profile = activeProfile();
  if (!profile) return;
  profile.slices.push({
    label: "",
    icon: "cog-6-tooth",
    action: { type: "Script", command: "" },
  });
  setExpandedSlice(profile.slices.length - 1);
  render();
}

function bindSubActionEvents(parentIdx, parentSlice) {
  const subSlices = parentSlice.action.slices || [];

  const addBtn = document.getElementById(`add-sub-${parentIdx}`);
  if (addBtn) {
    addBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      if (!parentSlice.action.slices) parentSlice.action.slices = [];
      parentSlice.action.slices.push({
        label: "",
        icon: "cog-6-tooth",
        action: { type: "Script", command: "" },
      });
      render();
    });
  }

  const templateSelect = document.getElementById(`template-select-${parentIdx}`);
  if (templateSelect) {
    templateSelect.addEventListener("click", (e) => e.stopPropagation());
    templateSelect.addEventListener("change", (e) => {
      e.stopPropagation();
      const idx = e.target.value;
      if (idx === "") return;
      const template = SUBMENU_TEMPLATES[+idx];
      if (!template) return;
      parentSlice.action.slices = structuredClone(template.slices);
      if (!parentSlice.label) parentSlice.label = template.name.replace(/^[^\w]+\s*/, '');
      parentSlice.icon = template.icon;
      render();
    });
  }

  for (let j = 0; j < subSlices.length; j++) {
    const sub = subSlices[j];

    const labelEl = document.getElementById(`sub-label-${parentIdx}-${j}`);
    if (labelEl) {
      labelEl.addEventListener("input", (e) => { sub.label = e.target.value; });
      labelEl.addEventListener("click", (e) => e.stopPropagation());
    }

    const typeEl = document.getElementById(`sub-type-${parentIdx}-${j}`);
    if (typeEl) {
      typeEl.addEventListener("click", (e) => e.stopPropagation());
      typeEl.addEventListener("change", (e) => {
        if (e.target.value === "Script") {
          sub.action = { type: "Script", command: "" };
        } else {
          sub.action = { type: "Program", path: "", args: [] };
        }
        render();
      });
    }

    const cmdEl = document.getElementById(`sub-cmd-${parentIdx}-${j}`);
    if (cmdEl) {
      cmdEl.addEventListener("click", (e) => e.stopPropagation());
      cmdEl.addEventListener("input", (e) => {
        sub.action.command = e.target.value;
      });
    }

    const browseEl = document.getElementById(`sub-browse-${parentIdx}-${j}`);
    if (browseEl) {
      browseEl.addEventListener("click", async (e) => {
        e.stopPropagation();
        const selected = await globalThis.api.openFileDialog();
        if (selected) {
          sub.action.path = selected;
          const pathEl = document.getElementById(`sub-path-${parentIdx}-${j}`);
          if (pathEl) {
            pathEl.textContent = appName(selected);
            pathEl.classList.remove("empty");
          }
          const iconDataUrl = await globalThis.api.getFileIcon(selected);
          if (iconDataUrl) {
            sub.customIcon = iconDataUrl;
          }
          render();
        }
      });
    }

    const delEl = document.getElementById(`sub-del-${parentIdx}-${j}`);
    if (delEl) {
      delEl.addEventListener("click", (e) => {
        e.stopPropagation();
        parentSlice.action.slices.splice(j, 1);
        render();
      });
    }

    const subIconBtn = document.getElementById(`sub-icon-btn-${parentIdx}-${j}`);
    if (subIconBtn) {
      subIconBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        openSubIconPicker(parentIdx, j);
      });
    }
  }
}

// ─── Main bindEvents ───

export function bindEvents() {
  // Config nav tabs (Actions / Settings)
  document.querySelectorAll('.config-nav-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      setActiveView(tab.dataset.view);
      render();
    });
  });

  // Shortcut (always in left pane)
  document.getElementById("shortcut-box")?.addEventListener("click", startRecording);

  const clearShortcutBtn = document.getElementById("clear-shortcut-btn");
  if (clearShortcutBtn) {
    clearShortcutBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      const profile = activeProfile();
      if (profile) {
        profile.shortcut = "";
        render();
      }
    });
  }

  // If settings view, bind settings events and return
  if (getActiveView() === 'settings') {
    bindSettingsEvents();
    return;
  }

  // ─── Actions view bindings ───

  document.getElementById("add-btn")?.addEventListener("click", addSlice);
  document.getElementById("save-btn")?.addEventListener("click", saveConfig);

  // Profile tabs
  document.querySelectorAll(".profile-tab[data-profile]").forEach((tab) => {
    tab.addEventListener("click", () => {
      const idx = +tab.dataset.profile;
      if (idx !== getActiveProfileIndex()) {
        setActiveProfileIndex(idx);
        setExpandedSlice(-1);
        render();
      }
    });
  });

  document.getElementById("add-profile-btn")?.addEventListener("click", addProfile);

  document.getElementById("delete-profile-btn")?.addEventListener("click", deleteProfile);

  document.querySelectorAll("[data-profile-delete]").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const idx = +btn.dataset.profileDelete;
      const config = getConfig();
      if (config.profiles.length <= 1) return;
      if (!confirm(`Delete profile "${config.profiles[idx].name || "Untitled"}"?`)) return;
      config.profiles.splice(idx, 1);
      if (getActiveProfileIndex() >= config.profiles.length) {
        setActiveProfileIndex(config.profiles.length - 1);
      }
      setExpandedSlice(-1);
      render();
    });
  });

  const profileNameInput = document.getElementById("profile-name-input");
  if (profileNameInput) {
    profileNameInput.addEventListener("input", (e) => {
      const profile = activeProfile();
      if (profile) {
        profile.name = e.target.value;
        const tabName = document.querySelector(`.profile-tab-name[data-profile-name="${getActiveProfileIndex()}"]`);
        if (tabName) tabName.textContent = e.target.value || 'Untitled';
        const title = document.querySelector('.right-title');
        if (title) title.textContent = e.target.value || 'Untitled';
      }
    });
    profileNameInput.addEventListener("click", (e) => e.stopPropagation());
  }

  document.querySelectorAll(".action-card-header").forEach((header) => {
    header.addEventListener("click", () => {
      const idx = +header.dataset.index;
      setExpandedSlice(getExpandedSlice() === idx ? -1 : idx);
      render();
      if (getExpandedSlice() >= 0) {
        requestAnimationFrame(() => {
          document.querySelector(`.action-card[data-card="${getExpandedSlice()}"]`)?.scrollIntoView({ behavior: "smooth", block: "nearest" });
        });
      }
    });
  });

  if (getExpandedSlice() >= 0 && getExpandedSlice() < (activeProfile()?.slices.length || 0)) {
    bindDetail(getExpandedSlice());
  }

  document.querySelectorAll(".action-card").forEach((card) => {
    const header = card.querySelector(".action-card-header");
    const idx = +card.dataset.card;

    header.addEventListener("dragstart", (e) => {
      setDragSrcIndex(idx);
      e.dataTransfer.effectAllowed = "move";
      requestAnimationFrame(() => card.classList.add("dragging"));
    });

    header.addEventListener("dragend", () => {
      card.classList.remove("dragging");
      document.querySelectorAll(".action-card").forEach(c => c.classList.remove("drag-over"));
      setDragSrcIndex(-1);
    });

    card.addEventListener("dragover", (e) => {
      if (getDragSrcIndex() === -1 || getDragSrcIndex() === idx) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
      document.querySelectorAll(".action-card.drag-over").forEach(c => c.classList.remove("drag-over"));
      card.classList.add("drag-over");
    });

    card.addEventListener("dragleave", (e) => {
      if (!card.contains(e.relatedTarget)) card.classList.remove("drag-over");
    });

    card.addEventListener("drop", (e) => {
      e.preventDefault();
      e.stopPropagation();
      const dragSrcIndex = getDragSrcIndex();
      if (dragSrcIndex === -1 || dragSrcIndex === idx) return;

      const profile = activeProfile();
      const src = dragSrcIndex;
      const [moved] = profile.slices.splice(src, 1);
      profile.slices.splice(idx, 0, moved);

      let currentExpanded = getExpandedSlice();
      if (currentExpanded === src) currentExpanded = idx;
      else if (src < idx && currentExpanded > src && currentExpanded <= idx) currentExpanded--;
      else if (src > idx && currentExpanded >= idx && currentExpanded < src) currentExpanded++;
      setExpandedSlice(currentExpanded);

      setDragSrcIndex(-1);
      render();
    });
  });
}

// Register bindEvents with render.js to break the circular dependency
registerBindEvents(bindEvents);
