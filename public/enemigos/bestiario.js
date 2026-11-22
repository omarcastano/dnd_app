// Pestaña «Bestiario»: lista de enemigos (nivel y nombre) y, al elegir uno, su vista de combate con la carta y el contador de vida.
// Los números de vida y daño salen de `niveles` en enemigos.json (una sola fila por nivel); cada enemigo solo aporta nombres y textos.
// Las cartas reutilizan el diseño de personajes/app/cartas.css y el volteo de catalogo.css; el corazón con − / +, el de catalogo.css.
import { esc } from '../personajes/app/util.js';
import { MEDALLON } from '../personajes/app/cartas.js';
import { atenderNarracion } from '../personajes/app/narracion.js';
import { groups as TIENDA } from '../tienda/js/datos/tienda.js';

const RAIZ = new URL('./', import.meta.url);
const ROMANOS = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII'];
const ESQUINAS = '<i class="esquina a"></i><i class="esquina b"></i><i class="esquina c"></i><i class="esquina d"></i>';
const JUGADORES = [4, 5, 6];
const CORAZON = '<svg viewBox="0 0 32 29" class="vida-corazon" aria-hidden="true"><path d="M16 28C6 20 1 15 1 9a7.5 7.5 0 0 1 15-2 7.5 7.5 0 0 1 15 2c0 6-5 11-15 19z"/></svg>';

// Rango del d20 de cada tipo de golpe (los mismos para todos los enemigos)
const D20 = { basico: '5-15', fuerte: '16+' };

// ---------- Cartas ----------
const frente = (e) => `${ESQUINAS}
  <div class="retrato-p"><img src="${new URL(`imagenes/${e.id}.webp`, RAIZ).href}" alt="${esc(e.nombre)}"${e.encuadre ? ` style="object-position:${esc(e.encuadre)}"` : ''}></div>
  <div class="pie-p"><div class="nombre-carta">${esc(e.nombre)}</div>${e.narracion ? MEDALLON(new URL(e.narracion, RAIZ).href) : '<div class="divisor"><i>◆</i></div>'}
  <div class="linaje">${esc(e.tipo)}<b>◆</b>Nivel ${ROMANOS[e.nivel]}</div></div>`;

const filaAtaque = (a, n) => `<div class="fila-p fila-enemigo">
  <div class="hex"><span><small>D20</small>${D20[a.golpe]}</span></div>
  <div class="quien"><div><b>${esc(a.nombre)}</b><em>${esc(a.subtitulo)}</em></div></div>
  <div class="valor-p" title="Daño">${n[a.golpe]}</div></div>`;

const dorso = (e, n) => `${ESQUINAS}
  <div class="placa"><h3>${esc(e.nombre)}</h3><div class="nivel-p">Nivel ${ROMANOS[e.nivel]}</div></div>
  <div class="cuerpo-p">
    <div class="bloque desc-e"><p class="desc-p">${esc(e.descripcion)}</p></div>
    <div class="bloque"><h5>${e.habilidades.length > 1 ? 'Habilidades' : 'Habilidad'}</h5>${e.habilidades.map((h) => `<div class="habilidad-e"><b>${esc(h.nombre)}</b><p>${esc(h.descripcion)}</p></div>`).join('')}</div>
    <div class="bloque"><h5>Ataques</h5>${e.ataques.map((a) => filaAtaque(a, n)).join('')}<p class="nota-e">Con 1-4 el enemigo falla.</p></div>
    <div class="bloque vida-e"><h5>Vida según jugadores</h5>
      <div class="vidas">${JUGADORES.map((j, i) => `<div><b>${n.vida[i]}</b><span>${j} jug.</span></div>`).join('')}</div></div>
  </div>`;

const carta = (e, n) => `<div class="carta-sel volteo gira" role="button" tabindex="0" aria-label="Voltear la carta de ${esc(e.nombre)}">
  <div class="volteo-in"><div class="cara"><article class="carta-p personaje">${frente(e)}</article></div>
  <div class="cara dorso"><article class="carta-p enemigo">${dorso(e, n)}</article></div></div></div>`;

// ---------- Estado guardado en este dispositivo (si no hay localStorage, simplemente no se recuerda) ----------
const leer = (clave, defecto) => { try { const v = localStorage.getItem(clave); return v === null ? defecto : JSON.parse(v); } catch { return defecto; } };
const guardar = (clave, valor) => { try { localStorage.setItem(clave, JSON.stringify(valor)); } catch {} };
const CLAVE_JUGADORES = 'taberna:bestiario:jugadores';
const claveVida = (id, jugadores) => `taberna:bestiario:${id}:vida:${jugadores}`;
const claveBotin = (id, jugadores) => `taberna:bestiario:${id}:botin:${jugadores}`;
const olvidar = (clave) => { try { localStorage.removeItem(clave); } catch {} };

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

function tirarBotin(n) {
  const { pesos, monedas } = n.botin;
  let tirada = Math.random() * Object.values(pesos).reduce((a, b) => a + b, 0);
  const tipo = Object.keys(pesos).find((k) => (tirada -= pesos[k]) < 0) ?? 'nada';
  if (tipo === 'nada') return { tipo, texto: 'No dejó nada' };
  if (tipo === 'monedas') { const c = monedas[0] + Math.floor(Math.random() * (monedas[1] - monedas[0] + 1)); return { tipo: 'moneda', texto: plural(c, 'moneda', 'monedas') }; }
  const { nombre, detalle } = ITEMS_TIENDA[tipo](azar(filasTienda(GRUPO_TIENDA[tipo])));
  return { tipo, texto: nombre, detalle };
}

const botinHtml = ({ tipo, texto, detalle }) => {
  const [icono, color] = ICONOS_BOTIN[tipo];
  return `<i class="fa-solid fa-${icono}" style="color:${color}"></i><b>${esc(texto)}</b>${detalle ? `<small>${esc(detalle)}</small>` : ''}`;
};

// ---------- Vistas ----------
const lista = (d) => `<table class="lista-enemigos"><thead><tr><th>Nivel</th><th>Enemigo</th></tr></thead><tbody>
  ${[...d.enemigos].sort((a, b) => a.nivel - b.nivel).map((e) => `<tr tabindex="0" data-enemigo="${esc(e.id)}" role="button" aria-label="Abrir ${esc(e.nombre)}">
    <td class="nivel-celda">${ROMANOS[e.nivel]}</td><td>${esc(e.nombre)}</td></tr>`).join('')}
  </tbody></table>`;

const panelVida = () => `<section class="panel-vida" aria-label="Seguimiento del combate">
  <div class="jugadores" role="group" aria-label="Número de jugadores"><span>Jugadores</span>
    ${JUGADORES.map((j) => `<button type="button" data-jugadores="${j}">${j}</button>`).join('')}</div>
  <div class="vida vida-enemigo" role="group" aria-label="Vida del enemigo">
    <button type="button" class="vida-btn" data-vida="-1" aria-label="Quitar 1 de vida">−</button>
    <span class="vida-valor" aria-live="polite">${CORAZON}<b></b></span>
    <button type="button" class="vida-btn" data-vida="1" aria-label="Sumar 1 de vida">+</button>
  </div>
  <button type="button" class="reiniciar" data-reiniciar>Reiniciar</button>
  <p class="estado-derrota" hidden>Derrotado</p>
  <div class="botin" hidden><h3>Botín</h3><p class="botin-item"></p></div>
</section>`;

function abrirEnemigo(zona, d, e) {
  const n = d.niveles.find((x) => x.nivel === e.nivel);
  zona.innerHTML = `<button type="button" class="volver" data-volver>← Enemigos</button>
    <h2 class="titulo-enemigo">${esc(e.nombre)} <small>Nivel ${ROMANOS[e.nivel]} · ${esc(n.nombre)}</small></h2>
    ${panelVida()}<div class="rejilla-enemigos">${carta(e, n)}</div>`;
  const q = (s) => zona.querySelector(s);
  const guardadas = leer(CLAVE_JUGADORES, 4);
  let jugadores = JUGADORES.includes(guardadas) ? guardadas : 4;
  let vida;
  const maximo = () => n.vida[JUGADORES.indexOf(jugadores)];
  const cargarVida = () => { const v = Number(leer(claveVida(e.id, jugadores), maximo())); vida = Number.isInteger(v) && v >= 0 && v <= maximo() ? v : maximo(); };
  const pintar = () => {
    const pct = vida / maximo();
    q('.vida-valor b').textContent = vida;
    q('.vida-enemigo').classList.toggle('baja', vida > 0 && pct <= 0.3);
    q('[data-vida="-1"]').disabled = vida <= 0;
    q('[data-vida="1"]').disabled = vida >= maximo();
    zona.querySelectorAll('[data-jugadores]').forEach((b) => b.classList.toggle('activo', Number(b.dataset.jugadores) === jugadores));
    q('.estado-derrota').hidden = vida > 0;
    if (vida > 0) olvidar(claveBotin(e.id, jugadores)); // el botín solo existe mientras el enemigo está derrotado
    else {
      let botin = leer(claveBotin(e.id, jugadores), null);
      if (!botin) { botin = tirarBotin(n); guardar(claveBotin(e.id, jugadores), botin); }
      q('.botin-item').innerHTML = botinHtml(botin);
      q('.botin').classList.toggle('bueno', botin.tipo === 'arma' || botin.tipo === 'armadura');
    }
    q('.botin').hidden = vida > 0;
    zona.classList.toggle('derrotado', vida <= 0);
  };
  zona.onclick = (ev) => {
    if (atenderNarracion(ev)) return;
    if (ev.target.closest('[data-volver]')) return mostrarLista(zona, d);
    const j = ev.target.closest('[data-jugadores]');
    const v = ev.target.closest('[data-vida]');
    if (j) { jugadores = Number(j.dataset.jugadores); guardar(CLAVE_JUGADORES, jugadores); cargarVida(); }
    else if (v) { vida = Math.min(maximo(), Math.max(0, vida + Number(v.dataset.vida))); guardar(claveVida(e.id, jugadores), vida); }
    else if (ev.target.closest('[data-reiniciar]')) { vida = maximo(); guardar(claveVida(e.id, jugadores), vida); olvidar(claveBotin(e.id, jugadores)); }
    else {
      const c = ev.target.closest('.volteo.gira');
      if (c) { const giro = Number(c.dataset.giro ?? 0) + 1; c.dataset.giro = giro; c.style.setProperty('--giro', giro); }
      return;
    }
    pintar();
  };
  zona.onkeydown = (ev) => {
    const c = ev.target.closest('.volteo.gira');
    if (c && (ev.key === 'Enter' || ev.key === ' ')) { ev.preventDefault(); c.click(); }
  };
  cargarVida();
  pintar();
  scrollTo({ top: 0, behavior: 'instant' });
}

function mostrarLista(zona, d, desplazar = true) {
  zona.onclick = (ev) => { const f = ev.target.closest('[data-enemigo]'); if (f) abrirEnemigo(zona, d, d.enemigos.find((e) => e.id === f.dataset.enemigo)); };
  zona.onkeydown = (ev) => { const f = ev.target.closest('[data-enemigo]'); if (f && (ev.key === 'Enter' || ev.key === ' ')) { ev.preventDefault(); f.click(); } };
  zona.classList.remove('derrotado');
  zona.innerHTML = lista(d);
  if (desplazar) scrollTo({ top: 0, behavior: 'instant' });
}

function ajustarEscala(raiz) {
  raiz.style.setProperty('--escala-bestiario', Math.min(1, (innerWidth - 32) / 306).toFixed(3));
}

export async function initBestiario() {
  const raiz = document.querySelector('.bestiario');
  const zona = document.getElementById('bestiario-catalogo');
  if (!raiz || !zona) return;
  ajustarEscala(raiz);
  addEventListener('resize', () => ajustarEscala(raiz));
  try {
    const d = await (await fetch(new URL('enemigos.json', RAIZ), { cache: 'no-cache' })).json();
    mostrarLista(zona, d, false);
  } catch (err) {
    console.error(err);
    zona.innerHTML = '<p class="estado alerta">No se pudo cargar el bestiario</p>';
  }
}
