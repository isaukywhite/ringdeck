import { describe, it, expect, beforeEach } from 'vitest';

import {
  getSlices, setSlices,
  getHoveredIndex, setHoveredIndex,
  getParticleAnim, setParticleAnim,
  getActiveSubmenu, setActiveSubmenu,
  getSubmenuHoveredIndex, setSubmenuHoveredIndex,
  getSubmenuTimer, setSubmenuTimer,
  SUBMENU_HOVER_DELAY,
} from '../../src/ring/state.js';

describe('ring/state', () => {
  beforeEach(() => {
    setSlices([]);
    setHoveredIndex(-1);
    setParticleAnim(null);
    setActiveSubmenu(-1);
    setSubmenuHoveredIndex(-1);
    setSubmenuTimer(null);
  });

  it('SUBMENU_HOVER_DELAY is 300', () => {
    expect(SUBMENU_HOVER_DELAY).toBe(300);
  });

  it('getSlices / setSlices round-trips', () => {
    const s = [{ label: 'A' }];
    setSlices(s);
    expect(getSlices()).toBe(s);
  });

  it('getHoveredIndex / setHoveredIndex', () => {
    expect(getHoveredIndex()).toBe(-1);
    setHoveredIndex(2);
    expect(getHoveredIndex()).toBe(2);
  });

  it('getParticleAnim / setParticleAnim', () => {
    expect(getParticleAnim()).toBeNull();
    setParticleAnim(42);
    expect(getParticleAnim()).toBe(42);
  });

  it('getActiveSubmenu / setActiveSubmenu', () => {
    expect(getActiveSubmenu()).toBe(-1);
    setActiveSubmenu(1);
    expect(getActiveSubmenu()).toBe(1);
  });

  it('getSubmenuHoveredIndex / setSubmenuHoveredIndex', () => {
    expect(getSubmenuHoveredIndex()).toBe(-1);
    setSubmenuHoveredIndex(3);
    expect(getSubmenuHoveredIndex()).toBe(3);
  });

  it('getSubmenuTimer / setSubmenuTimer', () => {
    expect(getSubmenuTimer()).toBeNull();
    setSubmenuTimer(123);
    expect(getSubmenuTimer()).toBe(123);
  });
});
