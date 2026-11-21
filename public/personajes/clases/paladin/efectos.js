// Efectos de la clase Paladín: castigo (fuego sagrado), luz (curación), resurreccion (columna de luz), egida (escudo). Estilos en efectos.css.
import { rnd } from '../../app/util.js';

const elegir = (xs) => xs[Math.floor(Math.random() * xs.length)];
const motas = (n, colores) => Array.from({ length: n }, () =>
  `<i class="mota" style="left:${rnd(2, 98)}%;--dx:${rnd(-60, 60).toFixed(0)}px;--t:${rnd(1.6, 2.8).toFixed(2)}s;--r:${rnd(0, .9).toFixed(2)}s;background:${elegir(colores)}"></i>`).join('');

export const efectos = {
  castigo: () => `<div class="halo-castigo"></div><i class="rayo r1"></i><i class="rayo r2"></i><i class="rayo r3"></i>${motas(22, ['#ffd24a', '#fff2b0', '#ff9a2a'])}`,
  luz: () => `<div class="aura-pal"></div><div class="anillo-pal"></div>${motas(28, ['#fff6c8', '#ffe27a', '#ffffff'])}`,
  resurreccion: () => `<div class="aura-pal"></div><div class="columna"></div><div class="anillo-pal"></div><div class="anillo-pal a2"></div>${motas(36, ['#fff6c8', '#ffe27a', '#ffffff'])}`,
  egida: () => `<div class="escudo-pal"></div><div class="anillo-pal"></div>${motas(16, ['#bcd8ff', '#ffffff', '#ffe27a'])}`,
};

// efecto → tema de la pantalla final (castigo/egida = acero y oro ardiente, luz/resurreccion = oro claro)
export const temas = { castigo: 'castigo', egida: 'egida', luz: 'sagrado', resurreccion: 'sagrado' };
