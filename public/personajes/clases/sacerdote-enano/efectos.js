// Efectos de la clase Sacerdote Enano: juicio (yunque y brasas), manantial (agua curativa), resguardo (runas de piedra). Estilos en efectos.css.
import { rnd } from '../../app/util.js';

const elegir = (xs) => xs[Math.floor(Math.random() * xs.length)];
const motas = (n, colores) => Array.from({ length: n }, () =>
  `<i class="mota-sac" style="left:${rnd(2, 98)}%;--dx:${rnd(-60, 60).toFixed(0)}px;--t:${rnd(1.6, 2.8).toFixed(2)}s;--r:${rnd(0, .9).toFixed(2)}s;background:${elegir(colores)}"></i>`).join('');

export const efectos = {
  juicio: () => `<div class="halo-juicio"></div><i class="yunque-sac"></i>${motas(24, ['#ffb347', '#ff7a1a', '#ffe1a0'])}`,
  manantial: () => `<div class="halo-manantial"></div><div class="onda-sac"></div><div class="onda-sac b2"></div>${motas(30, ['#9ff0e0', '#d8fff7', '#6fd6ff'])}`,
  resguardo: () => `<div class="runa-sac"></div><div class="onda-sac"></div>${motas(18, ['#c9d2dc', '#ffffff', '#e8c36a'])}`,
};

export const temas = { juicio: 'sac-juicio', manantial: 'sac-manantial', resguardo: 'sac-resguardo' };
