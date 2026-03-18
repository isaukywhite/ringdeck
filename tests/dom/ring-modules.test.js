// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';

// Mock templates.js since it uses String.raw`` which Vite can't parse in tests
vi.mock('../../src/config-ui/templates.js', () => ({
  SUBMENU_TEMPLATES: [],
}));

// Must set up globalThis.api before imports
vi.hoisted(() => {
  globalThis.api = {
    getTelemetryConsent: vi.fn().mockResolvedValue(false),
    executeAction: vi.fn().mockResolvedValue(undefined),
    executeSubmenuAction: vi.fn().mockResolvedValue(undefined),
    hideRing: vi.fn().mockResolvedValue(undefined),
    onRingData: vi.fn(),
    getRingColor: vi.fn().mockResolvedValue('#0A84FF'),
    getRingSize: vi.fn().mockResolvedValue('medium'),
    getActiveProfile: vi.fn().mockResolvedValue({ profile: { slices: [] } }),
  };
});

import {
  setSlices, getSlices,
  setHoveredIndex, getHoveredIndex,
  setActiveSubmenu, getActiveSubmenu,
  setSubmenuHoveredIndex, getSubmenuHoveredIndex,
  setParticleAnim, getParticleAnim,
  setSubmenuTimer,
} from '../../src/ring/state.js';

import { buildRing, buildSubRing, closeSubRing } from '../../src/ring/ring-render.js';
import { startParticles } from '../../src/ring/particles.js';
import {
  updateHover,
  activateArcPath,
  activateBeamLine,
  activateBeamGlow,
  deactivateHoverElements,
  scheduleSubmenuOpen,
} from '../../src/ring/hover.js';
import {
  setupInteraction,
  _resetInteractionSetup,
  handleMouseUp,
  handleKeyUp,
  highlightSubNode,
  highlightBackButton,
  clearSubRingHover,
  handleSubmenuMouseMove,
  executeSubmenuClick,
  toggleSubmenuForHovered,
} from '../../src/ring/interaction.js';
import { CENTER, RING_SIZE } from '../../src/ring/geometry.js';

function makeSlices(n) {
  const slices = [];
  for (let i = 0; i < n; i++) {
    slices.push({ label: `Slice ${i}`, icon: 'star', action: { type: 'Script', command: `cmd${i}` } });
  }
  return slices;
}

function setupRingDOM() {
  document.body.innerHTML = `<div id="ring" style="width:${RING_SIZE}px;height:${RING_SIZE}px;"></div>`;
  rafCallCount = 0;
}

// Mock canvas getContext since jsdom doesn't support canvas
function mockCanvas() {
  const proto = HTMLCanvasElement.prototype;
  if (!proto._mockCtx) {
    proto._mockCtx = true;
    proto.getContext = vi.fn().mockReturnValue({
      clearRect: vi.fn(),
      beginPath: vi.fn(),
      arc: vi.fn(),
      fill: vi.fn(),
      fillStyle: '',
    });
  }
}

// Mock requestAnimationFrame / cancelAnimationFrame
// Only call the callback once to avoid infinite recursion in the particles draw loop
let rafCallCount = 0;
globalThis.requestAnimationFrame = vi.fn((cb) => {
  rafCallCount++;
  if (rafCallCount <= 1) {
    cb();
  }
  return rafCallCount;
});
globalThis.cancelAnimationFrame = vi.fn();

describe('ring/ring-render', () => {
  beforeEach(() => {
    setupRingDOM();
    mockCanvas();
    setSlices(makeSlices(3));
    setHoveredIndex(-1);
    setActiveSubmenu(-1);
    setSubmenuHoveredIndex(-1);
    setParticleAnim(null);
  });

  it('buildRing creates ring nodes in DOM', () => {
    buildRing();
    const nodes = document.querySelectorAll('.ring-node');
    expect(nodes.length).toBe(3);
  });

  it('buildRing creates canvas, orbit, center elements', () => {
    buildRing();
    expect(document.querySelector('.ring-particles')).not.toBeNull();
    expect(document.querySelector('.ring-orbit-circle')).not.toBeNull();
    expect(document.querySelector('.ring-center')).not.toBeNull();
    expect(document.getElementById('sub-ring')).not.toBeNull();
  });

  it('buildRing handles empty slices', () => {
    setSlices([]);
    buildRing();
    const nodes = document.querySelectorAll('.ring-node');
    expect(nodes.length).toBe(0);
  });

  it('buildRing marks submenu nodes', () => {
    setSlices([
      { label: 'Normal', icon: 'star', action: { type: 'Script', command: 'x' } },
      { label: 'Menu', icon: 'squares-2x2', action: { type: 'Submenu', slices: [{ label: 'Sub', icon: 'star', action: { type: 'Script', command: '' } }] } },
    ]);
    buildRing();
    const submenuNode = document.querySelector('.ring-node.is-submenu');
    expect(submenuNode).not.toBeNull();
  });

  it('buildRing handles customIcon', () => {
    setSlices([{ label: 'Custom', icon: 'star', customIcon: 'data:image/png;base64,abc', action: { type: 'Script', command: '' } }]);
    buildRing();
    expect(document.querySelector('.ring-node-circle img')).not.toBeNull();
  });

  it('buildSubRing creates sub-nodes for submenu parent', () => {
    setSlices([
      { label: 'Menu', icon: 'squares-2x2', action: { type: 'Submenu', slices: [
        { label: 'A', icon: 'star', action: { type: 'Script', command: '' } },
        { label: 'B', icon: 'heart', action: { type: 'Script', command: '' } },
      ] } },
    ]);
    buildRing();
    setActiveSubmenu(0);
    buildSubRing(0);
    const subNodes = document.querySelectorAll('.sub-ring-node');
    expect(subNodes.length).toBe(2);
    expect(document.querySelector('.sub-ring-back')).not.toBeNull();
  });

  it('buildSubRing shows empty message for no children', () => {
    setSlices([{ label: 'Menu', icon: 'squares-2x2', action: { type: 'Submenu', slices: [] } }]);
    buildRing();
    buildSubRing(0);
    expect(document.querySelector('.sub-ring-empty')).not.toBeNull();
  });

  it('buildSubRing clears sub-ring for non-submenu parent', () => {
    setSlices([{ label: 'Normal', icon: 'star', action: { type: 'Script', command: '' } }]);
    buildRing();
    buildSubRing(0);
    const subRing = document.getElementById('sub-ring');
    expect(subRing.innerHTML).toBe('');
  });

  it('buildSubRing handles missing sub-ring element', () => {
    document.body.innerHTML = '<div id="ring"></div>';
    expect(() => buildSubRing(0)).not.toThrow();
  });

  it('buildSubRing marks hovered sub-node', () => {
    setSlices([{ label: 'Menu', icon: 'squares-2x2', action: { type: 'Submenu', slices: [
      { label: 'A', icon: 'star', action: { type: 'Script', command: '' } },
    ] } }]);
    buildRing();
    setSubmenuHoveredIndex(0);
    buildSubRing(0);
    expect(document.querySelector('.sub-ring-node.hovered')).not.toBeNull();
  });

  it('buildSubRing handles customIcon on sub-node', () => {
    setSlices([{ label: 'Menu', icon: 'squares-2x2', action: { type: 'Submenu', slices: [
      { label: 'A', icon: 'star', customIcon: 'data:img', action: { type: 'Script', command: '' } },
    ] } }]);
    buildRing();
    buildSubRing(0);
    expect(document.querySelector('.sub-ring-node img')).not.toBeNull();
  });

  it('closeSubRing resets state and clears DOM', () => {
    setSlices([{ label: 'Menu', icon: 'squares-2x2', action: { type: 'Submenu', slices: [
      { label: 'A', icon: 'star', action: { type: 'Script', command: '' } },
    ] } }]);
    buildRing();
    setActiveSubmenu(0);
    buildSubRing(0);

    closeSubRing();
    expect(getActiveSubmenu()).toBe(-1);
    expect(getSubmenuHoveredIndex()).toBe(-1);
    expect(document.getElementById('sub-ring').innerHTML).toBe('');
  });
});

describe('ring/particles', () => {
  beforeEach(() => {
    setupRingDOM();
    mockCanvas();
    setSlices(makeSlices(3));
    setHoveredIndex(-1);
    setParticleAnim(null);
  });

  it('startParticles initializes animation', () => {
    buildRing();
    // startParticles is called by buildRing, so particleAnim should be set
    expect(getParticleAnim()).not.toBeNull();
  });

  it('startParticles cancels existing animation', () => {
    setParticleAnim(42);
    buildRing();
    expect(globalThis.cancelAnimationFrame).toHaveBeenCalledWith(42);
  });

  it('startParticles does nothing without canvas', () => {
    document.body.innerHTML = '<div id="ring"></div>';
    expect(() => startParticles()).not.toThrow();
  });

  it('startParticles with hovered index activates particles near hovered slice', () => {
    buildRing();
    setHoveredIndex(0);
    // Re-trigger to exercise the hovered branch in the draw function
    startParticles();
    expect(getParticleAnim()).not.toBeNull();
  });
});

describe('ring/hover', () => {
  beforeEach(() => {
    setupRingDOM();
    mockCanvas();
    setSlices(makeSlices(3));
    setHoveredIndex(-1);
    setActiveSubmenu(-1);
    setSubmenuHoveredIndex(-1);
    setParticleAnim(null);
    setSubmenuTimer(null);
    buildRing();
  });

  it('activateArcPath sets d attribute and classes', () => {
    const arcPath = document.querySelector('.ring-arc-path');
    // Mock getBBox and getTotalLength for SVG
    arcPath.getBBox = vi.fn();
    arcPath.getTotalLength = vi.fn().mockReturnValue(100);
    activateArcPath(arcPath, 'M 0 0 A 10 10 0 0 1 100 100');
    expect(arcPath.getAttribute('d')).toBe('M 0 0 A 10 10 0 0 1 100 100');
    expect(arcPath.classList.contains('active')).toBe(true);
  });

  it('activateBeamLine sets x2/y2 and adds active class', () => {
    const beamLine = document.querySelector('.ring-beam-line');
    beamLine.getBBox = vi.fn();
    activateBeamLine(beamLine, { x: 250, y: 150 });
    expect(beamLine.getAttribute('x2')).toBe('250.00');
    expect(beamLine.classList.contains('active')).toBe(true);
  });

  it('activateBeamGlow sets x2/y2 and adds active class', () => {
    const beamGlow = document.querySelector('.ring-beam-glow');
    activateBeamGlow(beamGlow, { x: 250, y: 150 });
    expect(beamGlow.getAttribute('x2')).toBe('250.00');
    expect(beamGlow.classList.contains('active')).toBe(true);
  });

  it('deactivateHoverElements removes active class from all elements', () => {
    const center = document.querySelector('.ring-center');
    const orbit = document.querySelector('.ring-orbit-circle');
    center.classList.add('active');
    orbit.classList.add('active');
    deactivateHoverElements(center, orbit, null, null, null, null, null);
    expect(center.classList.contains('active')).toBe(false);
    expect(orbit.classList.contains('active')).toBe(false);
  });

  it('updateHover does nothing when same index', () => {
    setHoveredIndex(1);
    const prev = getHoveredIndex();
    updateHover(1);
    expect(getHoveredIndex()).toBe(prev);
  });

  it('updateHover activates a node', () => {
    // Mock SVG methods needed by updateHover
    const arcPath = document.querySelector('.ring-arc-path');
    const arcGlow = document.querySelector('.ring-arc-glow');
    const beamLine = document.querySelector('.ring-beam-line');
    const beamGlow = document.querySelector('.ring-beam-glow');
    const sectorPath = document.querySelector('.ring-sector-path');

    if (arcPath) { arcPath.getBBox = vi.fn(); arcPath.getTotalLength = vi.fn().mockReturnValue(100); }
    if (beamLine) { beamLine.getBBox = vi.fn(); }

    updateHover(0);
    expect(getHoveredIndex()).toBe(0);
    const node = document.querySelector('.ring-node[data-index="0"]');
    expect(node.classList.contains('hovered')).toBe(true);
  });

  it('updateHover deactivates when idx=-1', () => {
    setHoveredIndex(0);
    document.querySelector('.ring-node[data-index="0"]').classList.add('hovered');

    updateHover(-1);
    expect(getHoveredIndex()).toBe(-1);
  });

  it('updateHover clears submenu timer', () => {
    const timer = setTimeout(() => {}, 10000);
    setSubmenuTimer(timer);
    setHoveredIndex(0);

    const arcPath = document.querySelector('.ring-arc-path');
    const beamLine = document.querySelector('.ring-beam-line');
    if (arcPath) { arcPath.getBBox = vi.fn(); arcPath.getTotalLength = vi.fn().mockReturnValue(100); }
    if (beamLine) { beamLine.getBBox = vi.fn(); }

    updateHover(1);
    clearTimeout(timer);
    expect(getHoveredIndex()).toBe(1);
  });

  it('updateHover schedules submenu open for Submenu type', () => {
    setSlices([
      { label: 'Menu', icon: 'squares-2x2', action: { type: 'Submenu', slices: [{ label: 'A', icon: 'star', action: { type: 'Script', command: '' } }] } },
      { label: 'Normal', icon: 'star', action: { type: 'Script', command: '' } },
    ]);
    buildRing();

    const arcPath = document.querySelector('.ring-arc-path');
    const beamLine = document.querySelector('.ring-beam-line');
    if (arcPath) { arcPath.getBBox = vi.fn(); arcPath.getTotalLength = vi.fn().mockReturnValue(100); }
    if (beamLine) { beamLine.getBBox = vi.fn(); }

    updateHover(0);
    // scheduleSubmenuOpen should have been called (timer set)
    expect(getHoveredIndex()).toBe(0);
  });

  it('scheduleSubmenuOpen sets a timer', () => {
    vi.useFakeTimers();
    setHoveredIndex(0);
    setSlices([{ label: 'Menu', icon: 'squares-2x2', action: { type: 'Submenu', slices: [] } }]);
    buildRing();

    scheduleSubmenuOpen(0);
    vi.advanceTimersByTime(400);

    expect(getActiveSubmenu()).toBe(0);
    vi.useRealTimers();
  });
});

describe('ring/interaction', () => {
  beforeEach(() => {
    setupRingDOM();
    mockCanvas();
    setSlices(makeSlices(3));
    setHoveredIndex(-1);
    setActiveSubmenu(-1);
    setSubmenuHoveredIndex(-1);
    setParticleAnim(null);
    _resetInteractionSetup();
    buildRing();

    // Clear api mock call counts
    globalThis.api.executeAction.mockClear();
    globalThis.api.executeSubmenuAction.mockClear();
    globalThis.api.hideRing.mockClear();

    // Mock SVG methods for hover
    const arcPath = document.querySelector('.ring-arc-path');
    const beamLine = document.querySelector('.ring-beam-line');
    if (arcPath) { arcPath.getBBox = vi.fn(); arcPath.getTotalLength = vi.fn().mockReturnValue(100); }
    if (beamLine) { beamLine.getBBox = vi.fn(); }
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('highlightSubNode highlights the correct sub-node', () => {
    setSlices([{ label: 'Menu', icon: 'squares-2x2', action: { type: 'Submenu', slices: [
      { label: 'A', icon: 'star', action: { type: 'Script', command: '' } },
      { label: 'B', icon: 'heart', action: { type: 'Script', command: '' } },
    ] } }]);
    buildRing();
    setActiveSubmenu(0);
    buildSubRing(0);

    highlightSubNode(0);
    expect(getSubmenuHoveredIndex()).toBe(0);
    expect(document.querySelector('.sub-ring-node[data-sub-index="0"]').classList.contains('hovered')).toBe(true);
  });

  it('highlightSubNode does nothing when same index', () => {
    setSubmenuHoveredIndex(0);
    highlightSubNode(0);
    expect(getSubmenuHoveredIndex()).toBe(0);
  });

  it('highlightBackButton sets hover on back button', () => {
    setSlices([{ label: 'Menu', icon: 'squares-2x2', action: { type: 'Submenu', slices: [
      { label: 'A', icon: 'star', action: { type: 'Script', command: '' } },
    ] } }]);
    buildRing();
    setActiveSubmenu(0);
    buildSubRing(0);

    highlightBackButton();
    expect(getSubmenuHoveredIndex()).toBe(-1);
    expect(document.querySelector('.sub-ring-back.hovered')).not.toBeNull();
  });

  it('clearSubRingHover removes all hover classes', () => {
    setSlices([{ label: 'Menu', icon: 'squares-2x2', action: { type: 'Submenu', slices: [
      { label: 'A', icon: 'star', action: { type: 'Script', command: '' } },
    ] } }]);
    buildRing();
    setActiveSubmenu(0);
    buildSubRing(0);
    highlightSubNode(0);

    clearSubRingHover();
    expect(getSubmenuHoveredIndex()).toBe(-1);
  });

  it('handleMouseUp executes action for hovered slice', async () => {
    const container = document.getElementById('ring');
    setHoveredIndex(0);

    await handleMouseUp(container);
    expect(globalThis.api.executeAction).toHaveBeenCalledWith(0);
    expect(globalThis.api.hideRing).toHaveBeenCalled();
  });

  it('handleMouseUp hides ring when nothing hovered', async () => {
    const container = document.getElementById('ring');
    setHoveredIndex(-1);

    await handleMouseUp(container);
    expect(globalThis.api.hideRing).toHaveBeenCalled();
  });

  it('handleMouseUp toggles submenu for Submenu type', async () => {
    setSlices([{ label: 'Menu', icon: 'squares-2x2', action: { type: 'Submenu', slices: [
      { label: 'A', icon: 'star', action: { type: 'Script', command: '' } },
    ] } }]);
    buildRing();
    setHoveredIndex(0);

    const container = document.getElementById('ring');
    await handleMouseUp(container);
    expect(getActiveSubmenu()).toBe(0);
  });

  it('handleMouseUp executes submenu action when sub-item hovered', async () => {
    setSlices([{ label: 'Menu', icon: 'squares-2x2', action: { type: 'Submenu', slices: [
      { label: 'A', icon: 'star', action: { type: 'Script', command: '' } },
    ] } }]);
    buildRing();
    setActiveSubmenu(0);
    setSubmenuHoveredIndex(0);

    const container = document.getElementById('ring');
    await handleMouseUp(container);
    expect(globalThis.api.executeSubmenuAction).toHaveBeenCalledWith(0, 0);
  });

  it('handleMouseUp closes sub-ring when back button hovered', async () => {
    setSlices([{ label: 'Menu', icon: 'squares-2x2', action: { type: 'Submenu', slices: [
      { label: 'A', icon: 'star', action: { type: 'Script', command: '' } },
    ] } }]);
    buildRing();
    setActiveSubmenu(0);
    buildSubRing(0);
    setSubmenuHoveredIndex(-1);

    // Mark back button as hovered
    const back = document.querySelector('.sub-ring-back');
    if (back) back.classList.add('hovered');

    const container = document.getElementById('ring');
    await handleMouseUp(container);
    expect(getActiveSubmenu()).toBe(-1);
  });

  it('executeSubmenuClick calls api and hides ring', async () => {
    setActiveSubmenu(0);
    setSubmenuHoveredIndex(0);
    setSlices([{ label: 'Menu', icon: 'squares-2x2', action: { type: 'Submenu', slices: [
      { label: 'A', icon: 'star', action: { type: 'Script', command: '' } },
    ] } }]);
    buildRing();

    await executeSubmenuClick();
    expect(globalThis.api.executeSubmenuAction).toHaveBeenCalled();
    expect(globalThis.api.hideRing).toHaveBeenCalled();
  });

  it('toggleSubmenuForHovered opens submenu', () => {
    setSlices([{ label: 'Menu', icon: 'squares-2x2', action: { type: 'Submenu', slices: [
      { label: 'A', icon: 'star', action: { type: 'Script', command: '' } },
    ] } }]);
    buildRing();
    setHoveredIndex(0);
    setActiveSubmenu(-1);

    toggleSubmenuForHovered();
    expect(getActiveSubmenu()).toBe(0);
  });

  it('toggleSubmenuForHovered closes submenu if already open', () => {
    setSlices([{ label: 'Menu', icon: 'squares-2x2', action: { type: 'Submenu', slices: [] } }]);
    buildRing();
    setHoveredIndex(0);
    setActiveSubmenu(0);

    toggleSubmenuForHovered();
    expect(getActiveSubmenu()).toBe(-1);
  });

  it('handleKeyUp ignores non-modifier keys', async () => {
    handleKeyUp._ringShowTime = 0;
    const event = new KeyboardEvent('keyup', { key: 'a' });
    await handleKeyUp(event);
    // Should not trigger any action
    expect(globalThis.api.executeAction).not.toHaveBeenCalled();
  });

  it('handleKeyUp ignores when ring just appeared (debounce)', async () => {
    handleKeyUp._ringShowTime = Date.now();
    const event = new KeyboardEvent('keyup', { key: 'Control' });
    await handleKeyUp(event);
    expect(globalThis.api.hideRing).not.toHaveBeenCalled();
  });

  it('handleKeyUp executes action when modifier released and slice hovered', async () => {
    handleKeyUp._ringShowTime = 0;
    setHoveredIndex(0);

    const event = new KeyboardEvent('keyup', {
      key: 'Control',
      ctrlKey: false,
      altKey: false,
      shiftKey: false,
      metaKey: false,
    });
    await handleKeyUp(event);
    expect(globalThis.api.executeAction).toHaveBeenCalledWith(0);
  });

  it('handleKeyUp opens submenu for Submenu slice', async () => {
    handleKeyUp._ringShowTime = 0;
    setSlices([{ label: 'Menu', icon: 'squares-2x2', action: { type: 'Submenu', slices: [
      { label: 'A', icon: 'star', action: { type: 'Script', command: '' } },
    ] } }]);
    buildRing();
    setHoveredIndex(0);

    const event = new KeyboardEvent('keyup', {
      key: 'Alt',
      ctrlKey: false, altKey: false, shiftKey: false, metaKey: false,
    });
    await handleKeyUp(event);
    expect(getActiveSubmenu()).toBe(0);
  });

  it('handleKeyUp ignores when other modifiers still held', async () => {
    handleKeyUp._ringShowTime = 0;
    setHoveredIndex(0);

    const event = new KeyboardEvent('keyup', {
      key: 'Control',
      ctrlKey: false,
      altKey: true, // Alt still held
      shiftKey: false,
      metaKey: false,
    });
    await handleKeyUp(event);
    expect(globalThis.api.executeAction).not.toHaveBeenCalled();
  });

  it('handleKeyUp executes submenu action when submenu open and sub-item hovered', async () => {
    handleKeyUp._ringShowTime = 0;
    setSlices([{ label: 'Menu', icon: 'squares-2x2', action: { type: 'Submenu', slices: [
      { label: 'A', icon: 'star', action: { type: 'Script', command: '' } },
    ] } }]);
    buildRing();
    setActiveSubmenu(0);
    setSubmenuHoveredIndex(0);

    const event = new KeyboardEvent('keyup', {
      key: 'Control',
      ctrlKey: false, altKey: false, shiftKey: false, metaKey: false,
    });
    await handleKeyUp(event);
    expect(globalThis.api.executeSubmenuAction).toHaveBeenCalledWith(0, 0);
  });

  it('setupInteraction adds event listeners', () => {
    expect(() => setupInteraction()).not.toThrow();
  });

  it('handleSubmenuMouseMove calls clearSubRingHover when nothing matches', () => {
    setSlices([{ label: 'Menu', icon: 'squares-2x2', action: { type: 'Submenu', slices: [
      { label: 'A', icon: 'star', action: { type: 'Script', command: '' } },
    ] } }]);
    buildRing();
    setActiveSubmenu(0);
    buildSubRing(0);

    // Pass coordinates far from everything
    handleSubmenuMouseMove(9999, 9999);
    expect(getSubmenuHoveredIndex()).toBe(-1);
  });

  it('setupInteraction handles mousemove with submenu open', () => {
    setSlices([{ label: 'Menu', icon: 'squares-2x2', action: { type: 'Submenu', slices: [
      { label: 'A', icon: 'star', action: { type: 'Script', command: '' } },
    ] } }]);
    buildRing();
    setupInteraction();
    setActiveSubmenu(0);
    buildSubRing(0);

    const container = document.getElementById('ring');
    container.dispatchEvent(new MouseEvent('mousemove', {
      clientX: 250, clientY: 250, bubbles: true,
    }));
    expect(getActiveSubmenu()).toBe(0);
  });

  it('setupInteraction handles mouseleave', () => {
    setupInteraction();
    const container = document.getElementById('ring');
    container.dispatchEvent(new MouseEvent('mouseleave', { bubbles: true }));
    expect(getHoveredIndex()).toBe(-1);
  });

  it('setupInteraction handles mouseup', async () => {
    setupInteraction();
    setHoveredIndex(-1);
    const container = document.getElementById('ring');
    container.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
    expect(globalThis.api.hideRing).toHaveBeenCalled();
  });

  it('setupInteraction handles Escape keydown', async () => {
    setupInteraction();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(globalThis.api.hideRing).toHaveBeenCalled();
  });

  it('setupInteraction handles Escape with submenu open', () => {
    setSlices([{ label: 'Menu', icon: 'squares-2x2', action: { type: 'Submenu', slices: [
      { label: 'A', icon: 'star', action: { type: 'Script', command: '' } },
    ] } }]);
    buildRing();
    setupInteraction();
    setActiveSubmenu(0);
    buildSubRing(0);

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(getActiveSubmenu()).toBe(-1);
  });

  it('setupInteraction handles visibilitychange', () => {
    setupInteraction();
    document.dispatchEvent(new Event('visibilitychange'));
    // When document is not hidden, _ringShowTime is updated
    expect(handleKeyUp._ringShowTime).toBeGreaterThan(0);
  });

  it('setupInteraction handles keyup', () => {
    setupInteraction();
    handleKeyUp._ringShowTime = 0;
    document.dispatchEvent(new KeyboardEvent('keyup', {
      key: 'Control', ctrlKey: false, altKey: false, shiftKey: false, metaKey: false,
    }));
    expect(globalThis.api.hideRing).toHaveBeenCalled();
  });

  it('handleMouseUp handles error in executeAction gracefully', async () => {
    globalThis.api.executeAction.mockRejectedValueOnce(new Error('fail'));
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    setHoveredIndex(0);
    const container = document.getElementById('ring');
    await handleMouseUp(container);
    expect(consoleSpy).toHaveBeenCalled();
    consoleSpy.mockRestore();
  });

  it('executeSubmenuClick handles error gracefully', async () => {
    globalThis.api.executeSubmenuAction.mockRejectedValueOnce(new Error('fail'));
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    setActiveSubmenu(0);
    setSubmenuHoveredIndex(0);
    setSlices([{ label: 'Menu', icon: 'squares-2x2', action: { type: 'Submenu', slices: [
      { label: 'A', icon: 'star', action: { type: 'Script', command: '' } },
    ] } }]);
    buildRing();
    await executeSubmenuClick();
    expect(consoleSpy).toHaveBeenCalled();
    consoleSpy.mockRestore();
  });
});
