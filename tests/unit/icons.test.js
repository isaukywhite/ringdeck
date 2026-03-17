import { describe, it, expect } from 'vitest';
import { ICON_MAP, ICON_CATEGORIES, resolveIcon, iconNames } from '../../src/icons.js';

describe('resolveIcon', () => {
  it('returns SVG for known icon', () => {
    const result = resolveIcon('globe-alt');
    expect(result).toContain('svg');
  });

  it('returns default icon for unknown name', () => {
    const result = resolveIcon('nonexistent-icon-xyz');
    expect(result).toContain('svg');
    expect(result).toBe(ICON_MAP['cog-6-tooth']);
  });

  it('returns default icon for null/undefined', () => {
    expect(resolveIcon(null)).toBe(ICON_MAP['cog-6-tooth']);
    expect(resolveIcon(undefined)).toBe(ICON_MAP['cog-6-tooth']);
  });

  it('returns emoji span for emoji input', () => {
    const result = resolveIcon('🎵');
    expect(result).toContain('<span');
    expect(result).toContain('🎵');
  });
});

describe('iconNames', () => {
  it('returns an array', () => {
    const names = iconNames();
    expect(Array.isArray(names)).toBe(true);
  });

  it('has the correct number of icons', () => {
    const names = iconNames();
    expect(names.length).toBe(Object.keys(ICON_MAP).length);
  });

  it('includes known icon names', () => {
    const names = iconNames();
    expect(names).toContain('globe-alt');
    expect(names).toContain('cog-6-tooth');
    expect(names).toContain('command-line');
  });
});

describe('ICON_CATEGORIES', () => {
  it('all category icon references exist in ICON_MAP', () => {
    for (const cat of ICON_CATEGORIES) {
      for (const iconName of cat.icons) {
        expect(ICON_MAP).toHaveProperty(iconName, expect.anything());
      }
    }
  });

  it('has expected number of categories', () => {
    expect(ICON_CATEGORIES.length).toBe(9);
  });
});
