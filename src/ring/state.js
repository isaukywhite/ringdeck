// ─── Shared mutable state for the ring ───

let slices = [];
let hoveredIndex = -1;
let particleAnim = null;
let activeSubmenu = -1;
let submenuHoveredIndex = -1;
let submenuTimer = null;
let currentPalette = null;
export const SUBMENU_HOVER_DELAY = 300;

export function getSlices() { return slices; }
export function setSlices(v) { slices = v; }

export function getHoveredIndex() { return hoveredIndex; }
export function setHoveredIndex(v) { hoveredIndex = v; }

export function getParticleAnim() { return particleAnim; }
export function setParticleAnim(v) { particleAnim = v; }

export function getActiveSubmenu() { return activeSubmenu; }
export function setActiveSubmenu(v) { activeSubmenu = v; }

export function getSubmenuHoveredIndex() { return submenuHoveredIndex; }
export function setSubmenuHoveredIndex(v) { submenuHoveredIndex = v; }

export function getSubmenuTimer() { return submenuTimer; }
export function setSubmenuTimer(v) { submenuTimer = v; }

export function getCurrentPalette() { return currentPalette; }
export function setCurrentPalette(v) { currentPalette = v; }

