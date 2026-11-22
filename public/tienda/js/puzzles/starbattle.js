import { directions, entero, gridOf, mezclar, setPuzzleMsg } from "../nucleo/utilidades.js";

// Star Battle: N×N, K estrellas por fila, columna y región; sin tocarse (ni en diagonal).
const N = 9;
const K = 2;
let regiones = [];
let estado = gridOf(N, N, 0); // 0 vacío, 1 estrella, 2 marca «aquí no»
let resuelto = false;

const colores = ["#6b4a1f", "#2e5e4e", "#4a3a7a", "#7a2e3a", "#3a5a7a", "#6a6a2a", "#2a6a6a", "#7a4a6a", "#4a6a3a", "#7a5a2a"];

export function contarSoluciones(reg, n, k, limite = 2) {
  const filas = [];
  const combos = (desde, resto, actual, sal) => {
    if (resto === 0) { sal.push(actual.slice()); return; }
    for (let c = desde; c < n; c++) {
      if (actual.length && c - actual[actual.length - 1] < 2) continue;
      actual.push(c); combos(c + 1, resto - 1, actual, sal); actual.pop();
    }
  };
  combos(0, k, [], filas);
  const col = Array(n).fill(0);
  const reg2 = Array(n).fill(0);
  let cuenta = 0;
  const rec = (r, previa) => {
    if (cuenta >= limite) return;
    if (r === n) { cuenta++; return; }
    for (const f of filas) {
      if (previa && f.some(c => previa.some(p => Math.abs(p - c) <= 1))) continue;
      let ok = true;
      for (const c of f) if (col[c] >= k || reg2[reg[r][c]] >= k) { /* se revisa abajo */ }
      const puestos = [];
      for (const c of f) {
        if (col[c] + 1 > k || reg2[reg[r][c]] + 1 > k) { ok = false; break; }
        col[c]++; reg2[reg[r][c]]++; puestos.push(c);
      }
      if (ok) {
        // poda: las regiones y columnas deben poder completarse con las filas restantes
        const restantes = n - r - 1;
        if (col.every(v => v + restantes * 1 >= k) && col.every(v => v <= k)) rec(r + 1, f);
      }
      for (const c of puestos) { col[c]--; reg2[reg[r][c]]--; }
    }
  };
  rec(0, null);
  return cuenta;
}

function solucionAleatoria(n, k) {
  // una colocación válida aleatoria por búsqueda con retroceso
  const filas = [];
  const combos = (desde, resto, actual, sal) => {
    if (resto === 0) { sal.push(actual.slice()); return; }
    for (let c = desde; c < n; c++) {
      if (actual.length && c - actual[actual.length - 1] < 2) continue;
      actual.push(c); combos(c + 1, resto - 1, actual, sal); actual.pop();
    }
  };
  combos(0, k, [], filas);
  const col = Array(n).fill(0);
  const res = [];
  const rec = (r, previa) => {
    if (r === n) return true;
    for (const f of mezclar(filas)) {
      if (previa && f.some(c => previa.some(p => Math.abs(p - c) <= 1))) continue;
      if (f.some(c => col[c] >= k)) continue;
      f.forEach(c => col[c]++);
      res[r] = f;
      if (rec(r + 1, f)) return true;
      f.forEach(c => col[c]--);
    }
    return false;
  };
  return rec(0, null) ? res : null;
}

// Regiones conexas con k estrellas cada una, creciendo desde las estrellas de la solución.
function generarRegiones(sol, n, k) {
  const estrellas = [];
  sol.forEach((f, r) => f.forEach(c => estrellas.push([r, c])));
  // emparejar estrellas en grupos de k cercanas
  const libres = mezclar(estrellas);
  const grupos = [];
  while (libres.length) {
    const base = libres.shift();
    const grupo = [base];
    while (grupo.length < k && libres.length) {
      libres.sort((a, b) => (Math.abs(a[0] - base[0]) + Math.abs(a[1] - base[1])) - (Math.abs(b[0] - base[0]) + Math.abs(b[1] - base[1])));
      grupo.push(libres.shift());
    }
    grupos.push(grupo);
  }
  if (grupos.length !== n) return null;
  const reg = gridOf(n, n, -1);
  grupos.forEach((g, i) => g.forEach(([r, c]) => { reg[r][c] = i; }));
  const frontera = [];
  const empujar = (r, c) => directions.forEach(([dr, dc]) => { const rr = r + dr, cc = c + dc; if (rr >= 0 && rr < n && cc >= 0 && cc < n && reg[rr][cc] < 0) frontera.push([rr, cc, reg[r][c]]); });
  estrellas.forEach(([r, c]) => empujar(r, c));
  while (frontera.length) {
    const i = entero(frontera.length);
    const [r, c, g] = frontera.splice(i, 1)[0];
    if (reg[r][c] >= 0) continue;
    reg[r][c] = g;
    empujar(r, c);
  }
  // cada región debe ser conexa
  for (let g = 0; g < n; g++) {
    const celdas = [];
    reg.forEach((f, r) => f.forEach((v, c) => { if (v === g) celdas.push([r, c]); }));
    const vistos = new Set([celdas[0].join()]);
    const pila = [celdas[0]];
    while (pila.length) {
      const [r, c] = pila.pop();
      for (const [dr, dc] of directions) {
        const x = [r + dr, c + dc];
        if (reg[x[0]]?.[x[1]] === g && !vistos.has(x.join())) { vistos.add(x.join()); pila.push(x); }
      }
    }
    if (vistos.size !== celdas.length) return null;
  }
  return reg;
}

export function generarStarBattle(n = N, k = K, intentos = 4000) {
  for (let i = 0; i < intentos; i++) {
    const sol = solucionAleatoria(n, k);
    if (!sol) continue;
    const reg = generarRegiones(sol, n, k);
    if (!reg) continue;
    if (contarSoluciones(reg, n, k, 2) === 1) return { regiones: reg, solucion: sol };
  }
  return null;
}

function nuevo() {
  const p = generarStarBattle(N, K);
  regiones = p ? p.regiones : gridOf(N, N, 0);
  estado = gridOf(N, N, 0);
  resuelto = false;
  setPuzzleMsg("starMessage", "");
  render();
}

function analizar() {
  const filas = Array(N).fill(0), cols = Array(N).fill(0), regs = Array(N).fill(0);
  const estrellas = [];
  for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) if (estado[r][c] === 1) {
    filas[r]++; cols[c]++; regs[regiones[r][c]]++; estrellas.push([r, c]);
  }
  const toca = gridOf(N, N, false);
  for (let i = 0; i < estrellas.length; i++) for (let j = i + 1; j < estrellas.length; j++) {
    if (Math.abs(estrellas[i][0] - estrellas[j][0]) <= 1 && Math.abs(estrellas[i][1] - estrellas[j][1]) <= 1) {
      toca[estrellas[i][0]][estrellas[i][1]] = true; toca[estrellas[j][0]][estrellas[j][1]] = true;
    }
  }
  return { filas, cols, regs, toca };
}

function render() {
  const { filas, cols, regs, toca } = analizar();
  let html = "";
  for (let r = 0; r < N; r++) {
    html += "<tr>";
    for (let c = 0; c < N; c++) {
      const g = regiones[r][c];
      const borde = [
        r === 0 || regiones[r - 1][c] !== g ? "t" : "",
        r === N - 1 || regiones[r + 1][c] !== g ? "b" : "",
        c === 0 || regiones[r][c - 1] !== g ? "l" : "",
        c === N - 1 || regiones[r][c + 1] !== g ? "d" : ""
      ].join("");
      const exceso = filas[r] > K || cols[c] > K || regs[g] > K;
      const v = estado[r][c];
      const icono = v === 1 ? '<i class="fa-solid fa-star"></i>' : v === 2 ? '<span class="punto"></span>' : "";
      html += `<td class="puzzle-cell reg-borde-${borde}${toca[r][c] || (v === 1 && exceso) ? " error" : ""}" style="background:${colores[g % colores.length]}" data-r="${r}" data-c="${c}">${icono}</td>`;
    }
    html += "</tr>";
  }
  const t = document.getElementById("starBoard");
  t.style.setProperty("--n", N);
  t.innerHTML = html;
  const info = document.getElementById("starInfo");
  if (info) info.textContent = `Estrellas puestas: ${filas.reduce((a, b) => a + b, 0)} / ${N * K}`;
}

function starError() {
  const { filas, cols, regs, toca } = analizar();
  if (toca.some(f => f.some(Boolean))) return "Dos estrellas se tocan (también en diagonal).";
  if (filas.some(v => v !== K)) return `Cada fila debe tener exactamente ${K} estrellas.`;
  if (cols.some(v => v !== K)) return `Cada columna debe tener exactamente ${K} estrellas.`;
  if (regs.some(v => v !== K)) return `Cada región de color debe tener exactamente ${K} estrellas.`;
  return null;
}

export function initStarBattle() {
  const tabla = document.getElementById("starBoard");
  tabla.addEventListener("click", e => {
    const cell = e.target.closest("[data-r]");
    if (!cell || resuelto) return;
    const r = Number(cell.dataset.r), c = Number(cell.dataset.c);
    estado[r][c] = (estado[r][c] + 1) % 3;
    setPuzzleMsg("starMessage", "");
    render();
    if (!starError()) { resuelto = true; setPuzzleMsg("starMessage", "¡Puzzle resuelto!", true); }
  });
  tabla.addEventListener("contextmenu", e => {
    const cell = e.target.closest("[data-r]");
    if (!cell) return;
    e.preventDefault();
    const r = Number(cell.dataset.r), c = Number(cell.dataset.c);
    estado[r][c] = estado[r][c] === 2 ? 0 : 2;
    render();
  });
  document.getElementById("starCheck").addEventListener("click", () => {
    const error = starError();
    if (error) setPuzzleMsg("starMessage", error);
    else { resuelto = true; setPuzzleMsg("starMessage", "¡Puzzle resuelto!", true); }
  });
  document.getElementById("starReset").addEventListener("click", () => {
    estado = gridOf(N, N, 0); resuelto = false;
    setPuzzleMsg("starMessage", "");
    render();
  });
  document.getElementById("starNew").addEventListener("click", nuevo);
  nuevo();
}
