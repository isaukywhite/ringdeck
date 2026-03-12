import { invoke } from "@tauri-apps/api/core";

let config = { shortcut: "", slices: [] };
let activeRecorder = null;
let selectedSlice = -1;
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

async function loadConfig() {
  config = await invoke("get_config");
  // Migrate legacy icon strings
  for (const s of config.slices) {
    s.icon = resolveIcon(s.icon);
  }
  render();
}

function render() {
  const app = document.querySelector("#app");
  app.innerHTML = `
    <div class="config-panel">
      <h1>RingDeck</h1>
      <p class="subtitle">Radial action ring — mouse shortcut launcher</p>

      <section class="shortcut-section">
        <label>Trigger Shortcut</label>
        <div class="shortcut-row">
          <span class="shortcut-display" id="shortcut-display">${config.shortcut || "Not set"}</span>
          <button id="record-btn" class="btn btn-secondary">Record</button>
        </div>
      </section>

      <section class="slices-section">
        <div class="section-header">
          <label>Ring Slices</label>
          <button id="add-slice-btn" class="btn btn-secondary btn-small">+ Add</button>
        </div>
        ${renderPreview()}
        ${config.slices.length === 0 ? '<p class="empty-hint">No slices configured. Add one to get started.</p>' : ""}
        <div id="editor-mount"></div>
      </section>

      <div class="actions-row">
        <button id="save-btn" class="btn btn-primary">Save Configuration</button>
      </div>
    </div>
  `;

  document.getElementById("record-btn").addEventListener("click", startRecording);
  document.getElementById("add-slice-btn").addEventListener("click", addSlice);
  document.getElementById("save-btn").addEventListener("click", saveConfig);

  setupPreviewInteraction();
  if (selectedSlice >= 0 && selectedSlice < config.slices.length) {
    renderEditor();
  }
}

// --- Geometric Preview ---

const PREVIEW_SIZE = 300;
const PREVIEW_CENTER = PREVIEW_SIZE / 2;
const NODE_RADIUS = 110;

function slicePosition(i, n) {
  const angle = (2 * Math.PI * i) / n - Math.PI / 2;
  return {
    x: PREVIEW_CENTER + NODE_RADIUS * Math.cos(angle),
    y: PREVIEW_CENTER + NODE_RADIUS * Math.sin(angle),
    angle,
  };
}

function renderPreview() {
  if (config.slices.length === 0) {
    return `<div class="ring-preview-wrap"><div class="ring-preview"><div class="aura"></div></div></div>`;
  }

  const n = config.slices.length;
  let svgLines = "";

  // Draw polygon lines between adjacent nodes
  if (n >= 2) {
    const points = [];
    for (let i = 0; i < n; i++) {
      const p = slicePosition(i, n);
      points.push(`${p.x},${p.y}`);
    }
    svgLines = `<polygon points="${points.join(" ")}" fill="none" stroke="rgba(233,69,96,0.15)" stroke-width="1" />`;
  }

  const nodes = config.slices.map((s, i) => {
    const p = slicePosition(i, n);
    const sel = i === selectedSlice ? " selected" : "";
    return `<div class="slice-node${sel}" data-index="${i}" style="left:${p.x}px;top:${p.y}px">
      <div class="slice-node-icon">${resolveIcon(s.icon)}</div>
      <span class="slice-node-label">${s.label || `Slice ${i + 1}`}</span>
    </div>`;
  }).join("");

  return `
    <div class="ring-preview-wrap">
      <div class="ring-preview" id="ring-preview">
        <svg class="ring-preview-svg" viewBox="0 0 ${PREVIEW_SIZE} ${PREVIEW_SIZE}">${svgLines}</svg>
        <div class="aura"></div>
        <div class="aura-pointer" id="aura-pointer"></div>
        ${nodes}
      </div>
    </div>`;
}

function setupPreviewInteraction() {
  const preview = document.getElementById("ring-preview");
  if (!preview) return;

  const pointer = document.getElementById("aura-pointer");

  // Click nodes to select
  preview.querySelectorAll(".slice-node").forEach((node) => {
    node.addEventListener("click", () => {
      selectedSlice = +node.dataset.index;
      // Update selected class
      preview.querySelectorAll(".slice-node").forEach((n) => n.classList.remove("selected"));
      node.classList.add("selected");
      renderEditor();
    });
  });

  // Aura pointer follows mouse direction
  preview.addEventListener("mousemove", (e) => {
    if (!pointer || config.slices.length === 0) return;
    const rect = preview.getBoundingClientRect();
    const mx = e.clientX - rect.left - PREVIEW_CENTER;
    const my = e.clientY - rect.top - PREVIEW_CENTER;
    const dist = Math.sqrt(mx * mx + my * my);

    if (dist < 5) return;

    const angle = Math.atan2(my, mx);
    const pr = 25;
    const px = PREVIEW_CENTER + pr * Math.cos(angle);
    const py = PREVIEW_CENTER + pr * Math.sin(angle);
    pointer.style.left = px + "px";
    pointer.style.top = py + "px";
    pointer.style.opacity = "1";

    // Highlight closest node
    const n = config.slices.length;
    let closest = 0;
    let minDist = Infinity;
    for (let i = 0; i < n; i++) {
      const p = slicePosition(i, n);
      const dx = p.x - (mx + PREVIEW_CENTER);
      const dy = p.y - (my + PREVIEW_CENTER);
      const d = dx * dx + dy * dy;
      if (d < minDist) { minDist = d; closest = i; }
    }
    preview.querySelectorAll(".slice-node").forEach((node, idx) => {
      node.classList.toggle("highlight", idx === closest);
    });
  });

  preview.addEventListener("mouseleave", () => {
    if (pointer) pointer.style.opacity = "0";
    preview.querySelectorAll(".slice-node").forEach((n) => n.classList.remove("highlight"));
  });
}

// --- Slice Editor ---

function renderEditor() {
  const mount = document.getElementById("editor-mount");
  if (!mount || selectedSlice < 0 || selectedSlice >= config.slices.length) {
    if (mount) mount.innerHTML = "";
    return;
  }

  const s = config.slices[selectedSlice];
  const actionType = s.action.type;
  let commandValue = "";
  if (actionType === "Script") commandValue = s.action.command;
  else if (actionType === "Program") commandValue = [s.action.path, ...(s.action.args || [])].join(" ");

  mount.innerHTML = `
    <div class="slice-editor">
      <div class="editor-row">
        <label class="editor-label">Icon</label>
        <button class="icon-btn" id="icon-btn">${resolveIcon(s.icon)}</button>
        <label class="editor-label" style="width:auto;margin-left:8px">Label</label>
        <input type="text" id="editor-label" value="${escAttr(s.label)}" placeholder="Slice name" style="flex:1" />
      </div>
      <div class="editor-row">
        <label class="editor-label">Type</label>
        <select id="editor-type" style="width:120px">
          <option value="Script" ${actionType === "Script" ? "selected" : ""}>Script</option>
          <option value="Program" ${actionType === "Program" ? "selected" : ""}>Program</option>
        </select>
      </div>
      <div class="editor-row">
        <label class="editor-label">Command</label>
        <input type="text" id="editor-command" value="${escAttr(commandValue)}" placeholder="${actionType === "Script" ? "Shell command" : "Program path + args"}" style="flex:1" />
      </div>
      <div class="editor-row" style="justify-content:flex-end">
        <button class="btn btn-danger btn-small" id="editor-delete">Delete Slice</button>
      </div>
    </div>
  `;

  const idx = selectedSlice;

  document.getElementById("editor-label").addEventListener("input", (e) => {
    config.slices[idx].label = e.target.value;
    updateNodeDisplay(idx);
  });

  document.getElementById("editor-type").addEventListener("change", (e) => {
    const cmd = document.getElementById("editor-command").value;
    if (e.target.value === "Script") {
      config.slices[idx].action = { type: "Script", command: cmd };
    } else {
      const parts = cmd.split(" ");
      config.slices[idx].action = { type: "Program", path: parts[0] || "", args: parts.slice(1) };
    }
    document.getElementById("editor-command").placeholder = e.target.value === "Script" ? "Shell command" : "Program path + args";
  });

  document.getElementById("editor-command").addEventListener("input", (e) => {
    const t = document.getElementById("editor-type").value;
    if (t === "Script") {
      config.slices[idx].action = { type: "Script", command: e.target.value };
    } else {
      const parts = e.target.value.split(" ");
      config.slices[idx].action = { type: "Program", path: parts[0] || "", args: parts.slice(1) };
    }
  });

  document.getElementById("editor-delete").addEventListener("click", () => {
    config.slices.splice(idx, 1);
    selectedSlice = -1;
    render();
  });

  document.getElementById("icon-btn").addEventListener("click", (e) => {
    e.stopPropagation();
    openIconPicker(idx);
  });
}

function updateNodeDisplay(idx) {
  const node = document.querySelector(`.slice-node[data-index="${idx}"]`);
  if (!node) return;
  const s = config.slices[idx];
  node.querySelector(".slice-node-icon").textContent = resolveIcon(s.icon);
  node.querySelector(".slice-node-label").textContent = s.label || `Slice ${idx + 1}`;
}

function openIconPicker(idx) {
  closeIconPicker();
  pickerOpen = true;

  const btn = document.getElementById("icon-btn");
  const rect = btn.getBoundingClientRect();

  // Overlay to catch outside clicks
  const overlay = document.createElement("div");
  overlay.className = "icon-picker-overlay";
  overlay.addEventListener("click", closeIconPicker);

  const picker = document.createElement("div");
  picker.className = "icon-picker";
  picker.style.left = rect.left + "px";
  picker.style.top = (rect.bottom + 6) + "px";

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
    config.slices[idx].icon = cell.dataset.emoji;
    updateNodeDisplay(idx);
    document.getElementById("icon-btn").textContent = cell.dataset.emoji;
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

// --- Slice Add ---

function addSlice() {
  config.slices.push({
    label: "",
    icon: "⚙️",
    action: { type: "Script", command: "" },
  });
  selectedSlice = config.slices.length - 1;
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
    btn.textContent = "Saved!";
    btn.classList.add("saved");
    setTimeout(() => {
      btn.textContent = "Save Configuration";
      btn.classList.remove("saved");
    }, 1500);
  } catch (e) {
    alert("Failed to save: " + e);
  }
}

loadConfig();
