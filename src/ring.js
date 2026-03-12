
import { resolveIcon } from './icons.js';

const RING_SIZE = 400;
const CENTER = RING_SIZE / 2;
const NODE_ORBIT = 95;
const ARC_RADIUS = 135;
function arcSpread(n) {
  if (n <= 1) return Math.PI / 3;
  return Math.min(Math.PI / 3, 0.85 * Math.PI / n);
}

let slices = [];
let hoveredIndex = -1;
let particleAnim = null;

function nodePosition(i, n) {
  const angle = (2 * Math.PI * i) / n - Math.PI / 2;
  return {
    x: CENTER + NODE_ORBIT * Math.cos(angle),
    y: CENTER + NODE_ORBIT * Math.sin(angle),
    angle,
  };
}

async function init() {
  const config = await window.api.getConfig();
  slices = config.slices;
  buildRing();
  setupInteraction();
  startParticles();
}

window.__updateSlices = function (newSlices) {
  slices = newSlices;
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
    <canvas class="ring-particles" width="400" height="400"></canvas>

    <svg class="ring-orbit" viewBox="0 0 400 400">
      <circle class="ring-orbit-circle" cx="200" cy="200" r="${NODE_ORBIT}" />
    </svg>

    <svg class="ring-sector-svg" viewBox="0 0 400 400">
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

    <svg class="ring-beam" viewBox="0 0 400 400">
      <defs>
        <linearGradient id="beamGradient" gradientUnits="userSpaceOnUse"
          x1="200" y1="200" x2="200" y2="200">
          <stop offset="0%" stop-color="rgba(45, 27, 105, 0)" />
          <stop offset="30%" stop-color="rgba(61, 42, 124, 0.3)" />
          <stop offset="70%" stop-color="rgba(10, 132, 255, 0.45)" />
          <stop offset="100%" stop-color="rgba(79, 209, 255, 0.5)" />
        </linearGradient>
      </defs>
      <line class="ring-beam-glow" x1="200" y1="200" x2="200" y2="200" />
      <line class="ring-beam-line" x1="200" y1="200" x2="200" y2="200" />
    </svg>

    <svg class="ring-arc-svg" viewBox="0 0 400 400">
      <defs>
        <linearGradient id="arcGradient" gradientUnits="userSpaceOnUse"
          x1="65" y1="200" x2="335" y2="200">
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
      const icon = resolveIcon(slices[i].icon);
      const delay = (0.1 + stagger * i).toFixed(3);

      html += `
        <div class="ring-node" data-index="${i}"
             style="left:${p.x}px;top:${p.y}px;animation-delay:${delay}s">
          <div class="ring-node-inner">
            <div class="ring-node-circle">${icon}</div>
            <div class="ring-node-dot"></div>
          </div>
        </div>`;
    }
  }

  container.innerHTML = html;
  startParticles();
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
  } else {
    if (center) center.classList.remove("active");
    if (orbitCircle) orbitCircle.classList.remove("active");
    if (arcPath) arcPath.classList.remove("active");
    if (arcGlow) arcGlow.classList.remove("active");
    if (beamLine) beamLine.classList.remove("active");
    if (beamGlow) beamGlow.classList.remove("active");
    if (sectorPath) sectorPath.classList.remove("active");
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

function setupInteraction() {
  const container = document.getElementById("ring");

  container.addEventListener("mousemove", (e) => {
    const r = container.getBoundingClientRect();
    updateHover(closestSlice(e.clientX - r.left - CENTER, e.clientY - r.top - CENTER));
  });

  container.addEventListener("mouseleave", () => updateHover(-1));

  container.addEventListener("mouseup", async () => {
    if (hoveredIndex >= 0 && hoveredIndex < slices.length) {
      try { await window.api.executeAction(hoveredIndex); }
      catch (e) { console.error("Action failed:", e); }
    }
    hoveredIndex = -1;
    await window.api.hideRing();
  });

  document.addEventListener("keydown", async (e) => {
    if (e.key === "Escape") { hoveredIndex = -1; await window.api.hideRing(); }
  });
}

document.addEventListener("DOMContentLoaded", () => {
  const ring = document.getElementById("ring");
  let wasHidden = true;

  setInterval(async () => {
    if (!document.hidden && wasHidden) {
      wasHidden = false;
      const config = await window.api.getConfig();
      slices = config.slices;
      hoveredIndex = -1;
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
