// Carta de un enemigo (frente con retrato y dorso con descripción, habilidades y ataques). La comparten la pestaña Bestiario
// y las escenas de combate del libro de campañas (Mapas), para que la bestia se vea igual en los dos sitios.
import { esc } from '../personajes/app/util.js';
import { MEDALLON } from '../personajes/app/cartas.js';
import { ROMANOS, ESQUINAS, filaAtaque, cartaVolteable } from '../personajes/app/combate.js?v=3';

export const RAIZ_ENEMIGOS = new URL('./', import.meta.url);

const frente = (e) => `${ESQUINAS}
  <div class="retrato-p"><img src="${new URL(`imagenes/${e.id}.webp`, RAIZ_ENEMIGOS).href}" alt="${esc(e.nombre)}"${e.encuadre ? ` style="object-position:${esc(e.encuadre)}"` : ''}></div>
  <div class="pie-p"><div class="nombre-carta">${esc(e.nombre)}</div>${e.narracion ? MEDALLON(new URL(e.narracion, RAIZ_ENEMIGOS).href) : '<div class="divisor"><i>◆</i></div>'}
  <div class="linaje">${esc(e.tipo)}<b>◆</b>Nivel ${ROMANOS[e.nivel]}</div></div>`;

const dorso = (e, n) => `${ESQUINAS}
  <div class="placa"><h3>${esc(e.nombre)}</h3><div class="nivel-p">Nivel ${ROMANOS[e.nivel]}</div></div>
  <div class="cuerpo-p">
    <div class="bloque desc-e"><p class="desc-p">${esc(e.descripcion)}</p></div>
    <div class="bloque"><h5>${e.habilidades.length > 1 ? 'Habilidades' : 'Habilidad'}</h5>${e.habilidades.map((h) => `<div class="habilidad-e"><b>${esc(h.nombre)}</b><p>${esc(h.descripcion)}</p></div>`).join('')}</div>
    <div class="bloque"><h5>Ataques</h5>${e.ataques.map((a) => filaAtaque(a, n)).join('')}<p class="nota-e">Con 1-4 el enemigo falla.</p></div>
  </div>`;

// Carta volteable completa (n = fila de `niveles` del enemigo)
export const cartaEnemigo = (e, n) => cartaVolteable(e.nombre, frente(e), dorso(e, n));
// Subtítulo de la ficha: «Nivel III · <nombre del nivel>»
export const subtituloEnemigo = (e, n) => `Nivel ${ROMANOS[e.nivel]} · ${n.nombre}`;
// Datos del bestiario (niveles y enemigos), siempre frescos
export const cargarEnemigos = async () => (await fetch(new URL('enemigos.json', RAIZ_ENEMIGOS), { cache: 'no-cache' })).json();
