import { invoke } from "@tauri-apps/api/core";

const RING_SIZE = 400;
const CENTER = RING_SIZE / 2;
const NODE_ORBIT = 140; // radius of the circle nodes sit on
const NODE_SIZE = 48;

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
    angle,
  };
}

// Compute label offset direction — push label outward from node
function labelStyle(i, n) {
  const angle = (2 * Math.PI * i) / n - Math.PI / 2;
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);

  // Distance from node center to label
  const dist = 38;
  const lx = dist * cos;
  const ly = dist * sin;

  // Anchor: if label is to the right of node, left-align; if left, right-align; if top/bottom, center
  let transform = "translate(-50%, -50%)";
  if (cos > 0.4) transform = `translate(0, -50%)`; // right side
  else if (cos < -0.4) transform = `translate(-100%, -50%)`; // left side
  else if (sin < 0) transform = `translate(-50%, -100%)`; // top
  else transform = `translate(-50%, 0)`; // bottom

  return `left:${NODE_SIZE / 2 + lx}px; top:${NODE_SIZE / 2 + ly}px; transform:${transform}`;
}

async function init() {
  const config = await invoke("get_config");
  slices = config.slices;
  renderRing();
  setupInteraction();
}

window.__updateSlices = function (newSlices) {
  slices = newSlices;
  renderRing();
};

function renderRing() {
  const container = document.getElementById("ring");
  const n = slices.length;

  if (n === 0) {
    container.innerHTML = '<div class="ring-center"></div>';
    return;
  }

  // SVG connector lines from center to each node
  let lines = "";
  for (let i = 0; i < n; i++) {
    const p = nodePosition(i, n);
    const hovered = i === hoveredIndex;
    const color = hovered ? "rgba(233,69,96,0.4)" : "rgba(60,60,100,0.25)";
    lines += `<line x1="${CENTER}" y1="${CENTER}" x2="${p.x}" y2="${p.y}" stroke="${color}" stroke-width="${hovered ? 1.5 : 1}" />`;
  }

  const svg = `<svg class="ring-connectors" viewBox="0 0 ${RING_SIZE} ${RING_SIZE}">${lines}</svg>`;

  // Nodes
  const nodes = slices.map((s, i) => {
    const p = nodePosition(i, n);
    const hov = i === hoveredIndex ? " hovered" : "";
    const icon = resolveIcon(s.icon);
    const label = s.label || `Slice ${i + 1}`;
    return `<div class="ring-node${hov}" data-index="${i}" style="left:${p.x}px;top:${p.y}px">
      <div class="ring-node-circle">${icon}</div>
      <div class="ring-node-label" style="${labelStyle(i, n)}">${label}</div>
    </div>`;
  }).join("");

  container.innerHTML = svg + '<div class="ring-center"></div>' + nodes;
}

function getHoveredSlice(mx, my) {
  if (slices.length === 0) return -1;
  const dist = Math.sqrt(mx * mx + my * my);

  // Dead zone at center
  if (dist < 25) return -1;

  // Find closest node by angle
  let mouseAngle = Math.atan2(my, mx);
  const n = slices.length;
  let best = -1;
  let bestDiff = Infinity;

  for (let i = 0; i < n; i++) {
    const nodeAngle = (2 * Math.PI * i) / n - Math.PI / 2;
    let diff = Math.abs(mouseAngle - nodeAngle);
    if (diff > Math.PI) diff = 2 * Math.PI - diff;
    if (diff < bestDiff) {
      bestDiff = diff;
      best = i;
    }
  }

  return best;
}

function setupInteraction() {
  const container = document.getElementById("ring");

  container.addEventListener("mousemove", (e) => {
    const rect = container.getBoundingClientRect();
    const mx = e.clientX - rect.left - CENTER;
    const my = e.clientY - rect.top - CENTER;
    const index = getHoveredSlice(mx, my);

    if (index !== hoveredIndex) {
      hoveredIndex = index;
      renderRing();
    }
  });

  container.addEventListener("mouseup", async () => {
    if (hoveredIndex >= 0 && hoveredIndex < slices.length) {
      try {
        await invoke("execute_action", { index: hoveredIndex });
      } catch (e) {
        console.error("Action failed:", e);
      }
    }
    hoveredIndex = -1;
    await invoke("hide_ring");
  });

  document.addEventListener("keydown", async (e) => {
    if (e.key === "Escape") {
      hoveredIndex = -1;
      await invoke("hide_ring");
    }
  });
}

document.addEventListener("DOMContentLoaded", () => {
  const ring = document.getElementById("ring");

  let wasHidden = true;
  setInterval(async () => {
    if (!document.hidden && wasHidden) {
      wasHidden = false;
      const config = await invoke("get_config");
      slices = config.slices;
      hoveredIndex = -1;
      renderRing();
      ring.classList.remove("appear");
      void ring.offsetWidth;
      ring.classList.add("appear");
    } else if (document.hidden) {
      wasHidden = true;
    }
  }, 100);
});

init();
