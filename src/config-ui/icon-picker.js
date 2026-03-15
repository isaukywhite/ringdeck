import { resolveIcon } from '../icons.js';
import { activeProfile, getPickerOpen, setPickerOpen } from './state.js';
import { buildPickerContent, render } from './render.js';

export function closeIconPicker() {
  if (!getPickerOpen()) return;
  setPickerOpen(false);
  document.querySelectorAll(".icon-picker-overlay, .icon-picker").forEach((el) => el.remove());
}

export function openIconPicker(idx) {
  closeIconPicker();
  setPickerOpen(true);

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

export function openSubIconPicker(parentIdx, subIdx) {
  closeIconPicker();
  setPickerOpen(true);

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
