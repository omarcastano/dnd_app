// Pestaña «Mapas»: libro de campañas (mapas/campanas.json) y catálogo de mapas de batalla (mapas/mapas.json).
// Libro: portada de campañas → prólogo, 4 capítulos (uno por mapa: ficha, llegada, pasos en orden, cierre) y epílogo.
// Imágenes en mapas/imagenes/<id>.webp; audios en mapas/narraciones/ (rutas en los campos `audio*` del JSON).
import { MEDALLON } from '../../../personajes/app/cartas.js';
import { atenderNarracion } from '../../../personajes/app/narracion.js';
import { abrirEnigmaDeHistoria, cerrarEnigmaDeHistoria, nombreEnigma } from '../puzzles/api.js';

// Modo historia: intentos del equipo por enigma y aspecto (tema) del tablero según lo que representa
const INTENTOS = { mastermind: 8 };
const TEMAS = { cipher: 'libro', lightsout: 'runas', lightup: 'velas', hanoi: 'piedras', mastermind: 'cerradura',
  nonogram: 'tapiz', hitori: 'losas', tents: 'campamento', stars: 'cielo', galaxies: 'remolinos' };

const RAIZ = new URL('../../../mapas/', import.meta.url);
const V = '?v=22';
const ROMANOS = ['I', 'II', 'III', 'IV'];
const MONEDAS_EVENTOS = [5, 10, 15, 30];
const esc = (t) => String(t ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const img = (id) => new URL(`imagenes/${id}.webp${V}`, RAIZ).href;
const audio = (ruta) => (ruta ? MEDALLON(new URL(ruta + V, RAIZ).href) : '');
const leer = (archivo) => fetch(new URL(archivo + V, RAIZ)).then((r) => r.json());

const LETRAS = 'ABCDEFGHIJ';
const enEl = (o) => o && Number.isFinite(o.x) && Number.isFinite(o.y);
const pos = (o) => `left:${o.x}%;top:${o.y}%`;
const corto = (t, n = 26) => { const s = String(t ?? ''); return s.length > n ? `${s.slice(0, n - 1).trimEnd()}…` : s; };
const tipoPaso = (p) => (p.jefe ? 'jefe' : p.combate ? 'combate' : p.enigma ? 'enigma' : 'evento');
const rolClase = (q) => `rol-${esc((q.rol ?? '').replace(/\s+/g, '-'))}`;
const PROPORCION = 1200 / 896; // ancho/alto de las imágenes de mapas; se corrige al cargar cada imagen

// Ruta del plano en SVG con flechas que marcan el sentido del recorrido. El viewBox sigue la proporción
// de la imagen para que las flechas no se deformen (preserveAspectRatio="none").
function rutaSvg(ruta, ar = PROPORCION) {
  const pts = (ruta ?? []).filter((q) => Array.isArray(q) && q.length >= 2).map(([x, y]) => [x, y / ar]);
  if (pts.length < 2) return '';
  const flechas = [];
  for (let i = 1; i < pts.length; i++) {
    const [x0, y0] = pts[i - 1]; const [x1, y1] = pts[i];
    const largo = Math.hypot(x1 - x0, y1 - y0);
    if (largo < 4) continue;
    const ux = (x1 - x0) / largo; const uy = (y1 - y0) / largo;
    const mx = (x0 + x1) / 2; const my = (y0 + y1) / 2;
    const r = (v) => v.toFixed(2);
    // Punta de flecha: triángulo centrado en el punto medio del tramo
    flechas.push(`<polygon points="${r(mx + ux * 1.6)},${r(my + uy * 1.6)} ${r(mx - ux * 1.2 - uy * 1.3)},${r(my - uy * 1.2 + ux * 1.3)} ${r(mx - ux * 1.2 + uy * 1.3)},${r(my - uy * 1.2 - ux * 1.3)}"/>`);
  }
  return `<svg class="plano-ruta" viewBox="0 0 100 ${(100 / ar).toFixed(2)}" preserveAspectRatio="none" aria-hidden="true">
    <polyline points="${pts.map(([x, y]) => `${x},${y.toFixed(2)}`).join(' ')}"/><g class="plano-flechas">${flechas.join('')}</g></svg>`;
}
// Redibuja la ruta con la proporción real de la imagen en cuanto se conoce
function ajustarRutas(zona, ruta) {
  zona.querySelectorAll('.plano-lienzo').forEach((l) => {
    const im = l.querySelector('img');
    const svg = l.querySelector('.plano-ruta');
    if (!im || !svg) return;
    const trazar = () => { if (im.naturalWidth) svg.outerHTML = rutaSvg(ruta, im.naturalWidth / im.naturalHeight); };
    if (im.complete) trazar(); else im.addEventListener('load', trazar, { once: true });
  });
}

// Una marca del plano; `ref` enlaza la marca con su ficha del panel (resaltado mutuo)
const marca = (o, clase, contenido, titulo, etiqueta = '', ref = '') => `<span class="plano-marca ${clase}${o.x > 68 ? ' etiqueta-izq' : ''}" style="${pos(o)}"${ref ? ` data-plano-ref="${ref}"` : ''} title="${esc(titulo)}">${contenido}${etiqueta ? `<span class="plano-etiqueta">${esc(corto(etiqueta))}</span>` : ''}</span>`;

// Capas del plano. Base (siempre): ruta con flechas, entrada, salida y pasos numerados.
// Capa «llegada»: opciones de decision_llegada y personajes sin paso. Capa k (número): sus bestias,
// las opciones de su decisión y los personajes con paso = k. Las letras empiezan en A en cada capa.
function capasPlano(e, { capa = 'general', detalle = true } = {}) {
  const pl = e.plano ?? {};
  const marcas = [];
  if (enEl(pl.entrada)) marcas.push(marca(pl.entrada, 'marca-entrada', '<i class="fa-solid fa-flag"></i>', `Entrada: ${pl.entrada.texto ?? ''}`, detalle && capa === 'llegada' ? 'Entrada' : ''));
  if (enEl(pl.salida)) marcas.push(marca(pl.salida, 'marca-salida', '<i class="fa-solid fa-flag-checkered"></i>', `Salida: ${pl.salida.texto ?? ''}`));
  const k = typeof capa === 'number' ? capa : -1;
  e.pasos.forEach((p, i) => {
    if (!enEl(p)) return;
    const et = detalle ? 'button' : 'span';
    marcas.push(`<${et}${detalle ? ` type="button" data-plano-capa="${i}"` : ''} class="plano-marca marca-paso ${tipoPaso(p)}${i === k ? ' destacada' : ''}${k >= 0 && i !== k ? ' apagada' : ''}" style="${pos(p)}"${i === k ? ' data-plano-ref="paso"' : ''} title="${i + 1}. ${esc(p.titulo)}">${i + 1}${p.enigma ? '<i class="fa-solid fa-puzzle-piece"></i>' : ''}</${et}>`);
  });
  if (detalle) {
    const opciones = capa === 'llegada' ? e.decision_llegada?.opciones : k >= 0 ? e.pasos[k].decision?.opciones : null;
    (opciones ?? []).forEach((o, j) => { if (enEl(o)) marcas.push(marca(o, 'marca-opcion', LETRAS[j], `Opción ${LETRAS[j]}: ${o.opcion}`, o.opcion, `op-${j}`)); });
    if (k >= 0) (e.pasos[k].bestias ?? []).forEach((b, j) => { if (enEl(b)) marcas.push(marca(b, `marca-bestia${e.pasos[k].jefe ? ' jefe' : ''}`, `<i class="fa-solid fa-${e.pasos[k].jefe ? 'crown' : 'skull'}"></i>`, b.nombre, b.nombre, `be-${j}`)); });
    (e.personajes ?? []).forEach((q, j) => {
      const suyo = capa === 'llegada' ? !Number.isInteger(q.paso) : q.paso === k;
      if (suyo && enEl(q)) marcas.push(marca(q, `marca-pnj ${rolClase(q)}`, '<i class="fa-solid fa-user"></i>', `${q.nombre}: ${q.quien ?? ''}`, q.nombre, `pj-${j}`));
    });
  }
  return `${rutaSvg(pl.ruta)}${marcas.join('')}`;
}

// Texto para leer en voz alta, con su botón de audio
const lectura = (texto, ruta, etiqueta = 'Leer en voz alta') => (texto ? `<div class="lectura">
  <div class="lectura-cabecera"><span><i class="fa-solid fa-scroll"></i> ${etiqueta}</span>${audio(ruta)}</div><p>${esc(texto)}</p></div>` : '');

export async function initMapas() {
  const zonaLibro = document.getElementById('mapas-campanas');
  const zonaCatalogo = document.getElementById('mapas-catalogo');
  if (!zonaLibro || !zonaCatalogo) return;
  const [{ mapas, ambientes }, { campanas }, bestiario] = await Promise.all([leer('mapas.json'), leer('campanas.json'),
    fetch(new URL('../enemigos/enemigos.json' + V, RAIZ)).then((r) => r.json()).catch(() => ({ enemigos: [] }))]);
  const mapaDe = Object.fromEntries(mapas.map((m) => [m.id, m]));
  const raiz = zonaLibro.closest('.mapas-zona');

  // ---------- Libro de campañas ----------
  let campana = null; // índice de la campaña abierta
  let pagina = 0;     // 0 = prólogo, 1..n = capítulos, n+1 = epílogo
  const ultima = (c) => c.escenarios.length + 1;
  const nombreCap = (c, i) => (c.final ? 'Final' : ROMANOS[i]);

  const portada = () => `<div class="libro-portadas">${campanas.map((c, i) => `<button type="button" class="libro-portada${c.final ? ' portada-final' : ''}" data-abrir-campana="${i}">
    <span class="portada-mapas">${c.escenarios.map((e) => `<img src="${img(e.mapa)}" alt="" loading="lazy">`).join('')}</span>
    <span class="portada-texto"><small>${c.final ? 'Gran final' : `Campaña ${i + 1}`}${c.dificultad === 'alta' ? ' · <span class="portada-dificultad">Dificultad alta</span>' : ''}</small><b>${esc(c.nombre)}</b><em>${esc(c.gancho)}</em>
    ${c.requisito ? `<span class="portada-requisito"><i class="fa-solid fa-lock"></i> ${esc(c.requisito)}</span>` : ''}<span class="portada-ruta">${c.escenarios.map((e) => esc(mapaDe[e.mapa]?.nombre)).join(' → ')}</span></span></button>`).join('')}</div>`;

  const indice = (c) => `<ol class="libro-indice">${['Prólogo', ...c.escenarios.map((e, i) => `${nombreCap(c, i)}. ${e.titulo}`), 'Epílogo']
    .map((t, i) => `<li><button type="button" data-pagina="${i}"${i === pagina ? ' class="actual" aria-current="page"' : ''}>${esc(t)}</button></li>`).join('')}</ol>`;

  const fichaFinal = (c) => `<ul class="capitulo-ficha">
    <li><i class="fa-solid fa-lock"></i><b>Requisito</b><span>${esc(c.requisito ?? 'Completar las cinco campañas')}</span></li>
    <li><i class="fa-solid fa-dragon"></i><b>Jefe final</b><span><span class="nivel nivel-7">Nivel 7</span></span></li>
    <li><i class="fa-solid fa-khanda"></i><b>Combates</b><span>${c.escenarios[0].pasos.filter((p) => p.combate).length}, el último contra la Hidra</span></li></ul>`;
  const NIVEL_BESTIA = Object.fromEntries(bestiario.enemigos.map((b) => [b.id, b.nivel]));
  const ficha = (i, c) => `<ul class="capitulo-ficha">
    <li><i class="fa-solid fa-dragon"></i><b>Bestias</b><span><span class="nivel nivel-${i + 1}">Nivel ${i + 1}</span> <span class="nivel nivel-${i + 2}">Nivel ${i + 2}</span></span></li>
    <li><i class="fa-solid fa-khanda"></i><b>Combates</b><span>4 obligatorios, de 1–2 bestias</span></li>
    <li><i class="fa-solid fa-box-open"></i><b>Cofres</b><span>2 de nivel ${i + 1} + 2 de nivel ${i + 2}, al superar el mapa</span></li>
    <li><i class="fa-solid fa-coins"></i><b>Monedas de eventos</b><span>${MONEDAS_EVENTOS[i]} al terminar${i === 3 ? ', antes del jefe final' : ''}</span></li>
    ${i === 3 && c.villano ? `<li class="ficha-jefe"><i class="fa-solid fa-crown"></i><b>Jefe final</b><span>${esc(c.villano.nombre)} <span class="nivel nivel-${NIVEL_BESTIA[c.villano.bestia] ?? 6}">Nivel ${NIVEL_BESTIA[c.villano.bestia] ?? 6}</span></span></li>` : ''}</ul>`;

  const paso = (p, k) => `<li class="libro-paso">
    <div class="paso-num">${k + 1}</div>
    <div class="paso-cuerpo">
      <h5>${esc(p.titulo)}${p.jefe ? ' <span class="etiqueta-combate etiqueta-jefe"><i class="fa-solid fa-crown"></i> Jefe</span>' : p.combate ? ' <span class="etiqueta-combate"><i class="fa-solid fa-khanda"></i> Combate</span>' : ''}</h5>
      <p class="paso-meta"><span><i class="fa-solid fa-location-dot"></i> ${esc(p.lugar)}${p.ubicacion ? ` — ${esc(p.ubicacion)}` : ''}</span>
        ${p.cuando ? `<span><i class="fa-regular fa-clock"></i> ${esc(p.cuando)}</span>` : ''}</p>
      ${lectura(p.narracion, p.audio)}
      ${decision(p.decision, campanas[campana].escenarios[pagina - 1], k)}
      ${p.prueba ? `<p class="paso-dato prueba"><i class="fa-solid fa-dice-d20"></i> ${esc(p.prueba)}</p>` : ''}
      ${p.combate ? `<p class="paso-dato combate"><i class="fa-solid fa-khanda"></i> <b>${p.combate.enemigos.map(esc).join(' + ')}</b>${p.combate.nota ? ` · ${esc(p.combate.nota)}` : ''}</p>` : ''}
      ${p.enigma ? `<div class="paso-dato enigma"><i class="fa-solid fa-puzzle-piece"></i> <b>Enigma: ${esc(p.enigma.titulo ?? nombreEnigma(p.enigma.id))}</b> <small>(${esc(nombreEnigma(p.enigma.id) ?? p.enigma.id)})</small> · ${esc(p.enigma.recompensa ?? p.enigma.motivo)}
        <button type="button" class="boton-enigma" data-enigma="${esc(p.enigma.id)}" data-enigma-paso="${k}"><i class="fa-solid fa-hat-wizard"></i> Abrir enigma</button></div>` : ''}
      ${p.pista ? `<p class="paso-dato pista"><i class="fa-solid fa-key"></i> <b>Pista:</b> ${esc(p.pista)}</p>` : ''}
      ${p.despliegue ? `<p class="paso-dato despliegue"><i class="fa-solid fa-chess-board"></i> <b>Despliegue:</b> ${esc(p.despliegue)}</p>` : ''}
      ${`<button type="button" class="boton-ver-paso" data-ver-paso="${k}"><i class="fa-solid fa-map-location-dot"></i> Ver en el mapa</button>`}
    </div></li>`;

  const decision = (d, e, capa) => (d?.opciones?.length ? `<div class="decision">
    <p class="decision-pregunta"><i class="fa-solid fa-signs-post"></i> ${esc(d.pregunta ?? '¿Qué hacéis?')}</p>
    <ol class="decision-opciones">${d.opciones.map((o, j) => `<li>
      <span class="decision-letra">${LETRAS[j]}</span>
      <div><b>${esc(o.opcion)}</b>
        <span class="decision-destino ${Number.isInteger(o.paso) ? '' : 'desvio'}">${Number.isInteger(o.paso) ? `→ Paso ${o.paso + 1}: ${esc(e.pasos[o.paso]?.titulo)}` : '↯ Desvío'}</span>
        <p>${esc(o.que_pasa)}</p>
        <button type="button" class="boton-ver-paso" data-ver-paso="${capa}" data-ver-ref="op-${j}"><i class="fa-solid fa-map-location-dot"></i> Ver en el mapa</button></div></li>`).join('')}</ol>
    ${d.consejo ? `<p class="decision-consejo"><i class="fa-solid fa-hat-wizard"></i> <b>Para el máster:</b> ${esc(d.consejo)}</p>` : ''}</div>` : '');

  const pnj = (q) => `<article class="pnj rol-${esc((q.rol ?? '').replace(/\s+/g, '-'))}">
    <header><i class="fa-solid fa-user"></i><b>${esc(q.nombre)}</b><span class="pnj-rol">${esc(q.rol)}</span></header>
    <p>${esc(q.quien)}</p>
    ${q.como_interpretarlo ? `<p class="pnj-dato"><i class="fa-solid fa-masks-theater"></i> ${esc(q.como_interpretarlo)}</p>` : ''}
    ${q.que_sabe ? `<p class="pnj-dato"><i class="fa-solid fa-comment-dots"></i> ${esc(q.que_sabe)}</p>` : ''}
    ${Number.isInteger(q.paso) ? `<p class="pnj-dato"><i class="fa-solid fa-location-dot"></i> Aparece en el paso ${q.paso + 1}</p>` : ''}</article>`;

  const capitulo = (c, i) => {
    const e = c.escenarios[i];
    const m = mapaDe[e.mapa];
    const final = c.final;
    return `<header class="capitulo-cabecera">
      <button type="button" class="capitulo-mapa" data-ver-paso="-1" aria-label="Abrir el plano del capítulo"><span class="plano-lienzo"><img src="${img(e.mapa)}" alt="${esc(m?.nombre)}">${capasPlano(e, { detalle: false })}</span><span class="capitulo-mapa-boton"><i class="fa-solid fa-map-location-dot"></i> Abrir plano</span></button>
      <div><p class="capitulo-num">${final ? 'Gran final' : `Capítulo ${ROMANOS[i]}`} · ${esc(m?.nombre)}</p><h3>${esc(e.titulo)}</h3>
      <p class="capitulo-objetivo"><i class="fa-solid fa-bullseye"></i> ${esc(e.objetivo)}</p>${final ? fichaFinal(c) : ficha(i, c)}</div></header>
      ${e.personajes?.length ? `<section class="capitulo-seccion"><h4>Personajes de este capítulo</h4><div class="pnj-lista">${e.personajes.map(pnj).join('')}</div></section>` : ''}
      <section class="capitulo-seccion"><h4>Llegada</h4>${lectura(e.llegada, e.audio_llegada)}${decision(e.decision_llegada, e, 'llegada')}</section>
      <section class="capitulo-seccion"><h4>Desarrollo</h4><ol class="libro-pasos">${e.pasos.map(paso).join('')}</ol></section>
      <section class="capitulo-seccion"><h4>${final || i === 3 ? 'Desenlace' : 'Cierre del capítulo'}</h4>${lectura(e.cierre, e.audio_cierre)}
      ${!final && i < 3 ? `<p class="capitulo-taberna"><i class="fa-solid fa-beer-mug-empty"></i> <b>De vuelta en la taberna:</b> el equipo recibe ${MONEDAS_EVENTOS[i]} monedas de eventos (al que menos tiene), abre los 4 cofres, los caídos vuelven con 1 PV y cada héroe compra al tabernero. La vida solo se recupera comiendo.</p>` : ''}</section>`;
  };

  const prologo = (c) => `<section class="capitulo-seccion"><h3 class="libro-titulo-pagina">Prólogo</h3>${lectura(c.introduccion, c.audio_introduccion)}
    ${c.villano ? `<div class="libro-villano"><i class="fa-solid fa-skull"></i><div><small>Jefe final${NIVEL_BESTIA[c.villano.bestia] ? ` · nivel ${NIVEL_BESTIA[c.villano.bestia]}` : ''}</small><b>${esc(c.villano.nombre)}</b><p>${esc(c.villano.descripcion)}</p></div></div>` : ''}
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
    if (pagina > 0 && pagina < ultima(c)) ajustarRutas(zonaLibro, c.escenarios[pagina - 1].plano?.ruta);
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

  // ---------- Plano de un capítulo (por capas) ----------
  const plano = document.createElement('dialog');
  plano.className = 'plano-visor mapas-zona';
  plano.setAttribute('aria-label', 'Plano del capítulo');
  document.body.append(plano);
  let capaPlano = 'general';
  const escenarioActual = () => campanas[campana]?.escenarios[pagina - 1];
  const ordenCapas = (e) => ['general', 'llegada', ...e.pasos.map((_, k) => k)];
  const nombreCapa = (e, capa) => (capa === 'general' ? 'Vista general' : capa === 'llegada' ? 'Llegada' : `${capa + 1}. ${e.pasos[capa].titulo}`);
  const sinSitio = (o) => (enEl(o) ? '' : ' <small class="plano-sin-sitio">(sin sitio en el mapa)</small>');

  const opcionesPanel = (d, e) => (d?.opciones?.length ? `<section class="plano-bloque plano-decision">
    <h4><i class="fa-solid fa-signs-post"></i> ${esc(d.pregunta ?? '¿Qué hacéis?')}</h4>
    <ol class="plano-opciones">${d.opciones.map((o, j) => `<li data-plano-ref="op-${j}" tabindex="0">
      <span class="plano-letra">${LETRAS[j]}</span>
      <div><b>${esc(o.opcion)}</b>${sinSitio(o)}
        ${Number.isInteger(o.paso) ? `<button type="button" class="plano-destino" data-plano-capa="${o.paso}">→ Paso ${o.paso + 1}: ${esc(e.pasos[o.paso]?.titulo)}</button>` : '<span class="plano-destino desvio">↯ Desvío</span>'}
        ${o.que_pasa ? `<p>${esc(o.que_pasa)}</p>` : ''}</div></li>`).join('')}</ol>
    ${d.consejo ? `<p class="plano-consejo"><i class="fa-solid fa-hat-wizard"></i> <b>Para el máster:</b> ${esc(d.consejo)}</p>` : ''}</section>` : '');

  const personajesPanel = (e, suyo, titulo) => {
    const lista = (e.personajes ?? []).map((q, j) => [q, j]).filter(([q]) => suyo(q));
    return lista.length ? `<section class="plano-bloque"><h4><i class="fa-solid fa-user"></i> ${titulo}</h4>${lista.map(([q, j]) => `<article class="plano-pnj ${rolClase(q)}" data-plano-ref="pj-${j}" tabindex="0">
      <header><b>${esc(q.nombre)}</b>${q.rol ? `<span class="plano-rol">${esc(q.rol)}</span>` : ''}${sinSitio(q)}</header>
      ${q.quien ? `<p>${esc(q.quien)}</p>` : ''}
      ${q.como_interpretarlo ? `<p><i class="fa-solid fa-masks-theater"></i> ${esc(q.como_interpretarlo)}</p>` : ''}
      ${q.que_sabe ? `<p><i class="fa-solid fa-comment-dots"></i> ${esc(q.que_sabe)}</p>` : ''}</article>`).join('')}</section>` : '';
  };

  const panelGeneral = (e) => {
    const pl = e.plano ?? {};
    return `<ul class="plano-claves">
      <li><span class="marca-mini entrada"><i class="fa-solid fa-flag"></i></span> <b>Entrada</b>${pl.entrada?.texto ? `: ${esc(pl.entrada.texto)}` : ''}</li>
      <li><span class="marca-mini salida"><i class="fa-solid fa-flag-checkered"></i></span> <b>Salida</b>${pl.salida?.texto ? `: ${esc(pl.salida.texto)}` : ''}</li>
      <li><span class="marca-mini ruta"></span> Recorrido: las flechas marcan el sentido</li></ul>
      <p class="plano-ayuda">Elige una capa arriba (o usa ← →) para ver solo lo de ese momento: las opciones al llegar, o las bestias, decisiones y personajes de cada paso.</p>
      <ol class="plano-pasos">${e.pasos.map((p, k) => `<li><button type="button" data-plano-capa="${k}">
        <span class="leyenda-num ${tipoPaso(p)}">${k + 1}</span><span><b>${esc(p.titulo)}</b><small>${esc(p.lugar)}${p.cuando ? ` · ${esc(p.cuando)}` : ''}</small></span></button></li>`).join('')}</ol>`;
  };

  const panelLlegada = (e) => `${e.plano?.entrada?.texto ? `<p class="plano-dato"><i class="fa-solid fa-flag"></i> <b>Entrada:</b> ${esc(e.plano.entrada.texto)}</p>` : ''}
    ${opcionesPanel(e.decision_llegada, e) || '<p class="plano-ayuda">Este capítulo no tiene decisión al llegar.</p>'}
    ${personajesPanel(e, (q) => !Number.isInteger(q.paso), 'Personajes del capítulo')}`;

  const panelPaso = (e, k) => {
    const p = e.pasos[k];
    return `<p class="plano-meta"><span><i class="fa-solid fa-location-dot"></i> ${esc(p.lugar)}${p.ubicacion ? ` — ${esc(p.ubicacion)}` : ''}</span>
        ${p.cuando ? `<span><i class="fa-regular fa-clock"></i> ${esc(p.cuando)}</span>` : ''}${enEl(p) ? '' : ' <small class="plano-sin-sitio">(sin sitio en el mapa)</small>'}</p>
      ${p.combate ? `<section class="plano-bloque plano-combate"><h4><i class="fa-solid fa-${p.jefe ? 'crown' : 'khanda'}"></i> ${p.jefe ? 'Jefe' : 'Combate'}</h4>
        <ul class="plano-bestias">${(p.bestias?.length ? p.bestias : p.combate.enemigos.map((nombre) => ({ nombre }))).map((b, j) => `<li data-plano-ref="be-${j}" tabindex="0"><i class="fa-solid fa-${p.jefe ? 'crown' : 'skull'}"></i> ${esc(b.nombre)}${sinSitio(b)}</li>`).join('')}</ul>
        ${p.combate.nota ? `<p>${esc(p.combate.nota)}</p>` : ''}
        ${p.despliegue ? `<p><i class="fa-solid fa-chess-board"></i> <b>Despliegue:</b> ${esc(p.despliegue)}</p>` : ''}</section>`
        : p.despliegue ? `<p class="plano-dato"><i class="fa-solid fa-chess-board"></i> <b>Despliegue:</b> ${esc(p.despliegue)}</p>` : ''}
      ${p.prueba ? `<p class="plano-dato"><i class="fa-solid fa-dice-d20"></i> <b>Prueba:</b> ${esc(p.prueba)}</p>` : ''}
      ${p.enigma ? `<section class="plano-bloque plano-enigma"><h4><i class="fa-solid fa-puzzle-piece"></i> Enigma: ${esc(p.enigma.titulo ?? nombreEnigma(p.enigma.id))}</h4>
        <p><small>(${esc(nombreEnigma(p.enigma.id) ?? p.enigma.id)})</small> ${esc(p.enigma.recompensa ?? p.enigma.motivo)}</p>
        <button type="button" class="boton-enigma" data-enigma="${esc(p.enigma.id)}" data-enigma-paso="${k}"><i class="fa-solid fa-hat-wizard"></i> Abrir enigma</button></section>` : ''}
      ${p.pista ? `<p class="plano-dato"><i class="fa-solid fa-key"></i> <b>Pista:</b> ${esc(p.pista)}</p>` : ''}
      ${opcionesPanel(p.decision, e)}
      ${personajesPanel(e, (q) => q.paso === k, 'Personajes en este paso')}`;
  };

  const verPlano = (capa = 'general', ref = '') => {
    const c = campanas[campana];
    const e = escenarioActual();
    if (!e) return;
    capaPlano = ordenCapas(e).includes(capa) ? capa : 'general';
    const capas = ordenCapas(e);
    plano.innerHTML = `<button type="button" class="mapa-visor-cerrar" data-plano="cerrar" aria-label="Cerrar">✕</button>
      <div class="plano-cuerpo">
        <div class="plano-zona-mapa">
          <nav class="plano-capas" aria-label="Capas del plano">${capas.map((k) => {
            const p = typeof k === 'number' ? e.pasos[k] : null;
            return `<button type="button" data-plano-capa="${k}" class="${p ? `capa-paso ${tipoPaso(p)}` : ''}${k === capaPlano ? ' actual' : ''}"${k === capaPlano ? ' aria-current="true"' : ''} title="${esc(nombreCapa(e, k))}">${p ? k + 1 : k === 'general' ? '<i class="fa-solid fa-map"></i> General' : '<i class="fa-solid fa-signs-post"></i> Llegada'}</button>`;
          }).join('')}</nav>
          <p class="plano-capa-titulo">${esc(nombreCapa(e, capaPlano))} <small>← → para cambiar de capa</small></p>
          <div class="plano-lienzo grande capa-${typeof capaPlano === 'number' ? 'paso' : capaPlano}"><img src="${img(e.mapa)}" alt="${esc(mapaDe[e.mapa]?.nombre)}">${capasPlano(e, { capa: capaPlano })}</div>
        </div>
        <aside class="plano-leyenda">
          <p class="capitulo-num">${esc(c.nombre)} · ${c.final ? 'Gran final' : `Capítulo ${ROMANOS[pagina - 1]}`}</p><h3>${esc(e.titulo)}</h3>
          <h4 class="plano-capa-nombre">${esc(nombreCapa(e, capaPlano))}</h4>
          ${capaPlano === 'general' ? panelGeneral(e) : capaPlano === 'llegada' ? panelLlegada(e) : panelPaso(e, capaPlano)}
        </aside></div>`;
    ajustarRutas(plano, e.plano?.ruta);
    if (!plano.open) plano.showModal();
    plano.querySelector('.plano-capas .actual')?.focus({ preventScroll: true });
    if (ref) resaltar(ref, true);
  };
  const resaltar = (ref, si) => plano.querySelectorAll(`[data-plano-ref="${ref}"]`).forEach((el) => el.classList.toggle('plano-resaltada', si));
  const capaDe = (v) => (v === 'llegada' ? v : v === 'general' || Number(v) < 0 ? 'general' : Number(v)); // -1 = vista general
  // Abre el puzzle en la pestaña Enigmas con un pergamino que cuenta qué representa en la historia
  const abrirEnigma = (id, paso) => {
    const c = campanas[campana];
    const e = c?.escenarios[pagina - 1];
    const en = e?.pasos[paso]?.enigma;
    plano.open && plano.close();
    document.querySelector('.tab-btn[data-tab="puzzles"]')?.click();
    abrirEnigmaDeHistoria(id, {
      historia: en ? { intentos: en.intentos ?? INTENTOS[id] ?? 3, tema: en.tema ?? TEMAS[id], mensaje: en.mensaje } : null,
      pergamino: en ? `<aside class="enigma-historia mapas-zona">
        <p class="enigma-historia-origen"><i class="fa-solid fa-book-open"></i> ${esc(c.nombre)} · ${c.final ? 'Gran final' : `Capítulo ${ROMANOS[pagina - 1]}`}</p>
        <h3>${esc(en.titulo ?? nombreEnigma(id))}</h3>
        ${en.contexto ? `<p class="enigma-historia-texto">${esc(en.contexto)}</p>` : ''}
        ${en.recompensa ? `<p><i class="fa-solid fa-trophy"></i> <b>Si lo resolvéis:</b> ${esc(en.recompensa)}</p>` : ''}
        ${en.fallo ? `<p><i class="fa-solid fa-skull"></i> <b>Si os rendís:</b> ${esc(en.fallo)}</p>` : ''}
        <button type="button" class="boton-volver-libro" data-volver-libro><i class="fa-solid fa-arrow-left"></i> Volver al libro</button></aside>` : '',
    });
    document.getElementById('tab-puzzles')?.scrollIntoView({ behavior: 'smooth' });
  };
  document.addEventListener('click', (ev) => {
    if (ev.target.closest('[data-volver-libro]')) {
      cerrarEnigmaDeHistoria({ cerrarVista: true });
      document.querySelector('.tab-btn[data-tab="mapas"]')?.click();
      zonaLibro.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } else if (ev.target.closest('[data-cerrar-puzzle]')) cerrarEnigmaDeHistoria();
  });
  plano.addEventListener('click', (ev) => {
    const b = ev.target.closest('button');
    if (ev.target === plano || b?.dataset.plano === 'cerrar') return plano.close();
    if (b?.dataset.enigma) return abrirEnigma(b.dataset.enigma, Number(b.dataset.enigmaPaso));
    if (b?.dataset.planoCapa !== undefined) verPlano(capaDe(b.dataset.planoCapa));
  });
  plano.addEventListener('keydown', (ev) => {
    if (ev.key !== 'ArrowRight' && ev.key !== 'ArrowLeft') return;
    if (ev.target.closest('input, textarea, select')) return;
    const capas = ordenCapas(escenarioActual());
    const i = capas.indexOf(capaPlano) + (ev.key === 'ArrowRight' ? 1 : -1);
    ev.preventDefault();
    verPlano(capas[(i + capas.length) % capas.length]);
  });
  // Resaltado mutuo marca ↔ ficha del panel
  for (const [tipo, si] of [['mouseover', true], ['mouseout', false], ['focusin', true], ['focusout', false]]) {
    plano.addEventListener(tipo, (ev) => { const el = ev.target.closest('[data-plano-ref]'); if (el) resaltar(el.dataset.planoRef, si); });
  }

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
    if (b.dataset.verPaso !== undefined) return verPlano(capaDe(b.dataset.verPaso), b.dataset.verRef);
    if (b.dataset.enigma) return abrirEnigma(b.dataset.enigma, Number(b.dataset.enigmaPaso));
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
