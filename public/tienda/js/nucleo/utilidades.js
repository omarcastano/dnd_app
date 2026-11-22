export const randomOf = list => list[Math.floor(Math.random() * list.length)];

export const directions = [[1, 0], [-1, 0], [0, 1], [0, -1]];

export function gridOf(rows, cols, value) {
  return Array.from({ length: rows }, () => Array(cols).fill(value));
}

export function copyGrid(grid) {
  return grid.map(row => row.slice());
}

export function setPuzzleMsg(id, text, ok = false) {
  const el = document.getElementById(id);
  el.textContent = text;
  el.className = ok ? "puzzle-message ok" : "puzzle-message";
}

export function tablaLoot(cabecera, filas) {
  return `
    <table class="loot-table">
      <thead>
        <tr>${cabecera.join("")}</tr>
      </thead>
      <tbody>${filas.join("")}</tbody>
    </table>`;
}

export function mezclar(lista) {
  const copia = lista.slice();
  for (let i = copia.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copia[i], copia[j]] = [copia[j], copia[i]];
  }
  return copia;
}

export const entero = n => Math.floor(Math.random() * n);

// Pintar arrastrando (ratón o dedo) sobre un tablero con celdas [data-r][data-c].
// alEmpezar(r, c, evento) devuelve true para iniciar el arrastre; alPasar(r, c) se llama en cada celda nueva.
export function arrastrar(tablero, alEmpezar, alPasar) {
  let activo = false;
  let ultima = "";
  const celdaEn = (x, y) => document.elementFromPoint(x, y)?.closest("[data-r][data-c]");
  tablero.addEventListener("pointerdown", e => {
    const celda = e.target.closest("[data-r][data-c]");
    if (!celda || !tablero.contains(celda)) return;
    if (e.pointerType === "mouse" && e.button !== 0 && e.button !== 2) return;
    e.preventDefault();
    const r = Number(celda.dataset.r);
    const c = Number(celda.dataset.c);
    activo = alEmpezar(r, c, e) === true;
    ultima = `${r},${c}`;
  });
  tablero.addEventListener("pointermove", e => {
    if (!activo) return;
    const celda = celdaEn(e.clientX, e.clientY);
    if (!celda || !tablero.contains(celda)) return;
    const clave = `${celda.dataset.r},${celda.dataset.c}`;
    if (clave === ultima) return;
    ultima = clave;
    alPasar(Number(celda.dataset.r), Number(celda.dataset.c));
  });
  const soltar = () => { activo = false; };
  window.addEventListener("pointerup", soltar);
  window.addEventListener("pointercancel", soltar);
  tablero.addEventListener("contextmenu", e => e.preventDefault());
  tablero.addEventListener("pointerdown", e => { if (e.pointerType === "touch") tablero.releasePointerCapture?.(e.pointerId); });
}

export function formatoTiempo(ms) {
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}
