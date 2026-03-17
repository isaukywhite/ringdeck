import { describe, it, expect } from 'vitest';
import {
  arcSpread, nodePosition, subNodePosition, describeArc, describeSector,
  closestSlice, closestSubNode, isNearBackButton,
  CENTER, NODE_ORBIT,
} from '../../src/ring/geometry.js';

describe('arcSpread', () => {
  it('returns PI/3 for n=0', () => {
    expect(arcSpread(0)).toBeCloseTo(Math.PI / 3);
  });

  it('returns PI/3 for n=1', () => {
    expect(arcSpread(1)).toBeCloseTo(Math.PI / 3);
  });

  it('returns a positive spread for n=6', () => {
    const spread = arcSpread(6);
    expect(spread).toBeGreaterThan(0);
    expect(spread).toBeLessThanOrEqual(Math.PI / 3);
  });

  it('returns smaller spread as n increases', () => {
    expect(arcSpread(12)).toBeLessThan(arcSpread(6));
  });
});

describe('nodePosition', () => {
  it('first node (i=0) is at top (angle = -PI/2)', () => {
    const pos = nodePosition(0, 4);
    expect(pos.angle).toBeCloseTo(-Math.PI / 2);
    expect(pos.x).toBeCloseTo(CENTER);
    expect(pos.y).toBeCloseTo(CENTER - NODE_ORBIT);
  });

  it('places nodes at correct angles', () => {
    const pos1 = nodePosition(1, 4);
    expect(pos1.angle).toBeCloseTo(0);
    expect(pos1.x).toBeCloseTo(CENTER + NODE_ORBIT);
    expect(pos1.y).toBeCloseTo(CENTER);
  });

  it('handles single node', () => {
    const pos = nodePosition(0, 1);
    expect(pos.angle).toBeCloseTo(-Math.PI / 2);
  });
});

describe('subNodePosition', () => {
  it('returns a position offset from parent', () => {
    const pos = subNodePosition(0, 3, 0, 4);
    const parentPos = nodePosition(0, 4);
    const parentDist = Math.hypot(parentPos.x - CENTER, parentPos.y - CENTER);
    const subDist = Math.hypot(pos.x - CENTER, pos.y - CENTER);
    expect(subDist).toBeGreaterThan(parentDist * 0.5);
  });

  it('single child has no fan spread (step=0)', () => {
    const pos = subNodePosition(0, 1, 0, 4);
    expect(pos.x).toBeDefined();
    expect(pos.y).toBeDefined();
  });
});

describe('describeArc', () => {
  it('produces valid SVG path', () => {
    const path = describeArc(200, 200, 100, 0, Math.PI / 2);
    expect(path).toMatch(/^M\s/);
    expect(path).toContain('A');
  });

  it('uses large arc flag correctly for > PI', () => {
    const path = describeArc(200, 200, 100, 0, Math.PI + 0.1);
    expect(path).toMatch(/A\s\d+\s\d+\s0\s1/);
  });

  it('uses small arc flag for < PI', () => {
    const path = describeArc(200, 200, 100, 0, Math.PI / 2);
    expect(path).toMatch(/A\s\d+\s\d+\s0\s0/);
  });
});

describe('describeSector', () => {
  it('starts with M (moveTo center)', () => {
    const path = describeSector(200, 200, 100, 0, Math.PI / 2);
    expect(path).toMatch(/^M\s200\s200/);
  });

  it('ends with Z (close path)', () => {
    const path = describeSector(200, 200, 100, 0, Math.PI / 2);
    expect(path).toMatch(/Z$/);
  });

  it('contains L (lineTo) and A (arc)', () => {
    const path = describeSector(200, 200, 100, 0, Math.PI / 2);
    expect(path).toContain('L');
    expect(path).toContain('A');
  });
});

describe('closestSlice', () => {
  const slices4 = [{}, {}, {}, {}];

  it('returns -1 for empty slices', () => {
    expect(closestSlice(50, 0, [])).toBe(-1);
  });

  it('returns -1 in dead zone (center)', () => {
    expect(closestSlice(0, 0, slices4)).toBe(-1);
    expect(closestSlice(5, 5, slices4)).toBe(-1);
  });

  it('selects correct slice by angle', () => {
    // Mouse to the right → closest to node at angle 0 (index 1 for 4 nodes)
    expect(closestSlice(100, 0, slices4)).toBe(1);
    // Mouse above → closest to node at angle -PI/2 (index 0)
    expect(closestSlice(0, -100, slices4)).toBe(0);
  });
});

describe('closestSubNode', () => {
  it('returns -1 when no submenu is active', () => {
    expect(closestSubNode(50, 0, -1, [])).toBe(-1);
  });

  it('returns -1 when parent has no Submenu action', () => {
    expect(closestSubNode(50, 0, 0, [{ action: { type: 'Script' } }])).toBe(-1);
  });

  it('returns -1 when no sub-nodes are within threshold', () => {
    const slices = [{ action: { type: 'Submenu', slices: [{ label: 'a' }] } }];
    expect(closestSubNode(-500, -500, 0, slices)).toBe(-1);
  });
});

describe('isNearBackButton', () => {
  const slices4 = [{}, {}, {}, {}];

  it('returns false when no submenu is active', () => {
    expect(isNearBackButton(0, 0, -1, slices4)).toBe(false);
  });

  it('returns true when near the back button position', () => {
    // Back button for submenu 0 is at NODE_ORBIT * cos(-PI/2), NODE_ORBIT * sin(-PI/2) = (0, -95)
    expect(isNearBackButton(0, -NODE_ORBIT, 0, slices4)).toBe(true);
  });

  it('returns false when far from back button', () => {
    expect(isNearBackButton(100, 100, 0, slices4)).toBe(false);
  });
});
