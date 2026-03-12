
import { ICON_MAP, ICON_CATEGORIES, resolveIcon } from './icons.js';

let config = { shortcut: "", slices: [] };
let activeRecorder = null;
let expandedSlice = -1;
let pickerOpen = false;
let dragSrcIndex = -1;

function appName(path) {
  if (!path) return "";
  const base = path.split("/").pop() || "";
  return base.replace(/\.app$/i, "");
}

function actionSummary(action) {
  if (action.type === "Script") return action.command || "No command";
  if (action.type === "Program") return appName(action.path) || "No program";
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
  config = await window.api.getConfig();
  for (const s of config.slices) {
    migrateLegacyProgram(s);
    migrateIcon(s);
  }
  render();
}

// ─── Ring preview ───

function renderPreview() {
  const n = config.slices.length;
  const size = 200;
  const center = size / 2;
  const orbit = 68;

  const nodes = config.slices.map((s, i) => {
    const angle = (2 * Math.PI * i) / n - Math.PI / 2;
    const x = center + orbit * Math.cos(angle);
    const y = center + orbit * Math.sin(angle);
    const hl = i === expandedSlice ? " highlight" : "";
    return `<div class="ring-preview-node${hl}" data-preview="${i}" style="left:${x}px;top:${y}px"><span class="preview-icon">${resolveIcon(s.icon)}</span></div>`;
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

// ─── Action cards ───

function renderActionCard(s, i) {
  const active = i === expandedSlice;
  let html = `
    <div class="action-card${active ? " active" : ""}" data-card="${i}">
      <div class="action-card-header" data-index="${i}" draggable="true">
        <span class="drag-handle" title="Drag to reorder">⠿</span>
        <span class="action-card-index">${i + 1}</span>
        <span class="action-card-icon">${resolveIcon(s.icon)}</span>
        <div class="action-card-info">
          <div class="action-card-name">${s.label || "Untitled"}</div>
          <div class="action-card-desc">${actionSummary(s.action)}</div>
        </div>
        <span class="action-card-chevron">›</span>
      </div>`;

  if (active) {
    const at = s.action.type;
    const programPath = at === "Program" ? (s.action.path || "") : "";
    const programArgs = at === "Program" ? (s.action.args || []).join(" ") : "";
    const pathDisplay = programPath ? appName(programPath) : "";

    html += `
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
            </select>
          </div>

          ${at === "Script" ? `
            <span class="detail-label">Command</span>
            <div>
              <input type="text" id="cmd-${i}" value="${escAttr(s.action.command || "")}" placeholder="e.g. open -a Safari" />
            </div>
          ` : `
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
          `}
        </div>
        <div class="detail-actions">
          <button class="btn-delete" id="delete-${i}">Remove</button>
        </div>
      </div>`;
  }

  html += `</div>`;
  return html;
}

// ─── Main render ───

function render() {
  const app = document.querySelector("#app");
  const n = config.slices.length;
  const cards = config.slices.map((s, i) => renderActionCard(s, i)).join("");

  app.innerHTML = `
    <div class="config-layout">
      <div class="left-pane">
        <div class="app-brand">
          <img class="app-logo" src="logo_ring_2_1.png" alt="" />
          <h1>RingDeck</h1>
        </div>
        <div class="app-version">v0.1.0</div>

        ${renderPreview()}

        <div class="shortcut-area">
          <div class="shortcut-label">Activation shortcut</div>
          <div class="shortcut-box" id="shortcut-box">
            <span class="shortcut-keys" id="shortcut-display">${config.shortcut || "Not set"}</span>
            <span class="shortcut-action" id="shortcut-action">Record</span>
          </div>
        </div>
      </div>

      <div class="right-pane">
        <div class="right-header">
          <span class="right-title">Actions</span>
          <span class="slice-count">${n} item${n !== 1 ? "s" : ""}</span>
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
  document.getElementById("add-btn").addEventListener("click", addSlice);
  document.getElementById("save-btn").addEventListener("click", saveConfig);

  document.querySelectorAll(".action-card-header").forEach((header) => {
    header.addEventListener("click", () => {
      const idx = +header.dataset.index;
      expandedSlice = expandedSlice === idx ? -1 : idx;
      render();
      if (expandedSlice >= 0) {
        requestAnimationFrame(() => {
          const card = document.querySelector(`.action-card[data-card="${expandedSlice}"]`);
          if (card) card.scrollIntoView({ behavior: "smooth", block: "nearest" });
        });
      }
    });
  });

  if (expandedSlice >= 0 && expandedSlice < config.slices.length) {
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

      const src = dragSrcIndex;
      const [moved] = config.slices.splice(src, 1);
      config.slices.splice(idx, 0, moved);

      if (expandedSlice === src) expandedSlice = idx;
      else if (src < idx && expandedSlice > src && expandedSlice <= idx) expandedSlice--;
      else if (src > idx && expandedSlice >= idx && expandedSlice < src) expandedSlice++;

      dragSrcIndex = -1;
      render();
    });
  });
}

function bindDetail(idx) {
  const s = config.slices[idx];

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
      } else {
        s.action = { type: "Program", path: "", args: [] };
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
    browseBtn.addEventListener("click", async (e) => {
      e.stopPropagation();
      const selected = await window.api.openFileDialog();
      if (selected) {
        s.action.path = selected;
        const name = appName(selected);
        const display = document.getElementById(`path-${idx}`);
        if (display) { display.textContent = name; display.classList.remove("empty"); }
        const desc = document.querySelector(`.action-card[data-card="${idx}"] .action-card-desc`);
        if (desc) desc.textContent = name;
      }
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
      config.slices.splice(idx, 1);
      expandedSlice = -1;
      render();
    });
  }

  const detail = document.querySelector(`.action-detail[data-detail="${idx}"]`);
  if (detail) {
    detail.addEventListener("click", (e) => e.stopPropagation());
  }
}

// ─── Icon Picker ───

function buildPickerContent(body, currentIcon, query) {
  const q = (query || "").toLowerCase().trim();
  let html = "";
  let hasResults = false;

  for (const cat of ICON_CATEGORIES) {
    const matched = cat.icons.filter(name => !q || name.includes(q));
    if (matched.length === 0) continue;
    hasResults = true;

    html += `<div class="icon-picker-category">${cat.name}</div><div class="icon-picker-grid">`;
    for (const name of matched) {
      const sel = name === currentIcon ? " selected" : "";
      html += `<button class="icon-picker-cell${sel}" data-icon="${name}" title="${name}">${resolveIcon(name)}</button>`;
    }
    html += `</div>`;
  }

  // Also search all icons not in categories
  if (q) {
    const catIcons = new Set(ICON_CATEGORIES.flatMap(c => c.icons));
    const extras = Object.keys(ICON_MAP).filter(n => !catIcons.has(n) && n.includes(q));
    if (extras.length > 0) {
      hasResults = true;
      html += `<div class="icon-picker-category">Other</div><div class="icon-picker-grid">`;
      for (const name of extras) {
        const sel = name === currentIcon ? " selected" : "";
        html += `<button class="icon-picker-cell${sel}" data-icon="${name}" title="${name}">${resolveIcon(name)}</button>`;
      }
      html += `</div>`;
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

  const s = config.slices[idx];
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
    const sel = body.querySelector(".icon-picker-cell.selected");
    if (sel) sel.scrollIntoView({ block: "center", behavior: "instant" });
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

function escAttr(str) {
  return (str || "").replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
}

// ─── Add Slice ───

function addSlice() {
  config.slices.push({
    label: "",
    icon: "cog-6-tooth",
    action: { type: "Script", command: "" },
  });
  expandedSlice = config.slices.length - 1;
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
    config.shortcut = mods.join("+");
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
    display.textContent = config.shortcut || "Not set";
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
    await window.api.saveConfig(config);
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
