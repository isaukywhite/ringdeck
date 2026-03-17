import { resolveIcon } from '../icons.js';
import {
  RING_SIZE, CENTER, NODE_ORBIT,
  nodePosition, subNodePosition,
} from './geometry.js';
import {
  getSlices, getSubmenuHoveredIndex,
  setActiveSubmenu, setSubmenuHoveredIndex,
} from './state.js';
import { startParticles } from './particles.js';

export function buildRing() {
  const container = document.getElementById("ring");
  const slices = getSlices();
  const n = slices.length;

  let html = `
    <canvas class="ring-particles" width="${RING_SIZE}" height="${RING_SIZE}"></canvas>

    <svg class="ring-orbit" viewBox="0 0 ${RING_SIZE} ${RING_SIZE}">
      <circle class="ring-orbit-circle" cx="${CENTER}" cy="${CENTER}" r="${NODE_ORBIT}" />
    </svg>

    <svg class="ring-sector-svg" viewBox="0 0 ${RING_SIZE} ${RING_SIZE}">
      <defs>
        <radialGradient id="sectorGradient" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stop-color="rgba(45, 27, 105, 0.6)" />
          <stop offset="35%" stop-color="rgba(61, 42, 124, 0.3)" />
          <stop offset="60%" stop-color="rgba(10, 132, 255, 0.12)" />
          <stop offset="80%" stop-color="rgba(45, 27, 105, 0.05)" />
          <stop offset="100%" stop-color="transparent" />
        </radialGradient>
      </defs>
      <path class="ring-sector-path" d="" fill="url(#sectorGradient)" />
    </svg>

    <svg class="ring-beam" viewBox="0 0 ${RING_SIZE} ${RING_SIZE}">
      <defs>
        <linearGradient id="beamGradient" gradientUnits="userSpaceOnUse"
          x1="${CENTER}" y1="${CENTER}" x2="${CENTER}" y2="${CENTER}">
          <stop offset="0%" stop-color="rgba(45, 27, 105, 0)" />
          <stop offset="30%" stop-color="rgba(61, 42, 124, 0.3)" />
          <stop offset="70%" stop-color="rgba(10, 132, 255, 0.45)" />
          <stop offset="100%" stop-color="rgba(79, 209, 255, 0.5)" />
        </linearGradient>
      </defs>
      <line class="ring-beam-glow" x1="${CENTER}" y1="${CENTER}" x2="${CENTER}" y2="${CENTER}" />
      <line class="ring-beam-line" x1="${CENTER}" y1="${CENTER}" x2="${CENTER}" y2="${CENTER}" />
    </svg>

    <svg class="ring-arc-svg" viewBox="0 0 ${RING_SIZE} ${RING_SIZE}">
      <defs>
        <linearGradient id="arcGradient" gradientUnits="userSpaceOnUse"
          x1="${CENTER - NODE_ORBIT - 40}" y1="${CENTER}" x2="${CENTER + NODE_ORBIT + 40}" y2="${CENTER}">
          <stop offset="0%" stop-color="#2D1B69" />
          <stop offset="25%" stop-color="#0A84FF" />
          <stop offset="50%" stop-color="#4FD1FF" />
          <stop offset="75%" stop-color="#0A84FF" />
          <stop offset="100%" stop-color="#2D1B69" />
        </linearGradient>
      </defs>
      <path class="ring-arc-glow" d="" />
      <path class="ring-arc-path" d="" />
    </svg>

    <div class="ring-center"></div>`;

  if (n > 0) {
    const stagger = 0.065;
    for (let i = 0; i < n; i++) {
      const p = nodePosition(i, n);
      const s = slices[i];
      const isSubmenu = s.action?.type === "Submenu";
      const icon = s.customIcon
        ? `<img src="${s.customIcon}" style="width:24px;height:24px;" />`
        : resolveIcon(s.icon);
      const delay = (0.1 + stagger * i).toFixed(3);
      const submenuIndicator = isSubmenu
        ? `<div class="submenu-indicator">${resolveIcon('chevron-right')}</div>`
        : '';

      html += `
        <div class="ring-node${isSubmenu ? ' is-submenu' : ''}" data-index="${i}"
             style="left:${p.x}px;top:${p.y}px;animation-delay:${delay}s">
          <div class="ring-node-inner">
            <div class="ring-node-circle">${icon}</div>
            <div class="ring-node-dot"></div>
            ${submenuIndicator}
          </div>
        </div>`;
    }
  }

  // Sub-ring container (populated dynamically)
  html += `<div class="sub-ring" id="sub-ring"></div>`;

  container.innerHTML = html;
  startParticles();
}

// ─── Build sub-ring for a specific parent ───
export function buildSubRing(parentIndex) {
  const subRingEl = document.getElementById("sub-ring");
  if (!subRingEl) return;

  const slices = getSlices();
  const submenuHoveredIndex = getSubmenuHoveredIndex();
  const parentSlice = slices[parentIndex];
  if (!parentSlice || parentSlice.action?.type !== "Submenu") {
    subRingEl.innerHTML = "";
    subRingEl.classList.remove("visible");
    return;
  }

  const children = parentSlice.action.slices || [];
  const n = children.length;
  const parentN = slices.length;

  if (n === 0) {
    subRingEl.innerHTML = `<div class="sub-ring-empty">No sub-actions</div>`;
    subRingEl.classList.add("visible");
    return;
  }

  let html = "";

  // Back button at parent position (center of sub-ring)
  const parentAngle = (2 * Math.PI * parentIndex) / parentN - Math.PI / 2;
  const backX = CENTER + NODE_ORBIT * Math.cos(parentAngle);
  const backY = CENTER + NODE_ORBIT * Math.sin(parentAngle);
  html += `
    <div class="sub-ring-back" data-action="back"
         style="left:${backX}px;top:${backY}px">
      ${resolveIcon('arrow-uturn-left')}
    </div>`;

  // Child nodes
  const stagger = 0.04;
  for (let i = 0; i < n; i++) {
    const child = children[i];
    const pos = subNodePosition(i, n, parentIndex, parentN);
    const icon = child.customIcon
      ? `<img src="${child.customIcon}" style="width:18px;height:18px;" />`
      : resolveIcon(child.icon);
    const delay = (0.05 + stagger * i).toFixed(3);
    const hovered = i === submenuHoveredIndex ? " hovered" : "";

    html += `
      <div class="sub-ring-node${hovered}" data-sub-index="${i}"
           style="left:${pos.x}px;top:${pos.y}px;animation-delay:${delay}s">
        <div class="sub-ring-node-inner">
          ${icon}
        </div>
        <div class="sub-ring-label">${child.label || "..."}</div>
      </div>`;
  }

  subRingEl.innerHTML = html;
  subRingEl.classList.add("visible");
}

export function closeSubRing() {
  setActiveSubmenu(-1);
  setSubmenuHoveredIndex(-1);
  const subRingEl = document.getElementById("sub-ring");
  if (subRingEl) {
    subRingEl.classList.remove("visible");
    subRingEl.innerHTML = "";
  }
}
