import {
  CENTER, ARC_RADIUS,
  arcSpread, nodePosition, describeArc, describeSector,
} from './geometry.js';
import {
  getSlices, getHoveredIndex, setHoveredIndex,
  getActiveSubmenu, setActiveSubmenu,
  setSubmenuHoveredIndex,
  getSubmenuTimer, setSubmenuTimer,
  SUBMENU_HOVER_DELAY,
} from './state.js';
import { buildSubRing, closeSubRing } from './ring-render.js';

export function activateArcPath(arcPath, arcD) {
  arcPath.classList.remove("active");
  arcPath.getBBox(); // force reflow
  arcPath.setAttribute("d", arcD);
  const arcLen = arcPath.getTotalLength();
  arcPath.style.strokeDasharray = arcLen;
  arcPath.style.strokeDashoffset = arcLen;
  arcPath.style.setProperty("--arc-len", arcLen);
  arcPath.classList.add("active");
}

export function activateBeamLine(beamLine, pos) {
  beamLine.classList.remove("active");
  beamLine.setAttribute("x2", pos.x.toFixed(2));
  beamLine.setAttribute("y2", pos.y.toFixed(2));
  const bLen = Math.hypot(pos.x - CENTER, pos.y - CENTER);
  beamLine.style.strokeDasharray = bLen;
  beamLine.style.strokeDashoffset = bLen;
  beamLine.style.setProperty("--beam-len", bLen);
  beamLine.getBBox(); // force reflow
  beamLine.classList.add("active");
}

export function activateBeamGlow(beamGlow, pos) {
  beamGlow.setAttribute("x2", pos.x.toFixed(2));
  beamGlow.setAttribute("y2", pos.y.toFixed(2));
  beamGlow.classList.add("active");
}

export function deactivateHoverElements(center, orbitCircle, arcPath, arcGlow, beamLine, beamGlow, sectorPath) {
  if (center) center.classList.remove("active");
  if (orbitCircle) orbitCircle.classList.remove("active");
  if (arcPath) arcPath.classList.remove("active");
  if (arcGlow) arcGlow.classList.remove("active");
  if (beamLine) beamLine.classList.remove("active");
  if (beamGlow) beamGlow.classList.remove("active");
  if (sectorPath) sectorPath.classList.remove("active");
}

export function scheduleSubmenuOpen(idx) {
  setSubmenuTimer(setTimeout(() => {
    if (getHoveredIndex() === idx) {
      setActiveSubmenu(idx);
      setSubmenuHoveredIndex(-1);
      buildSubRing(idx);
    }
  }, SUBMENU_HOVER_DELAY));
}

function getHoverElements(container) {
  return {
    center: container.querySelector(".ring-center"),
    orbitCircle: container.querySelector(".ring-orbit-circle"),
    arcPath: container.querySelector(".ring-arc-path"),
    arcGlow: container.querySelector(".ring-arc-glow"),
    beamLine: container.querySelector(".ring-beam-line"),
    beamGlow: container.querySelector(".ring-beam-glow"),
    sectorPath: container.querySelector(".ring-sector-path"),
    beamGrad: document.getElementById("beamGradient"),
  };
}

function activateHoveredNode(idx, container, els) {
  const slices = getSlices();
  const n = slices.length;
  const node = container.querySelector(`.ring-node[data-index="${idx}"]`);
  if (node) node.classList.add("hovered");
  if (els.center) els.center.classList.add("active");
  if (els.orbitCircle) els.orbitCircle.classList.add("active");

  const nodeAngle = (2 * Math.PI * idx) / n - Math.PI / 2;
  const pos = nodePosition(idx, n);
  const spread = arcSpread(n);
  const a1 = nodeAngle - spread;
  const a2 = nodeAngle + spread;
  const arcD = describeArc(CENTER, CENTER, ARC_RADIUS, a1, a2);

  if (els.arcPath) activateArcPath(els.arcPath, arcD);
  if (els.arcGlow) { els.arcGlow.setAttribute("d", arcD); els.arcGlow.classList.add("active"); }
  if (els.beamGrad) { els.beamGrad.setAttribute("x2", pos.x.toFixed(2)); els.beamGrad.setAttribute("y2", pos.y.toFixed(2)); }
  if (els.beamLine) activateBeamLine(els.beamLine, pos);
  if (els.beamGlow) activateBeamGlow(els.beamGlow, pos);

  const sectorD = describeSector(CENTER, CENTER, ARC_RADIUS, a1, a2);
  if (els.sectorPath) { els.sectorPath.setAttribute("d", sectorD); els.sectorPath.classList.add("active"); }

  const s = slices[idx];
  if (s?.action?.type === "Submenu") {
    scheduleSubmenuOpen(idx);
  } else if (getActiveSubmenu() >= 0 && getActiveSubmenu() !== idx) {
    closeSubRing();
  }
}

export function updateHover(idx) {
  if (idx === getHoveredIndex()) return;
  const container = document.getElementById("ring");

  if (getHoveredIndex() >= 0) {
    const old = container.querySelector(`.ring-node[data-index="${getHoveredIndex()}"]`);
    if (old) old.classList.remove("hovered");
  }

  setHoveredIndex(idx);

  const submenuTimer = getSubmenuTimer();
  if (submenuTimer) {
    clearTimeout(submenuTimer);
    setSubmenuTimer(null);
  }

  const els = getHoverElements(container);

  if (idx >= 0) {
    activateHoveredNode(idx, container, els);
  } else {
    deactivateHoverElements(els.center, els.orbitCircle, els.arcPath, els.arcGlow, els.beamLine, els.beamGlow, els.sectorPath);
  }
}
