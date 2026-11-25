// Pestaña «Mapas»: galería de mapas de batalla (mapas/mapas.json) con visor y narración, y campañas de 4 escenarios (mapas/campanas.json).
// Imágenes en mapas/imagenes/<id>.webp; audios en mapas/narraciones/ (ruta en el campo `narracion` de cada JSON).
import { MEDALLON } from '../../../personajes/app/cartas.js';
import { atenderNarracion } from '../../../personajes/app/narracion.js';

const RAIZ = new URL('../../../mapas/', import.meta.url);
const V = '?v=8';
const esc = (t) => String(t ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const img = (id) => new URL(`imagenes/${id}.webp${V}`, RAIZ).href;
const audio = (ruta) => (ruta ? MEDALLON(new URL(ruta + V, RAIZ).href) : '');
const leer = (archivo) => fetch(new URL(archivo + V, RAIZ)).then((r) => r.json());

const puntos = (ps) => (ps?.length ? `<div class="escenario-puntos"><h6>Puntos de interés</h6><ol>${ps.map((p) => `<li>
  <b>${esc(p.nombre)}</b><small>${esc(p.ubicacion)}</small><p>${esc(p.que_hay)}</p>
  ${p.prueba ? `<p class="punto-prueba">🎲 ${esc(p.prueba)}</p>` : ''}${p.combate ? `<p class="punto-combate">⚔ ${esc(p.combate)}</p>` : ''}</li>`).join('')}</ol></div>` : '');

// Escenas: se muestran de una en una; «Siguiente escena» descubre la siguiente
const escenas = (es) => (es?.length ? `<div class="escenario-escenas" data-escenas><h6>Historia</h6>${es.map((s, k) => `<section class="escena"${k ? ' hidden' : ''}>
  <p class="escena-num">Escena ${k + 1} de ${es.length}${s.cuando ? ` · <em>${esc(s.cuando)}</em>` : ''}</p><h5>${esc(s.titulo)}</h5>
  ${audio(s.narracion)}<p>${esc(s.texto)}</p></section>`).join('')}
  <div class="escena-nav"><button type="button" data-escena="-1" disabled>‹ Anterior</button><button type="button" data-escena="1"${es.length > 1 ? '' : ' disabled'}>Siguiente escena ›</button></div></div>` : '');

function moverEscena(boton) {
  const caja = boton.closest('[data-escenas]');
  const lista = [...caja.querySelectorAll('.escena')];
  const i = Math.min(lista.length - 1, Math.max(0, lista.findIndex((x) => !x.hidden) + Number(boton.dataset.escena)));
  lista.forEach((x, k) => { x.hidden = k !== i; });
  const [atras, adelante] = caja.querySelectorAll('[data-escena]');
  atras.disabled = i === 0; adelante.disabled = i === lista.length - 1;
}

export async function initMapas() {
  const lista = document.getElementById('mapas-catalogo');
  if (!lista) return;
  const [{ mapas }, { campanas }] = await Promise.all([leer('mapas.json'), leer('campanas.json').catch(() => ({ campanas: [] }))]);
  const indice = Object.fromEntries(mapas.map((m, i) => [m.id, i]));

  lista.innerHTML = mapas.map((m, i) => `<button type="button" class="mapa-ficha" data-mapa="${i}">
    <img src="${img(m.id)}" alt="${esc(m.nombre)}" loading="lazy"><span class="mapa-ficha-num">${i + 1}</span>
    <b>${esc(m.nombre)}</b><small>${esc(m.resumen)}</small></button>`).join('');

  const zonaCampanas = document.getElementById('mapas-campanas');
  if (zonaCampanas) {
    zonaCampanas.innerHTML = campanas.map((c, ci) => `<details class="campana"${ci === 0 ? ' open' : ''}>
      <summary><span class="campana-num">${ci + 1}</span><span><b>${esc(c.nombre)}</b><small>${esc(c.gancho)}</small></span></summary>
      <div class="campana-intro">${audio(c.narracion)}<p>${esc(c.descripcion)}</p></div>
      <ol class="campana-escenarios">${c.escenarios.map((e, ei) => `<li class="escenario">
        <button type="button" class="escenario-img" data-mapa="${indice[e.mapa]}" aria-label="Ver el mapa ${esc(mapas[indice[e.mapa]]?.nombre)}">
          <img src="${img(e.mapa)}" alt="" loading="lazy"><span class="nivel nivel-${ei + 1}">Escenario ${ei + 1} · Niv. ${ei + 1}-${ei + 2}</span></button>
        <div class="escenario-texto"><h5>${esc(e.titulo)}</h5><p class="escenario-mapa">${esc(mapas[indice[e.mapa]]?.nombre)}</p>
          <p><b>Objetivo:</b> ${esc(e.objetivo)}</p>${e.amenazas?.length ? `<p><b>Amenazas:</b> ${e.amenazas.map(esc).join(', ')}</p>` : ''}
          <p class="escenario-etiqueta">Llegada</p>${audio(e.narracion)}<p class="escenario-desc">${esc(e.descripcion)}</p></div>
        ${puntos(e.puntos_interes)}${escenas(e.escenas)}</li>`).join('')}</ol></details>`).join('');
  }

  const visor = document.createElement('dialog');
  visor.className = 'mapa-visor mapas-zona';
  document.body.append(visor);
  let actual = 0;
  const mostrar = (i) => {
    actual = (i + mapas.length) % mapas.length;
    const m = mapas[actual];
    visor.innerHTML = `<button type="button" class="mapa-visor-cerrar" data-visor="cerrar" aria-label="Cerrar">✕</button>
      <img src="${img(m.id)}" alt="${esc(m.nombre)}"><h3>${actual + 1}. ${esc(m.nombre)}</h3>${audio(m.narracion)}
      <p class="mapa-visor-desc">${esc(m.descripcion ?? m.resumen)}</p>
      ${m.elementos?.length ? `<ul class="mapa-visor-elementos">${m.elementos.map((t) => `<li>${esc(t)}</li>`).join('')}</ul>` : ''}
      <div class="mapa-visor-nav"><button type="button" data-visor="-1">‹ Anterior</button><button type="button" data-visor="1">Siguiente ›</button></div>`;
  };
  const tab = lista.closest('.tab-content') ?? document;
  tab.addEventListener('click', (ev) => {
    if (atenderNarracion(ev)) return;
    const paso = ev.target.closest('[data-escena]');
    if (paso) return moverEscena(paso);
    const ficha = ev.target.closest('[data-mapa]');
    if (!ficha || ficha.dataset.mapa === 'undefined') return;
    mostrar(Number(ficha.dataset.mapa));
    visor.showModal();
  });
  visor.addEventListener('click', (ev) => {
    if (atenderNarracion(ev)) return;
    const b = ev.target.closest('[data-visor]');
    if (ev.target === visor || b?.dataset.visor === 'cerrar') return visor.close();
    if (b) mostrar(actual + Number(b.dataset.visor));
  });
  visor.addEventListener('keydown', (ev) => {
    if (ev.key === 'ArrowRight') mostrar(actual + 1);
    if (ev.key === 'ArrowLeft') mostrar(actual - 1);
  });
}
