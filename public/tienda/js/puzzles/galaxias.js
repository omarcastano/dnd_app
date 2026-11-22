import { arrastrar, directions, entero, gridOf, mezclar, setPuzzleMsg } from "../nucleo/utilidades.js";

// Galaxias: reparte la cuadrícula en regiones conexas con simetría de giro de 180° alrededor de su punto.
// Los centros usan coordenadas dobles: [2r, 2c] = centro de celda, impar = arista o vértice.
const N = 8;
let galaxias = []; // { cr, cc, celdas: [[r,c]...] }  (celdas = las que rodean al punto, ya fijas)
let asignacion = gridOf(N, N, -1);
let fijas = gridOf(N, N, false);
let elegida = -1;
let pincel = null; // galaxia que se está pintando o "borrar"
let resuelto = false;

const espejo = (g, r, c) => [g.cr - r, g.cc - c];
const dentro = (r, c) => r >= 0 && r < N && c >= 0 && c < N;

function celdasDelCentro(cr, cc) {
  const rs = cr % 2 ? [(cr - 1) / 2, (cr + 1) / 2] : [cr / 2];
  const cs = cc % 2 ? [(cc - 1) / 2, (cc + 1) / 2] : [cc / 2];
  return rs.flatMap(r => cs.map(c => [r, c]));
}

export function generarGalaxias(n = N) {
  for (let intento = 0; intento < 3000; intento++) {
    const reg = gridOf(n, n, -1);
    const lista = [];
    const celdasLibres = () => mezclar([...Array(n * n).keys()].map(k => [Math.floor(k / n), k % n]).filter(([r, c]) => reg[r][c] < 0));
    let libres = celdasLibres();
    while (libres.length) {
      const [r, c] = libres[0];
      const tipo = Math.random();
      let cr = 2 * r, cc = 2 * c;
      if (tipo > 0.5) { cr += entero(2); cc += entero(2); }
      let inicial = celdasDelCentro(cr, cc);
      if (!inicial.every(([a, b]) => dentro(a, b) && reg[a][b] < 0)) { cr = 2 * r; cc = 2 * c; inicial = [[r, c]]; }
      const id = lista.length;
      const g = { cr, cc, celdas: inicial };
      inicial.forEach(([a, b]) => { reg[a][b] = id; });
      let objetivo = 1 + entero(9);
      let fallos = 0;
      while (objetivo > 0 && fallos < 12) {
        const frontera = [];
        reg.forEach((f, a) => f.forEach((v, b) => {
          if (v !== id) return;
          directions.forEach(([dr, dc]) => { if (dentro(a + dr, b + dc) && reg[a + dr][b + dc] < 0) frontera.push([a + dr, b + dc]); });
        }));
        const x = frontera[entero(frontera.length)];
        if (!x) break;
        const [mr, mc] = espejo(g, x[0], x[1]);
        if (!dentro(mr, mc) || reg[mr][mc] >= 0 || (mr === x[0] && mc === x[1])) { fallos++; continue; }
        reg[x[0]][x[1]] = id; reg[mr][mc] = id;
        objetivo--;
      }
      lista.push(g);
      libres = celdasLibres();
    }
    const tamanos = lista.map((_, k) => reg.flat().filter(v => v === k).length);
    const solitarias = tamanos.filter(t => t === 1).length;
    if (lista.length > 18 || lista.length < 7 || solitarias > 4) continue;
    return { galaxias: lista, solucion: reg };
  }
  return null;
}

function nuevo() {
  const p = generarGalaxias(N);
  galaxias = p ? p.galaxias : [{ cr: 0, cc: 0, celdas: [[0, 0]] }];
  asignacion = gridOf(N, N, -1);
  fijas = gridOf(N, N, false);
  galaxias.forEach((g, k) => g.celdas.forEach(([r, c]) => { asignacion[r][c] = k; fijas[r][c] = true; }));
  elegida = 0;
  resuelto = false;
  setPuzzleMsg("galaxyMessage", "");
  render();
}

const color = k => `hsl(${(k * 137) % 360}, 52%, 36%)`;

function render() {
  const t = document.getElementById("galaxyBoard");
  t.style.setProperty("--n", N);
  let html = "";
  for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) {
    const k = asignacion[r][c];
    const lados = directions.map(([dr, dc]) => (dentro(r + dr, c + dc) && asignacion[r + dr][c + dc] === k && k >= 0 ? 0 : 1));
    // directions: [1,0]=abajo, [-1,0]=arriba, [0,1]=derecha, [0,-1]=izquierda
    const sombra = [
      lados[1] ? "inset 0 3px 0 #120b05" : "", lados[0] ? "inset 0 -3px 0 #120b05" : "",
      lados[3] ? "inset 3px 0 0 #120b05" : "", lados[2] ? "inset -3px 0 0 #120b05" : ""
    ].filter(Boolean).join(",");
    const estilo = `${k >= 0 ? `background:${color(k)};` : ""}${sombra ? `box-shadow:${sombra};` : ""}`;
    html += `<div class="gal-celda${k >= 0 && k === elegida ? " activa" : ""}${fijas[r][c] ? " fija" : ""}" style="${estilo}" data-r="${r}" data-c="${c}"></div>`;
  }
  galaxias.forEach((g, k) => {
    const x = ((g.cc + 1) / (2 * N)) * 100;
    const y = ((g.cr + 1) / (2 * N)) * 100;
    html += `<button type="button" class="gal-punto${k === elegida ? " elegido" : ""}" data-galaxia="${k}" style="left:${x}%;top:${y}%;--col:${color(k)}" aria-label="Galaxia ${k + 1}"></button>`;
  });
  t.innerHTML = html;
}

function pintarCelda(r, c, k) {
  if (!dentro(r, c) || fijas[r][c]) return;
  if (k < 0) {
    const g = galaxias[asignacion[r][c]];
    if (!g) return;
    const [mr, mc] = espejo(g, r, c);
    asignacion[r][c] = -1;
    if (dentro(mr, mc) && !fijas[mr][mc] && asignacion[mr][mc] === galaxias.indexOf(g)) asignacion[mr][mc] = -1;
    return;
  }
  const g = galaxias[k];
  const [mr, mc] = espejo(g, r, c);
  if (!dentro(mr, mc)) { setPuzzleMsg("galaxyMessage", "Esa celda no tiene reflejo dentro del tablero: no puede ser de esta galaxia."); return; }
  if (fijas[mr][mc] && asignacion[mr][mc] !== k) { setPuzzleMsg("galaxyMessage", "Su reflejo cae en otra galaxia."); return; }
  asignacion[r][c] = k;
  asignacion[mr][mc] = k;
}

function galaxyError() {
  for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) if (asignacion[r][c] < 0) return "Hay celdas sin galaxia.";
  for (let k = 0; k < galaxias.length; k++) {
    const g = galaxias[k];
    const celdas = [];
    for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) if (asignacion[r][c] === k) celdas.push([r, c]);
    for (const [r, c] of celdas) {
      const [mr, mc] = espejo(g, r, c);
      if (!dentro(mr, mc) || asignacion[mr][mc] !== k) return "Una galaxia no es simétrica respecto a su punto.";
    }
    const vistos = new Set([celdas[0].join()]);
    const pila = [celdas[0]];
    while (pila.length) {
      const [r, c] = pila.pop();
      for (const [dr, dc] of directions) {
        if (dentro(r + dr, c + dc) && asignacion[r + dr][c + dc] === k && !vistos.has([r + dr, c + dc].join())) { vistos.add([r + dr, c + dc].join()); pila.push([r + dr, c + dc]); }
      }
    }
    if (vistos.size !== celdas.length) return "Una galaxia no es continua (sus celdas deben estar pegadas).";
  }
  return null;
}

function revisarVictoria() {
  if (!galaxyError()) { resuelto = true; setPuzzleMsg("galaxyMessage", "¡Puzzle resuelto!", true); }
}

export function initGalaxias() {
  const t = document.getElementById("galaxyBoard");
  t.addEventListener("click", e => {
    const punto = e.target.closest("[data-galaxia]");
    if (!punto) return;
    elegida = Number(punto.dataset.galaxia);
    setPuzzleMsg("galaxyMessage", "");
    render();
  });
  arrastrar(t, (r, c) => {
    if (resuelto) return false;
    if (fijas[r][c]) { elegida = asignacion[r][c]; render(); return false; }
    pincel = asignacion[r][c] === elegida ? -1 : elegida;
    setPuzzleMsg("galaxyMessage", "");
    pintarCelda(r, c, pincel);
    render();
    revisarVictoria();
    return true;
  }, (r, c) => {
    if (fijas[r][c]) return;
    if (pincel === -1 && asignacion[r][c] !== elegida) return;
    pintarCelda(r, c, pincel);
    render();
    revisarVictoria();
  });
  document.getElementById("galaxyCheck").addEventListener("click", () => {
    const error = galaxyError();
    if (error) setPuzzleMsg("galaxyMessage", error);
    else { resuelto = true; setPuzzleMsg("galaxyMessage", "¡Puzzle resuelto!", true); }
  });
  document.getElementById("galaxyReset").addEventListener("click", () => {
    asignacion = gridOf(N, N, -1);
    galaxias.forEach((g, k) => g.celdas.forEach(([r, c]) => { asignacion[r][c] = k; }));
    resuelto = false;
    setPuzzleMsg("galaxyMessage", "");
    render();
  });
  document.getElementById("galaxyNew").addEventListener("click", nuevo);
  nuevo();
}
