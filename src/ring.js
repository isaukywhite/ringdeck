import {
  setSlices, getSlices, setHoveredIndex,
  setActiveSubmenu, setSubmenuHoveredIndex,
  getParticleAnim, setParticleAnim,
} from './ring/state.js';
import { buildRing } from './ring/ring-render.js';
import { setupInteraction } from './ring/interaction.js';
import { startParticles } from './ring/particles.js';
import { generateRingPalette } from './color-engine.js';
import { setCurrentPalette } from './ring/state.js';

let prevSliceCount = -1;

function applyRingColor(hex) {
  const p = generateRingPalette(hex);
  setCurrentPalette(p);
  const s = document.documentElement.style;
  s.setProperty('--ring-accent', p.accent);
  s.setProperty('--ring-accent-secondary', p.accentSecondary);
  s.setProperty('--ring-purple-deep', p.purpleDeep);
  s.setProperty('--ring-purple-mid', p.purpleMid);
  s.setProperty('--ring-purple-dark', p.purpleDark);
  s.setProperty('--glow-rgb', p.glowRgb);
  s.setProperty('--glow-secondary-rgb', p.glowSecondaryRgb);
  s.setProperty('--purple-rgb', p.purpleRgb);
  s.setProperty('--purple-mid-rgb', p.purpleMidRgb);
  s.setProperty('--purple-dark-rgb', p.purpleDarkRgb);
  s.setProperty('--ring-node-bg', p.nodeBg);
  s.setProperty('--ring-node-bg-hover', p.nodeBgHover);
  s.setProperty('--ring-center-gradient', p.centerGradient);
  s.setProperty('--ring-center-active', p.centerActive);
}

function applyRingSize(size) {
  const scales = { tiny: 0.45, mini: 0.6, small: 0.75, medium: 1, large: 1.3 };
  const scale = scales[size] || 1;
  document.documentElement.style.setProperty('--ring-scale', scale);
}

async function init() {
  try {
    const hex = await globalThis.api.getRingColor();
    if (hex) applyRingColor(hex);
    const size = await globalThis.api.getRingSize();
    if (size) applyRingSize(size);
  } catch (_) { /* preload may not be ready yet */ }

  if (getSlices().length === 0) {
    try {
      const { profile } = await globalThis.api.getActiveProfile();
      if (profile && profile.slices) setSlices(profile.slices);
    } catch (_) { /* ignore */ }
    buildRing();
  }

  setupInteraction();
  if (prevSliceCount !== getSlices().length) {
    startParticles();
    prevSliceCount = getSlices().length;
  }
}

// Listen for combined ring data from main process (color + size + slices in one IPC)
globalThis.api.onRingData((data) => {
  if (data.color) applyRingColor(data.color);
  if (data.size) applyRingSize(data.size);
  if (data.performanceMode) {
    document.body.classList.add("lite-mode");
  } else {
    document.body.classList.remove("lite-mode");
  }

  setSlices(data.slices);
  setActiveSubmenu(-1);
  setSubmenuHoveredIndex(-1);
  setHoveredIndex(-1);
  buildRing();

  if (prevSliceCount !== data.slices.length) {
    startParticles();
    prevSliceCount = data.slices.length;
  }

  const ring = document.getElementById("ring");
  if (ring) {
    ring.classList.remove("appear");
    // Use rAF to guarantee the browser processed the removal before re-adding
    requestAnimationFrame(() => {
      ring.classList.add("appear");
    });
  }
});

document.addEventListener("DOMContentLoaded", () => {
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      // Pause particles when ring is hidden (save CPU)
      const anim = getParticleAnim();
      if (anim) {
        cancelAnimationFrame(anim);
        setParticleAnim(null);
      }
      // Reset ring state immediately so it's clean for next show
      const ring = document.getElementById("ring");
      if (ring) ring.classList.remove("appear");
    } else {
      setHoveredIndex(-1);
      setActiveSubmenu(-1);
      setSubmenuHoveredIndex(-1);
      // Don't trigger appear here — onRingData handles it.
      // Just restart particles.
      startParticles();
    }
  });
});

init(); // NOSONAR

