export const RING_SIZE = 400;
export const CENTER = RING_SIZE / 2;
export const NODE_ORBIT = 95;
export const ARC_RADIUS = 135;
export const SUB_ORBIT = 135;
export const SUB_NODE_SIZE = 46;

export function arcSpread(n) {
  if (n <= 1) return Math.PI / 3;
  return Math.min(Math.PI / 3, 0.85 * Math.PI / n);
}

export function nodePosition(i, n) {
  const angle = (2 * Math.PI * i) / n - Math.PI / 2;
  return {
    x: CENTER + NODE_ORBIT * Math.cos(angle),
    y: CENTER + NODE_ORBIT * Math.sin(angle),
    angle,
  };
}

export function subNodePosition(childIndex, childCount, parentIndex, parentCount) {
  const parentAngle = (2 * Math.PI * parentIndex) / parentCount - Math.PI / 2;
  const parentX = CENTER + NODE_ORBIT * Math.cos(parentAngle);
  const parentY = CENTER + NODE_ORBIT * Math.sin(parentAngle);

  // Aumentar o spread para icones grandes não colidirem
  const fanSpread = Math.min(Math.PI * 0.85, 0.6 * Math.PI * childCount / 3);
  const startAngle = parentAngle - fanSpread / 2;
  const step = childCount > 1 ? fanSpread / (childCount - 1) : 0;
  const angle = startAngle + step * childIndex;

  return {
    x: parentX + SUB_ORBIT * Math.cos(angle),
    y: parentY + SUB_ORBIT * Math.sin(angle),
    angle,
  };
}

export function describeArc(cx, cy, r, startAngle, endAngle) {
  const x1 = cx + r * Math.cos(startAngle);
  const y1 = cy + r * Math.sin(startAngle);
  const x2 = cx + r * Math.cos(endAngle);
  const y2 = cy + r * Math.sin(endAngle);
  const largeArc = endAngle - startAngle > Math.PI ? 1 : 0;
  return `M ${x1.toFixed(2)} ${y1.toFixed(2)} A ${r} ${r} 0 ${largeArc} 1 ${x2.toFixed(2)} ${y2.toFixed(2)}`;
}

export function describeSector(cx, cy, r, startAngle, endAngle) {
  const x1 = cx + r * Math.cos(startAngle);
  const y1 = cy + r * Math.sin(startAngle);
  const x2 = cx + r * Math.cos(endAngle);
  const y2 = cy + r * Math.sin(endAngle);
  const largeArc = endAngle - startAngle > Math.PI ? 1 : 0;
  return `M ${cx} ${cy} L ${x1.toFixed(2)} ${y1.toFixed(2)} A ${r} ${r} 0 ${largeArc} 1 ${x2.toFixed(2)} ${y2.toFixed(2)} Z`;
}

export function closestSlice(mx, my, slices) {
  if (slices.length === 0) return -1;
  if (Math.hypot(mx, my) < 22) return -1;

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

export function closestSubNode(mx, my, activeSubmenu, slices) {
  if (activeSubmenu < 0) return -1;
  const parentSlice = slices[activeSubmenu];
  if (!parentSlice || parentSlice.action?.type !== 'Submenu') return -1;

  const children = parentSlice.action.slices || [];
  const n = children.length;
  if (n === 0) return -1;

  let best = -1, bestDist = 25;

  for (let i = 0; i < n; i++) {
    const pos = subNodePosition(i, n, activeSubmenu, slices.length);
    const dx = (mx + CENTER) - pos.x;
    const dy = (my + CENTER) - pos.y;
    const dist = Math.hypot(dx, dy);
    if (dist < bestDist) {
      bestDist = dist;
      best = i;
    }
  }

  return best;
}

