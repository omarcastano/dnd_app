import { setPuzzleMsg } from "../nucleo/utilidades.js";

const colores = ["#e74c3c", "#e67e22", "#f1c40f", "#2ecc71", "#1abc9c", "#3498db", "#9b59b6", "#e84393"];
let anillos = 5;
let torres = [];
let seleccionada = null;
let historial = [];

function empezar() {
  torres = [[...Array(anillos).keys()].map(i => anillos - i), [], []];
  seleccionada = null;
  historial = [];
  setPuzzleMsg("hanoiMessage", "");
  render();
}

function render() {
  for (let t = 0; t < 3; t++) {
    const torre = document.getElementById(`hanoiTower${t + 1}`);
    torre.innerHTML = "";
    torre.classList.toggle("hanoi-selected", seleccionada === t);
    const pila = torres[t];
    pila.forEach((anillo, i) => {
      const div = document.createElement("div");
      div.className = "hanoi-ring";
      if (seleccionada === t && i === pila.length - 1) div.classList.add("levantado");
      div.textContent = anillo;
      div.style.width = `${26 + (anillo / anillos) * 70}%`;
      div.style.background = `linear-gradient(180deg, ${colores[(anillo - 1) % colores.length]}, ${colores[(anillo - 1) % colores.length]}cc)`;
      torre.appendChild(div);
    });
    torre.style.minHeight = `${anillos * 28 + 36}px`;
  }
  document.getElementById("hanoiInfo").innerHTML = `Movimientos: <strong>${historial.length}</strong> · Mínimo posible: <strong>${2 ** anillos - 1}</strong>`;
  document.querySelectorAll("[data-hanoi-anillos]").forEach(b => b.classList.toggle("activo", Number(b.dataset.hanoiAnillos) === anillos));
}

function alTocarTorre(t) {
  const pila = torres[t];
  if (seleccionada === null) {
    if (pila.length) seleccionada = t;
    else setPuzzleMsg("hanoiMessage", "Esa torre está vacía. Toca una torre con anillos para cogerlos.");
    if (seleccionada === t) setPuzzleMsg("hanoiMessage", "");
    render();
    return;
  }
  if (seleccionada === t) { seleccionada = null; render(); return; }
  const origen = torres[seleccionada];
  const anillo = origen[origen.length - 1];
  if (pila.length && anillo > pila[pila.length - 1]) {
    setPuzzleMsg("hanoiMessage", "No puedes poner un anillo grande sobre uno más pequeño.");
    seleccionada = null;
    render();
    return;
  }
  origen.pop();
  pila.push(anillo);
  historial.push([seleccionada, t]);
  seleccionada = null;
  setPuzzleMsg("hanoiMessage", "");
  render();
  if (torres[2].length === anillos) {
    const min = 2 ** anillos - 1;
    setPuzzleMsg("hanoiMessage", historial.length === min ? `¡Perfecto! Resuelto en ${min} movimientos, el mínimo.` : `¡Resuelto en ${historial.length} movimientos! El mínimo es ${min}.`, true);
  }
}

export function initHanoi() {
  for (let t = 0; t < 3; t++) {
    document.getElementById(`hanoiTower${t + 1}`).closest(".hanoi-tower").addEventListener("click", () => {
      if (torres[2].length === anillos) return;
      alTocarTorre(t);
    });
  }
  document.querySelectorAll("[data-hanoi-anillos]").forEach(b => b.addEventListener("click", () => {
    anillos = Number(b.dataset.hanoiAnillos);
    empezar();
  }));
  document.getElementById("hanoiUndo").addEventListener("click", () => {
    const ultimo = historial.pop();
    if (!ultimo) return;
    torres[ultimo[0]].push(torres[ultimo[1]].pop());
    seleccionada = null;
    setPuzzleMsg("hanoiMessage", "");
    render();
  });
  document.getElementById("hanoiReset").addEventListener("click", empezar);
  empezar();
}
