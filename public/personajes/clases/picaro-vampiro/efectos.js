// Efectos de la clase Pícaro Vampiro: sangre (gotas y aura roja), sombra (niebla y destellos de oro), murcielagos (bandada). Estilos en efectos.css.
import { rnd } from '../../app/util.js';

const elegir = (xs) => xs[Math.floor(Math.random() * xs.length)];
const gotas = (n, colores) => Array.from({ length: n }, () =>
  `<i class="gota-vam" style="left:${rnd(2, 98)}%;--dx:${rnd(-40, 40).toFixed(0)}px;--t:${rnd(1.6, 2.8).toFixed(2)}s;--r:${rnd(0, .9).toFixed(2)}s;background:${elegir(colores)}"></i>`).join('');
const murcis = (n) => Array.from({ length: n }, () =>
  `<i class="murci" style="top:${rnd(5, 90)}%;--dy:${rnd(-120, 120).toFixed(0)}px;--t:${rnd(1.4, 2.4).toFixed(2)}s;--r:${rnd(0, 1).toFixed(2)}s"></i>`).join('');

export const efectos = {
  sangre: () => `<div class="aura-vam"></div><div class="anillo-vam"></div>${gotas(26, ['#c1121f', '#ff4d5a', '#7a0010'])}`,
  sombra: () => `<div class="niebla-vam"></div>${gotas(18, ['#ffd24a', '#fff2b0', '#6b4a8a'])}`,
  murcielagos: () => `<div class="niebla-vam"></div>${murcis(18)}`,
};

// efecto → tema de la pantalla final
export const temas = { sangre: 'sangre', sombra: 'sombra', murcielagos: 'noche' };
