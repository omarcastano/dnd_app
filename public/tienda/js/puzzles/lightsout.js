import { copyGrid, directions, entero, gridOf, setPuzzleMsg } from "../nucleo/utilidades.js";
import { enHistoria, comprobarHistoria, bloqueado, fallarHistoria } from "./historia.js";

const ID = "lightsout";
// Modo historia: pulsaciones permitidas = mínimo + 50 %, redondeando hacia arriba
const limiteHistoria = () => Math.ceil(par * 1.5);

const N = 6;
let estado = gridOf(N, N, false);
let inicio = gridOf(N, N, false);
let historial = [];
let par = 0;
let resuelto = false;
let gastadas = 0; // pulsaciones totales en modo historia (deshacer o reiniciar no las devuelve)

function pulsar(g, r, c) {
  for (const [dr, dc] of [[0, 0], ...directions]) {
    const rr = r + dr, cc = c + dc;
    if (rr >= 0 && rr < N && cc >= 0 && cc < N) g[rr][cc] = !g[rr][cc];
  }
}

// Mínimo de pulsaciones para apagar todo (álgebra lineal sobre GF(2)); null si no tiene solución.
export function minimoPulsaciones(g, n = N) {
  const v = n * n;
  const filas = [];
  for (let i = 0; i < v; i++) {
    const fila = Array(v + 1).fill(0);
    const r = Math.floor(i / n), c = i % n;
    for (const [dr, dc] of [[0, 0], ...directions]) {
      const rr = r + dr, cc = c + dc;
      if (rr >= 0 && rr < n && cc >= 0 && cc < n) fila[rr * n + cc] = 1;
    }
    fila[v] = g[r][c] ? 1 : 0;
    filas.push(fila);
  }
  const pivotes = [];
  let f = 0;
  for (let col = 0; col < v && f < v; col++) {
    let p = -1;
    for (let i = f; i < v; i++) if (filas[i][col]) { p = i; break; }
    if (p < 0) continue;
    [filas[f], filas[p]] = [filas[p], filas[f]];
    for (let i = 0; i < v; i++) if (i !== f && filas[i][col]) for (let k = 0; k <= v; k++) filas[i][k] ^= filas[f][k];
    pivotes.push(col);
    f++;
  }
  for (let i = f; i < v; i++) if (filas[i][v]) return null;
  const libres = [...Array(v).keys()].filter(c => !pivotes.includes(c));
  let mejor = Infinity;
  for (let m = 0; m < 1 << libres.length; m++) {
    const x = Array(v).fill(0);
    libres.forEach((c, i) => { x[c] = (m >> i) & 1; });
    pivotes.forEach((c, i) => {
      let val = filas[i][v];
      libres.forEach(l => { if (filas[i][l]) val ^= x[l]; });
      x[c] = val;
    });
    mejor = Math.min(mejor, x.reduce((a, b) => a + b, 0));
  }
  return mejor;
}

const apagado = g => g.every(f => f.every(v => !v));

function nuevo() {
  let g, p;
  do {
    g = gridOf(N, N, false);
    const pulsos = 12 + entero(10);
    for (let i = 0; i < pulsos; i++) pulsar(g, entero(N), entero(N));
    p = apagado(g) ? 0 : minimoPulsaciones(g);
  } while (!p || p < 9);
  inicio = copyGrid(g);
  estado = copyGrid(g);
  par = p;
  historial = [];
  gastadas = 0;
  resuelto = false;
  setPuzzleMsg("lightsMessage", "");
  render();
}

function render() {
  let html = "";
  for (let r = 0; r < N; r++) {
    html += "<tr>";
    for (let c = 0; c < N; c++) html += `<td class="puzzle-cell luz${estado[r][c] ? " on" : ""}" data-r="${r}" data-c="${c}"><i class="fa-solid fa-lightbulb"></i></td>`;
    html += "</tr>";
  }
  const t = document.getElementById("lightsBoard");
  t.style.setProperty("--n", N);
  t.innerHTML = html;
  document.getElementById("lightsCheck").style.display = enHistoria(ID) ? "" : "none";
  const encendidas = estado.flat().filter(Boolean).length;
  if (enHistoria(ID)) {
    document.getElementById("lightsInfo").innerHTML = `Pulsaciones: <strong>${gastadas} de ${limiteHistoria()}</strong> · Mínimo posible: <strong>${par}</strong>`;
    return;
  }
  document.getElementById("lightsInfo").innerHTML = `Movimientos: <strong>${historial.length}</strong> · Mínimo posible: <strong>${par}</strong> · Luces encendidas: <strong>${encendidas}</strong>`;
}

export function initLightsOut() {
  document.getElementById("lightsBoard").addEventListener("click", e => {
    const cell = e.target.closest("[data-r]");
    if (!cell || resuelto || bloqueado(ID)) return;
    const r = Number(cell.dataset.r), c = Number(cell.dataset.c);
    pulsar(estado, r, c);
    historial.push([r, c]);
    render();
    if (enHistoria(ID)) {
      gastadas++;
      // sin autocomprobar: solo se vigila el límite de pulsaciones
      if (gastadas > limiteHistoria()) fallarHistoria(ID, "Las runas se han apagado para siempre: demasiadas pulsaciones.");
      return;
    }
    if (apagado(estado)) {
      resuelto = true;
      const extra = historial.length === par ? " ¡Con el mínimo de movimientos, perfecto!" : ` Lo hiciste en ${historial.length} (mínimo ${par}).`;
      setPuzzleMsg("lightsMessage", "¡Todas las luces apagadas!" + extra, true);
    } else setPuzzleMsg("lightsMessage", "");
  });
  document.getElementById("lightsUndo").addEventListener("click", () => {
    if (bloqueado(ID)) return;
    const ultimo = historial.pop();
    if (!ultimo) return;
    pulsar(estado, ultimo[0], ultimo[1]);
    resuelto = false;
    setPuzzleMsg("lightsMessage", "");
    render();
  });
  document.getElementById("lightsNew").addEventListener("click", () => { if (!enHistoria(ID)) nuevo(); });
  document.getElementById("lightsCheck").addEventListener("click", () => {
    if (enHistoria(ID)) comprobarHistoria(ID, apagado(estado));
  });
  document.getElementById("lightsReset").addEventListener("click", () => {
    if (bloqueado(ID)) return;
    estado = copyGrid(inicio); historial = []; resuelto = false;
    setPuzzleMsg("lightsMessage", "");
    render();
  });
  // Al entrar en modo historia: tablero nuevo; al salir, se vuelve a dibujar el normal
  const vista = document.getElementById("view-" + ID);
  let enLibro = false;
  new MutationObserver(() => {
    const ahora = vista.classList.contains("modo-historia");
    if (ahora !== enLibro) { enLibro = ahora; nuevo(); }
  }).observe(vista, { attributes: true, attributeFilter: ["class"] });
  nuevo();
}
