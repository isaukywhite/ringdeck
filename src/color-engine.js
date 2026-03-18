// ─── Color Engine ───
// Pure functions: one hex seed → full ring palette via HSL math.
// No side effects, no DOM access.

// ─── Conversions ───

export function hexToRGB(hex) {
  const h = hex.replace('#', '');
  return [
    parseInt(h.substring(0, 2), 16),
    parseInt(h.substring(2, 4), 16),
    parseInt(h.substring(4, 6), 16),
  ];
}

export function hexToHSL(hex) {
  const [r, g, b] = hexToRGB(hex).map(v => v / 255);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  let h = 0, s = 0;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / d + 2) / 6; break;
      case b: h = ((r - g) / d + 4) / 6; break;
    }
  }

  return {
    h: Math.round(h * 360),
    s: Math.round(s * 100),
    l: Math.round(l * 100),
  };
}

export function hslToHex(h, s, l) {
  h = ((h % 360) + 360) % 360;
  s = Math.max(0, Math.min(100, s)) / 100;
  l = Math.max(0, Math.min(100, l)) / 100;
  const k = n => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = n => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  const toHex = v => Math.round(v * 255).toString(16).padStart(2, '0');
  return `#${toHex(f(0))}${toHex(f(8))}${toHex(f(4))}`;
}

// ─── Helpers ───

function clamp(v, min, max) {
  return Math.min(max, Math.max(min, v));
}

function rgbString(hex) {
  const [r, g, b] = hexToRGB(hex);
  return `${r}, ${g}, ${b}`;
}

function rgba(hex, alpha) {
  const [r, g, b] = hexToRGB(hex);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

// ─── Palette Generation ───

export function generateRingPalette(seedHex) {
  let { h, s, l } = hexToHSL(seedHex);

  // Edge case: achromatic or very dark colors — keep neutral gray
  // to prevent falling back to red (h=0)
  const isNeutral = s < 5 || l < 3;
  if (isNeutral) {
    h = 0;
    s = 0;
  }

  // Derived colors via HSL
  const accent           = seedHex;
  const accentSecondary  = isNeutral
    ? hslToHex(0, 0, Math.min(Math.max(l + 25, 35), 100))
    : hslToHex(h, clamp(s, 40, 95), Math.min(l + 20, 90));
  const purpleDeep       = isNeutral ? hslToHex(0, 0, 12) : hslToHex(h, clamp(s, 50, 70), 20);
  const purpleMid        = isNeutral ? hslToHex(0, 0, 20) : hslToHex(h, clamp(s, 45, 60), 30);
  const purpleDark       = isNeutral ? hslToHex(0, 0, 6) : hslToHex(h, clamp(s, 55, 70), 12);

  // RGB triplet strings for CSS vars
  const glowRgb          = rgbString(accent);
  const glowSecondaryRgb = rgbString(accentSecondary);
  const purpleRgb        = rgbString(purpleDeep);
  const purpleMidRgb     = rgbString(purpleMid);
  const purpleDarkRgb    = rgbString(purpleDark);

  // CSS gradient strings
  const nodeBg           = `linear-gradient(145deg, ${accent} 0%, ${purpleDeep} 100%)`;
  const nodeBgHover      = `linear-gradient(145deg, ${accentSecondary} 0%, ${accent} 100%)`;
  const centerGradient   = `radial-gradient(circle, #fff 0%, ${purpleMid} 100%)`;
  const centerActive     = `radial-gradient(circle, #fff 10%, ${accent} 70%, ${purpleDeep} 100%)`;

  // SVG gradient stop-color values (rgba)
  const sectorStart      = rgba(purpleDeep, 0.6);
  const sectorMid        = rgba(purpleMid, 0.3);
  const sectorAccent     = rgba(accent, 0.12);
  const sectorFade       = rgba(purpleDeep, 0.05);
  const beamStart        = rgba(purpleDeep, 0);
  const beamMid          = rgba(purpleMid, 0.3);
  const beamAccent       = rgba(accent, 0.45);
  const beamTip          = rgba(accentSecondary, 0.5);
  const arcStops         = [purpleDeep, accent, accentSecondary, accent, purpleDeep];

  // Canvas particle colors — 5 RGB triplets
  const particleColors = [
    hexToRGB(purpleDeep),
    hexToRGB(purpleMid),
    hexToRGB(accent),
    hexToRGB(accentSecondary),
    hexToRGB(purpleDark),
  ];

  // Hover lerp target — accent as [r, g, b]
  const accentRgb = hexToRGB(accent);

  return {
    // Hex values
    accent, accentSecondary, purpleDeep, purpleMid, purpleDark,
    // CSS RGB triplet strings
    glowRgb, glowSecondaryRgb, purpleRgb, purpleMidRgb, purpleDarkRgb,
    // CSS gradient strings
    nodeBg, nodeBgHover, centerGradient, centerActive,
    // SVG stops
    sectorStart, sectorMid, sectorAccent, sectorFade,
    beamStart, beamMid, beamAccent, beamTip,
    arcStops,
    // Canvas
    particleColors, accentRgb,
  };
}

// ─── Built-in Presets ───
// Names and seed colors extracted from themes/*.json

export const BUILTIN_PRESETS = [
  { id: 'nebula',    name: 'Nebula',    color: '#0A84FF' },
  { id: 'glacier',   name: 'Glacier',   color: '#06B6D4' },
  { id: 'matrix',    name: 'Matrix',    color: '#34D058' },
  { id: 'sunburst',  name: 'Sunburst',  color: '#EAB308' },
  { id: 'sovereign', name: 'Sovereign', color: '#B8860B' },
  { id: 'magma',     name: 'Magma',     color: '#F97316' },
  { id: 'inferno',   name: 'Inferno',   color: '#EF4444' },
  { id: 'blossom',   name: 'Blossom',   color: '#FF4D94' },
  { id: 'phantom',   name: 'Phantom',   color: '#9B59FF' },
  { id: 'gunmetal',  name: 'Gunmetal',  color: '#6B7280' },
];
