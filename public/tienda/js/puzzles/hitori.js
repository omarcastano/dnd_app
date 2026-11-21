import { directions, gridOf, setPuzzleMsg } from "../nucleo/utilidades.js";

const hitoriValues = [
  [3, 3, 1, 2, 4],
  [2, 4, 1, 3, 4],
  [3, 2, 2, 4, 1],
  [4, 1, 3, 1, 2],
  [2, 2, 4, 1, 3]
];
let hitoriShade = gridOf(5, 5, false);

function renderHitori() {
  let html = "";
  for (let r = 0; r < 5; r++) {
    html += "<tr>";
    for (let c = 0; c < 5; c++) {
      const shaded = hitoriShade[r][c];
      html += `<td class="puzzle-cell${shaded ? " shade" : ""}" data-r="${r}" data-c="${c}">${shaded ? "" : hitoriValues[r][c]}</td>`;
    }
    html += "</tr>";
  }
  document.getElementById("hitoriBoard").innerHTML = html;
}

function hitoriError() {
  const n = 5;
  const s = hitoriShade;
  const v = hitoriValues;

  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      if (s[r][c] && ((r + 1 < n && s[r + 1][c]) || (c + 1 < n && s[r][c + 1]))) {
        return "Dos celdas sombreadas se tocan.";
      }
    }
  }
  for (let r = 0; r < n; r++) {
    const seen = new Set();
    for (let c = 0; c < n; c++) {
      if (s[r][c]) continue;
      if (seen.has(v[r][c])) return `En la fila ${r + 1} se repite un numero sin sombrear.`;
      seen.add(v[r][c]);
    }
  }
  for (let c = 0; c < n; c++) {
    const seen = new Set();
    for (let r = 0; r < n; r++) {
      if (s[r][c]) continue;
      if (seen.has(v[r][c])) return `En la columna ${c + 1} se repite un numero sin sombrear.`;
      seen.add(v[r][c]);
    }
  }

  let total = 0;
  let start = null;
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      if (!s[r][c]) {
        total++;
        if (!start) start = [r, c];
      }
    }
  }
  if (!start) return "Sombrea algunas celdas.";

  const visited = gridOf(n, n, false);
  const queue = [start];
  visited[start[0]][start[1]] = true;
  let reached = 0;
  while (queue.length) {
    const [r, c] = queue.shift();
    reached++;
    for (const [dr, dc] of directions) {
      const rr = r + dr;
      const cc = c + dc;
      if (rr >= 0 && rr < n && cc >= 0 && cc < n && !s[rr][cc] && !visited[rr][cc]) {
        visited[rr][cc] = true;
        queue.push([rr, cc]);
      }
    }
  }
  if (reached !== total) return "Las celdas sin sombrear deben quedar conectadas.";
  return null;
}

export function initHitori() {
  document.getElementById("hitoriBoard").addEventListener("click", e => {
    const cell = e.target.closest("[data-r]");
    if (!cell) return;
    const r = Number(cell.dataset.r);
    const c = Number(cell.dataset.c);
    hitoriShade[r][c] = !hitoriShade[r][c];
    setPuzzleMsg("hitoriMessage", "");
    renderHitori();
  });

  document.getElementById("hitoriCheck").addEventListener("click", () => {
    const error = hitoriError();
    if (error) setPuzzleMsg("hitoriMessage", error);
    else setPuzzleMsg("hitoriMessage", "¡Puzzle resuelto!", true);
  });

  document.getElementById("hitoriReset").addEventListener("click", () => {
    hitoriShade = gridOf(5, 5, false);
    setPuzzleMsg("hitoriMessage", "");
    renderHitori();
  });

  renderHitori();
}
