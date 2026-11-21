import { directions, gridOf, setPuzzleMsg } from "../nucleo/utilidades.js";

const galaxyDots = [[0, 0], [0, 4], [4, 0], [4, 4], [2, 2], [0, 2], [2, 0], [1, 1], [2, 4], [1, 3], [3, 3], [3, 1], [4, 2]];
let galaxyAssign = gridOf(5, 5, -1);
let galaxySelected = -1;

function galaxyDotIndex(r, c) {
  return galaxyDots.findIndex(([dr, dc]) => dr === r && dc === c);
}

function resetGalaxies() {
  galaxyAssign = gridOf(5, 5, -1);
  galaxyDots.forEach(([r, c], k) => { galaxyAssign[r][c] = k; });
  galaxySelected = -1;
}

function renderGalaxy() {
  let html = "";
  for (let r = 0; r < 5; r++) {
    html += "<tr>";
    for (let c = 0; c < 5; c++) {
      const k = galaxyAssign[r][c];
      const dot = galaxyDotIndex(r, c);
      const selected = dot >= 0 && dot === galaxySelected ? " selected" : "";
      const style = k >= 0 ? ` style="background:hsl(${(k * 47) % 360}, 55%, 35%)"` : "";
      const icon = dot >= 0 ? '<i class="fa-solid fa-circle" style="color:var(--oro-claro)"></i>' : "";
      html += `<td class="puzzle-cell${selected}"${style} data-r="${r}" data-c="${c}">${icon}</td>`;
    }
    html += "</tr>";
  }
  document.getElementById("galaxyBoard").innerHTML = html;
}

function galaxyError() {
  for (let r = 0; r < 5; r++) {
    for (let c = 0; c < 5; c++) {
      if (galaxyAssign[r][c] < 0) return "Hay celdas sin galaxia.";
    }
  }
  for (let k = 0; k < galaxyDots.length; k++) {
    const [dr, dc] = galaxyDots[k];
    const cells = [];
    for (let r = 0; r < 5; r++) {
      for (let c = 0; c < 5; c++) {
        if (galaxyAssign[r][c] === k) cells.push([r, c]);
      }
    }

    const reached = gridOf(5, 5, false);
    const queue = [[dr, dc]];
    reached[dr][dc] = true;
    let count = 0;
    while (queue.length) {
      const [r, c] = queue.shift();
      count++;
      for (const [sr, sc] of directions) {
        const rr = r + sr;
        const cc = c + sc;
        if (rr >= 0 && rr < 5 && cc >= 0 && cc < 5 && !reached[rr][cc] && galaxyAssign[rr][cc] === k) {
          reached[rr][cc] = true;
          queue.push([rr, cc]);
        }
      }
    }
    if (count !== cells.length) return "Una galaxia no es continua.";

    for (const [r, c] of cells) {
      const mr = 2 * dr - r;
      const mc = 2 * dc - c;
      if (mr < 0 || mr > 4 || mc < 0 || mc > 4 || galaxyAssign[mr][mc] !== k) {
        return "Una galaxia no es simetrica alrededor de su punto.";
      }
    }
  }
  return null;
}

export function initGalaxias() {
  document.getElementById("galaxyBoard").addEventListener("click", e => {
    const cell = e.target.closest("[data-r]");
    if (!cell) return;
    const r = Number(cell.dataset.r);
    const c = Number(cell.dataset.c);
    const dot = galaxyDotIndex(r, c);
    if (dot >= 0) {
      galaxySelected = dot;
      setPuzzleMsg("galaxyMessage", "");
    } else if (galaxySelected < 0) {
      setPuzzleMsg("galaxyMessage", "Primero toca un punto para elegir su galaxia.");
    } else {
      galaxyAssign[r][c] = galaxyAssign[r][c] === galaxySelected ? -1 : galaxySelected;
      setPuzzleMsg("galaxyMessage", "");
    }
    renderGalaxy();
  });

  document.getElementById("galaxyCheck").addEventListener("click", () => {
    const error = galaxyError();
    if (error) setPuzzleMsg("galaxyMessage", error);
    else setPuzzleMsg("galaxyMessage", "¡Puzzle resuelto!", true);
  });

  document.getElementById("galaxyReset").addEventListener("click", () => {
    resetGalaxies();
    setPuzzleMsg("galaxyMessage", "");
    renderGalaxy();
  });

  resetGalaxies();
  renderGalaxy();
}
