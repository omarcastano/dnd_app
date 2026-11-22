// Efectos de la clase Pícaro: filo (destellos y aura roja), sombra (niebla y destellos de oro), humo (humo y chispas). Estilos en efectos.css.
import { rnd } from '../../app/util.js';

const elegir = (xs) => xs[Math.floor(Math.random() * xs.length)];
const chispas = (n, colores) => Array.from({ length: n }, () =>
  `<i class="chispa-p" style="left:${rnd(2, 98)}%;--dx:${rnd(-40, 40).toFixed(0)}px;--t:${rnd(1.6, 2.8).toFixed(2)}s;--r:${rnd(0, .9).toFixed(2)}s;background:${elegir(colores)}"></i>`).join('');
const humos = (n) => Array.from({ length: n }, () =>
  `<i class="humo-p" style="top:${rnd(5, 90)}%;--dy:${rnd(-120, 120).toFixed(0)}px;--t:${rnd(1.4, 2.4).toFixed(2)}s;--r:${rnd(0, 1).toFixed(2)}s"></i>`).join('');

export const efectos = {
  filo: () => `<div class="aura-p"></div><div class="anillo-p"></div>${chispas(26, ['#e63946', '#ffd24a', '#c9c9d6'])}`,
  sombra: () => `<div class="niebla-p"></div>${chispas(18, ['#ffd24a', '#fff2b0', '#6b4a8a'])}`,
  humo: () => `<div class="niebla-p"></div>${humos(18)}`,
};

// efecto → tema de la pantalla final
export const temas = { filo: 'filo', sombra: 'sombra', humo: 'noche' };
