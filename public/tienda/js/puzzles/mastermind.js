import { entero, setPuzzleMsg } from "../nucleo/utilidades.js";
import { enHistoria, comprobarHistoria, bloqueado, intentosRestantes } from "./historia.js";

const ID = "mastermind";

// 5 posiciones, 8 colores (con repeticiones), 10 intentos.
const HUECOS = 5;
const MAX_INTENTOS = 10;
const colores = [
  { id: "red", nombre: "Rojo", simbolo: "●" },
  { id: "blue", nombre: "Azul", simbolo: "■" },
  { id: "green", nombre: "Verde", simbolo: "▲" },
  { id: "yellow", nombre: "Amarillo", simbolo: "★" },
  { id: "white", nombre: "Blanco", simbolo: "◆" },
  { id: "purple", nombre: "Morado", simbolo: "✚" },
  { id: "orange", nombre: "Naranja", simbolo: "♥" },
  { id: "teal", nombre: "Turquesa", simbolo: "☾" }
];

let secreto = [];
let intentos = [];
let actual = [];
let color = 0;
let terminado = false;
let maximo = MAX_INTENTOS; // en modo historia, nunca más que los intentos que da la historia

export function evaluar(intento, clave) {
  const negras = intento.filter((c, i) => c === clave[i]).length;
  const cuentaS = {}, cuentaI = {};
  intento.forEach((c, i) => {
    if (c === clave[i]) return;
    cuentaS[clave[i]] = (cuentaS[clave[i]] || 0) + 1;
    cuentaI[c] = (cuentaI[c] || 0) + 1;
  });
  let blancas = 0;
  for (const c in cuentaI) blancas += Math.min(cuentaI[c], cuentaS[c] || 0);
  return { negras, blancas };
}

function nuevaPartida() {
  secreto = Array.from({ length: HUECOS }, () => colores[entero(colores.length)].id);
  intentos = [];
  actual = Array(HUECOS).fill(null);
  color = 0;
  terminado = false;
  maximo = enHistoria(ID) ? Math.min(MAX_INTENTOS, intentosRestantes(ID)) : MAX_INTENTOS;
  setPuzzleMsg("mastermindMessage", "");
  render();
}

const ficha = (id, extra = "") => {
  const c = colores.find(x => x.id === id);
  return `<div class="mastermind-peg ${id}${extra}" ${c ? `title="${c.nombre}"` : ""}>${c ? `<span>${c.simbolo}</span>` : ""}</div>`;
};

function pistas({ negras, blancas }) {
  let html = '<div class="mastermind-hint">';
  for (let i = 0; i < HUECOS; i++) html += `<span class="mastermind-hint-peg ${i < negras ? "black" : i < negras + blancas ? "white" : "empty"}"></span>`;
  return html + "</div>";
}

function render() {
  let html = "";
  intentos.forEach((it, n) => {
    html += `<div class="mastermind-guess"><span class="mastermind-num">${n + 1}</span><div class="mastermind-row">${it.colores.map(c => ficha(c)).join("")}</div>${pistas(it.res)}</div>`;
  });
  if (!terminado) {
    html += `<div class="mastermind-guess actual"><span class="mastermind-num">${intentos.length + 1}</span><div class="mastermind-row">`;
    actual.forEach((c, i) => { html += `<button type="button" class="mastermind-hueco" data-hueco="${i}">${c ? ficha(c) : '<div class="mastermind-peg empty"></div>'}</button>`; });
    html += `</div>${pistas({ negras: 0, blancas: 0 })}</div>`;
  } else {
    html += `<div class="mastermind-guess secreto"><span class="mastermind-num"><i class="fa-solid fa-lock-open"></i></span><div class="mastermind-row">${secreto.map(c => ficha(c)).join("")}</div></div>`;
  }
  document.getElementById("mastermindBoard").innerHTML = html;
  document.getElementById("mastermindPaleta").innerHTML = colores.map((c, i) =>
    `<button type="button" class="mastermind-color${i === color ? " elegido" : ""}" data-color="${i}" title="${c.nombre}">${ficha(c.id)}</button>`).join("");
  document.getElementById("mastermindInfo").textContent = terminado ? "" : `Intento ${intentos.length + 1} de ${maximo}`;
}

function comprobar() {
  if (terminado || bloqueado(ID)) return;
  if (actual.includes(null)) { setPuzzleMsg("mastermindMessage", `Completa los ${HUECOS} huecos primero.`); return; }
  const res = evaluar(actual, secreto);
  intentos.push({ colores: actual.slice(), res });
  if (enHistoria(ID)) {
    // cada combinación gasta un intento de la historia; las pistas negras/blancas se siguen mostrando
    comprobarHistoria(ID, res.negras === HUECOS);
    if (bloqueado(ID) || intentos.length >= maximo) terminado = true;
    else { setPuzzleMsg("mastermindMessage", `${res.negras} en su sitio, ${res.blancas} de color correcto en otro sitio.`); actual = Array(HUECOS).fill(null); }
    render();
    return;
  }
  if (res.negras === HUECOS) {
    terminado = true;
    setPuzzleMsg("mastermindMessage", `¡Código descifrado en ${intentos.length} intentos!`, true);
  } else if (intentos.length >= maximo) {
    terminado = true;
    setPuzzleMsg("mastermindMessage", "Te quedaste sin intentos. El código secreto está abajo.");
  } else {
    setPuzzleMsg("mastermindMessage", `${res.negras} en su sitio, ${res.blancas} de color correcto en otro sitio.`);
    actual = Array(HUECOS).fill(null);
  }
  render();
}

export function initMastermind() {
  document.getElementById("mastermindPaleta").addEventListener("click", e => {
    const b = e.target.closest("[data-color]");
    if (!b || bloqueado(ID)) return;
    color = Number(b.dataset.color);
    // si hay un hueco vacío, el color se coloca directamente en el primero libre
    const libre = actual.indexOf(null);
    if (libre >= 0 && !terminado) actual[libre] = colores[color].id;
    render();
  });
  document.getElementById("mastermindBoard").addEventListener("click", e => {
    const h = e.target.closest("[data-hueco]");
    if (!h || terminado || bloqueado(ID)) return;
    const i = Number(h.dataset.hueco);
    actual[i] = actual[i] === colores[color].id ? null : colores[color].id;
    render();
  });
  document.getElementById("mastermindCheck").addEventListener("click", comprobar);
  document.getElementById("mastermindClear").addEventListener("click", () => { if (bloqueado(ID)) return; actual = Array(HUECOS).fill(null); render(); });
  document.getElementById("mastermindReset").addEventListener("click", () => { if (!enHistoria(ID)) nuevaPartida(); });
  // Al entrar o salir del modo historia: código nuevo y límite de intentos ajustado
  const vista = document.getElementById("view-" + ID);
  let enLibro = false;
  new MutationObserver(() => {
    const ahora = vista.classList.contains("modo-historia");
    if (ahora !== enLibro) { enLibro = ahora; nuevaPartida(); }
  }).observe(vista, { attributes: true, attributeFilter: ["class"] });
  nuevaPartida();
}
