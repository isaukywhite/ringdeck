import {
  CENTER, NODE_ORBIT, arcSpread,
} from './geometry.js';
import {
  getHoveredIndex, getSlices,
  getParticleAnim, setParticleAnim,
} from './state.js';

export function startParticles() {
  if (getParticleAnim()) cancelAnimationFrame(getParticleAnim());

  const canvas = document.querySelector(".ring-particles");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");

  const particles = [];
  const NUM = 24;

  const PARTICLE_COLORS = [
    [45, 27, 105],
    [61, 42, 124],
    [10, 132, 255],
    [79, 209, 255],
    [26, 14, 62],
  ];

  for (let i = 0; i < NUM; i++) {
    particles.push({
      angle: Math.random() * Math.PI * 2, // NOSONAR — visual particles only
      radius: NODE_ORBIT - 4 + Math.random() * 8, // NOSONAR — visual particles only
      speed: 0.003 + Math.random() * 0.004, // NOSONAR — visual particles only
      size: 0.8 + Math.random() * 1.2, // NOSONAR — visual particles only
      alpha: 0.15 + Math.random() * 0.3, // NOSONAR — visual particles only
      drift: (Math.random() - 0.5) * 0.3, // NOSONAR — visual particles only
      color: PARTICLE_COLORS[Math.floor(Math.random() * PARTICLE_COLORS.length)], // NOSONAR — visual particles only
    });
  }

  function draw() {
    ctx.clearRect(0, 0, 400, 400);

    const hoveredIndex = getHoveredIndex();
    const slices = getSlices();

    for (const p of particles) {
      p.angle += p.speed;
      p.radius += Math.sin(p.angle * 3) * 0.05;

      const x = CENTER + p.radius * Math.cos(p.angle);
      const y = CENTER + p.radius * Math.sin(p.angle);

      let alpha = p.alpha;
      let [r, g, b] = p.color;
      if (hoveredIndex >= 0) {
        const n = slices.length;
        const hAngle = (2 * Math.PI * hoveredIndex) / n - Math.PI / 2;
        let diff = Math.abs(p.angle % (Math.PI * 2) - ((hAngle % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2));
        if (diff > Math.PI) diff = Math.PI * 2 - diff;
        const spread = arcSpread(n);
        if (diff < spread) {
          const t = 1 - diff / spread;
          alpha = Math.min(1, alpha + 0.45 * t);
          r = Math.round(r + (10 - r) * t * 0.6);
          g = Math.round(g + (132 - g) * t * 0.6);
          b = Math.round(b + (255 - b) * t * 0.6);
        }
      }

      ctx.beginPath();
      ctx.arc(x, y, p.size, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${alpha})`;
      ctx.fill();
    }

    setParticleAnim(requestAnimationFrame(draw));
  }

  draw();
}
