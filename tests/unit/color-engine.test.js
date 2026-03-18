import { describe, it, expect } from 'vitest';
import {
  hexToRGB, hexToHSL, hslToHex,
  generateRingPalette, BUILTIN_PRESETS,
} from '../../src/color-engine.js';

describe('hexToRGB', () => {
  it('converts #0A84FF to [10, 132, 255]', () => {
    expect(hexToRGB('#0A84FF')).toEqual([10, 132, 255]);
  });

  it('converts #000000 to [0, 0, 0]', () => {
    expect(hexToRGB('#000000')).toEqual([0, 0, 0]);
  });

  it('converts #FFFFFF to [255, 255, 255]', () => {
    expect(hexToRGB('#FFFFFF')).toEqual([255, 255, 255]);
  });

  it('works without # prefix', () => {
    expect(hexToRGB('FF0000')).toEqual([255, 0, 0]);
  });
});

describe('hexToHSL', () => {
  it('converts pure red #FF0000', () => {
    const hsl = hexToHSL('#FF0000');
    expect(hsl.h).toBe(0);
    expect(hsl.s).toBe(100);
    expect(hsl.l).toBe(50);
  });

  it('converts white #FFFFFF to achromatic', () => {
    const hsl = hexToHSL('#FFFFFF');
    expect(hsl.s).toBe(0);
    expect(hsl.l).toBe(100);
  });

  it('converts black #000000 to achromatic', () => {
    const hsl = hexToHSL('#000000');
    expect(hsl.s).toBe(0);
    expect(hsl.l).toBe(0);
  });
});

describe('hslToHex', () => {
  it('converts H=0 S=100 L=50 to red', () => {
    expect(hslToHex(0, 100, 50).toLowerCase()).toBe('#ff0000');
  });

  it('converts H=0 S=0 L=100 to white', () => {
    expect(hslToHex(0, 0, 100).toLowerCase()).toBe('#ffffff');
  });

  it('round-trips from hex through HSL back to hex', () => {
    const original = '#0A84FF';
    const hsl = hexToHSL(original);
    const roundTripped = hslToHex(hsl.h, hsl.s, hsl.l);
    // Allow small rounding differences
    const [r1, g1, b1] = hexToRGB(original);
    const [r2, g2, b2] = hexToRGB(roundTripped);
    expect(Math.abs(r1 - r2)).toBeLessThanOrEqual(2);
    expect(Math.abs(g1 - g2)).toBeLessThanOrEqual(2);
    expect(Math.abs(b1 - b2)).toBeLessThanOrEqual(2);
  });
});

describe('generateRingPalette', () => {
  it('returns all required palette keys', () => {
    const p = generateRingPalette('#0A84FF');
    expect(p).toHaveProperty('accent');
    expect(p).toHaveProperty('accentSecondary');
    expect(p).toHaveProperty('purpleDeep');
    expect(p).toHaveProperty('purpleMid');
    expect(p).toHaveProperty('purpleDark');
    expect(p).toHaveProperty('glowRgb');
    expect(p).toHaveProperty('glowSecondaryRgb');
    expect(p).toHaveProperty('purpleRgb');
    expect(p).toHaveProperty('purpleMidRgb');
    expect(p).toHaveProperty('purpleDarkRgb');
    expect(p).toHaveProperty('nodeBg');
    expect(p).toHaveProperty('nodeBgHover');
    expect(p).toHaveProperty('centerGradient');
    expect(p).toHaveProperty('centerActive');
    expect(p).toHaveProperty('particleColors');
    expect(p).toHaveProperty('accentRgb');
  });

  it('accent matches the input hex', () => {
    const p = generateRingPalette('#FF4D94');
    expect(p.accent).toBe('#FF4D94');
  });

  it('particleColors is an array of 5 RGB triplets', () => {
    const p = generateRingPalette('#0A84FF');
    expect(p.particleColors).toHaveLength(5);
    for (const rgb of p.particleColors) {
      expect(rgb).toHaveLength(3);
      rgb.forEach(v => {
        expect(v).toBeGreaterThanOrEqual(0);
        expect(v).toBeLessThanOrEqual(255);
      });
    }
  });

  it('accentRgb is a 3-element array', () => {
    const p = generateRingPalette('#34D058');
    expect(p.accentRgb).toHaveLength(3);
  });

  it('handles achromatic colors (gray)', () => {
    const p = generateRingPalette('#808080');
    expect(p.accent).toBe('#808080');
    expect(p.purpleDeep).toBeDefined();
  });

  it('handles very dark colors', () => {
    const p = generateRingPalette('#010101');
    expect(p.accent).toBe('#010101');
  });

  it('produces different palettes for different seeds', () => {
    const p1 = generateRingPalette('#0A84FF');
    const p2 = generateRingPalette('#FF4D94');
    expect(p1.accent).not.toBe(p2.accent);
    expect(p1.accentSecondary).not.toBe(p2.accentSecondary);
  });
});

describe('BUILTIN_PRESETS', () => {
  it('has 10 presets', () => {
    expect(BUILTIN_PRESETS).toHaveLength(10);
  });

  it('each preset has id, name, and color', () => {
    for (const preset of BUILTIN_PRESETS) {
      expect(preset).toHaveProperty('id');
      expect(preset).toHaveProperty('name');
      expect(preset).toHaveProperty('color');
      expect(preset.color).toMatch(/^#[0-9A-Fa-f]{6}$/);
    }
  });

  it('has unique ids', () => {
    const ids = BUILTIN_PRESETS.map(p => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('includes nebula as the first preset', () => {
    expect(BUILTIN_PRESETS[0].id).toBe('nebula');
    expect(BUILTIN_PRESETS[0].color).toBe('#0A84FF');
  });
});
