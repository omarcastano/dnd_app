// Brasas flotantes de la antorcha. Decorativo: se omite con "reducir movimiento".
export function initAmbiente() {
  const lienzo = document.getElementById("ambiente");
  if (!lienzo || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const ctx = lienzo.getContext("2d");
  let ancho, alto, brasas;

  const nueva = (abajo = false) => ({
    x: Math.random() * ancho,
    y: abajo ? alto + 10 : Math.random() * alto,
    r: Math.random() * 1.8 + 0.5,
    vy: Math.random() * 0.5 + 0.2,
    fase: Math.random() * 6.28,
    vida: Math.random() * 0.5 + 0.4
  });

  function medir() {
    ancho = lienzo.width = innerWidth;
    alto = lienzo.height = innerHeight;
    brasas = Array.from({ length: Math.min(45, Math.floor(ancho / 28)) }, () => nueva());
  }

  function pintar() {
    ctx.clearRect(0, 0, ancho, alto);
    for (const b of brasas) {
      b.y -= b.vy;
      b.fase += 0.02;
      b.x += Math.sin(b.fase) * 0.4;
      if (b.y < -10) Object.assign(b, nueva(true));
      const brillo = b.vida * (0.6 + 0.4 * Math.sin(b.fase * 3));
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.r, 0, 6.28);
      ctx.fillStyle = `rgba(255, ${150 + b.r * 30}, 60, ${brillo})`;
      ctx.shadowColor = "rgba(255, 140, 40, 0.9)";
      ctx.shadowBlur = 8;
      ctx.fill();
    }
    requestAnimationFrame(pintar);
  }

  addEventListener("resize", medir);
  medir();
  pintar();
}
