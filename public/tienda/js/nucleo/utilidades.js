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
