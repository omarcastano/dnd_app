import { directions, gridOf, mezclar, setPuzzleMsg } from "../nucleo/utilidades.js";

// Carpas: cada árbol (estrella) tiene una carpa (moneda) pegada, sin tocarse entre sí.
const N = 8;
let puzzle = null;
let tablero = gridOf(N, N, 0); // 0 vacío, 1 carpa, 2 hierba (marca)
let resuelto = false;

const adyacentes = (a, b) => Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) === 1;
const tocan = (a, b) => Math.abs(a[0] - b[0]) <= 1 && Math.abs(a[1] - b[1]) <= 1;

function emparejable(carpas, arboles) {
  const deArbol = new Array(arboles.length).fill(-1);
  const probar = (i, visto) => {
    for (let j = 0; j < arboles.length; j++) {
      if (!visto[j] && adyacentes(carpas[i], arboles[j])) {
        visto[j] = true;
        if (deArbol[j] === -1 || probar(deArbol[j], visto)) { deArbol[j] = i; return true; }
      }
    }
    return false;
  };
  return carpas.every((_, i) => probar(i, new Array(arboles.length).fill(false)));
}

export function contarSoluciones(p, limite = 2) {
  const n = p.n;
  const esArbol = gridOf(n, n, false);
  p.arboles.forEach(([r, c]) => { esArbol[r][c] = true; });
  const candidata = (r, c) => !esArbol[r][c] && directions.some(([dr, dc]) => esArbol[r + dr]?.[c + dc]);
  const carpas = [];
  const filas = Array(n).fill(0);
  const cols = Array(n).fill(0);
  let cuenta = 0;
  const rec = i => {
    if (cuenta >= limite) return;
    if (i === n * n) {
      if (carpas.length === p.arboles.length && cols.every((v, c) => v === p.colClues[c]) && emparejable(carpas, p.arboles)) cuenta++;
      return;
    }
    const r = Math.floor(i / n), c = i % n;
    const finFila = c === n - 1;
    const sigue = () => { if (!finFila || filas[r] === p.rowClues[r]) rec(i + 1); };
    if (candidata(r, c) && filas[r] < p.rowClues[r] && cols[c] < p.colClues[c] && !carpas.some(t => tocan(t, [r, c]))) {
      // las columnas que ya no pueden llegar a su cifra se podan al final de la partida
      carpas.push([r, c]); filas[r]++; cols[c]++;
      sigue();
      carpas.pop(); filas[r]--; cols[c]--;
    }
    sigue();
  };
  rec(0);
  return cuenta;
}

export function generarCarpas(n = N) {
  for (let intento = 0; intento < 4000; intento++) {
    const carpas = [];
    const arboles = [];
    const ocupado = gridOf(n, n, false);
    const objetivo = Math.round(n * n * 0.19);
    const celdas = mezclar([...Array(n * n).keys()]);
    for (const k of celdas) {
      if (carpas.length >= objetivo) break;
      const t = [Math.floor(k / n), k % n];
      if (ocupado[t[0]][t[1]] || carpas.some(x => tocan(x, t))) continue;
      const vec = mezclar(directions).map(([dr, dc]) => [t[0] + dr, t[1] + dc])
        .filter(([r, c]) => r >= 0 && r < n && c >= 0 && c < n && !ocupado[r][c] && !carpas.some(x => x[0] === r && x[1] === c));
      const a = vec[0];
      if (!a) continue;
      carpas.push(t); arboles.push(a);
      ocupado[t[0]][t[1]] = true; ocupado[a[0]][a[1]] = true;
    }
    if (carpas.length < objetivo - 1) continue;
    const rowClues = Array(n).fill(0);
    const colClues = Array(n).fill(0);
    carpas.forEach(([r, c]) => { rowClues[r]++; colClues[c]++; });
    const p = { n, arboles, rowClues, colClues };
    if (contarSoluciones(p, 2) === 1) return { ...p, carpas };
  }
  return null;
}

function nuevo() {
  puzzle = generarCarpas(N) || { n: 1, arboles: [], rowClues: [0], colClues: [0] };
  tablero = gridOf(puzzle.n, puzzle.n, 0);
  resuelto = false;
  setPuzzleMsg("puzzleMessage", "");
  render();
}

const esArbol = (r, c) => puzzle.arboles.some(([tr, tc]) => tr === r && tc === c);

function conteos() {
  const n = puzzle.n;
  const f = Array(n).fill(0), c = Array(n).fill(0);
  for (let r = 0; r < n; r++) for (let k = 0; k < n; k++) if (tablero[r][k] === 1) { f[r]++; c[k]++; }
  return { f, c };
}

function render() {
  const n = puzzle.n;
  const { f, c: cc } = conteos();
  const cls = (v, meta) => (v === meta ? "cumplida" : v > meta ? "excedida" : "");
  let html = "<tr><th></th>";
  for (let c = 0; c < n; c++) html += `<th class="clue ${cls(cc[c], puzzle.colClues[c])}">${puzzle.colClues[c]}</th>`;
  html += "</tr>";
  for (let r = 0; r < n; r++) {
    html += `<tr><td class="clue ${cls(f[r], puzzle.rowClues[r])}">${puzzle.rowClues[r]}</td>`;
    for (let c = 0; c < n; c++) {
      if (esArbol(r, c)) {
        html += '<td class="puzzle-cell tree"><i class="fa-solid fa-tree"></i></td>';
      } else {
        const v = tablero[r][c];
        const icono = v === 1 ? '<i class="fa-solid fa-campground"></i>' : v === 2 ? '<i class="fa-solid fa-leaf"></i>' : "";
        const choca = v === 1 && puzzle.n && tablero.some((fila, rr) => fila.some((x, k) => x === 1 && (rr !== r || k !== c) && tocan([rr, k], [r, c])));
        html += `<td class="puzzle-cell${v === 1 ? " carpa" : ""}${v === 2 ? " hierba" : ""}${choca ? " error" : ""}" data-r="${r}" data-c="${c}">${icono}</td>`;
      }
    }
    html += "</tr>";
  }
  const t = document.getElementById("puzzleTable");
  t.style.setProperty("--n", n + 1);
  t.innerHTML = html;
}

function puzzleError() {
  const n = puzzle.n;
  const carpas = [];
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (tablero[r][c] === 1) carpas.push([r, c]);
  if (carpas.length !== puzzle.arboles.length) return `Debes poner ${puzzle.arboles.length} carpas, una por cada árbol (ahora hay ${carpas.length}).`;
  for (let i = 0; i < carpas.length; i++) for (let j = i + 1; j < carpas.length; j++) if (tocan(carpas[i], carpas[j])) return "Dos carpas se tocan (también cuenta en diagonal).";
  const { f, c } = conteos();
  for (let r = 0; r < n; r++) if (f[r] !== puzzle.rowClues[r]) return `La fila ${r + 1} necesita ${puzzle.rowClues[r]} carpas.`;
  for (let k = 0; k < n; k++) if (c[k] !== puzzle.colClues[k]) return `La columna ${k + 1} necesita ${puzzle.colClues[k]} carpas.`;
  if (!emparejable(carpas, puzzle.arboles)) return "Cada carpa debe estar junto a su propio árbol (arriba, abajo, izquierda o derecha), sin compartirlo.";
  return null;
}

export function initTents() {
  const tabla = document.getElementById("puzzleTable");
  tabla.addEventListener("click", e => {
    const cell = e.target.closest(".puzzle-cell");
    if (!cell || cell.classList.contains("tree") || resuelto) return;
    const r = Number(cell.dataset.r), c = Number(cell.dataset.c);
    tablero[r][c] = (tablero[r][c] + 1) % 3;
    setPuzzleMsg("puzzleMessage", "");
    render();
    if (!puzzleError()) { resuelto = true; setPuzzleMsg("puzzleMessage", "¡Puzzle resuelto!", true); }
  });
  tabla.addEventListener("contextmenu", e => {
    const cell = e.target.closest(".puzzle-cell");
    if (!cell || cell.classList.contains("tree")) return;
    e.preventDefault();
    const r = Number(cell.dataset.r), c = Number(cell.dataset.c);
    tablero[r][c] = tablero[r][c] === 2 ? 0 : 2;
    render();
  });
  document.getElementById("puzzleCheck").addEventListener("click", () => {
    const error = puzzleError();
    if (error) setPuzzleMsg("puzzleMessage", error);
    else { resuelto = true; setPuzzleMsg("puzzleMessage", "¡Puzzle resuelto!", true); }
  });
  document.getElementById("puzzleReset").addEventListener("click", () => {
    tablero = gridOf(puzzle.n, puzzle.n, 0); resuelto = false;
    setPuzzleMsg("puzzleMessage", "");
    render();
  });
  document.getElementById("puzzleNew").addEventListener("click", nuevo);
  nuevo();
}
