// Pestaña «Mapas»: libro de campañas (mapas/campanas.json) y catálogo de mapas de batalla (mapas/mapas.json).
// Libro: portada de campañas → prólogo, 4 capítulos (uno por mapa: ficha, llegada, pasos en orden, cierre) y epílogo.
// Imágenes en mapas/imagenes/<id>.webp; audios en mapas/narraciones/ (rutas en los campos `audio*` del JSON).
import { MEDALLON } from '../../../personajes/app/cartas.js';
import { atenderNarracion } from '../../../personajes/app/narracion.js';

const RAIZ = new URL('../../../mapas/', import.meta.url);
const V = '?v=12';
const ROMANOS = ['I', 'II', 'III', 'IV'];
const MONEDAS_EVENTOS = [5, 10, 15, 30];
const esc = (t) => String(t ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const img = (id) => new URL(`imagenes/${id}.webp${V}`, RAIZ).href;
const audio = (ruta) => (ruta ? MEDALLON(new URL(ruta + V, RAIZ).href) : '');
const leer = (archivo) => fetch(new URL(archivo + V, RAIZ)).then((r) => r.json());

// Texto para leer en voz alta, con su botón de audio
const lectura = (texto, ruta, etiqueta = 'Leer en voz alta') => (texto ? `<div class="lectura">
  <div class="lectura-cabecera"><span><i class="fa-solid fa-scroll"></i> ${etiqueta}</span>${audio(ruta)}</div><p>${esc(texto)}</p></div>` : '');

export async function initMapas() {
  const zonaLibro = document.getElementById('mapas-campanas');
  const zonaCatalogo = document.getElementById('mapas-catalogo');
  if (!zonaLibro || !zonaCatalogo) return;
  const [{ mapas, ambientes }, { campanas }] = await Promise.all([leer('mapas.json'), leer('campanas.json')]);
  const mapaDe = Object.fromEntries(mapas.map((m) => [m.id, m]));
  const raiz = zonaLibro.closest('.mapas-zona');

  // ---------- Libro de campañas ----------
  let campana = null; // índice de la campaña abierta
  let pagina = 0;     // 0 = prólogo, 1..n = capítulos, n+1 = epílogo
  const ultima = (c) => c.escenarios.length + 1;
  const nombreCap = (c, i) => (c.final ? 'Final' : ROMANOS[i]);

  const portada = () => `<div class="libro-portadas">${campanas.map((c, i) => `<button type="button" class="libro-portada${c.final ? ' portada-final' : ''}" data-abrir-campana="${i}">
    <span class="portada-mapas">${c.escenarios.map((e) => `<img src="${img(e.mapa)}" alt="" loading="lazy">`).join('')}</span>
    <span class="portada-texto"><small>${c.final ? 'Gran final' : `Campaña ${i + 1}`}</small><b>${esc(c.nombre)}</b><em>${esc(c.gancho)}</em>
    ${c.requisito ? `<span class="portada-requisito"><i class="fa-solid fa-lock"></i> ${esc(c.requisito)}</span>` : ''}<span class="portada-ruta">${c.escenarios.map((e) => esc(mapaDe[e.mapa]?.nombre)).join(' → ')}</span></span></button>`).join('')}</div>`;

  const indice = (c) => `<ol class="libro-indice">${['Prólogo', ...c.escenarios.map((e, i) => `${nombreCap(c, i)}. ${e.titulo}`), 'Epílogo']
    .map((t, i) => `<li><button type="button" data-pagina="${i}"${i === pagina ? ' class="actual" aria-current="page"' : ''}>${esc(t)}</button></li>`).join('')}</ol>`;

  const fichaFinal = (c) => `<ul class="capitulo-ficha">
    <li><i class="fa-solid fa-lock"></i><b>Requisito</b><span>${esc(c.requisito ?? 'Completar las cinco campañas')}</span></li>
    <li><i class="fa-solid fa-dragon"></i><b>Jefe final</b><span><span class="nivel nivel-7">Nivel 7</span></span></li>
    <li><i class="fa-solid fa-khanda"></i><b>Combates</b><span>${c.escenarios[0].pasos.filter((p) => p.combate).length}, el último contra la Hidra</span></li></ul>`;
  const ficha = (i) => `<ul class="capitulo-ficha">
    <li><i class="fa-solid fa-dragon"></i><b>Bestias</b><span><span class="nivel nivel-${i + 1}">Nivel ${i + 1}</span> <span class="nivel nivel-${i + 2}">Nivel ${i + 2}</span></span></li>
    <li><i class="fa-solid fa-khanda"></i><b>Combates</b><span>4 obligatorios, de 1–2 bestias</span></li>
    <li><i class="fa-solid fa-box-open"></i><b>Cofres</b><span>2 de nivel ${i + 1} + 2 de nivel ${i + 2}, al superar el mapa</span></li>
    <li><i class="fa-solid fa-coins"></i><b>Monedas de eventos</b><span>${MONEDAS_EVENTOS[i]} al terminar${i === 3 ? ', antes del jefe final' : ''}</span></li></ul>`;

  const paso = (p, k) => `<li class="paso">
    <div class="paso-num">${k + 1}</div>
    <div class="paso-cuerpo">
      <h5>${esc(p.titulo)}${p.jefe ? ' <span class="etiqueta-combate etiqueta-jefe"><i class="fa-solid fa-crown"></i> Jefe</span>' : p.combate ? ' <span class="etiqueta-combate"><i class="fa-solid fa-khanda"></i> Combate</span>' : ''}</h5>
      <p class="paso-meta"><span><i class="fa-solid fa-location-dot"></i> ${esc(p.lugar)}${p.ubicacion ? ` — ${esc(p.ubicacion)}` : ''}</span>
        ${p.cuando ? `<span><i class="fa-regular fa-clock"></i> ${esc(p.cuando)}</span>` : ''}</p>
      ${lectura(p.narracion, p.audio)}
      ${p.prueba ? `<p class="paso-dato prueba"><i class="fa-solid fa-dice-d20"></i> ${esc(p.prueba)}</p>` : ''}
      ${p.combate ? `<p class="paso-dato combate"><i class="fa-solid fa-khanda"></i> <b>${p.combate.enemigos.map(esc).join(' + ')}</b>${p.combate.nota ? ` · ${esc(p.combate.nota)}` : ''}</p>` : ''}
      ${p.pista ? `<p class="paso-dato pista"><i class="fa-solid fa-key"></i> <b>Pista:</b> ${esc(p.pista)}</p>` : ''}
    </div></li>`;

  const capitulo = (c, i) => {
    const e = c.escenarios[i];
    const m = mapaDe[e.mapa];
    const final = c.final;
    return `<header class="capitulo-cabecera">
      <button type="button" class="capitulo-mapa" data-ver-mapa="${esc(e.mapa)}" aria-label="Ver el mapa en grande"><img src="${img(e.mapa)}" alt="${esc(m?.nombre)}"><span><i class="fa-solid fa-magnifying-glass-plus"></i> Ver mapa</span></button>
      <div><p class="capitulo-num">${final ? 'Gran final' : `Capítulo ${ROMANOS[i]}`} · ${esc(m?.nombre)}</p><h3>${esc(e.titulo)}</h3>
      <p class="capitulo-objetivo"><i class="fa-solid fa-bullseye"></i> ${esc(e.objetivo)}</p>${final ? fichaFinal(c) : ficha(i)}</div></header>
      <section class="capitulo-seccion"><h4>Llegada</h4>${lectura(e.llegada, e.audio_llegada)}</section>
      <section class="capitulo-seccion"><h4>Desarrollo</h4><ol class="pasos">${e.pasos.map(paso).join('')}</ol></section>
      <section class="capitulo-seccion"><h4>${final || i === 3 ? 'Desenlace' : 'Cierre del capítulo'}</h4>${lectura(e.cierre, e.audio_cierre)}
      ${!final && i < 3 ? `<p class="capitulo-taberna"><i class="fa-solid fa-beer-mug-empty"></i> <b>De vuelta en la taberna:</b> el equipo recibe ${MONEDAS_EVENTOS[i]} monedas de eventos (al que menos tiene), abre los 4 cofres, los caídos vuelven con 1 PV y cada héroe compra al tabernero. La vida solo se recupera comiendo.</p>` : ''}</section>`;
  };

  const prologo = (c) => `<section class="capitulo-seccion"><h3 class="libro-titulo-pagina">Prólogo</h3>${lectura(c.introduccion, c.audio_introduccion)}
    ${c.villano ? `<div class="libro-villano"><i class="fa-solid fa-skull"></i><div><b>${esc(c.villano.nombre)}</b><p>${esc(c.villano.descripcion)}</p></div></div>` : ''}
    ${c.villano?.lugarteniente ? `<div class="libro-villano libro-lugarteniente"><i class="fa-solid fa-crown"></i><div><small>En las sombras · nivel 6</small><b>${esc(c.villano.lugarteniente.nombre)}</b><p>${esc(c.villano.lugarteniente.descripcion)}</p></div></div>` : ''}
    <h4>La ruta</h4><ol class="libro-ruta">${c.escenarios.map((e, i) => `<li><button type="button" data-pagina="${i + 1}">
      <img src="${img(e.mapa)}" alt="" loading="lazy"><span><small>${c.final ? 'Gran final' : `Capítulo ${ROMANOS[i]}`} · ${esc(mapaDe[e.mapa]?.nombre)}</small><b>${esc(e.titulo)}</b>
      ${c.final ? '<span class="nivel nivel-7">Nivel 7</span>' : `<span class="nivel nivel-${i + 1}">Nivel ${i + 1}–${i + 2}</span>`}</span></button></li>`).join('')}</ol></section>`;

  const epilogo = (c) => `<section class="capitulo-seccion"><h3 class="libro-titulo-pagina">Epílogo</h3>${lectura(c.epilogo, c.audio_epilogo)}</section>`;

  const etiquetaPagina = (c, i) => (i === 0 ? 'Prólogo' : i === ultima(c) ? 'Epílogo' : c.final ? 'Gran final' : `Capítulo ${ROMANOS[i - 1]}`);

  function dibujarLibro() {
    if (campana === null) { zonaLibro.innerHTML = portada(); return; }
    const c = campanas[campana];
    const cuerpo = pagina === 0 ? prologo(c) : pagina === ultima(c) ? epilogo(c) : capitulo(c, pagina - 1);
    zonaLibro.innerHTML = `<article class="libro">
      <header class="libro-cabecera"><button type="button" class="libro-volver" data-cerrar-campana><i class="fa-solid fa-arrow-left"></i> Todas las campañas</button>
        <h2>${esc(c.nombre)}</h2><p>${esc(c.gancho)}</p>${indice(c)}</header>
      <div class="libro-pagina">${cuerpo}</div>
      <footer class="libro-pie">
        <button type="button" data-pagina="${pagina - 1}"${pagina === 0 ? ' disabled' : ''}>‹ ${pagina > 0 ? etiquetaPagina(c, pagina - 1) : ''}</button>
        <span>${etiquetaPagina(c, pagina)}</span>
        <button type="button" data-pagina="${pagina + 1}"${pagina === ultima(c) ? ' disabled' : ''}>${pagina < ultima(c) ? etiquetaPagina(c, pagina + 1) : ''} ›</button>
      </footer></article>`;
  }

  // ---------- Catálogo de mapas ----------
  let filtro = 'todos';
  const usos = (id) => campanas.flatMap((c, ci) => c.escenarios.map((e, ei) => (e.mapa === id ? { ci, ei, c } : null)).filter(Boolean));

  function dibujarCatalogo() {
    document.getElementById('mapas-filtros').innerHTML = [['todos', 'Todos'], ...Object.entries(ambientes)]
      .map(([k, t]) => `<button type="button" data-filtro="${k}"${k === filtro ? ' class="activo"' : ''}>${esc(t)}</button>`).join('');
    zonaCatalogo.innerHTML = mapas.filter((m) => filtro === 'todos' || m.ambiente === filtro).map((m) => `<button type="button" class="mapa-ficha" data-ver-mapa="${m.id}">
      <img src="${img(m.id)}" alt="${esc(m.nombre)}" loading="lazy"><b>${esc(m.nombre)}</b><small>${esc(m.resumen)}</small>
      <span class="ficha-campanas">${usos(m.id).map((u) => `<i class="fa-solid fa-book-open"></i> ${esc(u.c.nombre)}`).join('<br>')}</span></button>`).join('');
  }

  // ---------- Visor de un mapa ----------
  const visor = document.createElement('dialog');
  visor.className = 'mapa-visor mapas-zona';
  document.body.append(visor);
  const verMapa = (id) => {
    const m = mapaDe[id];
    visor.innerHTML = `<button type="button" class="mapa-visor-cerrar" data-visor="cerrar" aria-label="Cerrar">✕</button>
      <img src="${img(m.id)}" alt="${esc(m.nombre)}"><h3>${esc(m.nombre)}</h3>${audio(m.narracion)}
      <p class="mapa-visor-desc">${esc(m.descripcion ?? m.resumen)}</p>
      ${m.elementos?.length ? `<ul class="mapa-visor-elementos">${m.elementos.map((t) => `<li>${esc(t)}</li>`).join('')}</ul>` : ''}
      ${usos(id).length ? `<div class="mapa-visor-usos">${usos(id).map((u) => `<button type="button" data-ir-capitulo="${u.ci},${u.ei}"><i class="fa-solid fa-book-open"></i> ${esc(u.c.nombre)} · ${u.c.final ? 'Gran final' : `Capítulo ${ROMANOS[u.ei]}`}</button>`).join('')}</div>` : ''}`;
    if (!visor.open) visor.showModal();
  };

  // ---------- Eventos ----------
  const mostrarVista = (v) => {
    raiz.querySelectorAll('[data-vista-mapas]').forEach((b) => b.classList.toggle('activa', b.dataset.vistaMapas === v));
    raiz.querySelectorAll('.mapas-vista').forEach((s) => { s.hidden = s.dataset.vista !== v; });
  };
  const irA = (ci, p) => { campana = ci; pagina = p; dibujarLibro(); mostrarVista('campanas'); zonaLibro.scrollIntoView({ behavior: 'smooth', block: 'start' }); };

  raiz.addEventListener('click', (ev) => {
    if (atenderNarracion(ev)) return;
    const b = ev.target.closest('button');
    if (!b) return;
    if (b.dataset.vistaMapas) return mostrarVista(b.dataset.vistaMapas);
    if (b.dataset.abrirCampana) return irA(Number(b.dataset.abrirCampana), 0);
    if (b.hasAttribute('data-cerrar-campana')) { campana = null; return dibujarLibro(); }
    if (b.dataset.pagina !== undefined) return irA(campana, Number(b.dataset.pagina));
    if (b.dataset.filtro) { filtro = b.dataset.filtro; return dibujarCatalogo(); }
    if (b.dataset.verMapa) return verMapa(b.dataset.verMapa);
  });
  visor.addEventListener('click', (ev) => {
    if (atenderNarracion(ev)) return;
    const b = ev.target.closest('button');
    if (ev.target === visor || b?.dataset.visor === 'cerrar') return visor.close();
    if (b?.dataset.irCapitulo) { const [ci, ei] = b.dataset.irCapitulo.split(',').map(Number); visor.close(); irA(ci, ei + 1); }
  });

  dibujarLibro();
  dibujarCatalogo();
}
