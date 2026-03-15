import { ICON_MAP, ICON_CATEGORIES, resolveIcon } from './icons.js';

let sentryEnabled = false;
globalThis.api.getTelemetryConsent().then((v) => { sentryEnabled = v; }); // NOSONAR

const SUBMENU_TEMPLATES = [
  {
    name: "🌐 Browsers",
    icon: "globe-alt",
    slices: [
      { label: "Chrome", icon: "globe-alt", action: { type: "Program", path: String.raw`C:\Program Files\Google\Chrome\Application\chrome.exe`, args: [] } },
      { label: "Edge", icon: "globe-alt", action: { type: "Program", path: String.raw`C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe`, args: [] } },
      { label: "Firefox", icon: "globe-alt", action: { type: "Program", path: String.raw`C:\Program Files\Mozilla Firefox\firefox.exe`, args: [] } },
      { label: "Opera", icon: "globe-alt", action: { type: "Program", path: String.raw`C:\Users\` + String.raw`AppData\Local\Programs\Opera\opera.exe`, args: [] } },
    ]
  },
  {
    name: "🤖 IA Web",
    icon: "cpu-chip",
    slices: [
      { label: "Gemini", icon: "sparkles", action: { type: "Script", command: "start https://gemini.google.com" } },
      { label: "Claude", icon: "chat-bubble-left-right", action: { type: "Script", command: "start https://claude.ai" } },
      { label: "Copilot", icon: "sparkles", action: { type: "Script", command: "start https://copilot.microsoft.com" } },
      { label: "Perplexity", icon: "magnifying-glass", action: { type: "Script", command: "start https://perplexity.ai" } },
      { label: "DeepSeek", icon: "cpu-chip", action: { type: "Script", command: "start https://chat.deepseek.com" } },
      { label: "Manus", icon: "cpu-chip", action: { type: "Script", command: "start https://manus.im" } },
    ]
  },
  {
    name: "🎵 Mídia",
    icon: "play",
    slices: [
      { label: "Play/Pause", icon: "play-pause", action: { type: "Script", command: "powershell -Command Add-Type -TypeDefinition 'using System;using System.Runtime.InteropServices;public class MK{[DllImport(\"user32.dll\")]public static extern void keybd_event(byte a,byte b,uint c,UIntPtr d);}';[MK]::keybd_event(0xB3,0,0,[UIntPtr]::Zero);[MK]::keybd_event(0xB3,0,2,[UIntPtr]::Zero)" } },
      { label: "Next Track", icon: "forward", action: { type: "Script", command: "powershell -Command Add-Type -TypeDefinition 'using System;using System.Runtime.InteropServices;public class MK{[DllImport(\"user32.dll\")]public static extern void keybd_event(byte a,byte b,uint c,UIntPtr d);}';[MK]::keybd_event(0xB0,0,0,[UIntPtr]::Zero);[MK]::keybd_event(0xB0,0,2,[UIntPtr]::Zero)" } },
      { label: "Prev Track", icon: "backward", action: { type: "Script", command: "powershell -Command Add-Type -TypeDefinition 'using System;using System.Runtime.InteropServices;public class MK{[DllImport(\"user32.dll\")]public static extern void keybd_event(byte a,byte b,uint c,UIntPtr d);}';[MK]::keybd_event(0xB1,0,0,[UIntPtr]::Zero);[MK]::keybd_event(0xB1,0,2,[UIntPtr]::Zero)" } },
      { label: "Vol Up", icon: "speaker-wave", action: { type: "Script", command: "powershell -Command Add-Type -TypeDefinition 'using System;using System.Runtime.InteropServices;public class MK{[DllImport(\"user32.dll\")]public static extern void keybd_event(byte a,byte b,uint c,UIntPtr d);}';[MK]::keybd_event(0xAF,0,0,[UIntPtr]::Zero);[MK]::keybd_event(0xAF,0,2,[UIntPtr]::Zero)" } },
      { label: "Vol Down", icon: "speaker-wave", action: { type: "Script", command: "powershell -Command Add-Type -TypeDefinition 'using System;using System.Runtime.InteropServices;public class MK{[DllImport(\"user32.dll\")]public static extern void keybd_event(byte a,byte b,uint c,UIntPtr d);}';[MK]::keybd_event(0xAE,0,0,[UIntPtr]::Zero);[MK]::keybd_event(0xAE,0,2,[UIntPtr]::Zero)" } },
      { label: "Mute", icon: "speaker-x-mark", action: { type: "Script", command: "powershell -Command Add-Type -TypeDefinition 'using System;using System.Runtime.InteropServices;public class MK{[DllImport(\"user32.dll\")]public static extern void keybd_event(byte a,byte b,uint c,UIntPtr d);}';[MK]::keybd_event(0xAD,0,0,[UIntPtr]::Zero);[MK]::keybd_event(0xAD,0,2,[UIntPtr]::Zero)" } },
    ]
  },
  {
    name: "📝 LibreOffice",
    icon: "document-text",
    slices: [
      { label: "Writer", icon: "document-text", action: { type: "Program", path: String.raw`C:\Program Files\LibreOffice\program\swriter.exe`, args: [] } },
      { label: "Calc", icon: "table-cells", action: { type: "Program", path: String.raw`C:\Program Files\LibreOffice\program\scalc.exe`, args: [] } },
      { label: "Impress", icon: "presentation-chart-bar", action: { type: "Program", path: String.raw`C:\Program Files\LibreOffice\program\simpress.exe`, args: [] } },
      { label: "Draw", icon: "paint-brush", action: { type: "Program", path: String.raw`C:\Program Files\LibreOffice\program\sdraw.exe`, args: [] } },
    ]
  },
  {
    name: "💻 IA CLI",
    icon: "command-line",
    slices: [
      { label: "Gemini CLI", icon: "command-line", action: { type: "Script", command: "start cmd /k gemini" } },
      { label: "Claude Code", icon: "command-line", action: { type: "Script", command: "start cmd /k claude" } },
      { label: "Codex", icon: "command-line", action: { type: "Script", command: "start cmd /k codex" } },
      { label: "Aider", icon: "command-line", action: { type: "Script", command: "start cmd /k aider" } },
    ]
  }
];

let config = { profiles: [] };
let activeRecorder = null;
let expandedSlice = -1;
let pickerOpen = false;
let dragSrcIndex = -1;
let activeProfileIndex = 0;

function activeProfile() {
  return config.profiles[activeProfileIndex] || config.profiles[0];
}

function sliceIcon(s, size = 20) {
  if (s.customIcon) {
    return `<img src="${s.customIcon}" style="width:${size}px;height:${size}px;" />`;
  }
  return resolveIcon(s.icon);
}

function appName(path) {
  if (!path) return "";
  const base = path.split(/[/\\]/).pop() || "";
  return base.replace(/\.(app|exe)$/i, "");
}

function actionSummary(action) {
  if (action.type === "Script") return action.command || "No command";
  if (action.type === "Program") return appName(action.path) || "No program";
  if (action.type === "Submenu") {
    const count = (action.slices || []).length;
    return `${count} sub-action${count === 1 ? "" : "s"}`;
  }
  return "";
}

function migrateLegacyProgram(s) {
  if (s.action.type !== "Program") return;
  if (s.action.path === "open" && s.action.args?.length >= 2 && s.action.args[0] === "-a") {
    const name = s.action.args[1];
    s.action.path = `/Applications/${name}.app`;
    s.action.args = [];
  }
}

// Migrate old emoji icons to heroicon names
function migrateIcon(s) {
  const EMOJI_TO_HERO = {
    "🖥️": "computer-desktop",
    "🌐": "globe-alt",
    "⚙️": "cog-6-tooth",
    "📁": "folder",
    "📂": "folder-open",
    "📝": "document-text",
    "💬": "chat-bubble-left",
    "📧": "envelope",
    "📷": "camera",
    "🎵": "musical-note",
    "🎬": "film",
    "🎮": "puzzle-piece",
    "🔧": "wrench",
    "🔒": "lock-closed",
    "🔓": "lock-open",
    "💡": "light-bulb",
    "📡": "signal",
    "🖨️": "printer",
    "🐛": "bug-ant",
    "🧪": "beaker",
    "📦": "cube",
    "🚀": "rocket-launch",
    "🔥": "fire",
    "⚡": "bolt",
    "👤": "user",
    "👥": "user-group",
    "⭐": "star",
    "❤️": "heart",
    "🔔": "bell",
    "📌": "map-pin",
    "📄": "document",
    "📊": "chart-bar",
    "🗑️": "trash",
    "🔍": "magnifying-glass",
    "🌙": "moon",
    "☀️": "sun",
    "🎯": "cursor-arrow-rays",
    "🛡️": "shield-check",
  };
  if (s.icon && EMOJI_TO_HERO[s.icon]) {
    s.icon = EMOJI_TO_HERO[s.icon];
  }
  if (!s.icon || !ICON_MAP[s.icon]) {
    s.icon = "cog-6-tooth";
  }
}

async function loadConfig() {
  config = await globalThis.api.getConfig();
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
  activeProfileIndex = 0;
  expandedSlice = -1;
  render();
}

// ─── Ring preview ───

function renderPreview() {
  const profile = activeProfile();
  const slices = profile ? profile.slices : [];
  const n = slices.length;
  const size = 200;
  const center = size / 2;
  const orbit = 68;

  const nodes = slices.map((s, i) => {
    const angle = (2 * Math.PI * i) / n - Math.PI / 2;
    const x = center + orbit * Math.cos(angle);
    const y = center + orbit * Math.sin(angle);
    const hl = i === expandedSlice ? " highlight" : "";
    return `<div class="ring-preview-node${hl}" data-preview="${i}" style="left:${x}px;top:${y}px"><span class="preview-icon">${sliceIcon(s, 16)}</span></div>`;
  }).join("");

  return `
    <div class="ring-preview-wrap">
      <div class="ring-preview">
        <div class="ring-preview-bg"></div>
        <svg class="ring-preview-orbit" viewBox="0 0 200 200">
          <circle cx="100" cy="100" r="${orbit}" />
        </svg>
        <div class="ring-preview-center"></div>
        ${nodes}
      </div>
    </div>`;
}

// ─── Sub-action helpers (for Submenu type) ───

function renderSubActionInput(sub, parentIdx, j) {
  if (sub.action.type === "Script") {
    return `
      <input type="text" class="sub-action-cmd" id="sub-cmd-${parentIdx}-${j}"
        value="${escAttr(sub.action.command || "")}" placeholder="Command" />
    `;
  }
  return `
    <div class="sub-action-program">
      <span class="sub-action-path${sub.action.path ? "" : " empty"}" id="sub-path-${parentIdx}-${j}">
        ${sub.action.path ? appName(sub.action.path) : "Choose..."}
      </span>
      <button class="btn-browse-sub" id="sub-browse-${parentIdx}-${j}">Browse</button>
    </div>
  `;
}

function renderSubActions(subSlices, parentIdx) {
  if (!subSlices || subSlices.length === 0) {
    return `<div class="sub-action-empty">No sub-actions yet. Click "+ Add" above.</div>`;
  }
  return subSlices.map((sub, j) => {
    const icon = sub.customIcon
      ? `<img src="${sub.customIcon}" style="width:16px;height:16px;" />`
      : resolveIcon(sub.icon);
    const desc = sub.action.type === "Script"
      ? (sub.action.command || "No command")
      : appName(sub.action.path) || "No program";
    return `
      <div class="sub-action-card" data-parent="${parentIdx}" data-sub="${j}">
        <button class="sub-action-icon" id="sub-icon-btn-${parentIdx}-${j}" title="Change icon">${icon}</button>
        <div class="sub-action-info">
          <input type="text" class="sub-action-label" id="sub-label-${parentIdx}-${j}"
            value="${escAttr(sub.label)}" placeholder="Sub-action name" />
          <span class="sub-action-desc">${desc}</span>
        </div>
        <select class="sub-action-type" id="sub-type-${parentIdx}-${j}">
          <option value="Script"${sub.action.type === "Script" ? " selected" : ""}>Script</option>
          <option value="Program"${sub.action.type === "Program" ? " selected" : ""}>Program</option>
        </select>
        ${renderSubActionInput(sub, parentIdx, j)}
        <button class="btn-delete-sub" id="sub-del-${parentIdx}-${j}" title="Remove">×</button>
      </div>`;
  }).join("");
}

function bindSubActionEvents(parentIdx, parentSlice) {
  const subSlices = parentSlice.action.slices || [];

  // Add sub-action button
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

  // Template select
  const templateSelect = document.getElementById(`template-select-${parentIdx}`);
  if (templateSelect) {
    templateSelect.addEventListener("click", (e) => e.stopPropagation());
    templateSelect.addEventListener("change", (e) => {
      e.stopPropagation();
      const idx = e.target.value;
      if (idx === "") return;
      const template = SUBMENU_TEMPLATES[+idx];
      if (!template) return;
      // Deep copy template slices
      parentSlice.action.slices = structuredClone(template.slices);
      // Auto-set parent icon and label if empty
      if (!parentSlice.label) parentSlice.label = template.name.replace(/^[^\w]+\s*/, '');
      parentSlice.icon = template.icon;
      render();
    });
  }

  // Bind each sub-action
  for (let j = 0; j < subSlices.length; j++) {
    const sub = subSlices[j];

    // Label
    const labelEl = document.getElementById(`sub-label-${parentIdx}-${j}`);
    if (labelEl) {
      labelEl.addEventListener("input", (e) => { sub.label = e.target.value; });
      labelEl.addEventListener("click", (e) => e.stopPropagation());
    }

    // Type select
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

    // Command input (Script)
    const cmdEl = document.getElementById(`sub-cmd-${parentIdx}-${j}`);
    if (cmdEl) {
      cmdEl.addEventListener("click", (e) => e.stopPropagation());
      cmdEl.addEventListener("input", (e) => {
        sub.action.command = e.target.value;
      });
    }

    // Browse button (Program)
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
          // Auto-extract icon
          const iconDataUrl = await globalThis.api.getFileIcon(selected);
          if (iconDataUrl) {
            sub.customIcon = iconDataUrl;
          }
          render();
        }
      });
    }

    // Delete sub-action
    const delEl = document.getElementById(`sub-del-${parentIdx}-${j}`);
    if (delEl) {
      delEl.addEventListener("click", (e) => {
        e.stopPropagation();
        parentSlice.action.slices.splice(j, 1);
        render();
      });
    }

    // Icon picker for sub-action
    const subIconBtn = document.getElementById(`sub-icon-btn-${parentIdx}-${j}`);
    if (subIconBtn) {
      subIconBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        openSubIconPicker(parentIdx, j);
      });
    }
  }
}

// ─── Action detail helpers ───

function renderActionTypeFields(at, i, s, pathDisplay, programArgs) {
  if (at === "Script") {
    return `
      <span class="detail-label">Command</span>
      <div>
        <input type="text" id="cmd-${i}" value="${escAttr(s.action.command || "")}" placeholder="e.g. open -a Safari" />
      </div>
    `;
  }
  if (at === "Program") {
    return `
      <span class="detail-label">Program</span>
      <div>
        <div class="file-picker">
          <span class="file-picker-path${pathDisplay ? "" : " empty"}" id="path-${i}">${pathDisplay || "Choose app..."}</span>
          <button class="btn-browse" id="browse-${i}">Browse</button>
        </div>
      </div>
      <span class="detail-label">Args</span>
      <div>
        <input type="text" id="args-${i}" value="${escAttr(programArgs)}" placeholder="Optional arguments" />
      </div>
    `;
  }
  return ``;
}

function renderSubmenuSection(at, i, s) {
  if (at !== "Submenu") return ``;
  return `
    <div class="sub-action-section" id="sub-section-${i}">
      <div class="sub-action-header">
        <span class="sub-action-title">Sub-Actions</span>
        <div class="sub-action-header-btns">
          <select class="template-select" id="template-select-${i}">
            <option value="">Use Template...</option>
            ${SUBMENU_TEMPLATES.map((t, ti) => `<option value="${ti}">${t.name}</option>`).join('')}
          </select>
          <button class="btn-add-sub" id="add-sub-${i}">+ Add</button>
        </div>
      </div>
      <div class="sub-action-list" id="sub-list-${i}">
        ${renderSubActions(s.action.slices || [], i)}
      </div>
    </div>
  `;
}

function renderActionDetail(s, i) {
  const at = s.action.type;
  const programPath = at === "Program" ? (s.action.path || "") : "";
  const programArgs = at === "Program" ? (s.action.args || []).join(" ") : "";
  const pathDisplay = programPath ? appName(programPath) : "";

  return `
    <div class="action-detail" data-detail="${i}">
      <div class="detail-divider"></div>
      <div class="detail-grid">
        <span class="detail-label">Icon</span>
        <div class="detail-input-row">
          <button class="icon-btn" id="icon-btn-${i}">${resolveIcon(s.icon)}</button>
          <input type="text" id="label-${i}" value="${escAttr(s.label)}" placeholder="Action name" />
        </div>

        <span class="detail-label">Type</span>
        <div>
          <select id="type-${i}">
            <option value="Script"${at === "Script" ? " selected" : ""}>Script</option>
            <option value="Program"${at === "Program" ? " selected" : ""}>Program</option>
            <option value="Submenu"${at === "Submenu" ? " selected" : ""}>Submenu</option>
          </select>
        </div>

        ${renderActionTypeFields(at, i, s, pathDisplay, programArgs)}
      </div>
      ${renderSubmenuSection(at, i, s)}
      <div class="detail-actions">
        <button class="btn-delete" id="delete-${i}">Remove</button>
      </div>
    </div>`;
}

// ─── Action cards ───

function renderActionCard(s, i) {
  const active = i === expandedSlice;
  let html = `
    <div class="action-card${active ? " active" : ""}" data-card="${i}">
      <div class="action-card-header" data-index="${i}" draggable="true">
        <span class="drag-handle" title="Drag to reorder">⠿</span>
        <span class="action-card-index">${i + 1}</span>
        <span class="action-card-icon">${sliceIcon(s, 22)}</span>
        <div class="action-card-info">
          <div class="action-card-name">${s.label || "Untitled"}</div>
          <div class="action-card-desc">${actionSummary(s.action)}</div>
        </div>
        <span class="action-card-chevron">›</span>
      </div>`;

  if (active) {
    html += renderActionDetail(s, i);
  }

  html += `</div>`;
  return html;
}

// ─── Profile tabs ───

function renderProfileTabs() {
  const canDelete = config.profiles.length > 1;
  const tabs = config.profiles.map((p, i) => {
    const active = i === activeProfileIndex ? " active" : "";
    const delBtn = canDelete ? `<span class="profile-tab-delete" data-profile-delete="${i}" title="Delete profile">×</span>` : '';
    return `<button class="profile-tab${active}" data-profile="${i}">
      <span class="profile-tab-name" data-profile-name="${i}">${escAttr(p.name || 'Untitled')}</span>
      ${delBtn}
    </button>`;
  }).join("");

  return `<div class="profile-tabs">
    ${tabs}
    <button class="profile-tab profile-tab-add" id="add-profile-btn" title="Add profile">+</button>
  </div>`;
}

// ─── Main render ───

function render() {
  const app = document.querySelector("#app");
  const profile = activeProfile();
  if (!profile) return;

  const slices = profile.slices;
  const n = slices.length;
  const cards = slices.map((s, i) => renderActionCard(s, i)).join("");

  app.innerHTML = `
    <div class="config-layout">
      <div class="left-pane">
        <div class="app-brand">
          <img class="app-logo" src="logo_ring_2_1.png" alt="" />
          <h1>RingDeck</h1>
        </div>
        <div class="app-version">v0.2.3</div>

        <label class="telemetry-toggle">
          <input type="checkbox" id="telemetry-checkbox" ${sentryEnabled ? "checked" : ""} />
          <span class="telemetry-label">Send anonymous error reports</span>
        </label>

        ${renderPreview()}

        <div class="shortcut-area">
          <div class="shortcut-label">Activation shortcut</div>
          <div class="shortcut-box" id="shortcut-box">
            <span class="shortcut-keys" id="shortcut-display">${profile.shortcut || "Not set"}</span>
            <span class="shortcut-action" id="shortcut-action">Record</span>
          </div>
          ${profile.shortcut ? `<button class="btn-clear-shortcut" id="clear-shortcut-btn">Clear shortcut</button>` : ''}
        </div>
      </div>

      <div class="right-pane">
        ${renderProfileTabs()}

        <div class="right-header">
          <span class="right-title">${escAttr(profile.name || 'Untitled')}</span>
          <span class="slice-count">${n} item${n === 1 ? "" : "s"}</span>
          ${config.profiles.length > 1 ? `<button class="btn-delete-profile" id="delete-profile-btn" title="Delete this profile">🗑</button>` : ''}
        </div>

        <div class="profile-name-row">
          <label class="detail-label">Profile name</label>
          <input type="text" id="profile-name-input" value="${escAttr(profile.name || '')}" placeholder="Profile name" />
        </div>

        <div class="action-list" id="action-list">
          ${n === 0 ? `
            <div class="empty-state">
              <div class="empty-state-icon">${resolveIcon('cog-6-tooth')}</div>
              <div class="empty-state-text">No actions yet</div>
              <div class="empty-state-hint">Add your first action to get started</div>
            </div>
          ` : cards}
          <button class="add-action-btn" id="add-btn">
            <span class="plus">+</span> Add Action
          </button>
        </div>

        <div class="bottom-bar">
          <span class="save-status" id="save-status"></span>
          <button class="btn-save" id="save-btn">Save</button>
        </div>
      </div>
    </div>
  `;

  bindEvents();
}

function bindEvents() {
  document.getElementById("shortcut-box").addEventListener("click", startRecording);

  // Clear shortcut button
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
  document.getElementById("add-btn").addEventListener("click", addSlice);
  document.getElementById("save-btn").addEventListener("click", saveConfig);

  // Telemetry toggle
  document.getElementById("telemetry-checkbox").addEventListener("change", (e) => {
    sentryEnabled = e.target.checked;
    globalThis.api.setTelemetryConsent(sentryEnabled);
  });

  // Profile tabs
  document.querySelectorAll(".profile-tab[data-profile]").forEach((tab) => {
    tab.addEventListener("click", () => {
      const idx = +tab.dataset.profile;
      if (idx !== activeProfileIndex) {
        activeProfileIndex = idx;
        expandedSlice = -1;
        render();
      }
    });
  });

  document.getElementById("add-profile-btn")?.addEventListener("click", addProfile);

  document.getElementById("delete-profile-btn")?.addEventListener("click", deleteProfile);

  // Delete profile from tab × button
  document.querySelectorAll("[data-profile-delete]").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const idx = +btn.dataset.profileDelete;
      if (config.profiles.length <= 1) return;
      if (!confirm(`Delete profile "${config.profiles[idx].name || "Untitled"}"?`)) return;
      config.profiles.splice(idx, 1);
      if (activeProfileIndex >= config.profiles.length) {
        activeProfileIndex = config.profiles.length - 1;
      }
      expandedSlice = -1;
      render();
    });
  });

  // Profile name input
  const profileNameInput = document.getElementById("profile-name-input");
  if (profileNameInput) {
    profileNameInput.addEventListener("input", (e) => {
      const profile = activeProfile();
      if (profile) {
        profile.name = e.target.value;
        // Update tab text
        const tabName = document.querySelector(`.profile-tab-name[data-profile-name="${activeProfileIndex}"]`);
        if (tabName) tabName.textContent = e.target.value || 'Untitled';
        // Update header
        const title = document.querySelector('.right-title');
        if (title) title.textContent = e.target.value || 'Untitled';
      }
    });
    profileNameInput.addEventListener("click", (e) => e.stopPropagation());
  }

  document.querySelectorAll(".action-card-header").forEach((header) => {
    header.addEventListener("click", () => {
      const idx = +header.dataset.index;
      expandedSlice = expandedSlice === idx ? -1 : idx;
      render();
      if (expandedSlice >= 0) {
        requestAnimationFrame(() => {
          document.querySelector(`.action-card[data-card="${expandedSlice}"]`)?.scrollIntoView({ behavior: "smooth", block: "nearest" });
        });
      }
    });
  });

  if (expandedSlice >= 0 && expandedSlice < (activeProfile()?.slices.length || 0)) {
    bindDetail(expandedSlice);
  }

  document.querySelectorAll(".action-card").forEach((card) => {
    const header = card.querySelector(".action-card-header");
    const idx = +card.dataset.card;

    header.addEventListener("dragstart", (e) => {
      dragSrcIndex = idx;
      e.dataTransfer.effectAllowed = "move";
      requestAnimationFrame(() => card.classList.add("dragging"));
    });

    header.addEventListener("dragend", () => {
      card.classList.remove("dragging");
      document.querySelectorAll(".action-card").forEach(c => c.classList.remove("drag-over"));
      dragSrcIndex = -1;
    });

    card.addEventListener("dragover", (e) => {
      if (dragSrcIndex === -1 || dragSrcIndex === idx) return;
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
      if (dragSrcIndex === -1 || dragSrcIndex === idx) return;

      const profile = activeProfile();
      const src = dragSrcIndex;
      const [moved] = profile.slices.splice(src, 1);
      profile.slices.splice(idx, 0, moved);

      if (expandedSlice === src) expandedSlice = idx;
      else if (src < idx && expandedSlice > src && expandedSlice <= idx) expandedSlice--;
      else if (src > idx && expandedSlice >= idx && expandedSlice < src) expandedSlice++;

      dragSrcIndex = -1;
      render();
    });
  });
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

    // Auto-extract native icon from the executable
    const iconDataUrl = await globalThis.api.getFileIcon(selected);
    if (iconDataUrl) {
      s.customIcon = iconDataUrl;
      // Update icon in all places
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
      expandedSlice = -1;
      render();
    });
  }

  // Submenu sub-actions
  if (s.action.type === "Submenu") {
    bindSubActionEvents(idx, s);
  }

  document.querySelector(`.action-detail[data-detail="${idx}"]`)?.addEventListener("click", (e) => e.stopPropagation());
}

// ─── Icon Picker ───

function renderIconButtons(icons, currentIcon) {
  let html = "";
  for (const name of icons) {
    const sel = name === currentIcon ? " selected" : "";
    html += `<button class="icon-picker-cell${sel}" data-icon="${name}" title="${name}">${resolveIcon(name)}</button>`;
  }
  return html;
}

function renderExtraIcons(q, currentIcon) {
  const catIcons = new Set(ICON_CATEGORIES.flatMap(c => c.icons));
  const extras = Object.keys(ICON_MAP).filter(n => !catIcons.has(n) && n.includes(q));
  if (extras.length === 0) return { html: "", found: false };
  let html = `<div class="icon-picker-category">Other</div><div class="icon-picker-grid">`;
  html += renderIconButtons(extras, currentIcon);
  html += `</div>`;
  return { html, found: true };
}

function buildPickerContent(body, currentIcon, query) {
  const q = (query || "").toLowerCase().trim();
  let html = "";
  let hasResults = false;

  for (const cat of ICON_CATEGORIES) {
    const matched = cat.icons.filter(name => !q || name.includes(q));
    if (matched.length === 0) continue;
    hasResults = true;

    html += `<div class="icon-picker-category">${cat.name}</div><div class="icon-picker-grid">`;
    html += renderIconButtons(matched, currentIcon);
    html += `</div>`;
  }

  // Also search all icons not in categories
  if (q) {
    const extra = renderExtraIcons(q, currentIcon);
    if (extra.found) {
      hasResults = true;
      html += extra.html;
    }
  }

  if (!hasResults) {
    html = `<div class="icon-picker-empty">No icons match "${escAttr(q)}"</div>`;
  }

  body.innerHTML = html;
}

function openIconPicker(idx) {
  closeIconPicker();
  pickerOpen = true;

  const profile = activeProfile();
  if (!profile) return;
  const s = profile.slices[idx];
  const currentIcon = s.icon;

  const btn = document.getElementById(`icon-btn-${idx}`);
  const rect = btn.getBoundingClientRect();

  // Overlay
  const overlay = document.createElement("div");
  overlay.className = "icon-picker-overlay";
  overlay.addEventListener("click", closeIconPicker);

  // Picker container
  const picker = document.createElement("div");
  picker.className = "icon-picker";

  // Position: try to fit in viewport
  const left = Math.min(Math.max(rect.left, 8), window.innerWidth - 330);
  const top = Math.min(Math.max(rect.bottom + 6, 8), window.innerHeight - 430);
  picker.style.left = left + "px";
  picker.style.top = top + "px";

  // Header: search + selected indicator
  const header = document.createElement("div");
  header.className = "icon-picker-header";

  const search = document.createElement("input");
  search.type = "text";
  search.className = "icon-picker-search";
  search.placeholder = "Search icons...";
  search.autocomplete = "off";
  search.spellcheck = false;
  header.appendChild(search);

  // Selected indicator
  const selectedDiv = document.createElement("div");
  selectedDiv.className = "icon-picker-selected";
  selectedDiv.innerHTML = `
    <span class="icon-picker-selected-icon">${resolveIcon(currentIcon)}</span>
    <span class="icon-picker-selected-name">${currentIcon}</span>
    <span class="icon-picker-selected-check">Selected</span>
  `;
  header.appendChild(selectedDiv);

  picker.appendChild(header);

  // Body: scrollable grid
  const body = document.createElement("div");
  body.className = "icon-picker-body";
  picker.appendChild(body);

  // Initial render
  buildPickerContent(body, currentIcon, "");

  // Scroll to selected
  requestAnimationFrame(() => {
    body.querySelector(".icon-picker-cell.selected")?.scrollIntoView({ block: "center", behavior: "instant" });
    search.focus();
  });

  // Search handler
  search.addEventListener("input", () => {
    buildPickerContent(body, currentIcon, search.value);
  });

  // Keyboard nav
  search.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      closeIconPicker();
    }
  });

  // Click to select
  body.addEventListener("click", (e) => {
    e.stopPropagation();
    const cell = e.target.closest(".icon-picker-cell");
    if (!cell) return;

    const iconName = cell.dataset.icon;
    s.icon = iconName;

    // Update UI inline
    const cardIcon = document.querySelector(`.action-card[data-card="${idx}"] .action-card-icon`);
    if (cardIcon) cardIcon.innerHTML = resolveIcon(iconName);
    const iconEl = document.getElementById(`icon-btn-${idx}`);
    if (iconEl) iconEl.innerHTML = resolveIcon(iconName);
    const previewNode = document.querySelector(`.ring-preview-node[data-preview="${idx}"] .preview-icon`);
    if (previewNode) previewNode.innerHTML = resolveIcon(iconName);

    closeIconPicker();
  });

  // Prevent propagation
  picker.addEventListener("click", (e) => e.stopPropagation());

  document.body.appendChild(overlay);
  document.body.appendChild(picker);
}

function closeIconPicker() {
  if (!pickerOpen) return;
  pickerOpen = false;
  document.querySelectorAll(".icon-picker-overlay, .icon-picker").forEach((el) => el.remove());
}

function openSubIconPicker(parentIdx, subIdx) {
  closeIconPicker();
  pickerOpen = true;

  const profile = activeProfile();
  if (!profile) return;
  const parentSlice = profile.slices[parentIdx];
  if (!parentSlice?.action?.slices) return;
  const sub = parentSlice.action.slices[subIdx];
  if (!sub) return;
  const currentIcon = sub.icon;

  const btn = document.getElementById(`sub-icon-btn-${parentIdx}-${subIdx}`);
  if (!btn) return;
  const rect = btn.getBoundingClientRect();

  const overlay = document.createElement("div");
  overlay.className = "icon-picker-overlay";
  overlay.addEventListener("click", closeIconPicker);

  const picker = document.createElement("div");
  picker.className = "icon-picker";

  const left = Math.min(Math.max(rect.left, 8), window.innerWidth - 330);
  const top = Math.min(Math.max(rect.bottom + 6, 8), window.innerHeight - 430);
  picker.style.left = left + "px";
  picker.style.top = top + "px";

  const header = document.createElement("div");
  header.className = "icon-picker-header";

  const search = document.createElement("input");
  search.type = "text";
  search.className = "icon-picker-search";
  search.placeholder = "Search icons...";
  search.autocomplete = "off";
  search.spellcheck = false;
  header.appendChild(search);

  const selectedDiv = document.createElement("div");
  selectedDiv.className = "icon-picker-selected";
  selectedDiv.innerHTML = `
    <span class="icon-picker-selected-icon">${resolveIcon(currentIcon)}</span>
    <span class="icon-picker-selected-name">${currentIcon}</span>
    <span class="icon-picker-selected-check">Selected</span>
  `;
  header.appendChild(selectedDiv);
  picker.appendChild(header);

  const body = document.createElement("div");
  body.className = "icon-picker-body";
  picker.appendChild(body);

  buildPickerContent(body, currentIcon, "");

  requestAnimationFrame(() => {
    body.querySelector(".icon-picker-cell.selected")?.scrollIntoView({ block: "center", behavior: "instant" });
    search.focus();
  });

  search.addEventListener("input", () => {
    buildPickerContent(body, currentIcon, search.value);
  });

  search.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeIconPicker();
  });

  body.addEventListener("click", (e) => {
    e.stopPropagation();
    const cell = e.target.closest(".icon-picker-cell");
    if (!cell) return;

    const iconName = cell.dataset.icon;
    sub.icon = iconName;
    sub.customIcon = null; // Clear custom icon when manually selecting

    // Update sub-action icon inline
    const subIconBtn = document.getElementById(`sub-icon-btn-${parentIdx}-${subIdx}`);
    if (subIconBtn) subIconBtn.innerHTML = resolveIcon(iconName);

    closeIconPicker();
    render();
  });

  picker.addEventListener("click", (e) => e.stopPropagation());

  document.body.appendChild(overlay);
  document.body.appendChild(picker);
}

function escAttr(str) {
  return (str || "").replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
}

// ─── Add Slice ───

function addSlice() {
  const profile = activeProfile();
  if (!profile) return;
  profile.slices.push({
    label: "",
    icon: "cog-6-tooth",
    action: { type: "Script", command: "" },
  });
  expandedSlice = profile.slices.length - 1;
  render();
}

// ─── Profile management ───

function addProfile() {
  const id = 'profile_' + Date.now();
  config.profiles.push({
    id,
    name: "New Profile",
    shortcut: "",
    slices: [],
  });
  activeProfileIndex = config.profiles.length - 1;
  expandedSlice = -1;
  render();
}

function deleteProfile() {
  if (config.profiles.length <= 1) return;
  config.profiles.splice(activeProfileIndex, 1);
  if (activeProfileIndex >= config.profiles.length) {
    activeProfileIndex = config.profiles.length - 1;
  }
  expandedSlice = -1;
  render();
}

// ─── Shortcut Recording ───

function stopRecording() {
  if (activeRecorder) {
    activeRecorder.cleanup();
    activeRecorder = null;
  }
}

function startRecording() {
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
    activeRecorder = null;
    box.classList.remove("recording");
    display.textContent = (activeProfile()?.shortcut) || "Not set";
    action.textContent = "Record";
  }

  function finish() {
    cleanup();
    activeRecorder = null;
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

  activeRecorder = { cleanup };
}

// ─── Save ───

async function saveConfig() {
  try {
    await globalThis.api.saveConfig(config);
    const btn = document.getElementById("save-btn");
    const status = document.getElementById("save-status");
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

loadConfig();
