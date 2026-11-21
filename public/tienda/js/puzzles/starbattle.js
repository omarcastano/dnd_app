import { gridOf, setPuzzleMsg } from "../nucleo/utilidades.js";

const starRegions = [
  [0, 0, 0, 1, 1],
  [0, 0, 3, 1, 1],
  [2, 2, 3, 3, 1],
  [2, 2, 3, 3, 4],
  [2, 4, 4, 4, 4]
];
const starColors = ["#6b4a1f", "#2e5e4e", "#4a3a7a", "#7a2e3a", "#3a5a7a"];
let starState = gridOf(5, 5, false);

function renderStars() {
  let html = "";
  for (let r = 0; r < 5; r++) {
    html += "<tr>";
    for (let c = 0; c < 5; c++) {
      const star = starState[r][c] ? '<i class="fa-solid fa-star" style="color:#f5d76e"></i>' : "";
      html += `<td class="puzzle-cell" style="background:${starColors[starRegions[r][c]]}" data-r="${r}" data-c="${c}">${star}</td>`;
    }
    html += "</tr>";
  }
  document.getElementById("starBoard").innerHTML = html;
}

function starError() {
  const rows = Array(5).fill(0);
  const cols = Array(5).fill(0);
  const regions = Array(5).fill(0);
  const stars = [];
  for (let r = 0; r < 5; r++) {
    for (let c = 0; c < 5; c++) {
      if (starState[r][c]) {
        rows[r]++;
        cols[c]++;
        regions[starRegions[r][c]]++;
        stars.push([r, c]);
      }
    }
  }
  if (rows.some(v => v !== 1)) return "Cada fila debe tener exactamente una estrella.";
  if (cols.some(v => v !== 1)) return "Cada columna debe tener exactamente una estrella.";
  if (regions.some(v => v !== 1)) return "Cada color debe tener exactamente una estrella.";
  for (let i = 0; i < stars.length; i++) {
    for (let j = i + 1; j < stars.length; j++) {
      if (Math.abs(stars[i][0] - stars[j][0]) <= 1 && Math.abs(stars[i][1] - stars[j][1]) <= 1) {
        return "Dos estrellas se tocan.";
      }
    }
  }
  return null;
}

export function initStarBattle() {
  document.getElementById("starBoard").addEventListener("click", e => {
    const cell = e.target.closest("[data-r]");
    if (!cell) return;
    const r = Number(cell.dataset.r);
    const c = Number(cell.dataset.c);
    starState[r][c] = !starState[r][c];
    setPuzzleMsg("starMessage", "");
    renderStars();
  });

  document.getElementById("starCheck").addEventListener("click", () => {
    const error = starError();
    if (error) setPuzzleMsg("starMessage", error);
    else setPuzzleMsg("starMessage", "¡Puzzle resuelto!", true);
  });

  document.getElementById("starReset").addEventListener("click", () => {
    starState = gridOf(5, 5, false);
    setPuzzleMsg("starMessage", "");
    renderStars();
  });

  renderStars();
}
