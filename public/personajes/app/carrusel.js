// Carrusel de cartas (scroll-snap) con contador "3 / 10" y puntos.
import { renderizarCartas, esperarImagenes } from './cartas.js';

// Escala de la carta (306×572) para que quepa en el ancho y el alto de la pantalla
let anchoPrev = 0, altoPrev = 0;
export function ajustarEscala(forzar = false) {
  // En móvil la barra del navegador aparece/desaparece al hacer scroll y cambia innerHeight: sin este filtro las cartas «saltan» de tamaño.
  // Solo se recalcula si cambia el ancho (giro de pantalla) o el alto cambia de verdad (>150px), o si se pide (`forzar`, tras dibujar).
  if (!forzar && anchoPrev && innerWidth === anchoPrev && Math.abs(innerHeight - altoPrev) < 150) return;
  anchoPrev = innerWidth; altoPrev = innerHeight;
  const raiz = document.documentElement.style;
  const escala = Math.min(1, (innerWidth - 40) / 306, (innerHeight - 190) / 572);
  raiz.setProperty('--escala', Math.max(escala, 0.5).toFixed(3));
  const movil = innerWidth <= 760;
  const porAncho = Math.min(1.4, (innerWidth - 32) / 306);
  let alto;
  // Móvil: se mide lo que ocupa todo lo que rodea a la carta (pestañas, títulos, pista, botón) y la carta usa el resto de la pantalla
  const ops = movil && [...document.querySelectorAll('.heroes .opciones')].find((o) => o.offsetParent);
  const caja = ops?.querySelector('.opcion-caja');
  const carta = caja?.querySelector('.carta-sel');
  if (caja && carta) {
    const tabs = document.querySelector('.tabs')?.offsetHeight ?? 0;
    const seccion = ops.closest('.clase') ?? ops.closest('.contenido') ?? ops.parentElement;
    const arriba = ops.getBoundingClientRect().top - seccion.getBoundingClientRect().top;
    const abajo = caja.getBoundingClientRect().height - carta.getBoundingClientRect().height + (ops.closest('.paso')?.querySelector('.btn-sec')?.offsetHeight ?? 0);
    alto = (innerHeight - tabs - arriba - abajo - 36) / 572;
  } else alto = movil ? (innerHeight - 350) / 572 : Math.max((innerHeight - 250) / 572, 0.9);
  raiz.setProperty('--escala-sel', Math.max(Math.min(porAncho, alto), 0.4).toFixed(3));
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
