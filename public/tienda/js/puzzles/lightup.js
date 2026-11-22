import { directions, gridOf, mezclar, setPuzzleMsg } from "../nucleo/utilidades.js";

// Disposición: "W" casilla libre, "B" muro sin número, "0"-"4" muro numerado.
const N = 8;
let diseno = [];
let bombillas = gridOf(N, N, 0); // 0 vacío, 1 bombilla, 2 marca «aquí no»
let resuelto = false;

const dentro = (n, r, c) => r >= 0 && r < n && c >= 0 && c < n;

function visibles(d, r, c) {
  const n = d.length;
  const lista = [[r, c]];
  for (const [dr, dc] of directions) {
    let rr = r + dr, cc = c + dc;
    while (dentro(n, rr, cc) && d[rr][cc] === "W") { lista.push([rr, cc]); rr += dr; cc += dc; }
  }
  return lista;
}

export function contarSoluciones(d, limite = 2) {
  const n = d.length;
  const bomb = gridOf(n, n, false);
  const prohibida = gridOf(n, n, false);
  const iluminada = gridOf(n, n, 0);
  const muros = [];
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (/\d/.test(d[r][c])) muros.push([r, c, Number(d[r][c])]);
  let cuenta = 0;
  const murosOk = () => muros.every(([r, c, k]) => {
    let puestas = 0, libres = 0;
    for (const [dr, dc] of directions) {
      const rr = r + dr, cc = c + dc;
      if (!dentro(n, rr, cc) || d[rr][cc] !== "W") continue;
      if (bomb[rr][cc]) puestas++; else if (!prohibida[rr][cc]) libres++;
    }
    return puestas <= k && puestas + libres >= k;
  });
  const poner = (r, c, delta) => { for (const [rr, cc] of visibles(d, r, c)) iluminada[rr][cc] += delta; };
  const rec = () => {
    if (cuenta >= limite) return;
    if (!murosOk()) return;
    let objetivo = null;
    outer: for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (d[r][c] === "W" && !iluminada[r][c]) { objetivo = [r, c]; break outer; }
    if (!objetivo) { cuenta++; return; }
    const cands = visibles(d, objetivo[0], objetivo[1]).filter(([r, c]) => !prohibida[r][c] && !iluminada[r][c]);
    const marcadas = [];
    for (const [r, c] of cands) {
      bomb[r][c] = true; poner(r, c, 1);
      rec();
      bomb[r][c] = false; poner(r, c, -1);
      prohibida[r][c] = true; marcadas.push([r, c]);
      if (cuenta >= limite) break;
    }
    marcadas.forEach(([r, c]) => { prohibida[r][c] = false; });
  };
  rec();
  return cuenta;
}

export function generarLightUp(n = N) {
  for (let intento = 0; intento < 600; intento++) {
    const d = gridOf(n, n, "W");
    const muros = Math.round(n * n * (0.24 + Math.random() * 0.08));
    mezclar([...Array(n * n).keys()]).slice(0, muros).forEach(k => { d[Math.floor(k / n)][k % n] = "B"; });
    // colocar bombillas de forma válida que iluminen todo
    const bomb = gridOf(n, n, false);
    const ilum = gridOf(n, n, false);
    let ok = true;
    for (const k of mezclar([...Array(n * n).keys()])) {
      const r = Math.floor(k / n), c = k % n;
      if (d[r][c] !== "W" || ilum[r][c]) continue;
      bomb[r][c] = true;
      visibles(d, r, c).forEach(([rr, cc]) => { ilum[rr][cc] = true; });
    }
    for (let r = 0; r < n && ok; r++) for (let c = 0; c < n; c++) {
      if (!bomb[r][c]) continue;
      if (visibles(d, r, c).some(([rr, cc]) => (rr !== r || cc !== c) && bomb[rr][cc])) { ok = false; break; }
    }
    if (!ok) continue;
    // sin muros aislados de pista inútil: numerar muros hasta que la solución sea única
    const murosLista = mezclar([...Array(n * n).keys()].map(k => [Math.floor(k / n), k % n]).filter(([r, c]) => d[r][c] === "B"));
    const cuentaVec = (r, c) => directions.filter(([dr, dc]) => dentro(n, r + dr, c + dc) && bomb[r + dr][c + dc]).length;
    let unica = contarSoluciones(d, 2) === 1;
    for (const [r, c] of murosLista) {
      if (unica) break;
      d[r][c] = String(cuentaVec(r, c));
      unica = contarSoluciones(d, 2) === 1;
    }
    if (!unica) continue;
    // quitar pistas innecesarias para subir la dificultad
    for (const [r, c] of mezclar(murosLista)) {
      if (!/\d/.test(d[r][c])) continue;
      const guardado = d[r][c];
      d[r][c] = "B";
      if (contarSoluciones(d, 2) !== 1) d[r][c] = guardado;
    }
    return { diseno: d, solucion: bomb };
  }
  return null;
}

function nuevo() {
  const p = generarLightUp(N);
  diseno = p ? p.diseno : [["W"]];
  bombillas = gridOf(diseno.length, diseno.length, 0);
  resuelto = false;
  setPuzzleMsg("lightMessage", "");
  render();
}

function estadoTablero() {
  const n = diseno.length;
  const ilum = gridOf(n, n, false);
  const conflicto = gridOf(n, n, false);
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) {
    if (bombillas[r][c] !== 1) continue;
    for (const [rr, cc] of visibles(diseno, r, c)) {
      ilum[rr][cc] = true;
      if ((rr !== r || cc !== c) && bombillas[rr][cc] === 1) conflicto[r][c] = true;
    }
  }
  return { ilum, conflicto };
}

function cuentaMuro(r, c) {
  return directions.filter(([dr, dc]) => bombillas[r + dr]?.[c + dc] === 1).length;
}

function render() {
  const n = diseno.length;
  const { ilum, conflicto } = estadoTablero();
  let html = "";
  for (let r = 0; r < n; r++) {
    html += "<tr>";
    for (let c = 0; c < n; c++) {
      const v = diseno[r][c];
      if (v !== "W") {
        const num = v === "B" ? "" : v;
        const libres = directions.filter(([dr, dc]) => diseno[r + dr]?.[c + dc] === "W").length;
        const estado = num === "" ? "" : cuentaMuro(r, c) === Number(num) ? " cumplido" : cuentaMuro(r, c) > Number(num) || Number(num) > libres ? " error" : "";
        html += `<td class="puzzle-cell wall${estado}">${num}</td>`;
      } else {
        const b = bombillas[r][c];
        const icono = b === 1 ? '<i class="fa-solid fa-lightbulb"></i>' : b === 2 ? '<i class="fa-solid fa-xmark"></i>' : "";
        html += `<td class="puzzle-cell${ilum[r][c] ? " lit" : ""}${b === 1 ? " bombilla" : ""}${b === 2 ? " marca" : ""}${conflicto[r][c] ? " error" : ""}" data-r="${r}" data-c="${c}">${icono}</td>`;
      }
    }
    html += "</tr>";
  }
  const t = document.getElementById("lightBoard");
  t.style.setProperty("--n", n);
  t.innerHTML = html;
}

function lightError() {
  const n = diseno.length;
  const { ilum, conflicto } = estadoTablero();
  if (conflicto.some(f => f.some(Boolean))) return "Dos bombillas se iluminan entre sí (las celdas en rojo).";
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) {
    if (diseno[r][c] === "W" && !ilum[r][c]) return "Todavía hay celdas sin iluminar.";
  }
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) {
    const v = diseno[r][c];
    if (/\d/.test(v) && cuentaMuro(r, c) !== Number(v)) return `Un muro con el número ${v} no se cumple.`;
  }
  return null;
}

export function initLightUp() {
  const tabla = document.getElementById("lightBoard");
  tabla.addEventListener("click", e => {
    const cell = e.target.closest("[data-r]");
    if (!cell || resuelto) return;
    const r = Number(cell.dataset.r), c = Number(cell.dataset.c);
    bombillas[r][c] = (bombillas[r][c] + 1) % 3;
    setPuzzleMsg("lightMessage", "");
    render();
    if (!lightError()) { resuelto = true; setPuzzleMsg("lightMessage", "¡Puzzle resuelto!", true); }
  });
  tabla.addEventListener("contextmenu", e => {
    const cell = e.target.closest("[data-r]");
    if (!cell) return;
    e.preventDefault();
    const r = Number(cell.dataset.r), c = Number(cell.dataset.c);
    bombillas[r][c] = bombillas[r][c] === 2 ? 0 : 2;
    render();
  });
  document.getElementById("lightCheck").addEventListener("click", () => {
    const error = lightError();
    if (error) setPuzzleMsg("lightMessage", error);
    else { resuelto = true; setPuzzleMsg("lightMessage", "¡Puzzle resuelto!", true); }
  });
  document.getElementById("lightReset").addEventListener("click", () => {
    bombillas = gridOf(diseno.length, diseno.length, 0); resuelto = false;
    setPuzzleMsg("lightMessage", "");
    render();
  });
  document.getElementById("lightNew").addEventListener("click", nuevo);
  nuevo();
}
