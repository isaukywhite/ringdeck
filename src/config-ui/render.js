import { ICON_MAP, ICON_CATEGORIES, resolveIcon } from '../icons.js';
import { appName, actionSummary, escAttr, sliceIcon } from './utils.js';
import { SUBMENU_TEMPLATES } from './templates.js';
import { BUILTIN_PRESETS } from '../color-engine.js';
import {
  getConfig, activeProfile, getExpandedSlice, getSentryEnabled,
  getActiveProfileIndex, getActiveView, getAppVersion,
} from './state.js';

// Registration slot for bindEvents — set by events.js to break the circular dependency
let _bindEvents = null;
export function registerBindEvents(fn) { _bindEvents = fn; }

// ─── Ring preview ───

export function renderPreview() {
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
    const hl = i === getExpandedSlice() ? " highlight" : "";
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

export function renderSubActionInput(sub, parentIdx, j) {
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

export function renderSubActions(subSlices, parentIdx) {
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

// ─── Action detail helpers ───

export function renderActionTypeFields(at, i, s, pathDisplay, programArgs) {
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

export function renderSubmenuSection(at, i, s) {
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

export function renderActionDetail(s, i) {
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

export function renderActionCard(s, i) {
  const expandedSlice = getExpandedSlice();
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

export function renderProfileTabs() {
  const config = getConfig();
  const activeProfileIndex = getActiveProfileIndex();
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

// ─── Icon Picker helpers ───

export function renderIconButtons(icons, currentIcon) {
  let html = "";
  for (const name of icons) {
    const sel = name === currentIcon ? " selected" : "";
    html += `<button class="icon-picker-cell${sel}" data-icon="${name}" title="${name}">${resolveIcon(name)}</button>`;
  }
  return html;
}

export function renderExtraIcons(q, currentIcon) {
  const catIcons = new Set(ICON_CATEGORIES.flatMap(c => c.icons));
  const extras = Object.keys(ICON_MAP).filter(n => !catIcons.has(n) && n.includes(q));
  if (extras.length === 0) return { html: "", found: false };
  let html = `<div class="icon-picker-category">Other</div><div class="icon-picker-grid">`;
  html += renderIconButtons(extras, currentIcon);
  html += `</div>`;
  return { html, found: true };
}

export function buildPickerContent(body, currentIcon, query) {
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

// ─── Settings view ───

export function renderSettings() {
  const config = getConfig();
  const settings = config.settings || {};
  const activePreset = settings.activePreset || 'nebula';
  const customPresets = settings.customPresets || [];
  const ringSize = settings.ringSize || 'medium';
  const launchAtStartup = settings.launchAtStartup || false;
  const closeToTray = settings.closeToTray !== false;
  const sendErrorReports = settings.sendErrorReports !== false;
  const currentColor = settings.ringColor || '#0A84FF';

  const builtinSwatches = BUILTIN_PRESETS.map(p => {
    const isActive = activePreset === p.id;
    return `<button class="swatch${isActive ? ' active' : ''}" data-preset-id="${p.id}" data-preset-color="${p.color}" title="${escAttr(p.name)}">
      <span class="swatch-color" style="background:${p.color}"></span>
      <span class="swatch-name">${escAttr(p.name)}</span>
      ${isActive ? '<span class="swatch-check">✔</span>' : ''}
    </button>`;
  }).join('');

  const customSwatches = customPresets.map(p => {
    const isActive = activePreset === p.id;
    return `<button class="swatch custom${isActive ? ' active' : ''}" data-preset-id="${p.id}" data-preset-color="${p.color}" title="${escAttr(p.name)}">
      <span class="swatch-color" style="background:${p.color}"></span>
      <span class="swatch-name">${escAttr(p.name)}</span>
      ${isActive ? '<span class="swatch-check">✔</span>' : ''}
      <span class="swatch-delete" data-delete-preset="${p.id}" title="Delete">×</span>
    </button>`;
  }).join('');

  const sizes = ['tiny', 'mini', 'small', 'medium', 'large'];
  const sizeButtons = sizes.map(s => {
    const label = s.charAt(0).toUpperCase() + s.slice(1);
    const px = { tiny: 16, mini: 20, small: 24, medium: 30, large: 36 };
    return `<button class="size-btn${s === ringSize ? ' active' : ''}" data-size="${s}">
      <span class="size-btn-ring" style="width:${px[s]}px;height:${px[s]}px"></span>
      <span class="size-btn-label">${label}</span>
    </button>`;
  }).join('');

  return `
    <div class="settings-view">
      <div class="setting-card">
        <div class="setting-card-header">
          <span class="setting-card-icon">${resolveIcon('paint-brush')}</span>
          <div>
            <div class="setting-card-title">Ring Color</div>
            <div class="setting-card-desc">Choose a preset or create your own</div>
          </div>
        </div>
        <div class="swatch-grid">${builtinSwatches}${customSwatches}</div>
        <div class="custom-color-section">
          <div class="color-preview-row">
            <div class="color-preview-swatch" style="background:${currentColor}"></div>
            <div class="color-inputs">
              <input type="color" id="custom-color-picker" value="${currentColor}" />
              <input type="text" id="custom-color-hex" value="${currentColor}" maxlength="7" placeholder="#000000" spellcheck="false" />
            </div>
          </div>
          <div class="preset-save-row">
            <input type="text" id="custom-preset-name" placeholder="Name your color…" maxlength="20" spellcheck="false" />
            <button class="btn-save-preset" id="save-preset-btn">
              <span class="btn-icon">+</span> Save Preset
            </button>
          </div>
        </div>
      </div>

      <div class="setting-card">
        <div class="setting-card-header">
          <span class="setting-card-icon">${resolveIcon('cursor-arrow-rays')}</span>
          <div>
            <div class="setting-card-title">Ring Size</div>
            <div class="setting-card-desc">Controls the ring overlay dimensions</div>
          </div>
        </div>
        <div class="size-selector">${sizeButtons}</div>
      </div>

      <div class="setting-card">
        <div class="setting-card-header">
          <span class="setting-card-icon">${resolveIcon('cog-6-tooth')}</span>
          <div>
            <div class="setting-card-title">Behavior</div>
            <div class="setting-card-desc">System integration preferences</div>
          </div>
        </div>
        <div class="toggle-list">
          <label class="setting-toggle">
            <div class="toggle-info">
              <span class="toggle-label">Launch at startup</span>
              <span class="toggle-desc">Start RingDeck when you log in</span>
            </div>
            <input type="checkbox" id="toggle-startup" ${launchAtStartup ? 'checked' : ''} />
            <span class="toggle-slider"></span>
          </label>
          <label class="setting-toggle">
            <div class="toggle-info">
              <span class="toggle-label">Close to tray</span>
              <span class="toggle-desc">Keep running in the system tray</span>
            </div>
            <input type="checkbox" id="toggle-tray" ${closeToTray ? 'checked' : ''} />
            <span class="toggle-slider"></span>
          </label>
          <label class="setting-toggle">
            <div class="toggle-info">
              <span class="toggle-label">Send anonymous error reports</span>
              <span class="toggle-desc">Help improve RingDeck by sharing crash data</span>
            </div>
            <input type="checkbox" id="toggle-error-reports" ${sendErrorReports ? 'checked' : ''} />
            <span class="toggle-slider"></span>
          </label>
        </div>
      </div>

      <div class="settings-footer">
        <span class="settings-version">RingDeck ${getAppVersion()}</span>
      </div>
    </div>
  `;
}

// ─── Actions view ───

export function renderActionsView(profile, cards, n) {
  const config = getConfig();
  return `${renderProfileTabs()}

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
    </div>`;
}

// ─── Main render ───

export function render() {
  const app = document.querySelector("#app");
  const profile = activeProfile();
  if (!profile) return;

  const activeView = getActiveView();

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
        <div class="app-version">${getAppVersion()}</div>

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
        <div class="config-nav">
          <button class="config-nav-tab${activeView === 'actions' ? ' active' : ''}" data-view="actions">Actions</button>
          <button class="config-nav-tab${activeView === 'settings' ? ' active' : ''}" data-view="settings">Settings</button>
        </div>

        ${activeView === 'settings' ? renderSettings() : renderActionsView(profile, cards, n)}
      </div>
    </div>
  `;

  if (_bindEvents) _bindEvents();
}
