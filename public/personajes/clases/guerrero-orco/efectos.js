// Efectos de la clase Guerrero Taurent: provocacion (ondas de rugido), furia (tajos y brasas), aguante (chispas de hierro). Estilos en efectos.css.
import { rnd } from '../../app/util.js';

const elegir = (xs) => xs[Math.floor(Math.random() * xs.length)];
const chispas = (n, colores) => Array.from({ length: n }, () =>
  `<i class="chispa-orco" style="left:${rnd(2, 98)}%;--dx:${rnd(-60, 60).toFixed(0)}px;--t:${rnd(1.2, 2.4).toFixed(2)}s;--r:${rnd(0, .9).toFixed(2)}s;background:${elegir(colores)}"></i>`).join('');

export const efectos = {
  provocacion: () => `<div class="halo-orco"></div><div class="onda-orco"></div><div class="onda-orco o2"></div><div class="onda-orco o3"></div>${chispas(16, ['#ff7a1a', '#ffd24a'])}`,
  furia: () => `<div class="halo-orco furia"></div><i class="tajo-orco t1"></i><i class="tajo-orco t2"></i><i class="tajo-orco t3"></i>${chispas(24, ['#e01e00', '#ff5a1a', '#ffb030'])}`,
  aguante: () => `<div class="halo-orco aguante"></div><div class="onda-orco o2 verde"></div>${chispas(20, ['#9ad66a', '#d8ffb0', '#5c8f3a'])}`,
};

// efecto → tema de la pantalla final
export const temas = { provocacion: 'provocador', furia: 'berserker', aguante: 'orco' };
