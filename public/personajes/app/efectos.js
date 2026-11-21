// Motor de efectos y ambientes. No conoce ninguna clase: cada clase aporta su módulo (`clases/<clase>/efectos.js`)
// con { efectos: { nombre: () => html }, temas: { nombre: tema } } y su hoja `efectos.css` (ver catalogo.js).
import { rnd } from './util.js';

const EFECTOS = {};
const TEMAS = {};

export function registrarEfectos({ efectos = {}, temas = {} }) {
  Object.assign(EFECTOS, efectos);
  Object.assign(TEMAS, temas);
}

// Animación a pantalla completa de la opción elegida (campo `efecto` del JSON). La promesa se cumple al terminar.
export function reproducirEfecto(nombre) {
  const crear = EFECTOS[nombre];
  if (!crear || matchMedia('(prefers-reduced-motion: reduce)').matches) return Promise.resolve();
  const capa = document.createElement('div');
  capa.className = `efecto efecto-${nombre}`;
  capa.setAttribute('aria-hidden', 'true');
  capa.innerHTML = crear();
  document.body.append(capa);
  return new Promise((ok) => setTimeout(() => { capa.classList.add('sale'); setTimeout(() => { capa.remove(); ok(); }, 400); }, 2100));
}

// Tema de la pantalla final: gana el que más se repite; si empatan, el de la primera elección (el poder)
export function temaDe(efectos) {
  const conTema = efectos.filter((e) => TEMAS[e]);
  const cuenta = {};
  conTema.forEach((e) => { cuenta[TEMAS[e]] = (cuenta[TEMAS[e]] ?? 0) + 1; });
  return Object.keys(cuenta).reduce((a, b) => (cuenta[b] > cuenta[a] ? b : a), TEMAS[conTema[0]]);
}

const motas = (n) => Array.from({ length: n }, () =>
  `<i style="left:${rnd(0, 100)}%;--s:${rnd(3, 8).toFixed(1)}px;--dx:${rnd(-50, 50).toFixed(0)}px;--t:${rnd(7, 15).toFixed(1)}s;--r:${(-rnd(0, 15)).toFixed(1)}s"></i>`).join('');

// Fondo y partículas flotantes (clase `tema-<tema>` en `.heroes` y capa `.ambiente-<tema>`). Sin tema: fondo normal.
export function ponerAmbiente(tema) {
  const raiz = document.querySelector('.heroes');
  raiz.querySelector('.ambiente')?.remove();
  [...raiz.classList].filter((c) => c.startsWith('tema-')).forEach((c) => raiz.classList.remove(c));
  if (!tema) return;
  raiz.classList.add(`tema-${tema}`);
  const capa = document.createElement('div');
  capa.className = `ambiente ambiente-${tema}`;
  capa.setAttribute('aria-hidden', 'true');
  capa.innerHTML = motas(36);
  raiz.prepend(capa);
}
