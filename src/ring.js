import { invoke } from "@tauri-apps/api/core";

const RING_SIZE = 400;
const CENTER = RING_SIZE / 2;
const NODE_ORBIT = 120;

const ICON_MAP = { terminal: "🖥️", globe: "🌐", default: "⚙️" };

let slices = [];
let hoveredIndex = -1;

function resolveIcon(icon) {
  if (!icon) return "⚙️";
  if (icon.length <= 2 || /\p{Emoji}/u.test(icon)) return icon;
  return ICON_MAP[icon] || "⚙️";
}

function nodePosition(i, n) {
  const angle = (2 * Math.PI * i) / n - Math.PI / 2;
  return {
    x: CENTER + NODE_ORBIT * Math.cos(angle),
    y: CENTER + NODE_ORBIT * Math.sin(angle),
  };
}

async function init() {
  const config = await invoke("get_config");
  slices = config.slices;
  buildRing();
  setupInteraction();
}

window.__updateSlices = function (newSlices) {
  slices = newSlices;
  buildRing();
};

function buildRing() {
  const container = document.getElementById("ring");
  const n = slices.length;

  let html = '<div class="ring-center"></div>';

  if (n > 0) {
    // Connector lines
    let lines = "";
    for (let i = 0; i < n; i++) {
      const p = nodePosition(i, n);
      lines += `<line class="connector-line" data-line="${i}"
        x1="${CENTER}" y1="${CENTER}" x2="${p.x}" y2="${p.y}"
        stroke="#fff" stroke-opacity="0.06" stroke-width="0" />`;
    }
    html += `<svg class="ring-connectors" viewBox="0 0 ${RING_SIZE} ${RING_SIZE}">${lines}</svg>`;

    // Nodes — staggered entrance via animation-delay
    const stagger = 0.055;
    for (let i = 0; i < n; i++) {
      const p = nodePosition(i, n);
      const icon = resolveIcon(slices[i].icon);
      const label = slices[i].label || `Slice ${i + 1}`;
      const delay = (0.05 + stagger * i).toFixed(3);

      html += `
        <div class="ring-node" data-index="${i}"
             style="left:${p.x}px;top:${p.y}px;animation-delay:${delay}s">
          <div class="ring-node-inner">
            <div class="ring-node-circle">${icon}</div>
            <div class="ring-node-label">${label}</div>
          </div>
        </div>`;
    }
  }

  container.innerHTML = html;
}

// Hover — class toggle, no DOM rebuild
function updateHover(idx) {
  if (idx === hoveredIndex) return;
  const container = document.getElementById("ring");

  if (hoveredIndex >= 0) {
    const old = container.querySelector(`.ring-node[data-index="${hoveredIndex}"]`);
    if (old) old.classList.remove("hovered");
    const oldLine = container.querySelector(`.connector-line[data-line="${hoveredIndex}"]`);
    if (oldLine) {
      oldLine.setAttribute("stroke", "#fff");
      oldLine.setAttribute("stroke-opacity", "0.06");
      oldLine.setAttribute("stroke-width", "0");
    }
  }

  hoveredIndex = idx;

  if (idx >= 0) {
    const node = container.querySelector(`.ring-node[data-index="${idx}"]`);
    if (node) node.classList.add("hovered");
    const line = container.querySelector(`.connector-line[data-line="${idx}"]`);
    if (line) {
      line.setAttribute("stroke", "#fff");
      line.setAttribute("stroke-opacity", "0.16");
      line.setAttribute("stroke-width", "0");
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

function setupInteraction() {
  const container = document.getElementById("ring");

  container.addEventListener("mousemove", (e) => {
    const r = container.getBoundingClientRect();
    updateHover(closestSlice(e.clientX - r.left - CENTER, e.clientY - r.top - CENTER));
  });

  container.addEventListener("mouseleave", () => updateHover(-1));

  container.addEventListener("mouseup", async () => {
    if (hoveredIndex >= 0 && hoveredIndex < slices.length) {
      try { await invoke("execute_action", { index: hoveredIndex }); }
      catch (e) { console.error("Action failed:", e); }
    }
    hoveredIndex = -1;
    await invoke("hide_ring");
  });

  document.addEventListener("keydown", async (e) => {
    if (e.key === "Escape") { hoveredIndex = -1; await invoke("hide_ring"); }
  });
}

// Re-init on window show
document.addEventListener("DOMContentLoaded", () => {
  const ring = document.getElementById("ring");
  let wasHidden = true;

  setInterval(async () => {
    if (!document.hidden && wasHidden) {
      wasHidden = false;
      const config = await invoke("get_config");
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
