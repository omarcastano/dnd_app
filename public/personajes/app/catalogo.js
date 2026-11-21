// Pestaña «Héroes»: catálogo de clases dentro de index.html (partes/heroes.html). `initHeroes()` se registra en MODULOS de main.js.
// Las clases salen de `clases.json`; cada una carga su `clases/<id>/<id>.json` y, si lo declara, sus efectos.
import { cargarClase, rutaClase, RAIZ } from './datos.js';
import { mostrarCartas, ajustarEscala } from './carrusel.js?v=8';
import { iniciarSeleccion } from './seleccion.js?v=4';
import { registrarEfectos } from './efectos.js';
import { esc } from './util.js';
import { atenderNarracion } from './narracion.js';

const efectosCargados = new Set();
async function cargarEfectos(id) {
  if (efectosCargados.has(id)) return;
  efectosCargados.add(id);
  const css = document.createElement('link');
  css.rel = 'stylesheet';
  css.href = `${rutaClase(id)}efectos.css`;
  document.head.append(css);
  registrarEfectos(await import(`${rutaClase(id)}efectos.js`));
}

async function cargar(catalogo, { id, efectos }) {
  const seccion = document.createElement('section');
  seccion.id = id;
  seccion.className = 'clase';
  catalogo.append(seccion);
  try {
    const [datos] = await Promise.all([cargarClase(id), efectos && cargarEfectos(id)]);
    seccion.innerHTML = `<h2>${esc(datos.titulo)}</h2><div class="contenido"></div>`;
    const contenido = seccion.querySelector('.contenido');
    if (datos.seleccion.length) return iniciarSeleccion(contenido, datos);
    const faltan = await mostrarCartas(contenido, datos.cartas, datos.etiquetas);
    if (faltan) contenido.insertAdjacentHTML('afterbegin', `<p class="estado alerta">Faltan ${faltan} imágenes</p>`);
  } catch (e) {
    console.error(e);
    seccion.innerHTML = `<h2>${esc(id)}</h2><p class="estado alerta">No se pudo cargar ${esc(id)}</p>`;
  }
}

// Reinicio total: se olvidan las elecciones guardadas y se vuelve a montar toda la pestaña desde cero
let montaje = null;
function olvidarTodo() {
  try {
    Object.keys(localStorage).filter((k) => /^taberna:.+:seleccion$/.test(k)).forEach((k) => localStorage.removeItem(k));
  } catch {}
}
function reiniciar() {
  montaje?.abort();
  olvidarTodo();
  document.querySelectorAll('.visor, .efecto').forEach((v) => v.remove());
  document.body.classList.remove('visor-abierto');
  const raiz = document.querySelector('.heroes');
  raiz.querySelectorAll('.ambiente, .atras, .pagina-clases').forEach((v) => v.remove());
  [...raiz.classList].filter((c) => c.startsWith('tema-') || c === 'con-clase' || c === 'con-resultado').forEach((c) => raiz.classList.remove(c));
  document.getElementById('heroes-nav').innerHTML = '';
  document.getElementById('heroes-nav').hidden = false;
  document.getElementById('heroes-catalogo').innerHTML = '';
  history.replaceState(null, '', location.pathname + location.search);
  scrollTo({ top: 0, behavior: 'instant' });
  return montar();
}

export const initHeroes = () => montar();

async function montar() {
  montaje = new AbortController();
  const { signal } = montaje;
  const raiz = document.querySelector('.heroes');
  const nav = document.getElementById('heroes-nav');
  const catalogo = document.getElementById('heroes-catalogo');
  addEventListener('resize', () => ajustarEscala(), { signal });
  ajustarEscala(true);
  raiz.addEventListener('heroes:reiniciar', reiniciar, { signal });
  try {
    const clases = await (await fetch(new URL('clases.json', RAIZ), { cache: 'no-cache' })).json();
    nav.innerHTML = clases.map(({ id }) => `<a href="#${esc(id)}">${esc(id)}</a>`).join('');
    nav.insertAdjacentHTML('afterend', `<a href="#" class="atras" hidden>← ¿Quién eres?</a>`);
    // Una sola clase visible a la vez: el hash (#paladin) la elige; sin hash se vuelve a la lista. "Atrás" del navegador funciona igual.
    const atras = raiz.querySelector('.atras');
    atras.addEventListener('click', (e) => { e.preventDefault(); reiniciar(); }, { signal });
    history.replaceState(null, '', location.pathname + location.search); // siempre se arranca en la lista, aunque la URL traiga #clase
    const mostrarVista = () => {
      document.documentElement.style.setProperty('--tabs-h', `${document.querySelector('.tabs')?.offsetHeight ?? 44}px`);
      const id = decodeURIComponent(location.hash.slice(1));
      const activa = clases.some((c) => c.id === id) ? id : null;
      raiz.classList.toggle('con-clase', !!activa);
      atras.hidden = !activa;
      nav.hidden = !!activa;
      raiz.querySelectorAll('.clase').forEach((s) => s.classList.toggle('activa', s.id === activa));
      (raiz.querySelector('.clase.activa h2') ?? raiz.querySelector('.barra')).append(atras); // en la clase, el botón va en la fila del título
      // Al ocultarse las otras clases la página se acorta y el navegador recoloca el scroll: se deja la vista en el inicio de la clase elegida (o arriba al volver a la lista)
      if (activa) (raiz.querySelector('.clase.activa .paso') ?? raiz.querySelector('.clase.activa'))?.scrollIntoView({ block: 'start', behavior: 'instant' });
      else scrollTo({ top: 0, behavior: 'instant' });
    };
    addEventListener('hashchange', mostrarVista, { signal });
    // Texto que no cabe en la carta: al tocarlo se abre completo en una ventana (el scroll interno falla en Chrome móvil)
    raiz.addEventListener('click', (e) => {
      if (atenderNarracion(e)) return;
      if (e.target.closest('.visor')) return;
      const clic = e.target.closest('.bloque, .pergamino');
      // En las cartas de tabla (ataque básico + especial) se muestra el cuerpo entero, no un bloque suelto
      const caja = clic?.closest('.cuerpo-p') ?? clic;
      if (!caja) return;
      e.stopPropagation(); // que no voltee la carta
      const visor = document.createElement('div');
      visor.className = 'visor';
      visor.innerHTML = `<div class="visor-caja ${caja.className}">${caja.innerHTML}</div><button class="btn-pri visor-cerrar" type="button">Cerrar</button>`;
      const cerrar = () => { visor.remove(); document.body.classList.remove('visor-abierto'); removeEventListener('keydown', tecla); };
      const tecla = (ev) => { if (ev.key === 'Escape') cerrar(); };
      visor.addEventListener('click', (ev) => { if (ev.target === visor || ev.target.closest('.visor-cerrar')) cerrar(); });
      addEventListener('keydown', tecla);
      document.body.classList.add('visor-abierto');
      document.body.append(visor);
    }, { capture: true, signal });
    // Al elegir algo en una clase (en fase de captura, antes de que el asistente redibuje) se queda solo esa clase
    catalogo.addEventListener('click', (e) => {
      const seccion = e.target.closest('.clase');
      if (seccion && e.target.closest('[data-elegir]') && !raiz.classList.contains('con-clase')) {
          history.pushState(null, '', `#${seccion.id}`); // pushState (no location.hash) para que el navegador no salte al ancla
          mostrarVista();
        }
    }, { capture: true, signal });
    await Promise.all(clases.map((c) => cargar(catalogo, c)));
    if (signal.aborted) return;
    mostrarVista();
    ajustarEscala(true);
    // Contador vertical «1 / N» entre clases (solo móvil, en la lista)
    const pagina = document.createElement('div');
    pagina.className = 'pagina-clases';
    raiz.append(pagina);
    const secciones = [...catalogo.querySelectorAll('.clase')];
    const pintar = () => {
      const centro = innerHeight / 2;
      let mejor = 0, dist = Infinity;
      secciones.forEach((s, i) => { const r = s.getBoundingClientRect(); const d = Math.abs((r.top + r.bottom) / 2 - centro); if (d < dist) { dist = d; mejor = i; } });
      pagina.textContent = `${mejor + 1} / ${secciones.length}`;
    };
    addEventListener('scroll', pintar, { passive: true, signal });
    pintar();
  } catch (e) {
    console.error(e);
    catalogo.innerHTML = '<p class="estado alerta">No se pudo cargar clases.json</p>';
  }
}
