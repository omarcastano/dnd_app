// Motor común de las fichas de combate (pestañas Bestiario y PNJ, y las escenas de combate del libro de Mapas con montarFicha): lista por nivel y, al elegir una ficha, su vista con la carta,
// el contador de vida según 4/5/6 jugadores, el botín al llegar a 0 y lo que lleva encima (robo del Pícaro).
// Los números de vida, daño, botín y robo salen de `niveles` de enemigos/enemigos.json (una fila por nivel); cada ficha solo aporta textos.
// Cada pestaña pone su carta (`carta(e, n)`) y, si quiere, un trozo extra del panel (`extraPanel`) que repinta con `alPintar`.
import { esc } from './util.js';
import { atenderNarracion } from './narracion.js?v=2';
import { groups as TIENDA } from '../../tienda/js/datos/tienda.js';

export const ROMANOS = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII'];
export const ESQUINAS = '<i class="esquina a"></i><i class="esquina b"></i><i class="esquina c"></i><i class="esquina d"></i>';
export const JUGADORES = [4, 5, 6];
const CORAZON = '<svg viewBox="0 0 32 29" class="vida-corazon" aria-hidden="true"><path d="M16 28C6 20 1 15 1 9a7.5 7.5 0 0 1 15-2 7.5 7.5 0 0 1 15 2c0 6-5 11-15 19z"/></svg>';

// Rango del d20 de cada tipo de golpe (los mismos para todas las fichas)
export const D20 = { basico: '5-15', fuerte: '16+' };

// Daño de un golpe: un número, o una lista [4, 5, 6 jugadores] como la vida
export const danoDe = (n, golpe, jugadores) => (Array.isArray(n[golpe]) ? n[golpe][JUGADORES.indexOf(jugadores)] : n[golpe]);

// Fila de ataque del dorso (el número lo actualiza el panel al cambiar de jugadores: data-golpe)
export const filaAtaque = (a, n) => `<div class="fila-p fila-enemigo">
  <div class="hex"><span><small>D20</small>${D20[a.golpe]}</span></div>
  <div class="quien"><div><b>${esc(a.nombre)}</b><em>${esc(a.subtitulo)}</em></div></div>
  <div class="valor-p" title="Daño" data-golpe="${a.golpe}">${danoDe(n, a.golpe, 4)}</div></div>`;

// Carta que se voltea al tocarla: frente y dorso los pone cada pestaña
export const cartaVolteable = (nombre, frente, dorso, claseDorso = 'enemigo') => `<div class="carta-sel volteo gira" role="button" tabindex="0" aria-label="Voltear la carta de ${esc(nombre)}">
  <div class="volteo-in"><div class="cara"><article class="carta-p personaje">${frente}</article></div>
  <div class="cara dorso"><article class="carta-p ${claseDorso}">${dorso}</article></div></div></div>`;

// ---------- Estado guardado en este dispositivo (si no hay localStorage, simplemente no se recuerda) ----------
const leer = (clave, defecto) => { try { const v = localStorage.getItem(clave); return v === null ? defecto : JSON.parse(v); } catch { return defecto; } };
const guardar = (clave, valor) => { try { localStorage.setItem(clave, JSON.stringify(valor)); } catch {} };
const olvidar = (clave) => { try { localStorage.removeItem(clave); } catch {} };
export const CLAVE_JUGADORES = 'taberna:bestiario:jugadores'; // el mismo grupo para Bestiario, PNJ y la mesa de combate de Mapas

// ---------- Botín: al llegar a 0 de vida se tira según el nivel (pesos en enemigos.json) y puede salir cualquier ítem de la tienda ----------
const ICONOS_BOTIN = { moneda: ['coins', '#d4a54a'], comida: ['drumstick-bite', '#c0813a'], bebida: ['beer-mug-empty', '#d4a54a'], dado: ['dice-d20', '#6a9a4a'],
  arma: ['khanda', '#c0392b'], armadura: ['shield-halved', '#3498db'], nada: ['skull-crossbones', '#7a6845'] };
const limpio = (t) => String(t).replace(/<[^>]*>/g, '').trim(); // los nombres de la tienda pueden llevar iconos HTML
const filasTienda = (grupo) => TIENDA.find((g) => g.name === grupo)?.table ?? [];
const azar = (xs) => xs[Math.floor(Math.random() * xs.length)];
const plural = (n, uno, varios) => `${n} ${n === 1 ? uno : varios}`;

// Texto del ítem tal como lo describe la tienda (columnas: nombre, unidades, precio, efecto…)
const ITEMS_TIENDA = {
  comida: ([nombre, , , cura]) => ({ nombre: limpio(nombre), detalle: typeof cura === 'number' ? `cura ${cura}` : 'efecto desconocido' }),
  bebida: ([nombre, , , cura]) => ({ nombre: `Bebida ${limpio(nombre).toLowerCase()}`, detalle: `cura ${cura}` }),
  dado: ([nombre, , , sirve]) => ({ nombre: limpio(nombre), detalle: `sirve para ${String(sirve).toLowerCase()}` }),
  arma: ([nombre, , , dano, manos]) => ({ nombre: limpio(nombre), detalle: `+${dano} de daño · ${plural(manos, 'mano', 'manos')}` }),
  armadura: ([nombre, , , reduce]) => ({ nombre: limpio(nombre), detalle: `reduce ${reduce}` }),
};
const GRUPO_TIENDA = { comida: 'Comida', bebida: 'Bebidas', dado: 'Dados', arma: 'Armas', armadura: 'Armaduras' };

const entre = ([min, max]) => min + Math.floor(Math.random() * (max - min + 1));
function elegirTipo(pesos) {
  let tirada = Math.random() * Object.values(pesos).reduce((a, b) => a + b, 0);
  return Object.keys(pesos).find((k) => (tirada -= pesos[k]) < 0) ?? 'nada';
}
function itemDe(tipo, monedas) {
  if (tipo === 'nada') return { tipo, texto: 'No dejó nada' };
  if (tipo === 'monedas') return { tipo: 'moneda', texto: plural(entre(monedas), 'moneda', 'monedas') };
  const { nombre, detalle } = ITEMS_TIENDA[tipo](azar(filasTienda(GRUPO_TIENDA[tipo])));
  return { tipo, texto: nombre, detalle };
}
const tirarBotin = (n) => itemDe(elegirTipo(n.botin.pesos), n.botin.monedas);
// Objetos que lleva la ficha y que el Pícaro puede robar (1 o 2, a su elección). `objetos` da el % de llevar 0, 1, 2… objetos; una ficha puede cambiarlo con `robo.objetos`.
// El tipo de cada objeto usa los pesos del botín (lo que allí es «nada» pasa a monedas): lo valioso es igual de raro al robar que al derrotar.
const pesosRobo = ({ botin: { pesos }, robo }) => robo.pesos ?? (({ nada = 0, monedas = 0, ...resto }) => ({ monedas: monedas + nada, ...resto }))(pesos);
const tirarRobo = (n, e) => Array.from({ length: Number(elegirTipo(e.robo?.objetos ?? n.robo.objetos)) }, () => ({ ...itemDe(elegirTipo(pesosRobo(n)), n.robo.monedas ?? n.botin.monedas), robado: false }));

const botinHtml = ({ tipo, texto, detalle }) => {
  const [icono, color] = ICONOS_BOTIN[tipo];
  return `<i class="fa-solid fa-${icono}" style="color:${color}"></i><b>${esc(texto)}</b>${detalle ? `<small>${esc(detalle)}</small>` : ''}`;
};

// ---------- Vistas ----------
const lista = (fichas, o) => `<table class="lista-enemigos"><thead><tr><th>Nivel</th><th>${esc(o.columna)}</th></tr></thead><tbody>
  ${[...fichas].sort((a, b) => a.nivel - b.nivel).map((e) => `<tr tabindex="0" data-${o.atributo}="${esc(e.id)}" role="button" aria-label="Abrir ${esc(e.nombre)}">
    <td class="nivel-celda">${ROMANOS[e.nivel]}</td><td>${esc(e.nombre)}</td></tr>`).join('')}
  </tbody></table>`;

// Fichas con varias cabezas (e.cabezas = { cantidad, vida, regenera } por 4/5/6 jugadores): un contador por cabeza en vez del contador único
const cabezasHtml = (e) => `<div class="cabezas" role="group" aria-label="Vida de cada cabeza">${Array.from({ length: e.cabezas.cantidad }, (_, i) => `<div class="cabeza" data-cabeza-fila="${i}">
  <button type="button" class="vida-btn" data-cabeza="${i}:-1" aria-label="Quitar 1 de vida a la cabeza ${i + 1}">−</button>
  <span class="vida-valor"><small>Cabeza ${i + 1}</small><b></b></span>
  <button type="button" class="vida-btn" data-cabeza="${i}:1" aria-label="Sumar 1 de vida a la cabeza ${i + 1}">+</button></div>`).join('')}
  <p class="cabezas-info"></p></div>`;

const panelVida = (e, o) => `<section class="panel-vida" aria-label="Seguimiento del combate">
  <div class="jugadores" role="group" aria-label="Número de jugadores"><span>Jugadores</span>
    ${JUGADORES.map((j) => `<button type="button" data-jugadores="${j}">${j}</button>`).join('')}</div>
  ${e.cabezas ? cabezasHtml(e) : ''}
  <div class="vida vida-enemigo" role="group" aria-label="Vida"${e.cabezas ? ' hidden' : ''}>
    <button type="button" class="vida-btn" data-vida="-1" aria-label="Quitar 1 de vida">−</button>
    <span class="vida-valor" aria-live="polite">${CORAZON}<b></b></span>
    <button type="button" class="vida-btn" data-vida="1" aria-label="Sumar 1 de vida">+</button>
  </div>
  <button type="button" class="reiniciar" data-reiniciar>Reiniciar</button>
  <p class="estado-derrota" hidden>Derrotado</p>
  ${o.extraPanel(e)}
  <div class="botin" hidden><h3>Botín</h3><p class="botin-item"></p></div>
  <section class="robo" aria-label="Robo del pícaro"><h3>Robo</h3><p class="robo-texto"></p><div class="robo-lista"></div>
    <button type="button" class="reiniciar" data-ver-robo>Ver qué lleva</button></section>
</section>`;

function abrirFicha(zona, d, e, o) {
  const n = d.niveles.find((x) => x.nivel === e.nivel);
  const claveVida = (jugadores) => `${o.prefijo}:${e.id}:vida:${jugadores}`;
  const claveRobo = `${o.prefijo}:${e.id}:robo`;
  const claveBotin = (jugadores) => `${o.prefijo}:${e.id}:botin:${jugadores}`;
  zona.innerHTML = `${o.volver ? `<button type="button" class="volver" data-volver>${esc(o.volver)}</button>` : ''}
    <h2 class="titulo-enemigo">${esc(e.nombre)} <small>${esc(o.subtitulo(e, n))}</small></h2>
    ${panelVida(e, o)}<div class="rejilla-enemigos">${o.carta(e, n)}</div>`;
  const q = (s) => zona.querySelector(s);
  const guardadas = leer(CLAVE_JUGADORES, 4);
  let jugadores = JUGADORES.includes(guardadas) ? guardadas : 4;
  let vida;
  let cab; // vida de cada cabeza (solo fichas con `cabezas`); `vida` es entonces su suma
  const cabezas = e.cabezas;
  let robo = leer(claveRobo, null);
  const porCabeza = () => cabezas.vida[JUGADORES.indexOf(jugadores)];
  const maximo = () => (cabezas ? porCabeza() * cabezas.cantidad : n.vida[JUGADORES.indexOf(jugadores)]);
  const cargarVida = () => {
    if (cabezas) {
      const g = leer(claveVida(jugadores), null);
      cab = Array.isArray(g) && g.length === cabezas.cantidad && g.every((x) => Number.isInteger(x) && x >= 0 && x <= porCabeza()) ? g : Array(cabezas.cantidad).fill(porCabeza());
      return;
    }
    const v = Number(leer(claveVida(jugadores), maximo())); vida = Number.isInteger(v) && v >= 0 && v <= maximo() ? v : maximo();
  };
  const pintarRobo = () => {
    q('.robo-texto').textContent = e.robo?.texto ?? '';
    q('.robo-lista').innerHTML = robo && !robo.length ? '<p class="robo-nada">No lleva nada</p>' : (robo ?? []).map((o2, i) => `<button type="button" class="objeto-robo${o2.robado ? ' robado' : ''}" data-robar="${i}" aria-pressed="${o2.robado}">${botinHtml(o2)}</button>`).join('');
    q('[data-ver-robo]').hidden = !!robo;
  };
  const pintar = () => {
    pintarRobo();
    if (cabezas) {
      vida = cab.reduce((a, b) => a + b, 0);
      zona.querySelectorAll('[data-cabeza-fila]').forEach((f, i) => {
        f.querySelector('b').textContent = cab[i];
        f.classList.toggle('muerta', cab[i] === 0);
        f.querySelector('[data-cabeza$=":-1"]').disabled = cab[i] <= 0;
        f.querySelector('[data-cabeza$=":1"]').disabled = cab[i] >= porCabeza();
      });
      const viva = cab.filter((x) => x > 0).length;
      q('.cabezas-info').textContent = `Cabezas vivas ${viva}/${cabezas.cantidad} · regenera con ${cabezas.regenera[JUGADORES.indexOf(jugadores)]} · mitad: ${Math.floor(maximo() / 2)} (total ${vida})`;
    }
    const pct = vida / maximo();
    q('.vida-enemigo .vida-valor b').textContent = vida;
    q('.vida-enemigo').classList.toggle('baja', vida > 0 && pct <= 0.3);
    q('[data-vida="-1"]').disabled = vida <= 0;
    q('[data-vida="1"]').disabled = vida >= maximo();
    zona.querySelectorAll('[data-jugadores]').forEach((b) => b.classList.toggle('activo', Number(b.dataset.jugadores) === jugadores));
    zona.querySelectorAll('[data-golpe]').forEach((el) => { el.textContent = danoDe(n, el.dataset.golpe, jugadores); });
    q('.estado-derrota').hidden = vida > 0;
    if (vida > 0) olvidar(claveBotin(jugadores)); // el botín solo existe mientras la ficha está derrotada
    else {
      let botin = leer(claveBotin(jugadores), null);
      if (!botin) { botin = tirarBotin(n); guardar(claveBotin(jugadores), botin); }
      q('.botin-item').innerHTML = botinHtml(botin);
      q('.botin').classList.toggle('bueno', botin.tipo === 'arma' || botin.tipo === 'armadura');
    }
    q('.botin').hidden = vida > 0;
    zona.classList.toggle('derrotado', vida <= 0);
    o.alPintar(zona, e, { vida, maximo: maximo() });
  };
  zona.onclick = (ev) => {
    if (atenderNarracion(ev)) return;
    if (o.volver && ev.target.closest('[data-volver]')) return mostrarLista(zona, d, o);
    const antes = vida;
    const j = ev.target.closest('[data-jugadores]');
    const rb = ev.target.closest('[data-robar]');
    const v = ev.target.closest('[data-vida]');
    const cb = ev.target.closest('[data-cabeza]');
    if (j) { jugadores = Number(j.dataset.jugadores); guardar(CLAVE_JUGADORES, jugadores); cargarVida(); }
    else if (ev.target.closest('[data-ver-robo]')) { robo = tirarRobo(n, e); guardar(claveRobo, robo); }
    else if (rb) { robo[Number(rb.dataset.robar)].robado = !robo[Number(rb.dataset.robar)].robado; guardar(claveRobo, robo); }
    else if (cb) { const [i, dv] = cb.dataset.cabeza.split(':').map(Number); cab[i] = Math.min(porCabeza(), Math.max(0, cab[i] + dv)); guardar(claveVida(jugadores), cab); }
    else if (v) { vida = Math.min(maximo(), Math.max(0, vida + Number(v.dataset.vida))); guardar(claveVida(jugadores), vida); }
    else if (ev.target.closest('[data-reiniciar]')) { vida = maximo(); if (cabezas) { olvidar(claveVida(jugadores)); cargarVida(); } else guardar(claveVida(jugadores), vida); olvidar(claveBotin(jugadores)); robo = null; olvidar(claveRobo); }
    else {
      const c = ev.target.closest('.volteo.gira');
      if (c) { const giro = Number(c.dataset.giro ?? 0) + 1; c.dataset.giro = giro; c.style.setProperty('--giro', giro); }
      return;
    }
    pintar();
    // Al morir suena su quejido (sonido_muerte): solo cuando este toque la deja en 0, no al abrir la vista
    if (antes > 0 && vida === 0 && e.sonido_muerte) new Audio(new URL(e.sonido_muerte, o.raizUrl).href).play().catch(() => {});
  };
  zona.onkeydown = (ev) => {
    const c = ev.target.closest('.volteo.gira');
    if (c && (ev.key === 'Enter' || ev.key === ' ')) { ev.preventDefault(); c.click(); }
  };
  cargarVida();
  pintar();
  if (o.desplazar !== false) scrollTo({ top: 0, behavior: 'instant' });
}

function mostrarLista(zona, d, o, desplazar = true) {
  const sel = `[data-${o.atributo}]`;
  zona.onclick = (ev) => { const f = ev.target.closest(sel); if (f) abrirFicha(zona, d, d.fichas.find((e) => e.id === f.getAttribute(`data-${o.atributo}`)), o); };
  zona.onkeydown = (ev) => { const f = ev.target.closest(sel); if (f && (ev.key === 'Enter' || ev.key === ' ')) { ev.preventDefault(); f.click(); } };
  zona.classList.remove('derrotado');
  zona.innerHTML = d.fichas.length ? lista(d.fichas, o) : `<p class="estado alerta">${esc(o.vacio)}</p>`;
  if (desplazar) scrollTo({ top: 0, behavior: 'instant' });
}

function ajustarEscala(raiz) {
  raiz.style.setProperty('--escala-bestiario', Math.min(1, (innerWidth - 32) / 306).toFixed(3));
}

/**
 * Monta un catálogo de fichas en `zona` (dentro de `raiz`, que lleva la clase .bestiario para compartir estilos).
 * d = { niveles, fichas }. Opciones: carta(e, n), subtitulo(e, n), raizUrl (base de sonidos), atributo (data-x de cada fila),
 * columna, volver, vacio, prefijo (localStorage), extraPanel(e) y alPintar(zona, e, { vida, maximo }).
 */
/**
 * Una sola ficha de combate ya abierta en `zona` (sin lista ni botón «Volver», y sin mover la página): la usa el libro de
 * campañas (Mapas) para poner, en cada escena de combate, una ficha por bestia. Mismas opciones que montarCatalogo; `prefijo`
 * debe distinguir cada bestia del encuentro (dos lobos iguales son dos fichas). Si `escala` viene, fija el zoom de la carta.
 */
export function montarFicha(raiz, zona, d, e, opciones) {
  const o = { extraPanel: () => '', alPintar: () => {}, ...opciones, volver: null, desplazar: false };
  if (o.escala) raiz.style.setProperty('--escala-bestiario', o.escala);
  abrirFicha(zona, d, e, o);
}

export function montarCatalogo(raiz, zona, d, opciones) {
  const o = { atributo: 'ficha', columna: 'Nombre', volver: '← Volver', vacio: 'Aún no hay fichas', extraPanel: () => '', alPintar: () => {}, ...opciones };
  ajustarEscala(raiz);
  addEventListener('resize', () => ajustarEscala(raiz));
  mostrarLista(zona, d, o, false);
}
