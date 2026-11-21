import { gridOf, setPuzzleMsg } from "../nucleo/utilidades.js";

const nonoSolution = [
  [0, 0, 1, 0, 0],
  [0, 1, 1, 1, 0],
  [1, 1, 1, 1, 1],
  [0, 0, 1, 0, 0],
  [0, 0, 1, 0, 0]
];

function nonoRuns(line) {
  const runs = [];
  let count = 0;
  for (const v of line) {
    if (v) {
      count++;
    } else if (count) {
      runs.push(count);
      count = 0;
    }
  }
  if (count) runs.push(count);
  return runs;
}

function sameRuns(a, b) {
  return a.length === b.length && a.every((v, i) => v === b[i]);
}

const nonoRowClues = nonoSolution.map(row => nonoRuns(row));
const nonoColClues = nonoSolution[0].map((_, c) => nonoRuns(nonoSolution.map(row => row[c])));
let nonoBoard = gridOf(5, 5, 0);

function renderNono() {
  let html = "<tr><th></th>";
  for (let c = 0; c < 5; c++) {
    const clue = nonoColClues[c].length ? nonoColClues[c].join("<br>") : "0";
    html += `<th class="clue">${clue}</th>`;
  }
  html += "</tr>";
  for (let r = 0; r < 5; r++) {
    const clue = nonoRowClues[r].length ? nonoRowClues[r].join(" ") : "0";
    html += `<tr><td class="clue">${clue}</td>`;
    for (let c = 0; c < 5; c++) {
      html += `<td class="puzzle-cell${nonoBoard[r][c] ? " filled" : ""}" data-r="${r}" data-c="${c}"></td>`;
    }
    html += "</tr>";
  }
  document.getElementById("nonoBoard").innerHTML = html;
}

function nonoError() {
  for (let r = 0; r < 5; r++) {
    if (!sameRuns(nonoRuns(nonoBoard[r]), nonoRowClues[r])) return `La fila ${r + 1} no cumple sus pistas.`;
  }
  for (let c = 0; c < 5; c++) {
    const col = nonoBoard.map(row => row[c]);
    if (!sameRuns(nonoRuns(col), nonoColClues[c])) return `La columna ${c + 1} no cumple sus pistas.`;
  }
  return null;
}

export function initNonograma() {
  document.getElementById("nonoBoard").addEventListener("click", e => {
    const cell = e.target.closest("[data-r]");
    if (!cell) return;
    const r = Number(cell.dataset.r);
    const c = Number(cell.dataset.c);
    nonoBoard[r][c] = nonoBoard[r][c] ? 0 : 1;
    setPuzzleMsg("nonoMessage", "");
    renderNono();
  });

  document.getElementById("nonoCheck").addEventListener("click", () => {
    const error = nonoError();
    if (error) setPuzzleMsg("nonoMessage", error);
    else setPuzzleMsg("nonoMessage", "¡Puzzle resuelto!", true);
  });

  document.getElementById("nonoReset").addEventListener("click", () => {
    nonoBoard = gridOf(5, 5, 0);
    setPuzzleMsg("nonoMessage", "");
    renderNono();
  });

  renderNono();
}
