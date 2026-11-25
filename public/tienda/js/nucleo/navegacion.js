import { cerrarEnigma } from "../puzzles/api.js";

function switchTab(tab, btn) {
  document.querySelectorAll(".tab-content").forEach(t => t.classList.remove("active"));
  document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
  document.getElementById("tab-" + tab).classList.add("active");
  btn.classList.add("active");
}

// Delegación de eventos: el HTML declara data-tab="x" y data-cerrar-puzzle, sin onclick inline ni globales.
export function initNavegacion() {
  document.addEventListener("click", e => {
    const pestana = e.target.closest("[data-tab]");
    if (pestana) return switchTab(pestana.dataset.tab, pestana);
    if (e.target.closest("[data-cerrar-puzzle]")) cerrarEnigma();
  });
}
