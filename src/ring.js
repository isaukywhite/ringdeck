import { resolveIcon, ICON_MAP } from './icons.js';

const RING_SIZE = 400;
const CENTER = RING_SIZE / 2;
const NODE_ORBIT = 95;
const ARC_RADIUS = 135;
const SUB_ORBIT = 90;
const SUB_NODE_SIZE = 46;

function arcSpread(n) {
  if (n <= 1) return Math.PI / 3;
  return Math.min(Math.PI / 3, 0.85 * Math.PI / n);
}

let slices = [];
let hoveredIndex = -1;
let particleAnim = null;

// ─── Submenu state ───
let activeSubmenu = -1;      // index of parent slice whose submenu is open (-1 = none)
let submenuHoveredIndex = -1; // hovered index within the submenu
let submenuTimer = null;      // delay timer for opening submenu on hover
const SUBMENU_HOVER_DELAY = 300; // ms before submenu opens

function nodePosition(i, n) {
  const angle = (2 * Math.PI * i) / n - Math.PI / 2;
  return {
    x: CENTER + NODE_ORBIT * Math.cos(angle),
    y: CENTER + NODE_ORBIT * Math.sin(angle),
    angle,
  };
}

// ─── Sub-ring node positions ───
// Sub-nodes fan out from the parent node position, centered on the parent's angle
function subNodePosition(childIndex, childCount, parentIndex, parentCount) {
  const parentAngle = (2 * Math.PI * parentIndex) / parentCount - Math.PI / 2;
  const parentX = CENTER + NODE_ORBIT * Math.cos(parentAngle);
  const parentY = CENTER + NODE_ORBIT * Math.sin(parentAngle);

  // Fan the sub-nodes around the parent angle
  const fanSpread = Math.min(Math.PI / 2, 0.5 * Math.PI * childCount / 5);
  const startAngle = parentAngle - fanSpread / 2;
  const step = childCount > 1 ? fanSpread / (childCount - 1) : 0;
  const angle = startAngle + step * childIndex;

  return {
    x: parentX + SUB_ORBIT * Math.cos(angle),
    y: parentY + SUB_ORBIT * Math.sin(angle),
    angle,
  };
}

async function init() {
  const { profile } = await window.api.getActiveProfile();
  slices = profile.slices;
  buildRing();
  setupInteraction();
  startParticles();
}

window.__updateSlices = function (newSlices) {
  slices = newSlices;
  activeSubmenu = -1;
  submenuHoveredIndex = -1;
  buildRing();
};

function describeArc(cx, cy, r, startAngle, endAngle) {
  const x1 = cx + r * Math.cos(startAngle);
  const y1 = cy + r * Math.sin(startAngle);
  const x2 = cx + r * Math.cos(endAngle);
  const y2 = cy + r * Math.sin(endAngle);
  const largeArc = endAngle - startAngle > Math.PI ? 1 : 0;
  return `M ${x1.toFixed(2)} ${y1.toFixed(2)} A ${r} ${r} 0 ${largeArc} 1 ${x2.toFixed(2)} ${y2.toFixed(2)}`;
}

function describeSector(cx, cy, r, startAngle, endAngle) {
  const x1 = cx + r * Math.cos(startAngle);
  const y1 = cy + r * Math.sin(startAngle);
  const x2 = cx + r * Math.cos(endAngle);
  const y2 = cy + r * Math.sin(endAngle);
  const largeArc = endAngle - startAngle > Math.PI ? 1 : 0;
  return `M ${cx} ${cy} L ${x1.toFixed(2)} ${y1.toFixed(2)} A ${r} ${r} 0 ${largeArc} 1 ${x2.toFixed(2)} ${y2.toFixed(2)} Z`;
}

function buildRing() {
  const container = document.getElementById("ring");
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
      const isSubmenu = s.action && s.action.type === "Submenu";
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
function buildSubRing(parentIndex) {
  const subRingEl = document.getElementById("sub-ring");
  if (!subRingEl) return;

  const parentSlice = slices[parentIndex];
  if (!parentSlice || parentSlice.action.type !== "Submenu") {
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

function closeSubRing() {
  activeSubmenu = -1;
  submenuHoveredIndex = -1;
  const subRingEl = document.getElementById("sub-ring");
  if (subRingEl) {
    subRingEl.classList.remove("visible");
    subRingEl.innerHTML = "";
  }
}

// ─── Particle system ───

function startParticles() {
  if (particleAnim) cancelAnimationFrame(particleAnim);

  const canvas = document.querySelector(".ring-particles");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");

  const particles = [];
  const NUM = 24;

  const PARTICLE_COLORS = [
    [45, 27, 105],
    [61, 42, 124],
    [10, 132, 255],
    [79, 209, 255],
    [26, 14, 62],
  ];

  for (let i = 0; i < NUM; i++) {
    particles.push({
      angle: Math.random() * Math.PI * 2,
      radius: NODE_ORBIT - 4 + Math.random() * 8,
      speed: 0.003 + Math.random() * 0.004,
      size: 0.8 + Math.random() * 1.2,
      alpha: 0.15 + Math.random() * 0.3,
      drift: (Math.random() - 0.5) * 0.3,
      color: PARTICLE_COLORS[Math.floor(Math.random() * PARTICLE_COLORS.length)],
    });
  }

  function draw() {
    ctx.clearRect(0, 0, 400, 400);

    for (const p of particles) {
      p.angle += p.speed;
      p.radius += Math.sin(p.angle * 3) * 0.05;

      const x = CENTER + p.radius * Math.cos(p.angle);
      const y = CENTER + p.radius * Math.sin(p.angle);

      let alpha = p.alpha;
      let [r, g, b] = p.color;
      if (hoveredIndex >= 0) {
        const n = slices.length;
        const hAngle = (2 * Math.PI * hoveredIndex) / n - Math.PI / 2;
        let diff = Math.abs(p.angle % (Math.PI * 2) - ((hAngle % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2));
        if (diff > Math.PI) diff = Math.PI * 2 - diff;
        const spread = arcSpread(n);
        if (diff < spread) {
          const t = 1 - diff / spread;
          alpha = Math.min(1, alpha + 0.45 * t);
          r = Math.round(r + (10 - r) * t * 0.6);
          g = Math.round(g + (132 - g) * t * 0.6);
          b = Math.round(b + (255 - b) * t * 0.6);
        }
      }

      ctx.beginPath();
      ctx.arc(x, y, p.size, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${alpha})`;
      ctx.fill();
    }

    particleAnim = requestAnimationFrame(draw);
  }

  draw();
}

// ─── Hover logic ───

function updateHover(idx) {
  if (idx === hoveredIndex) return;
  const container = document.getElementById("ring");

  if (hoveredIndex >= 0) {
    const old = container.querySelector(`.ring-node[data-index="${hoveredIndex}"]`);
    if (old) old.classList.remove("hovered");
  }

  hoveredIndex = idx;

  // Clear submenu timer
  if (submenuTimer) {
    clearTimeout(submenuTimer);
    submenuTimer = null;
  }

  const center = container.querySelector(".ring-center");
  const orbitCircle = container.querySelector(".ring-orbit-circle");
  const arcPath = container.querySelector(".ring-arc-path");
  const arcGlow = container.querySelector(".ring-arc-glow");
  const beamLine = container.querySelector(".ring-beam-line");
  const beamGlow = container.querySelector(".ring-beam-glow");
  const sectorPath = container.querySelector(".ring-sector-path");
  const beamGrad = document.getElementById("beamGradient");

  if (idx >= 0) {
    const n = slices.length;
    const node = container.querySelector(`.ring-node[data-index="${idx}"]`);
    if (node) node.classList.add("hovered");
    if (center) center.classList.add("active");
    if (orbitCircle) orbitCircle.classList.add("active");

    const nodeAngle = (2 * Math.PI * idx) / n - Math.PI / 2;
    const pos = nodePosition(idx, n);

    const spread = arcSpread(n);
    const a1 = nodeAngle - spread;
    const a2 = nodeAngle + spread;
    const arcD = describeArc(CENTER, CENTER, ARC_RADIUS, a1, a2);

    if (arcPath) {
      arcPath.classList.remove("active");
      void arcPath.getBBox();
      arcPath.setAttribute("d", arcD);
      const arcLen = arcPath.getTotalLength();
      arcPath.style.strokeDasharray = arcLen;
      arcPath.style.strokeDashoffset = arcLen;
      arcPath.style.setProperty("--arc-len", arcLen);
      arcPath.classList.add("active");
    }
    if (arcGlow) {
      arcGlow.setAttribute("d", arcD);
      arcGlow.classList.add("active");
    }

    if (beamGrad) {
      beamGrad.setAttribute("x2", pos.x.toFixed(2));
      beamGrad.setAttribute("y2", pos.y.toFixed(2));
    }
    if (beamLine) {
      beamLine.classList.remove("active");
      beamLine.setAttribute("x2", pos.x.toFixed(2));
      beamLine.setAttribute("y2", pos.y.toFixed(2));
      const bLen = Math.sqrt((pos.x - CENTER) ** 2 + (pos.y - CENTER) ** 2);
      beamLine.style.strokeDasharray = bLen;
      beamLine.style.strokeDashoffset = bLen;
      beamLine.style.setProperty("--beam-len", bLen);
      void beamLine.getBBox();
      beamLine.classList.add("active");
    }
    if (beamGlow) {
      beamGlow.setAttribute("x2", pos.x.toFixed(2));
      beamGlow.setAttribute("y2", pos.y.toFixed(2));
      beamGlow.classList.add("active");
    }

    const sectorD = describeSector(CENTER, CENTER, ARC_RADIUS, a1, a2);
    if (sectorPath) {
      sectorPath.setAttribute("d", sectorD);
      sectorPath.classList.add("active");
    }

    // Check if hovered item is a submenu — open sub-ring after delay
    const s = slices[idx];
    if (s && s.action && s.action.type === "Submenu") {
      submenuTimer = setTimeout(() => {
        if (hoveredIndex === idx) {
          activeSubmenu = idx;
          submenuHoveredIndex = -1;
          buildSubRing(idx);
        }
      }, SUBMENU_HOVER_DELAY);
    } else if (activeSubmenu >= 0 && activeSubmenu !== idx) {
      // Moving to a non-submenu item — close any open sub-ring
      closeSubRing();
    }
  } else {
    if (center) center.classList.remove("active");
    if (orbitCircle) orbitCircle.classList.remove("active");
    if (arcPath) arcPath.classList.remove("active");
    if (arcGlow) arcGlow.classList.remove("active");
    if (beamLine) beamLine.classList.remove("active");
    if (beamGlow) beamGlow.classList.remove("active");
    if (sectorPath) sectorPath.classList.remove("active");

    // If mouse leaves entirely and no submenu open, close
    if (activeSubmenu >= 0) {
      // Don't close immediately — user might be moving to sub-ring
    }
  }
}

function closestSlice(mx, my) {
  if (slices.length === 0) return -1;
  if (Math.sqrt(mx * mx + my * my) < 22) return -1;

  const angle = Math.atan2(my, mx);
  const n = slices.length;
  let best = 0, bestDiff = Infinity;

  for (let i = 0; i < n; i++) {
    const na = (2 * Math.PI * i) / n - Math.PI / 2;
    let d = Math.abs(angle - na);
    if (d > Math.PI) d = 2 * Math.PI - d;
    if (d < bestDiff) { bestDiff = d; best = i; }
  }
  return best;
}

// ─── Find closest sub-ring node ───
function closestSubNode(mx, my) {
  if (activeSubmenu < 0) return -1;
  const parentSlice = slices[activeSubmenu];
  if (!parentSlice || parentSlice.action.type !== "Submenu") return -1;

  const children = parentSlice.action.slices || [];
  const n = children.length;
  if (n === 0) return -1;

  let best = -1, bestDist = 25; // max 25px distance to consider a hit

  for (let i = 0; i < n; i++) {
    const pos = subNodePosition(i, n, activeSubmenu, slices.length);
    const dx = (mx + CENTER) - pos.x;
    const dy = (my + CENTER) - pos.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < bestDist) {
      bestDist = dist;
      best = i;
    }
  }

  return best;
}

// ─── Check if mouse is near the back button ───
function isNearBackButton(mx, my) {
  if (activeSubmenu < 0) return false;
  const parentN = slices.length;
  const parentAngle = (2 * Math.PI * activeSubmenu) / parentN - Math.PI / 2;
  const backX = NODE_ORBIT * Math.cos(parentAngle);
  const backY = NODE_ORBIT * Math.sin(parentAngle);
  const dx = mx - backX;
  const dy = my - backY;
  return Math.sqrt(dx * dx + dy * dy) < 18;
}

function setupInteraction() {
  const container = document.getElementById("ring");

  container.addEventListener("mousemove", (e) => {
    const r = container.getBoundingClientRect();
    const mx = e.clientX - r.left - CENTER;
    const my = e.clientY - r.top - CENTER;

    if (activeSubmenu >= 0) {
      // Check if hovering a sub-node
      const subIdx = closestSubNode(mx, my);
      if (subIdx >= 0) {
        // Hovering a sub-node
        if (subIdx !== submenuHoveredIndex) {
          submenuHoveredIndex = subIdx;
          // Update visual highlight
          const subRingEl = document.getElementById("sub-ring");
          if (subRingEl) {
            subRingEl.querySelectorAll(".sub-ring-node").forEach((el) => el.classList.remove("hovered"));
            const target = subRingEl.querySelector(`.sub-ring-node[data-sub-index="${subIdx}"]`);
            if (target) target.classList.add("hovered");
          }
        }
        return;
      }

      // Check if hovering back button
      if (isNearBackButton(mx, my)) {
        submenuHoveredIndex = -1;
        const subRingEl = document.getElementById("sub-ring");
        if (subRingEl) {
          subRingEl.querySelectorAll(".sub-ring-node").forEach((el) => el.classList.remove("hovered"));
          const back = subRingEl.querySelector(".sub-ring-back");
          if (back) back.classList.add("hovered");
        }
        return;
      }

      // Check if hovering a main ring node
      const mainIdx = closestSlice(mx, my);
      if (mainIdx >= 0 && mainIdx !== activeSubmenu) {
        // Moving to a different main node — close submenu
        closeSubRing();
        updateHover(mainIdx);
        return;
      }

      // Clear sub-node hover
      submenuHoveredIndex = -1;
      const subRingEl = document.getElementById("sub-ring");
      if (subRingEl) {
        subRingEl.querySelectorAll(".sub-ring-node, .sub-ring-back").forEach((el) => el.classList.remove("hovered"));
      }
      return;
    }

    updateHover(closestSlice(mx, my));
  });

  container.addEventListener("mouseleave", () => {
    if (activeSubmenu < 0) {
      updateHover(-1);
    }
  });

  // Click (mouseup) still works as fallback
  container.addEventListener("mouseup", async () => {
    // If submenu is open, check if clicking a sub-item or back
    if (activeSubmenu >= 0) {
      const r = container.getBoundingClientRect();
      // Use the last known hovered state
      if (submenuHoveredIndex >= 0) {
        try { await window.api.executeSubmenuAction(activeSubmenu, submenuHoveredIndex); }
        catch (e) { console.error("Submenu action failed:", e); }
        closeSubRing();
        hoveredIndex = -1;
        await window.api.hideRing();
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
      if (s && s.action && s.action.type === "Submenu") {
        if (activeSubmenu === hoveredIndex) {
          closeSubRing();
        } else {
          activeSubmenu = hoveredIndex;
          submenuHoveredIndex = -1;
          buildSubRing(hoveredIndex);
        }
        return;
      }
      try { await window.api.executeAction(hoveredIndex); }
      catch (e) { console.error("Action failed:", e); }
    }
    hoveredIndex = -1;
    closeSubRing();
    await window.api.hideRing();
  });

  // Release-to-activate: when modifier keys are released, trigger hovered action
  let ringShowTime = 0;

  // Track when ring becomes visible
  const observer = new MutationObserver(() => {
    if (!document.hidden) {
      ringShowTime = Date.now();
    }
  });
  observer.observe(document, { attributes: true, attributeFilter: ["visibilityState"] });

  // Also set on DOMContentLoaded / visibility
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) {
      ringShowTime = Date.now();
    }
  });

  document.addEventListener("keyup", async (e) => {
    // Ignore if ring just appeared (debounce 200ms to avoid premature activation)
    if (Date.now() - ringShowTime < 200) return;

    // Only activate when a MODIFIER key (Ctrl/Alt/Shift/Meta) is released
    // and NO other modifiers remain held.
    const isModifierKey = ["Control", "Alt", "Shift", "Meta"].includes(e.key);
    if (!isModifierKey) return;

    const hasModifiers = e.ctrlKey || e.altKey || e.shiftKey || e.metaKey;
    if (hasModifiers) return; // Still holding other modifiers

    // If submenu is open and a sub-item is hovered → execute sub-action
    if (activeSubmenu >= 0 && submenuHoveredIndex >= 0) {
      try { await window.api.executeSubmenuAction(activeSubmenu, submenuHoveredIndex); }
      catch (err) { console.error("Submenu action failed:", err); }
      closeSubRing();
      hoveredIndex = -1;
      await window.api.hideRing();
      return;
    }

    // All modifiers released → activate hovered action (if not submenu)
    if (hoveredIndex >= 0 && hoveredIndex < slices.length) {
      const s = slices[hoveredIndex];
      if (s && s.action && s.action.type === "Submenu") {
        // Don't close ring — just open the submenu on release
        activeSubmenu = hoveredIndex;
        submenuHoveredIndex = -1;
        buildSubRing(hoveredIndex);
        return;
      }
      try { await window.api.executeAction(hoveredIndex); }
      catch (err) { console.error("Action failed:", err); }
    }
    hoveredIndex = -1;
    closeSubRing();
    await window.api.hideRing();
  });

  document.addEventListener("keydown", async (e) => {
    if (e.key === "Escape") {
      if (activeSubmenu >= 0) {
        closeSubRing();
        return;
      }
      hoveredIndex = -1;
      await window.api.hideRing();
    }
  });
}

document.addEventListener("DOMContentLoaded", () => {
  const ring = document.getElementById("ring");
  let wasHidden = true;

  setInterval(async () => {
    if (!document.hidden && wasHidden) {
      wasHidden = false;
      const { profile } = await window.api.getActiveProfile();
      slices = profile.slices;
      hoveredIndex = -1;
      activeSubmenu = -1;
      submenuHoveredIndex = -1;
      buildRing();
      ring.classList.remove("appear");
      void ring.offsetWidth;
      ring.classList.add("appear");
    } else if (document.hidden) {
      wasHidden = true;
    }
  }, 100);
});

init();
