import { directions, entero, gridOf, mezclar, setPuzzleMsg } from "../nucleo/utilidades.js";

const N = 7;
let valores = [];
let estado = gridOf(N, N, 0); // 0 libre, 1 sombreada, 2 marcada «se queda»
let resuelto = false;

function conectadas(sombra, n) {
  let total = 0;
  let inicio = null;
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (!sombra[r][c]) { total++; if (!inicio) inicio = [r, c]; }
  if (!inicio) return false;
  const visto = gridOf(n, n, false);
  const pila = [inicio];
  visto[inicio[0]][inicio[1]] = true;
  let alcanzadas = 0;
  while (pila.length) {
    const [r, c] = pila.pop();
    alcanzadas++;
    for (const [dr, dc] of directions) {
      const rr = r + dr, cc = c + dc;
      if (rr >= 0 && rr < n && cc >= 0 && cc < n && !sombra[rr][cc] && !visto[rr][cc]) { visto[rr][cc] = true; pila.push([rr, cc]); }
    }
  }
  return alcanzadas === total;
}

// Cuenta soluciones (hasta `limite`) de un Hitori.
export function contarSoluciones(v, limite = 2) {
  const n = v.length;
  const s = gridOf(n, n, false);
  let cuenta = 0;
  const choca = (r, c) => {
    // sombreada: no tocar otra sombreada
    if (s[r][c] && ((r > 0 && s[r - 1][c]) || (c > 0 && s[r][c - 1]))) return true;
    if (!s[r][c]) {
      for (let k = 0; k < c; k++) if (!s[r][k] && v[r][k] === v[r][c]) return true;
      for (let k = 0; k < r; k++) if (!s[k][c] && v[k][c] === v[r][c]) return true;
    }
    return false;
  };
  const rec = i => {
    if (cuenta >= limite) return;
    if (i === n * n) { if (conectadas(s, n)) cuenta++; return; }
    const r = Math.floor(i / n), c = i % n;
    s[r][c] = false;
    if (!choca(r, c)) rec(i + 1);
    s[r][c] = true;
    if (!choca(r, c)) rec(i + 1);
    s[r][c] = false;
  };
  rec(0);
  return cuenta;
}

export function generarHitori(n = N) {
  for (let intento = 0; intento < 3000; intento++) {
    // cuadrado latino aleatorio
    const base = mezclar([...Array(n).keys()].map(x => x + 1));
    const filas = mezclar([...Array(n).keys()]);
    const v = filas.map(f => base.map((_, c) => base[(c + f) % n]));
    const cols = mezclar([...Array(n).keys()]);
    const lat = v.map(f => cols.map(c => f[c]));
    // sombreado aleatorio: sin tocarse y con el resto conectado
    const s = gridOf(n, n, false);
    const celdas = mezclar([...Array(n * n).keys()]);
    let puestas = 0;
    const objetivo = Math.round(n * n * (0.27 + Math.random() * 0.05));
    for (const k of celdas) {
      if (puestas >= objetivo) break;
      const r = Math.floor(k / n), c = k % n;
      if (directions.some(([dr, dc]) => s[r + dr]?.[c + dc])) continue;
      s[r][c] = true;
      if (!conectadas(s, n)) { s[r][c] = false; continue; }
      puestas++;
    }
    // cada celda sombreada pasa a repetir un número visible de su fila o columna
    const g = lat.map(f => f.slice());
    let valido = true;
    for (let r = 0; r < n && valido; r++) for (let c = 0; c < n; c++) {
      if (!s[r][c]) continue;
      const cand = [];
      for (let k = 0; k < n; k++) {
        if (k !== c && !s[r][k]) cand.push(lat[r][k]);
        if (k !== r && !s[k][c]) cand.push(lat[k][c]);
      }
      if (!cand.length) { valido = false; break; }
      g[r][c] = cand[entero(cand.length)];
    }
    if (!valido) continue;
    if (contarSoluciones(g, 2) === 1) return { valores: g, sombra: s };
  }
  return null;
}

function nuevo() {
  const p = generarHitori(N);
  valores = p ? p.valores : [[1]];
  estado = gridOf(N, N, 0);
  resuelto = false;
  setPuzzleMsg("hitoriMessage", "");
  render();
}

// Resalta una repetición solo cuando el jugador ya ha marcado con círculo una de las dos celdas iguales.
function duplicadosVisibles() {
  const mal = gridOf(N, N, false);
  for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) {
    if (estado[r][c] !== 2) continue;
    for (let k = 0; k < N; k++) {
      if (k !== c && estado[r][k] !== 1 && valores[r][k] === valores[r][c]) mal[r][k] = true;
      if (k !== r && estado[k][c] !== 1 && valores[k][c] === valores[r][c]) mal[k][c] = true;
    }
  }
  return mal;
}

function repeticiones() {
  for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) {
    if (estado[r][c] === 1) continue;
    for (let k = 0; k < N; k++) {
      if (k !== c && estado[r][k] !== 1 && valores[r][k] === valores[r][c]) return [r, c];
      if (k !== r && estado[k][c] !== 1 && valores[k][c] === valores[r][c]) return [r, c];
    }
  }
  return null;
}

function render() {
  const mal = duplicadosVisibles();
  let html = "";
  for (let r = 0; r < N; r++) {
    html += "<tr>";
    for (let c = 0; c < N; c++) {
      const e = estado[r][c];
      const vecina = e === 1 && directions.some(([dr, dc]) => estado[r + dr]?.[c + dc] === 1);
      const cls = ["puzzle-cell", e === 1 ? "shade" : "", e === 2 ? "circulo" : "", mal[r][c] && e !== 2 ? "repetido" : "", vecina ? "error" : ""].join(" ");
      html += `<td class="${cls}" data-r="${r}" data-c="${c}"><span>${valores[r][c]}</span></td>`;
    }
    html += "</tr>";
  }
  const t = document.getElementById("hitoriBoard");
  t.style.setProperty("--n", N);
  t.innerHTML = html;
}

function hitoriError() {
  for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) {
    if (estado[r][c] === 1 && ((r + 1 < N && estado[r + 1][c] === 1) || (c + 1 < N && estado[r][c + 1] === 1))) return "Dos celdas sombreadas se tocan.";
  }
  const rep = repeticiones();
  if (rep) return `Hay un número repetido sin sombrear (fila ${rep[0] + 1}, columna ${rep[1] + 1}).`;
  const sombra = estado.map(f => f.map(v => v === 1));
  if (!sombra.some(f => f.some(Boolean))) return "Sombrea algunas celdas.";
  if (!conectadas(sombra, N)) return "Las celdas sin sombrear deben quedar conectadas.";
  return null;
}

export function initHitori() {
  document.getElementById("hitoriBoard").addEventListener("click", e => {
    const cell = e.target.closest("[data-r]");
    if (!cell || resuelto) return;
    const r = Number(cell.dataset.r), c = Number(cell.dataset.c);
    estado[r][c] = (estado[r][c] + 1) % 3;
    setPuzzleMsg("hitoriMessage", "");
    render();
    if (!hitoriError() && estado.some(f => f.includes(1))) {
      resuelto = true;
      setPuzzleMsg("hitoriMessage", "¡Puzzle resuelto!", true);
    }
  });
  document.getElementById("hitoriBoard").addEventListener("contextmenu", e => {
    const cell = e.target.closest("[data-r]");
    if (!cell) return;
    e.preventDefault();
    const r = Number(cell.dataset.r), c = Number(cell.dataset.c);
    estado[r][c] = estado[r][c] === 2 ? 0 : 2;
    render();
  });
  document.getElementById("hitoriCheck").addEventListener("click", () => {
    const error = hitoriError();
    if (error) setPuzzleMsg("hitoriMessage", error);
    else { resuelto = true; setPuzzleMsg("hitoriMessage", "¡Puzzle resuelto!", true); }
  });
  document.getElementById("hitoriReset").addEventListener("click", () => {
    estado = gridOf(N, N, 0); resuelto = false;
    setPuzzleMsg("hitoriMessage", "");
    render();
  });
  document.getElementById("hitoriNew").addEventListener("click", nuevo);
  nuevo();
}
