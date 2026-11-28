import { arrastrar, gridOf, setPuzzleMsg } from "../nucleo/utilidades.js";
import { enHistoria, comprobarHistoria, bloqueado, datosHistoria } from "./historia.js?v=2";

// 0 = vacío, 1 = relleno, 2 = marca «aquí no» (X)
// Modo historia: si el enigma trae `figura` (filas de «#» y «.», 10×10), el dibujo oculto es el símbolo de la historia
// (comprobado con pruebas/probar_enigmas.py: se resuelve solo con lógica de líneas). Si no, uno al azar.
let N = 10;
let solucion = gridOf(N, N, 0);
let pistasF = [];
let pistasC = [];
let tablero = gridOf(N, N, 0);
let modoMarca = false;
let pincel = 1;
let resuelto = false;

export function rachas(linea) {
  const r = [];
  let n = 0;
  for (const v of linea) {
    if (v === 1) n++;
    else if (n) { r.push(n); n = 0; }
  }
  if (n) r.push(n);
  return r;
}

const igual = (a, b) => a.length === b.length && a.every((v, i) => v === b[i]);

// Deduce todo lo posible en una línea. `linea`: -1 desconocido, 0 vacío, 1 relleno. Devuelve null si hay contradicción.
function resolverLinea(linea, pistas) {
  const n = linea.length;
  // Recorremos todas las colocaciones posibles (n pequeño) y vemos qué celdas coinciden en todas.
  const siempre1 = Array(n).fill(true);
  const siempre0 = Array(n).fill(true);
  let hubo = false;
  const actual = Array(n).fill(0);
  const recorrer = (i, k) => {
    if (i >= n || k === pistas.length) {
      if (k !== pistas.length) return;
      for (let j = i; j < n; j++) if (linea[j] === 1) return;
      const sol = actual.slice();
      for (let j = i; j < n; j++) sol[j] = 0;
      hubo = true;
      for (let j = 0; j < n; j++) { if (sol[j]) siempre0[j] = false; else siempre1[j] = false; }
      return;
    }
    if (linea[i] !== 1) { actual[i] = 0; recorrer(i + 1, k); }
    const largo = pistas[k];
    if (i + largo <= n) {
      let ok = true;
      for (let j = i; j < i + largo; j++) if (linea[j] === 0) { ok = false; break; }
      if (ok && (i + largo === n || linea[i + largo] !== 1)) {
        for (let j = i; j < i + largo; j++) actual[j] = 1;
        if (i + largo < n) actual[i + largo] = 0;
        recorrer(Math.min(n, i + largo + 1), k + 1);
        for (let j = i; j < i + largo; j++) actual[j] = 0;
      }
    }
  };
  recorrer(0, 0);
  if (!hubo) return null;
  return linea.map((v, j) => (v !== -1 ? v : siempre1[j] ? 1 : siempre0[j] ? 0 : -1));
}

// ¿Se resuelve solo con lógica de líneas (sin adivinar)?
export function resolvibleSinAdivinar(pf, pc) {
  const n = pf.length;
  const g = gridOf(n, n, -1);
  let cambio = true;
  while (cambio) {
    cambio = false;
    for (let r = 0; r < n; r++) {
      const nuevo = resolverLinea(g[r], pf[r]);
      if (!nuevo) return null;
      nuevo.forEach((v, c) => { if (v !== g[r][c]) { g[r][c] = v; cambio = true; } });
    }
    for (let c = 0; c < n; c++) {
      const col = g.map(f => f[c]);
      const nuevo = resolverLinea(col, pc[c]);
      if (!nuevo) return null;
      nuevo.forEach((v, r) => { if (v !== g[r][c]) { g[r][c] = v; cambio = true; } });
    }
  }
  return g.every(f => f.every(v => v !== -1)) ? g : null;
}

export function generarNonograma(n = N) {
  for (let intento = 0; intento < 400; intento++) {
    const dens = 0.55 + Math.random() * 0.12;
    const sol = gridOf(n, n, 0).map(f => f.map(() => (Math.random() < dens ? 1 : 0)));
    const pf = sol.map(rachas);
    const pc = sol[0].map((_, c) => rachas(sol.map(f => f[c])));
    if (pf.some(p => !p.length) || pc.some(p => !p.length)) continue;
    const g = resolvibleSinAdivinar(pf, pc);
    if (g) return { sol: g, pf, pc };
  }
  return null;
}

function deFigura(figura) {
  if (!Array.isArray(figura) || !figura.length) return null;
  const sol = figura.map(f => [...f].map(ch => (ch === "#" ? 1 : 0)));
  const pf = sol.map(rachas);
  const pc = sol[0].map((_, c) => rachas(sol.map(f => f[c])));
  return { sol, pf, pc };
}

function nuevo() {
  const fig = enHistoria("nonogram") ? deFigura(datosHistoria("nonogram").figura) : null;
  N = fig ? fig.sol.length : 10;
  const p = fig || generarNonograma(N) || { sol: gridOf(N, N, 1), pf: Array(N).fill([N]), pc: Array(N).fill([N]) };
  solucion = p.sol; pistasF = p.pf; pistasC = p.pc;
  tablero = gridOf(N, N, 0);
  resuelto = false;
  setPuzzleMsg("nonoMessage", "");
  render();
}

function pintar() {
  // En modo historia las pistas no se atenúan: delatarían que el tablero está resuelto.
  const ocultar = enHistoria("nonogram");
  const filas = tablero.map(f => f.map(v => (v === 1 ? 1 : 0)));
  pistasF.forEach((p, r) => {
    const ok = !ocultar && igual(rachas(filas[r]), p);
    document.querySelector(`#nonoBoard [data-pf="${r}"]`)?.classList.toggle("cumplida", ok);
  });
  pistasC.forEach((p, c) => {
    const ok = !ocultar && igual(rachas(filas.map(f => f[c])), p);
    document.querySelector(`#nonoBoard [data-pc="${c}"]`)?.classList.toggle("cumplida", ok);
  });
}

function render() {
  let html = "<tr><th></th>";
  for (let c = 0; c < N; c++) html += `<th class="clue clue-col${c % 5 === 4 && c < N - 1 ? " sep-d" : ""}" data-pc="${c}">${pistasC[c].join("<br>") || 0}</th>`;
  html += "</tr>";
  for (let r = 0; r < N; r++) {
    html += `<tr><td class="clue clue-fila${r % 5 === 4 && r < N - 1 ? " sep-b" : ""}" data-pf="${r}">${pistasF[r].join(" ") || 0}</td>`;
    for (let c = 0; c < N; c++) {
      const v = tablero[r][c];
      const cls = ["puzzle-cell", v === 1 ? "filled" : "", v === 2 ? "marca" : "", c % 5 === 4 && c < N - 1 ? "sep-d" : "", r % 5 === 4 && r < N - 1 ? "sep-b" : ""].join(" ");
      html += `<td class="${cls}" data-r="${r}" data-c="${c}">${v === 2 ? '<i class="fa-solid fa-xmark"></i>' : ""}</td>`;
    }
    html += "</tr>";
  }
  const t = document.getElementById("nonoBoard");
  t.style.setProperty("--n", N + 2);
  t.innerHTML = html;
  pintar();
}

function aplicar(r, c, valor) {
  if (resuelto || bloqueado("nonogram")) return;
  const actual = tablero[r][c];
  if (valor === 1 && actual === 2) return;
  if (valor === 2 && actual === 1) return;
  tablero[r][c] = valor === 0 ? 0 : valor;
  const td = document.querySelector(`#nonoBoard [data-r="${r}"][data-c="${c}"]`);
  td.classList.toggle("filled", tablero[r][c] === 1);
  td.classList.toggle("marca", tablero[r][c] === 2);
  td.innerHTML = tablero[r][c] === 2 ? '<i class="fa-solid fa-xmark"></i>' : "";
  pintar();
}

function comprobarAuto() {
  if (enHistoria("nonogram")) return;
  const filas = tablero.map(f => f.map(v => (v === 1 ? 1 : 0)));
  const ok = pistasF.every((p, r) => igual(rachas(filas[r]), p)) && pistasC.every((p, c) => igual(rachas(filas.map(f => f[c])), p));
  if (ok) {
    resuelto = true;
    setPuzzleMsg("nonoMessage", "¡Puzzle resuelto!", true);
  }
}

function nonoError() {
  const filas = tablero.map(f => f.map(v => (v === 1 ? 1 : 0)));
  const malasF = pistasF.map((p, r) => r + 1).filter((_, r) => !igual(rachas(filas[r]), pistasF[r]));
  const malasC = pistasC.map((p, c) => c + 1).filter((_, c) => !igual(rachas(filas.map(f => f[c])), pistasC[c]));
  if (!malasF.length && !malasC.length) return null;
  const partes = [];
  if (malasF.length) partes.push(`filas ${malasF.join(", ")}`);
  if (malasC.length) partes.push(`columnas ${malasC.join(", ")}`);
  return `Aún no cumplen sus pistas: ${partes.join(" y ")}.`;
}

export function initNonograma() {
  arrastrar(document.getElementById("nonoBoard"), (r, c, e) => {
    const derecho = e.button === 2 || modoMarca;
    const v = tablero[r][c];
    if (derecho) pincel = v === 2 ? 0 : 2;
    else pincel = v === 1 ? 0 : 1;
    aplicar(r, c, pincel);
    comprobarAuto();
    return true;
  }, (r, c) => { aplicar(r, c, pincel); comprobarAuto(); });

  document.getElementById("nonoModo").addEventListener("click", e => {
    modoMarca = !modoMarca;
    e.currentTarget.classList.toggle("activo", modoMarca);
    e.currentTarget.innerHTML = modoMarca ? '<i class="fa-solid fa-xmark"></i> Modo: marcar vacío' : '<i class="fa-solid fa-square"></i> Modo: rellenar';
  });

  document.getElementById("nonoCheck").addEventListener("click", () => {
    const error = nonoError();
    if (comprobarHistoria("nonogram", !error)) return;
    if (error) setPuzzleMsg("nonoMessage", error);
    else setPuzzleMsg("nonoMessage", "¡Puzzle resuelto!", true);
  });
  document.getElementById("nonoReset").addEventListener("click", () => {
    if (bloqueado("nonogram")) return;
    tablero = gridOf(N, N, 0); resuelto = false;
    setPuzzleMsg("nonoMessage", "");
    render();
  });
  document.getElementById("nonoNew").addEventListener("click", () => { if (!enHistoria("nonogram")) nuevo(); });

  // Al entrar o salir del modo historia: tablero nuevo (no vale traerlo resuelto desde el modo normal)
  const vista = document.getElementById("view-nonogram");
  let enLibro = false;
  new MutationObserver(() => {
    const ahora = vista.classList.contains("modo-historia");
    if (ahora !== enLibro) { enLibro = ahora; nuevo(); }
  }).observe(vista, { attributes: true, attributeFilter: ["class"] });
  nuevo();
}
