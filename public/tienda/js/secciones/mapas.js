// Pestaña «Mapas»: libro de campañas (mapas/campanas.json) y catálogo de mapas de batalla (mapas/mapas.json).
// Libro: portada de campañas → prólogo, 4 capítulos (uno por mapa: ficha, llegada, pasos en orden, cierre) y epílogo.
// Imágenes en mapas/imagenes/<id>.webp; audios en mapas/narraciones/ (rutas en los campos `audio*` del JSON).
import { MEDALLON } from '../../../personajes/app/cartas.js';
import { atenderNarracion } from '../../../personajes/app/narracion.js?v=2';
import { abrirEnigmaDeHistoria, cerrarEnigmaDeHistoria, nombreEnigma } from '../puzzles/api.js?v=2';

// Modo historia: intentos del equipo por enigma y aspecto (tema) del tablero según lo que representa
const INTENTOS = { mastermind: 8 };
const TEMAS = { cipher: 'libro', lightsout: 'runas', lightup: 'velas', hanoi: 'piedras', mastermind: 'cerradura',
  nonogram: 'tapiz', hitori: 'losas', tents: 'campamento', stars: 'cielo', galaxies: 'remolinos' };

const RAIZ = new URL('../../../mapas/', import.meta.url);
const V = '?v=35';
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
// `camino` (recorrido de la capa): lo ya elegido se marca con huellas y solo se ven las opciones de la decisión abierta.
function capasPlano(e, { capa = 'general', detalle = true, camino = null, extra = '' } = {}) {
  const pl = e.plano ?? {};
  const marcas = [];
  if (enEl(pl.entrada)) marcas.push(marca(pl.entrada, 'marca-entrada', '<i class="fa-solid fa-flag"></i>', `Entrada: ${pl.entrada.texto ?? ''}`, detalle && capa === 'llegada' ? 'Entrada' : ''));
  if (enEl(pl.salida)) marcas.push(marca(pl.salida, 'marca-salida', '<i class="fa-solid fa-flag-checkered"></i>', `Salida: ${pl.salida.texto ?? ''}`));
  const k = typeof capa === 'number' ? capa : -1;
  (e.pasos ?? []).forEach((p, i) => {
    if (!enEl(p)) return;
    const et = detalle ? 'button' : 'span';
    marcas.push(`<${et}${detalle ? ` type="button" data-plano-capa="${i}"` : ''} class="plano-marca marca-paso ${tipoPaso(p)}${i === k ? ' destacada' : ''}${k >= 0 && i !== k ? ' apagada' : ''}" style="${pos(p)}"${i === k ? ' data-plano-ref="paso"' : ''} title="${i + 1}. ${esc(p.titulo)}">${i + 1}${p.enigma ? '<i class="fa-solid fa-puzzle-piece"></i>' : ''}</${et}>`);
  });
  if (detalle) {
    (camino?.tramos ?? []).forEach((t, n, todos) => {
      if (!enEl(t.o)) return;
      const ultima = n === todos.length - 1 && !camino.abierta;
      marcas.push(marca(t.o, `marca-opcion ${ultima ? 'plano-elegida' : 'plano-recorrida'}`, ultima ? LETRAS[t.j] : '<i class="fa-solid fa-shoe-prints"></i>', `Elegido: ${t.o.opcion}`, ultima ? t.o.opcion : ''));
    });
    (camino?.abierta?.opciones ?? []).forEach((o, j) => { if (enEl(o)) marcas.push(marca(o, 'marca-opcion', LETRAS[j], `Opción ${LETRAS[j]}: ${o.opcion}`, o.opcion, `op-${j}`)); });
    if (k >= 0 && e.pasos?.[k]) (e.pasos[k].bestias ?? []).forEach((b, j) => { if (enEl(b)) marcas.push(marca(b, `marca-bestia${e.pasos[k].jefe ? ' jefe' : ''}`, `<i class="fa-solid fa-${e.pasos[k].jefe ? 'crown' : 'skull'}"></i>`, b.nombre, b.nombre, `be-${j}`)); });
    (e.personajes ?? []).forEach((q, j) => {
      const suyo = capa === 'llegada' ? !Number.isInteger(q.paso) : q.paso === k;
      if (suyo && enEl(q)) marcas.push(marca(q, `marca-pnj ${rolClase(q)}`, '<i class="fa-solid fa-user"></i>', `${q.nombre}: ${q.quien ?? ''}`, q.nombre, `pj-${j}`));
    });
  }
  return `${rutaSvg(pl.ruta)}${marcas.join('')}${extra}`;
}

// Texto para leer en voz alta, con su botón de audio
const lectura = (texto, ruta, etiqueta = 'Leer en voz alta') => (texto ? `<div class="lectura">
  <div class="lectura-cabecera"><span><i class="fa-solid fa-scroll"></i> ${etiqueta}</span>${audio(ruta)}</div><p>${esc(texto)}</p></div>` : '');

// Elecciones de las decisiones, recordadas en este dispositivo (si no hay localStorage, no se recuerdan)
const leerGuardado = (clave) => { try { const v = localStorage.getItem(clave); return v === null ? null : JSON.parse(v); } catch { return null; } };
const guardar = (clave, valor) => { try { localStorage.setItem(clave, JSON.stringify(valor)); } catch {} };
const olvidar = (clave) => { try { localStorage.removeItem(clave); } catch {} };
const sinMovimiento = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

// Paso al que seguir tras una opción: el suyo; si es desvío, el que cite `que_pasa` («paso N») o el de la primera opción con paso
function pasoSiguiente(o, d, e) {
  if (Number.isInteger(o.paso)) return o.paso;
  const n = Number(/paso\s+(\d+)/i.exec(o.que_pasa ?? '')?.[1]) - 1;
  if (Number.isInteger(n) && e.pasos[n]) return n;
  const otra = d.opciones.find((x) => Number.isInteger(x.paso));
  return otra ? otra.paso : null;
}

// Decisión que sigue a una opción: `luego` en línea ({ pregunta, opciones, consejo }) o el id de una decisión
// con nombre de `e.decisiones` (así varias opciones pueden llevar a la misma, o volver a una anterior)
const decisionLuego = (o, e) => (typeof o?.luego === 'string' ? e.decisiones?.[o.luego] : o?.luego) ?? null;
// Recorre las elecciones guardadas desde la decisión raíz: tramos ya elegidos y la decisión abierta (null = fin del recorrido)
function recorrer(d0, elecciones, e) {
  const tramos = [];
  let d = d0;
  for (const j of elecciones) {
    const o = d?.opciones?.[j];
    if (!o) break;
    tramos.push({ d, j, o });
    d = decisionLuego(o, e);
    if (!d?.opciones?.length) { d = null; break; }
  }
  return { tramos, abierta: d };
}

// ---------- Aventura por escenas (capítulos con `escenas`) ----------
// Cada escena: narración → (combate: «Combate ganado» → `despues`) → pregunta y opciones que llevan a otra escena
// (`va_a`), o `sigue` (sin elección: p. ej. una emboscada que lleva al combate) o `fin`. Las escenas visitadas y sus
// `marca` forman el estado del grupo; cada opción se ve solo si cumple `si` (todas) y ninguna de `salvo`.
// Una entrada `{ comunes: id, si, salvo }` dentro de la lista mete ahí las opciones comunes (sumando sus `si`/`salvo`);
// al mostrar, una común que va al mismo sitio que otra opción ya visible no se repite (las propias de la escena van antes).
const opcionesEscena = (e, s) => {
  const ref = typeof s.opciones === 'string' ? e.opciones_comunes?.[s.opciones] : null;
  const lista = (ref ? ref.opciones : (s.opciones ?? [])).flatMap((o) => (o.comunes
    ? (e.opciones_comunes?.[o.comunes]?.opciones ?? []).map((c) => ({ ...c, si: [...(c.si ?? []), ...(o.si ?? [])], salvo: [...(c.salvo ?? []), ...(o.salvo ?? [])], comun: true }))
    : [o]));
  return { pregunta: s.pregunta ?? ref?.pregunta ?? '¿Qué hacéis?', lista };
};
const marcasDe = (e, pasos) => {
  const m = new Set();
  for (const p of pasos) { m.add(p.e); (e.escenas[p.e]?.marca ?? []).forEach((x) => m.add(x)); }
  return m;
};
const opcionVisible = (o, m) => (o.si ?? []).every((x) => m.has(x)) && !(o.salvo ?? []).some((x) => m.has(x));

export async function initMapas() {
  const zonaLibro = document.getElementById('mapas-campanas');
  const zonaCatalogo = document.getElementById('mapas-catalogo');
  if (!zonaLibro || !zonaCatalogo) return;
  const [{ mapas, ambientes }, { campanas }, bestiario] = await Promise.all([leer('mapas.json'), leer('campanas.json'),
    fetch(new URL('../enemigos/enemigos.json' + V, RAIZ)).then((r) => r.json()).catch(() => ({ enemigos: [] }))]);
  // Un capítulo puede tener su guion aparte (`guion`: escenas, opciones, estados… en mapas/guiones/<campaña>-<n>.json):
  // se carga y se mezcla con la ficha de campanas.json, así el guion es la única fuente de la historia.
  await Promise.all(campanas.flatMap((c) => c.escenarios.filter((e) => e.guion)
    .map((e) => leer(e.guion).then((g) => { const { _acerca, ...resto } = g; Object.assign(e, resto); }).catch(() => {}))));
  const mapaDe = Object.fromEntries(mapas.map((m) => [m.id, m]));
  const raiz = zonaLibro.closest('.mapas-zona');

  // ---------- Libro de campañas ----------
  let campana = null; // índice de la campaña abierta
  let pagina = 0;     // 0 = prólogo, 1..n = capítulos, n+1 = epílogo
  const ultima = (c) => c.escenarios.length + 1;
  const nombreCap = (c, i) => (c.final ? 'Final' : ROMANOS[i]);
  // Recorrido de cada decisión (lista de índices elegidos, uno por nivel), recordado en este dispositivo.
  // Compatibilidad: la clave antigua `eleccion` guardaba un solo índice.
  const claveDe = (capa, tipo) => `taberna:mapas:${campanas[campana]?.id ?? campana}:${pagina}:${capa}:${tipo}`;
  const elecciones = (capa) => {
    const r = leerGuardado(claveDe(capa, 'recorrido'));
    if (Array.isArray(r)) return r.filter(Number.isInteger);
    const j = leerGuardado(claveDe(capa, 'eleccion'));
    return Number.isInteger(j) ? [j] : [];
  };
  const fijarElecciones = (capa, lista) => {
    olvidar(claveDe(capa, 'eleccion'));
    if (lista.length) guardar(claveDe(capa, 'recorrido'), lista); else olvidar(claveDe(capa, 'recorrido'));
  };
  const decisionDe = (e, capa) => (capa === 'llegada' ? e.decision_llegada : e.pasos[capa]?.decision);
  const caminoDe = (e, capa) => (capa === 'general' ? null : recorrer(decisionDe(e, capa), elecciones(capa), e));

  // Destino de una opción, en pequeño: abre otra decisión, va a un paso o es un desvío que reconduce
  const destinoDe = (o, d, e) => {
    if (decisionLuego(o, e)) return { clase: 'sigue', texto: '⤷ Nueva decisión' };
    if (Number.isInteger(o.paso)) return { clase: '', texto: `→ Paso ${o.paso + 1}: ${e.pasos[o.paso]?.titulo ?? ''}` };
    const k = pasoSiguiente(o, d, e);
    return { clase: 'desvio', texto: `↯ Desvío${k === null ? '' : ` → Paso ${k + 1}`}` };
  };

  // Recorrido de una decisión (libro y plano). Arriba, lo ya elegido como una línea de tiempo (pregunta, opción,
  // narración para leer y nota del máster, con «Cambiar» para volver a elegir ahí). Abajo, la decisión abierta con
  // todas sus opciones; o, si el recorrido terminó, el botón para seguir al paso que toca.
  const recorridoHtml = (d0, e, capa, pre) => {
    if (!d0?.opciones?.length) return '';
    const { tramos, abierta } = recorrer(d0, elecciones(capa), e);
    const hechas = new Set(tramos.map((t) => t.o));
    const ver = (j) => (pre === 'libro' ? `<button type="button" class="boton-ver-paso" data-ver-paso="${capa}" data-ver-ref="op-${j}"><i class="fa-solid fa-map-location-dot"></i> Ver en el mapa</button>` : '');
    const tramo = (t, n) => `<li class="${pre}-tramo">
      <p class="${pre}-tramo-pregunta"><i class="fa-solid fa-signs-post"></i> ${esc(t.d.pregunta ?? '¿Qué hacéis?')}
        <button type="button" class="${pre}-cambiar" data-volver-a="${capa},${n}" title="Volver a esta decisión y elegir otra cosa"><i class="fa-solid fa-pen"></i> Cambiar</button></p>
      <p class="${pre}-tramo-eleccion"><span class="${pre}-tramo-letra">${LETRAS[t.j]}</span> <b>${esc(t.o.opcion)}</b></p>
      ${t.o.narracion ? lectura(t.o.narracion, t.o.audio) : ''}
      ${t.o.que_pasa ? `<p class="${pre}-nota-master"><i class="fa-solid fa-hat-wizard"></i> <b>Para el máster:</b> ${esc(t.o.que_pasa)}</p>` : ''}</li>`;
    const opciones = (d, n) => `<ol class="${pre === 'libro' ? 'decision-opciones' : 'plano-opciones'}">${d.opciones.map((o, j) => {
      const dest = destinoDe(o, d, e);
      const hecha = hechas.has(o) ? ` <span class="${pre}-ya-hecha" title="Ya la eligieron antes en este recorrido"><i class="fa-solid fa-shoe-prints"></i> Ya fueron</span>` : '';
      return `<li${pre === 'plano' ? ` data-plano-ref="op-${j}"` : ''}><span class="${pre === 'libro' ? 'decision-letra' : 'plano-letra'}">${LETRAS[j]}</span>
        <div><button type="button" class="${pre}-opcion-elegir" data-elegir="${capa},${n},${j}" title="Marcar lo que eligen los jugadores"><b>${esc(o.opcion)}</b></button>${hecha}${pre === 'plano' ? sinSitio(o) : ''}
          <span class="${pre}-destino ${dest.clase}">${esc(dest.texto)}</span>
          ${o.que_pasa ? `<p>${esc(o.que_pasa)}</p>` : ''}${ver(j)}</div></li>`;
    }).join('')}</ol>`;
    const botones = (extra = '') => (tramos.length || extra ? `<div class="${pre}-resultado-botones">${extra}${tramos.length ? `
      <button type="button" class="${pre}-reiniciar" data-deshacer="${capa}"><i class="fa-solid fa-arrow-rotate-left"></i> Deshacer la última</button>
      <button type="button" class="${pre}-reiniciar" data-reiniciar-eleccion="${capa}"><i class="fa-solid fa-rotate-left"></i> Reiniciar</button>` : ''}</div>` : '');
    let final = '';
    if (abierta) {
      final = `<div class="${pre}-abierta">
        <p class="${pre === 'libro' ? 'decision-pregunta' : 'plano-pregunta'}"><i class="fa-solid fa-signs-post"></i> ${tramos.length ? '<small>Y ahora…</small> ' : ''}${esc(abierta.pregunta ?? '¿Qué hacéis?')}</p>
        ${opciones(abierta, tramos.length)}
        ${abierta.consejo ? `<p class="${pre === 'libro' ? 'decision-consejo' : 'plano-consejo'}"><i class="fa-solid fa-hat-wizard"></i> <b>Para el máster:</b> ${esc(abierta.consejo)}</p>` : ''}
        ${botones()}</div>`;
    } else {
      const { d, o } = tramos.at(-1);
      const k = pasoSiguiente(o, d, e);
      const seguir = k === null ? '' : pre === 'plano'
        ? `<button type="button" class="plano-continuar" data-plano-capa="${k}"><i class="fa-solid fa-arrow-right"></i> Continuar: Paso ${k + 1} — ${esc(e.pasos[k]?.titulo)}</button>`
        : `<button type="button" class="libro-continuar" data-ir-paso="${k}"><i class="fa-solid fa-arrow-right"></i> Continuar: Paso ${k + 1} — ${esc(e.pasos[k]?.titulo)}</button>`;
      final = `<div class="${pre}-fin">
        ${Number.isInteger(o.paso) ? '' : `<p class="${pre}-nota-desvio"><i class="fa-solid fa-route"></i> <b>Desvío:</b> después, reconduce al camino.</p>`}
        ${botones(seguir)}</div>`;
    }
    return `${tramos.length ? `<ol class="${pre}-camino" aria-label="Lo que han elegido">${tramos.map(tramo).join('')}</ol>` : ''}<div aria-live="polite">${final}</div>`;
  };

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

  const decision = (d, e, capa) => (d?.opciones?.length
    ? `<div class="decision${elecciones(capa).length ? ' libro-con-eleccion' : ''}" data-decision="${capa}">${recorridoHtml(d, e, capa, 'libro')}</div>` : '');
  // Vuelve a dibujar solo los cuadros de decisión del capítulo (sin perder el scroll)
  const refrescarDecisiones = () => {
    const e = escenarioActual();
    if (!e) return;
    zonaLibro.querySelectorAll('[data-decision]').forEach((el) => {
      const capa = el.dataset.decision === 'llegada' ? 'llegada' : Number(el.dataset.decision);
      el.outerHTML = decision(decisionDe(e, capa), e, capa);
    });
  };
  const irAPaso = (k) => {
    const el = zonaLibro.querySelectorAll('.libro-paso')[k];
    if (!el) return;
    el.scrollIntoView({ behavior: sinMovimiento() ? 'auto' : 'smooth', block: 'start' });
    el.classList.remove('libro-paso-resaltado');
    void el.offsetWidth;
    el.classList.add('libro-paso-resaltado');
    setTimeout(() => el.classList.remove('libro-paso-resaltado'), 2200);
  };

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
    const cabecera = `<header class="capitulo-cabecera">
      <button type="button" class="capitulo-mapa" data-ver-paso="-1" aria-label="Abrir el plano del capítulo"><span class="plano-lienzo"><img src="${img(e.mapa)}" alt="${esc(m?.nombre)}">${capasPlano(e, { detalle: false })}</span><span class="capitulo-mapa-boton"><i class="fa-solid fa-map-location-dot"></i> Abrir plano</span></button>
      <div><p class="capitulo-num">${final ? 'Gran final' : `Capítulo ${ROMANOS[i]}`} · ${esc(m?.nombre)}</p><h3>${esc(e.titulo)}</h3>
      <p class="capitulo-objetivo"><i class="fa-solid fa-bullseye"></i> ${esc(e.objetivo)}</p>${final ? fichaFinal(c) : ficha(i, c)}</div></header>`;
    if (e.escenas) {
      return `${cabecera}
      ${e.personajes?.length ? `<details class="capitulo-seccion aventura-pnj"><summary><i class="fa-solid fa-user"></i> Personajes de este capítulo (${e.personajes.length})</summary><div class="pnj-lista">${e.personajes.map(pnj).join('')}</div></details>` : ''}
      <section class="aventura" data-aventura aria-label="Aventura: escena a escena"></section>
      ${guiaAventura(e)}`;
    }
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

  // ----- Aventura -----
  const claveAventura = () => `taberna:mapas:${campanas[campana]?.id ?? campana}:${pagina}:aventura`;
  const estadoAventura = (e) => {
    const g = leerGuardado(claveAventura());
    const ok = g && Array.isArray(g.pasos) && g.pasos.length && g.pasos.every((p) => e.escenas[p?.e]);
    return ok ? { pasos: g.pasos, fase: g.fase === 1 ? 1 : 0 } : { pasos: [{ e: e.inicio, o: null }], fase: 0 };
  };
  const guardarAventura = (st) => guardar(claveAventura(), st);
  const tiposEscena = (s) => (s.combate ? 'combate' : s.enigma ? 'enigma' : s.fin ? 'fin' : 'evento');
  const ICONO_ESCENA = { combate: 'khanda', enigma: 'puzzle-piece', fin: 'flag-checkered', evento: 'feather' };
  const combatesHechos = (e, st) => st.pasos.filter((p, i) => e.escenas[p.e].combate && (i < st.pasos.length - 1 || st.fase === 1)).length;

  // Marcas del mapa: rastro recorrido, escena actual y adónde lleva cada opción
  const marcasAventura = (e, st, opciones = []) => {
    const pts = st.pasos.map((p) => e.escenas[p.e]).filter(enEl);
    const linea = pts.length > 1 ? `<svg class="aventura-rastro" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"><polyline points="${pts.map((q) => `${q.x},${q.y}`).join(' ')}"/></svg>` : '';
    const actual = e.escenas[st.pasos.at(-1).e];
    const hechas = st.pasos.slice(0, -1).map((p) => e.escenas[p.e]).filter(enEl)
      .map((q) => `<span class="aventura-huella" style="${pos(q)}" title="${esc(q.titulo)}"></span>`).join('');
    const ops = opciones.map(([o, letra]) => { const d = e.escenas[o.va_a]; return enEl(d) ? `<span class="aventura-destino" style="${pos(d)}" data-av-ref="${letra}" title="${letra}: ${esc(o.opcion)}">${letra}</span>` : ''; }).join('');
    return `${linea}${hechas}${ops}${enEl(actual) ? `<span class="aventura-aqui" style="${pos(actual)}" title="Estáis aquí: ${esc(actual.titulo)}"><i class="fa-solid fa-${ICONO_ESCENA[tiposEscena(actual)]}"></i></span>` : ''}`;
  };

  // La pregunta y las opciones que se ven ahora, para leer en voz alta (audio de la pregunta y de cada opción, seguidos)
  const lecturaDecision = (e, s, pregunta, visibles) => {
    const ap = s.audio_pregunta ?? (typeof s.opciones === 'string' ? e.opciones_comunes?.[s.opciones]?.audio_pregunta : null);
    const rutas = [ap, ...visibles.map(([o]) => o.audio)].filter(Boolean).map((r) => new URL(r + V, RAIZ).href);
    return `<div class="lectura aventura-lectura-decision">
      <div class="lectura-cabecera"><span><i class="fa-solid fa-signs-post"></i> Leer en voz alta</span>${rutas.length ? MEDALLON(rutas.join('|')) : ''}</div>
      <p class="aventura-pregunta">${esc(pregunta)}</p>
      <ol class="aventura-lecturas">${visibles.map(([o, letra]) => `<li><b>${letra}.</b> ${esc(o.lectura ?? o.opcion)}</li>`).join('')}</ol></div>`;
  };

  const aventuraHtml = (e) => {
    const st = estadoAventura(e);
    const sid = st.pasos.at(-1).e;
    const s = e.escenas[sid];
    const m = marcasDe(e, st.pasos);
    const prev = st.pasos.at(-2);
    const sPrev = prev ? e.escenas[prev.e] : null;
    const opPrev = sPrev && prev.o >= 0 ? opcionesEscena(e, sPrev).lista[prev.o] : null;
    const antesDelCombate = s.combate && st.fase === 0;
    const { pregunta, lista } = opcionesEscena(e, s);
    const destinos = new Set();
    const visibles = lista.map((o, i) => [o, i]).filter(([o]) => opcionVisible(o, m) && !(o.comun && destinos.has(o.va_a)) && destinos.add(o.va_a)).map(([o, i], n) => [o, LETRAS[n], i]);
    const estados = Object.entries(e.estados ?? {}).filter(([k]) => m.has(k));
    const nota = (t, clase = '') => (t ? `<p class="aventura-nota ${clase}"><i class="fa-solid fa-hat-wizard"></i> <b>Para el máster:</b> ${esc(t)}</p>` : '');

    let cuerpo;
    if (antesDelCombate) {
      const como = opPrev?.nota ?? (sPrev?.sigue === sid ? sPrev.master : null);
      cuerpo = `${lectura(s.narracion, s.audio)}
        ${como ? `<p class="aventura-nota aventura-como"><i class="fa-solid fa-route"></i> <b>Cómo empieza:</b> ${esc(como)}</p>` : ''}
        ${nota(s.master)}
        <div class="aventura-combate">
          <p><i class="fa-solid fa-khanda"></i> <b>${s.combate.enemigos.map(esc).join(' + ')}</b></p>
          ${s.combate.nota ? `<p>${esc(s.combate.nota)}</p>` : ''}
          ${s.combate.despliegue ? `<p><i class="fa-solid fa-chess-board"></i> <b>Despliegue:</b> ${esc(s.combate.despliegue)}</p>` : ''}
          <button type="button" class="aventura-ganado" data-av-ganado><i class="fa-solid fa-trophy"></i> Combate ganado: ¿qué pasa después?</button>
        </div>`;
    } else {
      const decision = s.fin
        ? `<div class="aventura-fin"><p class="aventura-nota"><i class="fa-solid fa-beer-mug-empty"></i> <b>De vuelta en la taberna:</b> el equipo recibe ${MONEDAS_EVENTOS[pagina - 1] ?? 0} monedas de eventos (al que menos tiene), abre los 4 cofres, los caídos vuelven con 1 PV y cada héroe compra al tabernero. La vida solo se recupera comiendo.</p>
            ${pagina < campanas[campana].escenarios.length ? `<button type="button" class="aventura-ganado" data-pagina="${pagina + 1}"><i class="fa-solid fa-book-open"></i> Ir al capítulo ${ROMANOS[pagina]}</button>` : ''}</div>`
        : s.sigue
          ? `<button type="button" class="aventura-ganado" data-av-sigue>${e.escenas[s.sigue]?.combate ? '<i class="fa-solid fa-khanda"></i> ¡Al combate!' : '<i class="fa-solid fa-arrow-right"></i> Continuar'}</button>`
          : `${lecturaDecision(e, s, pregunta, visibles)}
            <div class="aventura-opciones">${visibles.map(([o, letra, i]) => `<button type="button" class="aventura-opcion" data-av-opcion="${i}" data-av-ref="${letra}">
              <span class="aventura-letra">${letra}</span><span class="aventura-texto"><b>${esc(o.opcion)}</b>${o.nota ? `<small>${esc(o.nota)}</small>` : ''}</span></button>`).join('')}</div>`;
      cuerpo = `${s.combate ? `<p class="aventura-tras"><i class="fa-solid fa-trophy"></i> Tras el combate</p>${lectura(s.despues, s.audio_despues)}${nota(s.master_despues)}`
        : `${lectura(s.narracion, s.audio)}${nota(s.master)}`}
        ${s.enigma ? `<div class="aventura-enigma"><p><i class="fa-solid fa-puzzle-piece"></i> <b>Enigma: ${esc(s.enigma.titulo ?? nombreEnigma(s.enigma.id))}</b> <small>(${esc(nombreEnigma(s.enigma.id) ?? s.enigma.id)})</small></p>
          <button type="button" class="boton-enigma" data-enigma="${esc(s.enigma.id)}" data-enigma-escena="${esc(sid)}"><i class="fa-solid fa-hat-wizard"></i> Abrir enigma</button></div>` : ''}
        ${decision}`;
    }

    return `<div class="aventura-barra">
        <button type="button" class="aventura-boton" data-av-atras${st.pasos.length === 1 && !(s.combate && st.fase === 1) ? ' disabled' : ''} title="Volver a la escena anterior (←)"><i class="fa-solid fa-arrow-left"></i> Atrás</button>
        <ol class="aventura-migas" aria-label="Escenas recorridas">${st.pasos.map((p, i) => `<li><button type="button" data-av-volver="${i}"${i === st.pasos.length - 1 ? ' aria-current="step"' : ''} title="${esc(e.escenas[p.e].titulo)}"><i class="fa-solid fa-${ICONO_ESCENA[tiposEscena(e.escenas[p.e])]}"></i> ${esc(corto(e.escenas[p.e].titulo, 22))}</button></li>`).join('')}</ol>
        <span class="aventura-contador" title="Combates obligatorios ganados"><i class="fa-solid fa-khanda"></i> ${combatesHechos(e, st)}/4</span>
        <button type="button" class="aventura-boton" data-av-reiniciar title="Empezar el capítulo de nuevo"><i class="fa-solid fa-rotate-left"></i></button>
      </div>
      <div class="aventura-escenario">
        <div class="aventura-lado">
          <button type="button" class="aventura-mapa" data-ver-paso="-1" aria-label="Ampliar el plano"><span class="plano-lienzo"><img src="${img(e.mapa)}" alt="">${marcasAventura(e, st, antesDelCombate || s.sigue || s.fin ? [] : visibles)}</span></button>
          ${estados.length ? `<ul class="aventura-estados">${estados.map(([, v]) => `<li><i class="fa-solid fa-${esc(v.icono ?? 'circle-info')}"></i> ${esc(v.texto)}</li>`).join('')}</ul>` : ''}
        </div>
        <article class="aventura-carta" aria-live="polite">
          <header class="aventura-cabecera"><span class="aventura-tipo ${tiposEscena(s)}"><i class="fa-solid fa-${ICONO_ESCENA[tiposEscena(s)]}"></i></span>
            <div><p class="aventura-lugar"><i class="fa-solid fa-location-dot"></i> ${esc(s.lugar)}</p><h4>${esc(s.titulo)}</h4></div></header>
          ${cuerpo}
        </article>
      </div>`;
  };

  // Guía del máster: todas las escenas, para preparar la sesión
  const guiaAventura = (e) => `<details class="aventura-guia"><summary><i class="fa-solid fa-book"></i> Guía del máster: las ${Object.keys(e.escenas).length} escenas del capítulo</summary>
    ${e.geografia ? `<p class="aventura-geografia"><i class="fa-solid fa-map"></i> <b>Cómo es el mapa:</b> ${esc(e.geografia)}</p>` : ''}
    <ol>${Object.entries(e.escenas).map(([id, s]) => {
      const { lista } = opcionesEscena(e, s);
      const destinos = s.fin ? 'Fin del capítulo' : s.sigue ? `→ ${e.escenas[s.sigue]?.titulo}` : [...new Set(lista.map((o) => `${o.opcion} → ${e.escenas[o.va_a]?.titulo ?? '¿?'}`))].join(' · ');
      return `<li><b><i class="fa-solid fa-${ICONO_ESCENA[tiposEscena(s)]}"></i> ${esc(s.titulo)}</b> <small>(${esc(s.lugar)})</small>${s.combate ? ` — <i>${s.combate.enemigos.map(esc).join(' + ')}</i>` : ''}<br><small>${esc(destinos)}</small></li>`;
    }).join('')}</ol></details>`;

  let direccion = 'adelante';
  const dibujarAventura = () => {
    const e = escenarioActual();
    const caja = zonaLibro.querySelector('[data-aventura]');
    if (!e?.escenas || !caja) return;
    caja.innerHTML = aventuraHtml(e);
    const carta = caja.querySelector('.aventura-carta');
    if (!sinMovimiento()) carta.classList.add(`aventura-entra-${direccion}`);
    caja.querySelector('.aventura-migas [aria-current]')?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  };
  // Acciones de la aventura; devuelve true si el botón era suyo
  const atenderAventura = (b) => {
    const e = escenarioActual();
    if (!e?.escenas || !b.closest('[data-aventura]')) return false;
    const st = estadoAventura(e);
    const actual = st.pasos.at(-1);
    const s = e.escenas[actual.e];
    const ir = (o, destino) => { actual.o = o; st.pasos.push({ e: destino, o: null }); st.fase = 0; direccion = 'adelante'; };
    const d = b.dataset;
    if (d.avOpcion !== undefined) { const o = opcionesEscena(e, s).lista[Number(d.avOpcion)]; if (!e.escenas[o?.va_a]) return true; ir(Number(d.avOpcion), o.va_a); }
    else if (d.avSigue !== undefined) ir(-1, s.sigue);
    else if (d.avGanado !== undefined) { st.fase = 1; direccion = 'adelante'; }
    else if (d.avAtras !== undefined) {
      if (s.combate && st.fase === 1) st.fase = 0;
      else if (st.pasos.length > 1) { st.pasos.pop(); st.pasos.at(-1).o = null; st.fase = e.escenas[st.pasos.at(-1).e].combate ? 1 : 0; }
      direccion = 'atras';
    } else if (d.avVolver !== undefined) {
      const i = Number(d.avVolver);
      if (i === st.pasos.length - 1) return true;
      st.pasos = st.pasos.slice(0, i + 1); st.pasos.at(-1).o = null; st.fase = e.escenas[st.pasos.at(-1).e].combate ? 1 : 0;
      direccion = 'atras';
    } else if (d.avReiniciar !== undefined) { olvidar(claveAventura()); direccion = 'atras'; dibujarAventura(); enfocarAventura(); return true; }
    else return false;
    guardarAventura(st);
    dibujarAventura();
    enfocarAventura();
    return true;
  };
  const enfocarAventura = () => {
    const caja = zonaLibro.querySelector('[data-aventura]');
    if (!caja) return;
    if (caja.getBoundingClientRect().top < 0) caja.scrollIntoView({ behavior: sinMovimiento() ? 'auto' : 'smooth', block: 'start' });
    caja.querySelector('.aventura-carta .aventura-opcion, .aventura-carta .aventura-ganado, .aventura-carta button')?.focus({ preventScroll: true });
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
    direccion = 'adelante';
    dibujarAventura();
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
  const ordenCapas = (e) => (e.escenas ? ['general'] : ['general', 'llegada', ...e.pasos.map((_, k) => k)]);
  const nombreCapa = (e, capa) => (capa === 'general' ? (e.escenas ? 'Recorrido' : 'Vista general') : capa === 'llegada' ? 'Llegada' : `${capa + 1}. ${e.pasos[capa].titulo}`);
  const sinSitio = (o) => (enEl(o) ? '' : ' <small class="plano-sin-sitio">(sin sitio en el mapa)</small>');

  const opcionesPanel = (d, e, capa) => (d?.opciones?.length
    ? `<section class="plano-bloque plano-decision" data-decision-plano="${capa}">${recorridoHtml(d, e, capa, 'plano')}</section>` : '');

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
    if (e.escenas) {
      const st = estadoAventura(e);
      return `<ul class="plano-claves">
        <li><span class="marca-mini entrada"><i class="fa-solid fa-flag"></i></span> <b>Entrada</b>${pl.entrada?.texto ? `: ${esc(pl.entrada.texto)}` : ''}</li>
        <li><span class="marca-mini salida"><i class="fa-solid fa-flag-checkered"></i></span> <b>Salida</b>${pl.salida?.texto ? `: ${esc(pl.salida.texto)}` : ''}</li></ul>
        <h4 class="plano-capa-nombre">Recorrido del grupo</h4>
        <ol class="plano-pasos">${st.pasos.map((p) => { const s = e.escenas[p.e]; return `<li><span class="plano-recorrido-item"><span class="leyenda-num ${tiposEscena(s)}"><i class="fa-solid fa-${ICONO_ESCENA[tiposEscena(s)]}"></i></span><span><b>${esc(s.titulo)}</b><small>${esc(s.lugar)}</small></span></span></li>`; }).join('')}</ol>`;
    }
    return `<ul class="plano-claves">
      <li><span class="marca-mini entrada"><i class="fa-solid fa-flag"></i></span> <b>Entrada</b>${pl.entrada?.texto ? `: ${esc(pl.entrada.texto)}` : ''}</li>
      <li><span class="marca-mini salida"><i class="fa-solid fa-flag-checkered"></i></span> <b>Salida</b>${pl.salida?.texto ? `: ${esc(pl.salida.texto)}` : ''}</li>
      <li><span class="marca-mini ruta"></span> Recorrido: las flechas marcan el sentido</li></ul>
      <p class="plano-ayuda">Elige una capa arriba (o usa ← →) para ver solo lo de ese momento: las opciones al llegar, o las bestias, decisiones y personajes de cada paso.</p>
      <ol class="plano-pasos">${e.pasos.map((p, k) => `<li><button type="button" data-plano-capa="${k}">
        <span class="leyenda-num ${tipoPaso(p)}">${k + 1}</span><span><b>${esc(p.titulo)}</b><small>${esc(p.lugar)}${p.cuando ? ` · ${esc(p.cuando)}` : ''}</small></span></button></li>`).join('')}</ol>`;
  };

  const panelLlegada = (e) => `${e.plano?.entrada?.texto ? `<p class="plano-dato"><i class="fa-solid fa-flag"></i> <b>Entrada:</b> ${esc(e.plano.entrada.texto)}</p>` : ''}
    ${opcionesPanel(e.decision_llegada, e, 'llegada') || '<p class="plano-ayuda">Este capítulo no tiene decisión al llegar.</p>'}
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
      ${opcionesPanel(p.decision, e, k)}
      ${personajesPanel(e, (q) => q.paso === k, 'Personajes en este paso')}`;
  };

  const verPlano = (capa = 'general', ref = '', mantenerScroll = false) => {
    const scroll = mantenerScroll ? plano.querySelector('.plano-leyenda')?.scrollTop ?? 0 : 0;
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
          <div class="plano-lienzo grande capa-${typeof capaPlano === 'number' ? 'paso' : capaPlano}"><img src="${img(e.mapa)}" alt="${esc(mapaDe[e.mapa]?.nombre)}">${capasPlano(e, { capa: capaPlano, camino: e.escenas ? null : caminoDe(e, capaPlano), extra: e.escenas ? marcasAventura(e, estadoAventura(e)) : '' })}</div>
        </div>
        <aside class="plano-leyenda">
          <p class="capitulo-num">${esc(c.nombre)} · ${c.final ? 'Gran final' : `Capítulo ${ROMANOS[pagina - 1]}`}</p><h3>${esc(e.titulo)}</h3>
          <h4 class="plano-capa-nombre">${esc(nombreCapa(e, capaPlano))}</h4>
          ${capaPlano === 'general' ? panelGeneral(e) : capaPlano === 'llegada' ? panelLlegada(e) : panelPaso(e, capaPlano)}
        </aside></div>`;
    ajustarRutas(plano, e.plano?.ruta);
    if (!plano.open) plano.showModal();
    if (mantenerScroll) { const l = plano.querySelector('.plano-leyenda'); if (l) l.scrollTop = scroll; }
    else plano.querySelector('.plano-capas .actual')?.focus({ preventScroll: true });
    if (ref) resaltar(ref, true);
  };
  const resaltar = (ref, si) => plano.querySelectorAll(`[data-plano-ref="${ref}"]`).forEach((el) => el.classList.toggle('plano-resaltada', si));
  const capaDe = (v) => (v === 'llegada' ? v : v === 'general' || Number(v) < 0 ? 'general' : Number(v)); // -1 = vista general
  // Abre el puzzle en la pestaña Enigmas con un pergamino que cuenta qué representa en la historia
  const abrirEnigma = (id, paso, escena) => {
    const c = campanas[campana];
    const e = c?.escenarios[pagina - 1];
    const en = escena ? e?.escenas?.[escena]?.enigma : e?.pasos?.[paso]?.enigma;
    plano.open && plano.close();
    document.querySelector('.tab-btn[data-tab="puzzles"]')?.click();
    abrirEnigmaDeHistoria(id, {
      historia: en ? { intentos: en.intentos ?? INTENTOS[id] ?? 3, tema: en.tema ?? TEMAS[id], mensaje: en.mensaje, datos: en } : null,
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
  // Elegir / reiniciar una opción (compartido por libro y plano)
  // Devuelve la capa tocada, o null si el botón no es de decisiones
  const atenderEleccion = (b) => {
    const { elegir, volverA, deshacer, reiniciarEleccion } = b.dataset;
    if (elegir) {
      const [capa, n, j] = elegir.split(',');
      fijarElecciones(capa, [...elecciones(capa).slice(0, Number(n)), Number(j)]);
      return capa;
    }
    if (volverA) {
      const [capa, n] = volverA.split(',');
      fijarElecciones(capa, elecciones(capa).slice(0, Number(n)));
      return capa;
    }
    if (deshacer !== undefined) { fijarElecciones(deshacer, elecciones(deshacer).slice(0, -1)); return deshacer; }
    if (reiniciarEleccion !== undefined) { fijarElecciones(reiniciarEleccion, []); return reiniciarEleccion; }
    return null;
  };
  // Tras elegir, lleva la vista a lo último narrado (o a las opciones nuevas) y deja el foco en lo siguiente que tocar
  const enfocarRecorrido = (caja) => {
    if (!caja) return;
    const ultimo = caja.querySelector('[class$="-tramo"]:last-child');
    (ultimo ?? caja).scrollIntoView({ behavior: sinMovimiento() ? 'auto' : 'smooth', block: 'nearest' });
    caja.querySelector('[class$="-opcion-elegir"], [class$="-continuar"], [class$="-reiniciar"]')?.focus({ preventScroll: true });
  };
  plano.addEventListener('close', refrescarDecisiones);
  plano.addEventListener('click', (ev) => {
    if (atenderNarracion(ev)) return;
    const b = ev.target.closest('button');
    if (b && atenderEleccion(b) !== null) { verPlano(capaPlano, '', true); enfocarRecorrido(plano.querySelector('[data-decision-plano]')); return; }
    if (ev.target === plano || b?.dataset.plano === 'cerrar') return plano.close();
    if (b?.dataset.enigma) return abrirEnigma(b.dataset.enigma, Number(b.dataset.enigmaPaso), b.dataset.enigmaEscena);
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
    if (b.dataset.enigma) return abrirEnigma(b.dataset.enigma, Number(b.dataset.enigmaPaso), b.dataset.enigmaEscena);
    if (atenderAventura(b)) return;
    if (b.dataset.irPaso !== undefined) return irAPaso(Number(b.dataset.irPaso));
    const capa = atenderEleccion(b);
    if (capa !== null) {
      refrescarDecisiones();
      enfocarRecorrido(zonaLibro.querySelector(`[data-decision="${capa}"]`));
    }
  });
  visor.addEventListener('click', (ev) => {
    if (atenderNarracion(ev)) return;
    const b = ev.target.closest('button');
    if (ev.target === visor || b?.dataset.visor === 'cerrar') return visor.close();
    if (b?.dataset.irCapitulo) { const [ci, ei] = b.dataset.irCapitulo.split(',').map(Number); visor.close(); irA(ci, ei + 1); }
  });

  for (const [tipo, si] of [['mouseover', true], ['mouseout', false], ['focusin', true], ['focusout', false]]) {
    zonaLibro.addEventListener(tipo, (ev) => {
      const el = ev.target.closest?.('.aventura-opcion[data-av-ref]');
      if (el) zonaLibro.querySelectorAll(`.aventura-destino[data-av-ref="${el.dataset.avRef}"]`).forEach((x) => x.classList.toggle('aventura-resaltada', si));
    });
  }
  document.addEventListener('keydown', (ev) => {
    const caja = zonaLibro.querySelector('[data-aventura]');
    if (!caja || caja.closest('[hidden]') || !caja.offsetParent || ev.ctrlKey || ev.metaKey || ev.altKey) return;
    if (ev.target.closest('input, textarea, select, dialog') || document.querySelector('dialog[open]')) return;
    const tecla = ev.key.toUpperCase();
    const b = tecla === 'ARROWLEFT' ? caja.querySelector('[data-av-atras]:not([disabled])') : /^[A-J]$/.test(tecla) ? caja.querySelector(`.aventura-opcion[data-av-ref="${tecla}"]`) : null;
    if (b) { ev.preventDefault(); b.click(); }
  });

  dibujarLibro();
  dibujarCatalogo();
}
