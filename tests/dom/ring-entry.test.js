// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock globalThis.api
globalThis.api = {
  getActiveProfile: vi.fn().mockResolvedValue({
    profile: { slices: [{ icon: 'star', action: { type: 'Script', command: 'test' } }] },
  }),
  executeAction: vi.fn(),
  executeSubmenuAction: vi.fn(),
  hideRing: vi.fn(),
};

// Mock canvas
HTMLCanvasElement.prototype.getContext = vi.fn(() => ({
  clearRect: vi.fn(),
  beginPath: vi.fn(),
  arc: vi.fn(),
  fill: vi.fn(),
  fillStyle: '',
}));

// Mock requestAnimationFrame to not loop
let rafCount = 0;
globalThis.requestAnimationFrame = vi.fn((cb) => {
  if (rafCount++ < 1) cb();
  return 1;
});
globalThis.cancelAnimationFrame = vi.fn();

describe('src/ring.js entry point', () => {
  beforeEach(() => {
    rafCount = 0;
    document.body.innerHTML = '<div id="ring"></div>';
    globalThis.api.getActiveProfile.mockResolvedValue({
      profile: { slices: [{ icon: 'star', action: { type: 'Script', command: 'test' } }] },
    });
  });

  it('init() sets up the ring', async () => {
    await import('../../src/ring.js');
    // Wait for init() to resolve
    await new Promise(r => setTimeout(r, 50));
    expect(globalThis.api.getActiveProfile).toHaveBeenCalled();
  });

  it('__updateSlices updates the ring', async () => {
    await import('../../src/ring.js');
    await new Promise(r => setTimeout(r, 50));

    const newSlices = [
      { icon: 'heart', action: { type: 'Script', command: 'test2' } },
      { icon: 'bolt', action: { type: 'Script', command: 'test3' } },
    ];
    globalThis.__updateSlices(newSlices);
    const nodes = document.querySelectorAll('.ring-node');
    expect(nodes.length).toBe(2);
  });
});
