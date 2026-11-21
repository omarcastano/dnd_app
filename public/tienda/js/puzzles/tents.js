import { setPuzzleMsg } from "../nucleo/utilidades.js";

const puzzle = {
  size: 5,
  trees: [[0, 1], [1, 4], [2, 2], [3, 0], [4, 3]],
  rowClues: [2, 0, 1, 0, 2],
  colClues: [2, 1, 0, 0, 2]
};

let puzzleBoard = Array.from({ length: puzzle.size }, () => Array(puzzle.size).fill(0));

function isTree(r, c) {
  return puzzle.trees.some(([tr, tc]) => tr === r && tc === c);
}

function renderPuzzle() {
  const n = puzzle.size;
  let html = "<tr><th></th>";
  for (let c = 0; c < n; c++) html += `<th class="clue">${puzzle.colClues[c]}</th>`;
  html += "</tr>";
  for (let r = 0; r < n; r++) {
    html += `<tr><td class="clue">${puzzle.rowClues[r]}</td>`;
    for (let c = 0; c < n; c++) {
      if (isTree(r, c)) {
        html += '<td class="puzzle-cell tree"><i class="fa-solid fa-star" style="color:var(--oro)"></i></td>';
      } else {
        const coin = puzzleBoard[r][c] ? '<i class="fa-solid fa-coins" style="color:var(--oro)"></i>' : "";
        html += `<td class="puzzle-cell" data-r="${r}" data-c="${c}">${coin}</td>`;
      }
    }
    html += "</tr>";
  }
  document.getElementById("puzzleTable").innerHTML = html;
}

function hasPerfectMatch(coins, trees) {
  const adjacent = (coin, tree) => Math.abs(coin[0] - tree[0]) + Math.abs(coin[1] - tree[1]) === 1;
  const coinOfTree = new Array(trees.length).fill(-1);

  function tryCoin(i, seen) {
    for (let j = 0; j < trees.length; j++) {
      if (!seen[j] && adjacent(coins[i], trees[j])) {
        seen[j] = true;
        if (coinOfTree[j] === -1 || tryCoin(coinOfTree[j], seen)) {
          coinOfTree[j] = i;
          return true;
        }
      }
    }
    return false;
  }

  for (let i = 0; i < coins.length; i++) {
    if (!tryCoin(i, new Array(trees.length).fill(false))) return false;
  }
  return true;
}

function puzzleError() {
  const n = puzzle.size;
  const coins = [];
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      if (puzzleBoard[r][c]) coins.push([r, c]);
    }
  }

  if (coins.length !== puzzle.trees.length) {
    return `Debes poner ${puzzle.trees.length} monedas, una por cada estrella.`;
  }
  for (let i = 0; i < coins.length; i++) {
    for (let j = i + 1; j < coins.length; j++) {
      if (Math.abs(coins[i][0] - coins[j][0]) <= 1 && Math.abs(coins[i][1] - coins[j][1]) <= 1) {
        return "Dos monedas se tocan. Separalas.";
      }
    }
  }
  for (let r = 0; r < n; r++) {
    const count = coins.filter(([cr]) => cr === r).length;
    if (count !== puzzle.rowClues[r]) return `La fila ${r + 1} necesita ${puzzle.rowClues[r]} monedas.`;
  }
  for (let c = 0; c < n; c++) {
    const count = coins.filter(([, cc]) => cc === c).length;
    if (count !== puzzle.colClues[c]) return `La columna ${c + 1} necesita ${puzzle.colClues[c]} monedas.`;
  }
  if (!hasPerfectMatch(coins, puzzle.trees)) {
    return "Cada moneda debe estar junto a una estrella (arriba, abajo, izquierda o derecha), y cada estrella debe tener su moneda.";
  }
  return null;
}

export function initTents() {
  document.getElementById("puzzleTable").addEventListener("click", e => {
    const cell = e.target.closest(".puzzle-cell");
    if (!cell || cell.classList.contains("tree")) return;
    const r = Number(cell.dataset.r);
    const c = Number(cell.dataset.c);
    puzzleBoard[r][c] = puzzleBoard[r][c] ? 0 : 1;
    setPuzzleMsg("puzzleMessage", "");
    renderPuzzle();
  });

  document.getElementById("puzzleCheck").addEventListener("click", () => {
    const error = puzzleError();
    if (error) setPuzzleMsg("puzzleMessage", error);
    else setPuzzleMsg("puzzleMessage", "¡Puzzle resuelto!", true);
  });

  document.getElementById("puzzleReset").addEventListener("click", () => {
    puzzleBoard = Array.from({ length: puzzle.size }, () => Array(puzzle.size).fill(0));
    setPuzzleMsg("puzzleMessage", "");
    renderPuzzle();
  });

  renderPuzzle();
}
