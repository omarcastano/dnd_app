// Efectos de la clase Druida: garras (poder salvaje), sanacion y curandero (poder sanador). Estilos en efectos.css.
import { rnd } from '../../app/util.js';

const elegir = (xs) => xs[Math.floor(Math.random() * xs.length)];
const hojas = (n, colores) => Array.from({ length: n }, () =>
  `<i class="hoja" style="left:${rnd(2, 98)}%;--dx:${rnd(-70, 70).toFixed(0)}px;--rot:${rnd(-360, 360).toFixed(0)}deg;--t:${rnd(1.6, 2.6).toFixed(2)}s;--r:${rnd(0, .8).toFixed(2)}s;background:${elegir(colores)}"></i>`).join('');
const chispas = (n) => Array.from({ length: n }, () =>
  `<i class="chispa" style="left:${rnd(15, 85)}%;top:${rnd(55, 85)}%;--t:${rnd(1, 2).toFixed(2)}s;--r:${rnd(0, .8).toFixed(2)}s"></i>`).join('');
const brasas = (n) => Array.from({ length: n }, () =>
  `<i class="brasa" style="left:${rnd(0, 100)}%;--dx:${rnd(-60, 60).toFixed(0)}px;--t:${rnd(1.2, 2.4).toFixed(2)}s;--r:${rnd(0, .9).toFixed(2)}s"></i>`).join('');

export const efectos = {
  sanacion: () => `<div class="aura"></div><div class="anillo"></div>${hojas(26, ['#58b368', '#7fd18b', '#3b8f4f'])}${chispas(14)}`,
  curandero: () => `<div class="aura"></div><div class="anillo"></div><div class="anillo a2"></div>${hojas(34, ['#58b368', '#a6e3a1', '#3b8f4f'])}${chispas(22)}`,
  garras: () => `<div class="halo-oso"></div>${brasas(20)}<i class="zarpa z1"></i><i class="zarpa z2"></i><i class="zarpa z3"></i>`,
};

// efecto → tema de la pantalla final (salvaje = brasas rojas, sanador = puntos verdes)
export const temas = { garras: 'salvaje', sanacion: 'sanador', curandero: 'sanador' };
