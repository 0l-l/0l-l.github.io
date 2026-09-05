// Footer year (present only on contact.html)
const yearEl = document.getElementById("year");
if (yearEl) yearEl.textContent = new Date().getFullYear();

// Magnetic homepage interaction (index.html only) — items drift
// toward the cursor when it's nearby, and ease back when it isn't.
// Skipped on touch devices and when the visitor prefers reduced motion.
(function () {
  const canvas = document.getElementById("heroCanvas");
  if (!canvas) return;

  const canHover = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (!canHover || reducedMotion) return;

  const RADIUS = 200;   // px, distance at which the pull starts
  const MAX_PULL = 26;  // px, strongest pull at zero distance
  const EASE = 0.14;    // how quickly items catch up each frame

  const items = Array.from(canvas.querySelectorAll(".mag-item")).map((el) => ({
    el,
    baseX: 0,
    baseY: 0,
    curX: 0,
    curY: 0,
  }));

  function recalcBase() {
    const canvasRect = canvas.getBoundingClientRect();
    items.forEach((item) => {
      const prevTransform = item.el.style.transform;
      item.el.style.transform = "none";
      const r = item.el.getBoundingClientRect();
      item.baseX = r.left - canvasRect.left + r.width / 2;
      item.baseY = r.top - canvasRect.top + r.height / 2;
      item.el.style.transform = prevTransform;
    });
  }
  recalcBase();
  window.addEventListener("resize", recalcBase);

  let mouseX = -9999;
  let mouseY = -9999;

  canvas.addEventListener("mousemove", (e) => {
    const r = canvas.getBoundingClientRect();
    mouseX = e.clientX - r.left;
    mouseY = e.clientY - r.top;
  });
  canvas.addEventListener("mouseleave", () => {
    mouseX = -9999;
    mouseY = -9999;
  });

  function step() {
    items.forEach((item) => {
      const dx = mouseX - item.baseX;
      const dy = mouseY - item.baseY;
      const dist = Math.hypot(dx, dy);
      let tx = 0;
      let ty = 0;
      if (dist < RADIUS && dist > 0.01) {
        const pull = (1 - dist / RADIUS) * MAX_PULL;
        tx = (dx / dist) * pull;
        ty = (dy / dist) * pull;
      }
      item.curX += (tx - item.curX) * EASE;
      item.curY += (ty - item.curY) * EASE;
      item.el.style.transform = `translate(${item.curX.toFixed(1)}px, ${item.curY.toFixed(1)}px)`;
    });
    requestAnimationFrame(step);
  }
  requestAnimationFrame(step);
})();
