# Efectos de clase (`efectos.js` + `efectos.css`)

Cada clase real declara `"efectos": true` en `personajes/clases.json` y aporta ambos archivos en `clases/<id>/`.
El motor (`personajes/app/efectos.js`) no conoce ninguna clase. Valor de `efecto` en `seleccion` → función en `efectos`.

## efectos.js (patrón del druida)
```js
// Efectos de la clase <Clase>: <efecto-uno> (...), <efecto-dos> (...). Estilos en efectos.css.
import { rnd } from '../../app/util.js';

const elegir = (xs) => xs[Math.floor(Math.random() * xs.length)];
// generador de partículas: n elementos <i class="PARTICULA" style="left:..;--dx:..;--t:..;--r:..">
const particulas = (n, colores) => Array.from({ length: n }, () =>
  `<i class="particula" style="left:${rnd(2, 98)}%;--dx:${rnd(-70, 70).toFixed(0)}px;--t:${rnd(1.6, 2.6).toFixed(2)}s;--r:${rnd(0, .8).toFixed(2)}s;background:${elegir(colores)}"></i>`).join('');

export const efectos = {
  'efecto-uno': () => `<div class="aura"></div><div class="anillo"></div>${particulas(26, ['#...', '#...'])}`,
  'efecto-dos': () => `<div class="halo"></div>${particulas(20, ['#...'])}`,
};

// efecto → tema de la pantalla final (nombre de tema = sufijo de body.tema-X y .ambiente-X)
export const temas = { 'efecto-uno': 'tema-a', 'efecto-dos': 'tema-b' };
```
Reglas: un efecto por cada `efecto` usado en `seleccion` (poderes y dones); poder y don de la misma "familia" pueden compartir efecto.
No usar globales; el HTML lo genera la función, los estilos van en el CSS.

## efectos.css (patrón del druida)
- Prefijo `.efecto .X` para las partículas/auras, con `@keyframes ef-*` (nombres únicos por clase: `ef-<clase>-...` si chocan con otra clase).
- Variables por partícula: `--t` duración, `--r` retardo, `--dx` deriva, `--rot` giro.
- Temas de la pantalla final (uno por `temas`):
```css
body.catalogo.tema-a { background: radial-gradient(120% 60% at 50% 0%, #C1 0%, #C2 45%, #C3 100%) fixed; }
body.tema-a .barra { background: #0a0604dd; }
.ambiente-tema-a i { background: #COLOR; box-shadow: 0 0 10px 3px #COLOR2; }
```
Elige paletas que coincidan con la temática de cada poder (fuego = rojos/naranjas, hielo = azules, sombra = violetas…).
