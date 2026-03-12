import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";

let config = { shortcut: "", slices: [] };
let activeRecorder = null;
let expandedSlice = -1;
let pickerOpen = false;

const ICON_MAP = { terminal: "🖥️", globe: "🌐", default: "⚙️" };

const EMOJI_CATEGORIES = [
  { name: "Apps", icons: ["🖥️", "🌐", "📁", "📂", "📝", "💬", "📧", "📷"] },
  { name: "Media", icons: ["🎵", "🎬", "🎮", "🎧", "📺", "🔊", "🔇", "🎤"] },
  { name: "System", icons: ["⚙️", "🔧", "🔒", "🔓", "💡", "🔋", "📡", "🖨️"] },
  { name: "Actions", icons: ["▶️", "⏸️", "⏹️", "🔄", "⬆️", "⬇️", "📋", "✂️"] },
  { name: "Dev", icons: ["🐛", "🧪", "📦", "🚀", "🔥", "⚡", "🏗️", "🧩"] },
  { name: "Social", icons: ["👤", "👥", "🏠", "⭐", "❤️", "🔔", "📌", "🏷️"] },
  { name: "Files", icons: ["📄", "📊", "📈", "🗂️", "💾", "🗑️", "📎", "🔍"] },
  { name: "Misc", icons: ["🌙", "☀️", "🎯", "🧲", "💎", "🛡️", "⚔️", "🪐"] },
];

function resolveIcon(icon) {
  if (!icon) return "⚙️";
  if (icon.length <= 2 || /\p{Emoji}/u.test(icon)) return icon;
  return ICON_MAP[icon] || "⚙️";
}

function appName(path) {
  if (!path) return "";
  const base = path.split("/").pop() || "";
  return base.replace(/\.app$/i, "");
}

function actionSummary(action) {
  if (action.type === "Script") return action.command || "No command";
  if (action.type === "Program") {
    const p = action.path || "";
    return appName(p) || "No program";
  }
  return "";
}

// Migrate legacy configs that use path:"open" args:["-a","AppName"]
function migrateLegacyProgram(s) {
  if (s.action.type !== "Program") return;
  if (s.action.path === "open" && s.action.args?.length >= 2 && s.action.args[0] === "-a") {
    const name = s.action.args[1];
    // Try common macOS app locations
    const candidates = [
      `/Applications/${name}.app`,
      `/System/Applications/${name}.app`,
      `/System/Applications/Utilities/${name}.app`,
    ];
    s.action.path = candidates[0]; // default to /Applications
    s.action.args = [];
  }
}

async function loadConfig() {
  config = await invoke("get_config");
  for (const s of config.slices) {
    s.icon = resolveIcon(s.icon);
    migrateLegacyProgram(s);
  }
  render();
}

function render() {
  const app = document.querySelector("#app");

  const sliceRows = config.slices.map((s, i) => {
    const active = i === expandedSlice;
    let html = `
      <div class="slice-row${active ? " active" : ""}" data-index="${i}">
        <div class="slice-icon">${resolveIcon(s.icon)}</div>
        <div class="slice-info">
          <div class="slice-info-name">${s.label || "Untitled"}</div>
          <div class="slice-info-detail">${actionSummary(s.action)}</div>
        </div>
        <span class="slice-chevron">›</span>
      </div>`;
    if (active) {
      html += renderDetail(s, i);
    }
    return html;
  }).join("");

  app.innerHTML = `
    <div class="config-panel">
      <div class="app-header">
        <div class="app-icon">⌘</div>
        <div>
          <h1>RingDeck</h1>
          <div class="subtitle">Radial shortcut launcher</div>
        </div>
      </div>

      <section>
        <div class="section-label">Trigger</div>
        <div class="group">
          <div class="group-row">
            <span class="group-row-label">Shortcut</span>
            <span class="group-row-value">
              <span class="shortcut-value" id="shortcut-display">${config.shortcut || "Not set"}</span>
            </span>
            <span class="group-row-action">
              <button class="btn-inline" id="record-btn">Record</button>
            </span>
          </div>
        </div>
        <div class="section-footer">Press a key combination to activate the ring.</div>
      </section>

      ${renderMiniPreview()}

      <section>
        <div class="section-label">Actions</div>
        <div class="group" id="slice-group">
          ${sliceRows}
          ${config.slices.length === 0 ? '<div class="empty-hint">No actions yet</div>' : ""}
          <div class="add-row" id="add-slice-btn">
            <span>Add Action</span>
          </div>
        </div>
      </section>

      <div class="actions-row">
        <button class="btn-save" id="save-btn">Save</button>
      </div>
    </div>
  `;

  // Bind events
  document.getElementById("record-btn").addEventListener("click", startRecording);
  document.getElementById("add-slice-btn").addEventListener("click", addSlice);
  document.getElementById("save-btn").addEventListener("click", saveConfig);

  // Slice row clicks
  document.querySelectorAll(".slice-row").forEach((row) => {
    row.addEventListener("click", () => {
      const idx = +row.dataset.index;
      expandedSlice = expandedSlice === idx ? -1 : idx;
      render();
    });
  });

  // Detail bindings
  if (expandedSlice >= 0 && expandedSlice < config.slices.length) {
    bindDetail(expandedSlice);
  }
}

// --- Mini ring preview ---

function renderMiniPreview() {
  if (config.slices.length === 0) return "";
  const n = config.slices.length;
  const size = 160;
  const center = size / 2;
  const orbit = 55;

  const nodes = config.slices.map((s, i) => {
    const angle = (2 * Math.PI * i) / n - Math.PI / 2;
    const x = center + orbit * Math.cos(angle);
    const y = center + orbit * Math.sin(angle);
    return `<div class="ring-mini-node" style="left:${x}px;top:${y}px">${resolveIcon(s.icon)}</div>`;
  }).join("");

  return `
    <div class="ring-mini">
      <div class="ring-mini-bg">
        <div class="ring-mini-center"></div>
        ${nodes}
      </div>
    </div>`;
}

// --- Inline Detail ---

function renderDetail(s, index) {
  const at = s.action.type;
  const programPath = at === "Program" ? (s.action.path || "") : "";
  const programArgs = at === "Program" ? (s.action.args || []).join(" ") : "";
  const pathDisplay = programPath ? appName(programPath) : "";

  return `
    <div class="slice-detail" data-detail="${index}">
      <div class="detail-field">
        <span class="detail-field-label">Icon</span>
        <button class="icon-btn" id="icon-btn-${index}">${resolveIcon(s.icon)}</button>
        <input type="text" id="label-${index}" value="${escAttr(s.label)}" placeholder="Name" style="flex:1" />
      </div>
      <div class="detail-field">
        <span class="detail-field-label">Type</span>
        <select id="type-${index}">
          <option value="Script"${at === "Script" ? " selected" : ""}>Script</option>
          <option value="Program"${at === "Program" ? " selected" : ""}>Program</option>
        </select>
      </div>
      ${at === "Script" ? `
        <div class="detail-field">
          <span class="detail-field-label">Command</span>
          <input type="text" id="cmd-${index}" value="${escAttr(s.action.command || "")}" placeholder="e.g. open -a Safari" />
        </div>
      ` : `
        <div class="detail-field">
          <span class="detail-field-label">Program</span>
          <div class="file-picker">
            <span class="file-picker-path${pathDisplay ? "" : " empty"}" id="path-${index}">${pathDisplay || "Choose..."}</span>
            <button class="btn-browse" id="browse-${index}">Browse</button>
          </div>
        </div>
        <div class="detail-field">
          <span class="detail-field-label">Arguments</span>
          <input type="text" id="args-${index}" value="${escAttr(programArgs)}" placeholder="Optional" />
        </div>
      `}
      <div class="detail-footer">
        <button class="btn-delete" id="delete-${index}">Remove Action</button>
      </div>
    </div>`;
}

function bindDetail(idx) {
  const s = config.slices[idx];

  const labelInput = document.getElementById(`label-${idx}`);
  if (labelInput) {
    labelInput.addEventListener("input", (e) => {
      s.label = e.target.value;
      // Update row live
      const row = document.querySelector(`.slice-row[data-index="${idx}"] .slice-info-name`);
      if (row) row.textContent = s.label || "Untitled";
    });
    // Prevent row toggle when clicking inside detail
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

  // Script
  const cmdInput = document.getElementById(`cmd-${idx}`);
  if (cmdInput) {
    cmdInput.addEventListener("click", (e) => e.stopPropagation());
    cmdInput.addEventListener("input", (e) => {
      s.action = { type: "Script", command: e.target.value };
      const detail = document.querySelector(`.slice-row[data-index="${idx}"] .slice-info-detail`);
      if (detail) detail.textContent = e.target.value || "No command";
    });
  }

  // Program: browse
  const browseBtn = document.getElementById(`browse-${idx}`);
  if (browseBtn) {
    browseBtn.addEventListener("click", async (e) => {
      e.stopPropagation();
      const selected = await open({
        multiple: false,
        directory: false,
        defaultPath: "/Applications",
        filters: [{ name: "Applications", extensions: ["app"] }],
      });
      if (selected) {
        s.action.path = selected;
        const name = appName(selected);
        const display = document.getElementById(`path-${idx}`);
        if (display) {
          display.textContent = name;
          display.classList.remove("empty");
        }
        const detail = document.querySelector(`.slice-row[data-index="${idx}"] .slice-info-detail`);
        if (detail) detail.textContent = name;
      }
    });
  }

  // Program: args
  const argsInput = document.getElementById(`args-${idx}`);
  if (argsInput) {
    argsInput.addEventListener("click", (e) => e.stopPropagation());
    argsInput.addEventListener("input", (e) => {
      s.action.args = e.target.value ? e.target.value.split(" ") : [];
    });
  }

  // Icon picker
  const iconBtn = document.getElementById(`icon-btn-${idx}`);
  if (iconBtn) {
    iconBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      openIconPicker(idx);
    });
  }

  // Delete
  const deleteBtn = document.getElementById(`delete-${idx}`);
  if (deleteBtn) {
    deleteBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      config.slices.splice(idx, 1);
      expandedSlice = -1;
      render();
    });
  }

  // Stop propagation on detail area
  const detail = document.querySelector(`.slice-detail[data-detail="${idx}"]`);
  if (detail) {
    detail.addEventListener("click", (e) => e.stopPropagation());
  }
}

// --- Icon Picker ---

function openIconPicker(idx) {
  closeIconPicker();
  pickerOpen = true;

  const btn = document.getElementById(`icon-btn-${idx}`);
  const rect = btn.getBoundingClientRect();

  const overlay = document.createElement("div");
  overlay.className = "icon-picker-overlay";
  overlay.addEventListener("click", closeIconPicker);

  const picker = document.createElement("div");
  picker.className = "icon-picker";
  picker.style.left = Math.min(rect.left, window.innerWidth - 310) + "px";
  picker.style.top = (rect.bottom + 4) + "px";

  let html = "";
  for (const cat of EMOJI_CATEGORIES) {
    html += `<div class="icon-picker-category">${cat.name}</div><div class="icon-picker-grid">`;
    for (const emoji of cat.icons) {
      html += `<button class="icon-picker-cell" data-emoji="${emoji}">${emoji}</button>`;
    }
    html += `</div>`;
  }
  picker.innerHTML = html;
  picker.addEventListener("click", (e) => {
    e.stopPropagation();
    const cell = e.target.closest(".icon-picker-cell");
    if (!cell) return;
    const s = config.slices[idx];
    s.icon = cell.dataset.emoji;
    // Update inline
    const iconEl = document.getElementById(`icon-btn-${idx}`);
    if (iconEl) iconEl.textContent = cell.dataset.emoji;
    const rowIcon = document.querySelector(`.slice-row[data-index="${idx}"] .slice-icon`);
    if (rowIcon) rowIcon.textContent = cell.dataset.emoji;
    // Update mini preview
    const miniNodes = document.querySelectorAll(".ring-mini-node");
    if (miniNodes[idx]) miniNodes[idx].textContent = cell.dataset.emoji;
    closeIconPicker();
  });

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

// --- Add Slice ---

function addSlice() {
  config.slices.push({
    label: "",
    icon: "⚙️",
    action: { type: "Script", command: "" },
  });
  expandedSlice = config.slices.length - 1;
  render();
}

// --- Recording ---

function stopRecording() {
  if (activeRecorder) {
    activeRecorder.cleanup();
    activeRecorder = null;
  }
}

function startRecording() {
  stopRecording();

  const display = document.getElementById("shortcut-display");
  const btn = document.getElementById("record-btn");

  display.textContent = "Press keys...";
  display.classList.add("recording");
  btn.textContent = "Cancel";

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
    display.classList.remove("recording");
    display.textContent = config.shortcut || "Not set";
    btn.textContent = "Record";
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
  btn.onclick = cancel;
  activeRecorder = { cleanup };
}

// --- Save ---

async function saveConfig() {
  try {
    await invoke("save_config", { config });
    const btn = document.getElementById("save-btn");
    btn.textContent = "Saved";
    btn.classList.add("saved");
    setTimeout(() => {
      btn.textContent = "Save";
      btn.classList.remove("saved");
    }, 1500);
  } catch (e) {
    alert("Failed to save: " + e);
  }
}

loadConfig();
