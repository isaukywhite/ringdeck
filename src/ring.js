import {
  setSlices, setHoveredIndex,
  setActiveSubmenu, setSubmenuHoveredIndex,
} from './ring/state.js';
import { buildRing } from './ring/ring-render.js';
import { setupInteraction } from './ring/interaction.js';
import { startParticles } from './ring/particles.js';

async function init() {
  const { profile } = await globalThis.api.getActiveProfile();
  setSlices(profile.slices);
  buildRing();
  setupInteraction();
  startParticles();
}

globalThis.__updateSlices = function (newSlices) {
  setSlices(newSlices);
  setActiveSubmenu(-1);
  setSubmenuHoveredIndex(-1);
  buildRing();
};

document.addEventListener("DOMContentLoaded", () => {
  const ring = document.getElementById("ring");
  let wasHidden = true;

  setInterval(async () => {
    if (!document.hidden && wasHidden) {
      wasHidden = false;
      const { profile } = await globalThis.api.getActiveProfile();
      setSlices(profile.slices);
      setHoveredIndex(-1);
      setActiveSubmenu(-1);
      setSubmenuHoveredIndex(-1);
      buildRing();
      ring.classList.remove("appear");
      ring.getAnimations(); // force reflow
      ring.classList.add("appear");
    } else if (document.hidden) {
      wasHidden = true;
    }
  }, 100);
});

init(); // NOSONAR
