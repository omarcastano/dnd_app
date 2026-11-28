import { setPuzzleMsg } from "../nucleo/utilidades.js";
import { enHistoria, comprobarHistoria, bloqueado, fallarHistoria, datosHistoria } from "./historia.js?v=2";

const ID = "hanoi";
// Modo historia: movimientos permitidos = mínimo + 25 %, redondeando hacia arriba.
// Regla «circular» (campo `regla` del enigma, por defecto en el libro): una pieza solo puede ir al soporte de su
// derecha (1→2, 2→3, 3→1). El truco clásico ya no sirve y hay que razonar de nuevo; el mínimo se calcula con BFS.
const limiteHistoria = () => Math.ceil(minimo() * 1.25);
let circular = false;
const permitido = (de, a) => !circular || a === (de + 1) % 3;

// Mínimo de movimientos de la torre 1 a la 3 con la regla actual (búsqueda en anchura, 3^n estados)
export function minimoHanoi(n, esCircular) {
  const inicio = "0".repeat(n), meta = "2".repeat(n);
  const dist = new Map([[inicio, 0]]);
  const cola = [inicio];
  while (cola.length) {
    const e = cola.shift();
    if (e === meta) return dist.get(e);
    // e[i] = torre del anillo i (0 = el más pequeño); el de arriba de cada torre es el menor índice
    const arriba = [-1, -1, -1];
    for (let i = n - 1; i >= 0; i--) arriba[Number(e[i])] = i;
    for (let de = 0; de < 3; de++) {
      const a1 = arriba[de];
      if (a1 < 0) continue;
      for (let a = 0; a < 3; a++) {
        if (a === de || (esCircular && a !== (de + 1) % 3)) continue;
        if (arriba[a] >= 0 && arriba[a] < a1) continue;
        const sig = e.slice(0, a1) + a + e.slice(a1 + 1);
        if (!dist.has(sig)) { dist.set(sig, dist.get(e) + 1); cola.push(sig); }
      }
    }
  }
  return Infinity;
}
const minimo = () => (circular ? minimoHanoi(anillos, true) : 2 ** anillos - 1);

const colores = ["#e74c3c", "#e67e22", "#f1c40f", "#2ecc71", "#1abc9c", "#3498db", "#9b59b6", "#e84393"];
let anillos = 5;
let torres = [];
let seleccionada = null;
let historial = [];
let gastados = 0; // movimientos totales en modo historia (deshacer o reiniciar no los devuelve)

function empezar() {
  torres = [[...Array(anillos).keys()].map(i => anillos - i), [], []];
  seleccionada = null;
  historial = [];
  gastados = 0;
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
  document.getElementById("hanoiCheck").style.display = enHistoria(ID) ? "" : "none";
  const regla = document.getElementById("hanoiRegla");
  regla.hidden = !circular;
  regla.innerHTML = '<i class="fa-solid fa-rotate-right"></i> Regla del giro: cada pieza solo puede ir al soporte de su derecha (1→2, 2→3 y 3→1).';
  if (enHistoria(ID)) document.getElementById("hanoiInfo").innerHTML = `Movimientos: <strong>${gastados} de ${limiteHistoria()}</strong> · Mínimo posible: <strong>${minimo()}</strong>`;
  else document.getElementById("hanoiInfo").innerHTML = `Movimientos: <strong>${historial.length}</strong> · Mínimo posible: <strong>${minimo()}</strong>`;
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
  if (!permitido(seleccionada, t)) {
    setPuzzleMsg("hanoiMessage", `Por la regla del giro, desde la torre ${seleccionada + 1} solo se puede ir a la torre ${(seleccionada + 1) % 3 + 1}.`);
    seleccionada = null;
    render();
    return;
  }
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
  if (enHistoria(ID)) {
    gastados++;
    render();
    // sin autocomprobar: solo se vigila el límite; la pila completa se confirma con «Comprobar»
    if (gastados > limiteHistoria()) fallarHistoria(ID, "Las piedras se han desmoronado: demasiados movimientos.");
    return;
  }
  if (torres[2].length === anillos) {
    const min = minimo();
    setPuzzleMsg("hanoiMessage", historial.length === min ? `¡Perfecto! Resuelto en ${min} movimientos, el mínimo.` : `¡Resuelto en ${historial.length} movimientos! El mínimo es ${min}.`, true);
  }
}

export function initHanoi() {
  for (let t = 0; t < 3; t++) {
    document.getElementById(`hanoiTower${t + 1}`).closest(".hanoi-tower").addEventListener("click", () => {
      if (bloqueado(ID) || (!enHistoria(ID) && torres[2].length === anillos)) return;
      alTocarTorre(t);
    });
  }
  document.querySelectorAll("[data-hanoi-anillos]").forEach(b => b.addEventListener("click", () => {
    if (enHistoria(ID)) return;
    anillos = Number(b.dataset.hanoiAnillos);
    empezar();
  }));
  document.getElementById("hanoiCircular").addEventListener("change", e => {
    if (enHistoria(ID)) return;
    circular = e.target.checked;
    empezar();
  });
  document.getElementById("hanoiUndo").addEventListener("click", () => {
    if (bloqueado(ID)) return;
    const ultimo = historial.pop();
    if (!ultimo) return;
    torres[ultimo[0]].push(torres[ultimo[1]].pop());
    seleccionada = null;
    setPuzzleMsg("hanoiMessage", "");
    render();
  });
  document.getElementById("hanoiReset").addEventListener("click", () => {
    if (bloqueado(ID)) return;
    if (!enHistoria(ID)) return empezar();
    // en modo historia se recoloca la pila, pero los movimientos gastados siguen contando
    const g = gastados; empezar(); gastados = g; render();
  });
  document.getElementById("hanoiCheck").addEventListener("click", () => {
    if (enHistoria(ID)) comprobarHistoria(ID, torres[2].length === anillos);
  });
  // Al entrar en modo historia: 5 anillos y pila nueva; al salir, partida normal de nuevo
  const vista = document.getElementById("view-" + ID);
  let enLibro = false;
  new MutationObserver(() => {
    const ahora = vista.classList.contains("modo-historia");
    if (ahora !== enLibro) {
      enLibro = ahora;
      const d = ahora ? datosHistoria(ID) : {};
      circular = ahora ? (d.regla ?? "circular") === "circular" : document.getElementById("hanoiCircular").checked;
      if (ahora) anillos = Number(d.anillos) || (circular ? 3 : 5);
      empezar();
    }
  }).observe(vista, { attributes: true, attributeFilter: ["class"] });
  empezar();
}
