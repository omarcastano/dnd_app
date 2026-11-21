// Carrusel de cartas (scroll-snap) con contador "3 / 10" y puntos.
import { renderizarCartas, esperarImagenes } from './cartas.js';

// Escala de la carta (306×572) para que quepa en el ancho y el alto de la pantalla
export function ajustarEscala() {
  const raiz = document.documentElement.style;
  const escala = Math.min(1, (innerWidth - 40) / 306, (innerHeight - 190) / 572);
  raiz.setProperty('--escala', Math.max(escala, 0.5).toFixed(3));
  // En la selección sobra espacio para el título, el contador y el botón "Elegir"
  const sel = Math.min(1.4, (innerWidth - 32) / 306, Math.max((innerHeight - 250) / 572, 0.9));
  raiz.setProperty('--escala-sel', Math.max(sel, 0.4).toFixed(3));
}

// Contador y puntos según la carta que quede centrada al deslizar
export function activarContador(cuenta, hoja) {
  const cartas = [...hoja.children];
  cuenta.innerHTML = `<span class="n"></span><span class="puntos">${cartas.map(() => '<i></i>').join('')}</span>`;
  const n = cuenta.querySelector('.n');
  const puntos = [...cuenta.querySelectorAll('i')];
  const actualizar = () => {
    const centro = hoja.scrollLeft + hoja.clientWidth / 2;
    let mejor = 0, dist = Infinity;
    cartas.forEach((c, i) => { const d = Math.abs(c.offsetLeft + c.offsetWidth / 2 - centro); if (d < dist) { dist = d; mejor = i; } });
    n.textContent = `${mejor + 1} / ${cartas.length}`;
    puntos.forEach((p, i) => p.classList.toggle('activo', i === mejor));
  };
  hoja.addEventListener('scroll', actualizar, { passive: true });
  actualizar();
}

// Dibuja las cartas en un carrusel dentro de `destino`; devuelve cuántas imágenes faltan
export async function mostrarCartas(destino, cartas, etiquetas) {
  destino.innerHTML = '<div class="contador"></div><div class="hoja-p"></div>';
  const hoja = destino.querySelector('.hoja-p');
  hoja.innerHTML = renderizarCartas(cartas, etiquetas);
  const faltan = await esperarImagenes(hoja);
  activarContador(destino.querySelector('.contador'), hoja);
  return faltan;
}
