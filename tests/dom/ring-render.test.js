// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { resolveIcon } from '../../src/icons.js';
import { nodePosition, subNodePosition, CENTER, NODE_ORBIT } from '../../src/ring/geometry.js';

describe('buildRing DOM generation', () => {
  const RING_SIZE = 400;

  function buildRingHTML(slices) {
    const n = slices.length;
    let html = `
      <canvas class="ring-particles" width="${RING_SIZE}" height="${RING_SIZE}"></canvas>
      <svg class="ring-orbit" viewBox="0 0 ${RING_SIZE} ${RING_SIZE}">
        <circle class="ring-orbit-circle" cx="${CENTER}" cy="${CENTER}" r="${NODE_ORBIT}" />
      </svg>
      <svg class="ring-sector-svg" viewBox="0 0 ${RING_SIZE} ${RING_SIZE}">
        <path class="ring-sector-path" d="" />
      </svg>
      <svg class="ring-beam" viewBox="0 0 ${RING_SIZE} ${RING_SIZE}">
        <line class="ring-beam-glow" x1="${CENTER}" y1="${CENTER}" x2="${CENTER}" y2="${CENTER}" />
        <line class="ring-beam-line" x1="${CENTER}" y1="${CENTER}" x2="${CENTER}" y2="${CENTER}" />
      </svg>
      <svg class="ring-arc-svg" viewBox="0 0 ${RING_SIZE} ${RING_SIZE}">
        <path class="ring-arc-glow" d="" />
        <path class="ring-arc-path" d="" />
      </svg>
      <div class="ring-center"></div>`;

    if (n > 0) {
      for (let i = 0; i < n; i++) {
        const p = nodePosition(i, n);
        const s = slices[i];
        const isSubmenu = s.action?.type === 'Submenu';
        const icon = s.customIcon
          ? `<img src="${s.customIcon}" style="width:24px;height:24px;" />`
          : resolveIcon(s.icon);
        const submenuIndicator = isSubmenu
          ? `<div class="submenu-indicator">${resolveIcon('chevron-right')}</div>`
          : '';

        html += `
          <div class="ring-node${isSubmenu ? ' is-submenu' : ''}" data-index="${i}"
               style="left:${p.x}px;top:${p.y}px">
            <div class="ring-node-inner">
              <div class="ring-node-circle">${icon}</div>
              <div class="ring-node-dot"></div>
              ${submenuIndicator}
            </div>
          </div>`;
      }
    }

    html += `<div class="sub-ring" id="sub-ring"></div>`;
    return html;
  }

  beforeEach(() => {
    document.body.innerHTML = '<div id="ring"></div>';
  });

  it('renders correct number of ring nodes', () => {
    const slices = [
      { icon: 'star', action: { type: 'Script', command: 'test' } },
      { icon: 'heart', action: { type: 'Script', command: 'test2' } },
      { icon: 'bolt', action: { type: 'Script', command: 'test3' } },
    ];
    document.getElementById('ring').innerHTML = buildRingHTML(slices);

    const nodes = document.querySelectorAll('.ring-node');
    expect(nodes.length).toBe(3);
  });

  it('renders 0 nodes for empty slices', () => {
    document.getElementById('ring').innerHTML = buildRingHTML([]);

    const nodes = document.querySelectorAll('.ring-node');
    expect(nodes.length).toBe(0);
  });

  it('positions nodes at correct coordinates', () => {
    const slices = [
      { icon: 'star', action: { type: 'Script', command: 'test' } },
      { icon: 'heart', action: { type: 'Script', command: 'test2' } },
    ];
    document.getElementById('ring').innerHTML = buildRingHTML(slices);

    const node0 = document.querySelector('.ring-node[data-index="0"]');
    const pos0 = nodePosition(0, 2);
    expect(node0.style.left).toBe(`${pos0.x}px`);
    expect(node0.style.top).toBe(`${pos0.y}px`);
  });

  it('marks submenu nodes with is-submenu class', () => {
    const slices = [
      { icon: 'star', action: { type: 'Script', command: 'test' } },
      { icon: 'squares-2x2', action: { type: 'Submenu', slices: [] } },
    ];
    document.getElementById('ring').innerHTML = buildRingHTML(slices);

    const submenuNode = document.querySelector('.ring-node[data-index="1"]');
    expect(submenuNode.classList.contains('is-submenu')).toBe(true);
    expect(submenuNode.querySelector('.submenu-indicator')).not.toBeNull();

    const normalNode = document.querySelector('.ring-node[data-index="0"]');
    expect(normalNode.classList.contains('is-submenu')).toBe(false);
  });

  it('renders canvas, orbit, and center elements', () => {
    document.getElementById('ring').innerHTML = buildRingHTML([{ icon: 'star', action: { type: 'Script', command: '' } }]);

    expect(document.querySelector('.ring-particles')).not.toBeNull();
    expect(document.querySelector('.ring-orbit-circle')).not.toBeNull();
    expect(document.querySelector('.ring-center')).not.toBeNull();
    expect(document.getElementById('sub-ring')).not.toBeNull();
  });

  it('renders customIcon as img', () => {
    const slices = [{ customIcon: 'data:image/png;base64,test', action: { type: 'Script', command: '' } }];
    document.getElementById('ring').innerHTML = buildRingHTML(slices);

    const img = document.querySelector('.ring-node-circle img');
    expect(img).not.toBeNull();
    expect(img.src).toContain('data:image/png;base64,test');
  });
});

describe('buildSubRing DOM generation', () => {
  function buildSubRingHTML(parentIndex, parentSlice, slices) {
    if (!parentSlice || parentSlice.action?.type !== 'Submenu') return '';

    const children = parentSlice.action.slices || [];
    const n = children.length;
    const parentN = slices.length;

    if (n === 0) {
      return `<div class="sub-ring-empty">No sub-actions</div>`;
    }

    let html = '';
    const parentAngle = (2 * Math.PI * parentIndex) / parentN - Math.PI / 2;
    const backX = CENTER + NODE_ORBIT * Math.cos(parentAngle);
    const backY = CENTER + NODE_ORBIT * Math.sin(parentAngle);
    html += `<div class="sub-ring-back" data-action="back" style="left:${backX}px;top:${backY}px">${resolveIcon('arrow-uturn-left')}</div>`;

    for (let i = 0; i < n; i++) {
      const child = children[i];
      const pos = subNodePosition(i, n, parentIndex, parentN);
      const icon = resolveIcon(child.icon);

      html += `
        <div class="sub-ring-node" data-sub-index="${i}" style="left:${pos.x}px;top:${pos.y}px">
          <div class="sub-ring-node-inner">${icon}</div>
          <div class="sub-ring-label">${child.label || '...'}</div>
        </div>`;
    }

    return html;
  }

  it('renders correct number of sub-nodes', () => {
    const slices = [{ icon: 'squares-2x2', action: { type: 'Submenu', slices: [
      { label: 'A', icon: 'star' },
      { label: 'B', icon: 'heart' },
      { label: 'C', icon: 'bolt' },
    ] } }];

    document.body.innerHTML = `<div id="sub-ring">${buildSubRingHTML(0, slices[0], slices)}</div>`;

    const subNodes = document.querySelectorAll('.sub-ring-node');
    expect(subNodes.length).toBe(3);
  });

  it('renders back button', () => {
    const slices = [{ icon: 'squares-2x2', action: { type: 'Submenu', slices: [{ label: 'A', icon: 'star' }] } }];
    document.body.innerHTML = `<div id="sub-ring">${buildSubRingHTML(0, slices[0], slices)}</div>`;

    const back = document.querySelector('.sub-ring-back');
    expect(back).not.toBeNull();
  });

  it('shows empty message for no children', () => {
    const slices = [{ icon: 'squares-2x2', action: { type: 'Submenu', slices: [] } }];
    document.body.innerHTML = `<div id="sub-ring">${buildSubRingHTML(0, slices[0], slices)}</div>`;

    const empty = document.querySelector('.sub-ring-empty');
    expect(empty).not.toBeNull();
    expect(empty.textContent).toContain('No sub-actions');
  });
});
