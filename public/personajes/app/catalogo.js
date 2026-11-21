// Pestaña «Héroes»: catálogo de clases dentro de index.html (partes/heroes.html). `initHeroes()` se registra en MODULOS de main.js.
// Las clases salen de `clases.json`; cada una carga su `clases/<id>/<id>.json` y, si lo declara, sus efectos.
import { cargarClase, rutaClase, RAIZ } from './datos.js';
import { mostrarCartas, ajustarEscala } from './carrusel.js';
import { iniciarSeleccion } from './seleccion.js';
import { registrarEfectos } from './efectos.js';
import { esc } from './util.js';

async function cargarEfectos(id) {
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

export async function initHeroes() {
  const raiz = document.querySelector('.heroes');
  const nav = document.getElementById('heroes-nav');
  const catalogo = document.getElementById('heroes-catalogo');
  addEventListener('resize', ajustarEscala);
  ajustarEscala();
  try {
    const clases = await (await fetch(new URL('clases.json', RAIZ), { cache: 'no-cache' })).json();
    nav.innerHTML = clases.map(({ id }) => `<a href="#${esc(id)}">${esc(id)}</a>`).join('');
    nav.insertAdjacentHTML('afterend', `<a href="#" class="atras" hidden>← ¿Quién eres?</a>`);
    // Una sola clase visible a la vez: el hash (#paladin) la elige; sin hash se vuelve a la lista. "Atrás" del navegador funciona igual.
    const atras = raiz.querySelector('.atras');
    let prev = null;
    history.replaceState(null, '', location.pathname + location.search); // siempre se arranca en la lista, aunque la URL traiga #clase
    const mostrarVista = () => {
      const id = decodeURIComponent(location.hash.slice(1));
      const activa = clases.some((c) => c.id === id) ? id : null;
      raiz.classList.toggle('con-clase', !!activa);
      atras.hidden = !activa;
      nav.hidden = !!activa;
      raiz.querySelectorAll('.clase').forEach((s) => s.classList.toggle('activa', s.id === activa));
      if (!activa || !prev) scrollTo(0, 0);
      prev = activa;
    };
    addEventListener('hashchange', mostrarVista);
    // Al elegir algo en una clase (en fase de captura, antes de que el asistente redibuje) se queda solo esa clase
    catalogo.addEventListener('click', (e) => {
      const seccion = e.target.closest('.clase');
      if (seccion && e.target.closest('[data-elegir]') && !raiz.classList.contains('con-clase')) location.hash = seccion.id;
    }, true);
    await Promise.all(clases.map((c) => cargar(catalogo, c)));
    mostrarVista();
  } catch (e) {
    console.error(e);
    catalogo.innerHTML = '<p class="estado alerta">No se pudo cargar clases.json</p>';
  }
}
