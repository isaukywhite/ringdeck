import {
  CENTER,
  closestSlice as _closestSlice,
  closestSubNode as _closestSubNode,
  isNearBackButton as _isNearBackButton,
} from './geometry.js';
import {
  getSlices, getHoveredIndex, setHoveredIndex,
  getActiveSubmenu, setActiveSubmenu,
  getSubmenuHoveredIndex, setSubmenuHoveredIndex,
} from './state.js';
import { buildSubRing, closeSubRing } from './ring-render.js';
import { updateHover } from './hover.js';

function closestSlice(mx, my) {
  return _closestSlice(mx, my, getSlices());
}

function closestSubNode(mx, my) {
  return _closestSubNode(mx, my, getActiveSubmenu(), getSlices());
}

function isNearBackButton(mx, my) {
  return _isNearBackButton(mx, my, getActiveSubmenu(), getSlices());
}

// ─── Submenu interaction helpers ───

export function highlightSubNode(subIdx) {
  if (subIdx !== getSubmenuHoveredIndex()) {
    setSubmenuHoveredIndex(subIdx);
    const subRingEl = document.getElementById("sub-ring");
    if (subRingEl) {
      subRingEl.querySelectorAll(".sub-ring-node").forEach((el) => el.classList.remove("hovered"));
      const target = subRingEl.querySelector(`.sub-ring-node[data-sub-index="${subIdx}"]`);
      if (target) target.classList.add("hovered");
    }
  }
}

export function highlightBackButton() {
  setSubmenuHoveredIndex(-1);
  const subRingEl = document.getElementById("sub-ring");
  if (subRingEl) {
    subRingEl.querySelectorAll(".sub-ring-node").forEach((el) => el.classList.remove("hovered"));
    const back = subRingEl.querySelector(".sub-ring-back");
    if (back) back.classList.add("hovered");
  }
}

export function clearSubRingHover() {
  setSubmenuHoveredIndex(-1);
  const subRingEl = document.getElementById("sub-ring");
  if (subRingEl) {
    subRingEl.querySelectorAll(".sub-ring-node, .sub-ring-back").forEach((el) => el.classList.remove("hovered"));
  }
}

export function handleSubmenuMouseMove(mx, my) {
  // Check if hovering a sub-node
  const subIdx = closestSubNode(mx, my);
  if (subIdx >= 0) {
    highlightSubNode(subIdx);
    return;
  }

  // Check if hovering back button
  if (isNearBackButton(mx, my)) {
    highlightBackButton();
    return;
  }

  // Check if hovering a main ring node
  const mainIdx = closestSlice(mx, my);
  if (mainIdx >= 0 && mainIdx !== getActiveSubmenu()) {
    closeSubRing();
    updateHover(mainIdx);
    return;
  }

  // Clear sub-node hover
  clearSubRingHover();
}

export async function executeSubmenuClick() {
  const activeSubmenu = getActiveSubmenu();
  const submenuHoveredIndex = getSubmenuHoveredIndex();
  try { await globalThis.api.executeSubmenuAction(activeSubmenu, submenuHoveredIndex); }
  catch (e) { console.error("Submenu action failed:", e); }
  closeSubRing();
  setHoveredIndex(-1);
  await globalThis.api.hideRing();
}

export function toggleSubmenuForHovered() {
  const hoveredIndex = getHoveredIndex();
  if (getActiveSubmenu() === hoveredIndex) {
    closeSubRing();
  } else {
    setActiveSubmenu(hoveredIndex);
    setSubmenuHoveredIndex(-1);
    buildSubRing(hoveredIndex);
  }
}

export async function handleMouseUp(container) {
  const activeSubmenu = getActiveSubmenu();
  const hoveredIndex = getHoveredIndex();
  const submenuHoveredIndex = getSubmenuHoveredIndex();
  const slices = getSlices();

  // If submenu is open, check if clicking a sub-item or back
  if (activeSubmenu >= 0) {
    if (submenuHoveredIndex >= 0) {
      await executeSubmenuClick();
      return;
    }

    // Check back button
    const backEl = document.getElementById("sub-ring")?.querySelector(".sub-ring-back.hovered");
    if (backEl) {
      closeSubRing();
      return;
    }
  }

  if (hoveredIndex >= 0 && hoveredIndex < slices.length) {
    const s = slices[hoveredIndex];
    // If it's a submenu, don't execute — just open/toggle sub-ring
    if (s?.action?.type === "Submenu") {
      toggleSubmenuForHovered();
      return;
    }
    try { await globalThis.api.executeAction(hoveredIndex); }
    catch (e) { console.error("Action failed:", e); }
  }
  setHoveredIndex(-1);
  closeSubRing();
  await globalThis.api.hideRing();
}

export async function handleKeyUp(e) {
  // Ignore if ring just appeared (debounce 200ms to avoid premature activation)
  if (Date.now() - handleKeyUp._ringShowTime < 200) return;

  // Only activate when a MODIFIER key (Ctrl/Alt/Shift/Meta) is released
  // and NO other modifiers remain held.
  const isModifierKey = ["Control", "Alt", "Shift", "Meta"].includes(e.key);
  if (!isModifierKey) return;

  const hasModifiers = e.ctrlKey || e.altKey || e.shiftKey || e.metaKey;
  if (hasModifiers) return; // Still holding other modifiers

  const activeSubmenu = getActiveSubmenu();
  const submenuHoveredIndex = getSubmenuHoveredIndex();
  const hoveredIndex = getHoveredIndex();
  const slices = getSlices();

  // If submenu is open and a sub-item is hovered → execute sub-action
  if (activeSubmenu >= 0 && submenuHoveredIndex >= 0) {
    try { await globalThis.api.executeSubmenuAction(activeSubmenu, submenuHoveredIndex); }
    catch (err) { console.error("Submenu action failed:", err); }
    closeSubRing();
    setHoveredIndex(-1);
    await globalThis.api.hideRing();
    return;
  }

  // All modifiers released → activate hovered action (if not submenu)
  if (hoveredIndex >= 0 && hoveredIndex < slices.length) {
    const s = slices[hoveredIndex];
    if (s?.action?.type === "Submenu") {
      // Don't close ring — just open the submenu on release
      setActiveSubmenu(hoveredIndex);
      setSubmenuHoveredIndex(-1);
      buildSubRing(hoveredIndex);
      return;
    }
    try { await globalThis.api.executeAction(hoveredIndex); }
    catch (err) { console.error("Action failed:", err); }
  }
  setHoveredIndex(-1);
  closeSubRing();
  await globalThis.api.hideRing();
}
handleKeyUp._ringShowTime = 0;

let _interactionSetup = false;

export function _resetInteractionSetup() { _interactionSetup = false; }

export function setupInteraction() {
  if (_interactionSetup) return;
  _interactionSetup = true;

  const container = document.getElementById("ring");

  container.addEventListener("mousemove", (e) => {
    const rect = container.getBoundingClientRect();
    const zoom = parseFloat(getComputedStyle(container).zoom) || 1;
    const mx = (e.clientX - rect.left) / zoom - CENTER;
    const my = (e.clientY - rect.top) / zoom - CENTER;

    if (getActiveSubmenu() >= 0) {
      handleSubmenuMouseMove(mx, my);
      return;
    }

    updateHover(closestSlice(mx, my));
  });

  container.addEventListener("mouseleave", () => {
    if (getActiveSubmenu() < 0) {
      updateHover(-1);
    }
  });

  // Click (mouseup) still works as fallback
  container.addEventListener("mouseup", async () => {
    await handleMouseUp(container);
  });

  // Release-to-activate: when modifier keys are released, trigger hovered action

  // Track when ring becomes visible
  const observer = new MutationObserver(() => {
    if (!document.hidden) {
      handleKeyUp._ringShowTime = Date.now();
    }
  });
  observer.observe(document, { attributes: true, attributeFilter: ["visibilityState"] });

  // Also set on DOMContentLoaded / visibility
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) {
      handleKeyUp._ringShowTime = Date.now();
    }
  });

  document.addEventListener("keyup", handleKeyUp);

  document.addEventListener("keydown", async (e) => {
    if (e.key === "Escape") {
      if (getActiveSubmenu() >= 0) {
        closeSubRing();
        return;
      }
      setHoveredIndex(-1);
      await globalThis.api.hideRing();
    }
  });
}
