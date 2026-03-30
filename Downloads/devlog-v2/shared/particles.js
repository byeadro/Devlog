/**
 * Devlog — Particle Burst Effect
 */

const particles = {
  burst(originEl, count = 20) {
    const rect = originEl.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;

    for (let i = 0; i < count; i++) {
      const dot = document.createElement("div");
      dot.className = "particle";
      const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.5;
      const distance = 40 + Math.random() * 60;
      const tx = Math.cos(angle) * distance;
      const ty = Math.sin(angle) * distance;
      const size = 3 + Math.random() * 4;
      const duration = 400 + Math.random() * 300;

      dot.style.cssText = `position:fixed;left:${cx}px;top:${cy}px;width:${size}px;height:${size}px;border-radius:50%;background:var(--accent);pointer-events:none;z-index:9999;opacity:1;transition:all ${duration}ms cubic-bezier(0.25,0.46,0.45,0.94);`;
      document.body.appendChild(dot);

      requestAnimationFrame(() => {
        dot.style.transform = `translate(${tx}px,${ty}px) scale(0)`;
        dot.style.opacity = "0";
      });

      setTimeout(() => dot.remove(), duration + 50);
    }
  }
};
