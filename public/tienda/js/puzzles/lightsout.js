import { copyGrid, directions, gridOf, setPuzzleMsg } from "../utilidades.js";

let lightsState = gridOf(5, 5, false);
let lightsStart = gridOf(5, 5, false);

function lightsPress(state, r, c) {
  for (const [dr, dc] of [[0, 0], ...directions]) {
    const rr = r + dr;
    const cc = c + dc;
    if (rr >= 0 && rr < 5 && cc >= 0 && cc < 5) state[rr][cc] = !state[rr][cc];
  }
}

function lightsSolved() {
  return lightsState.every(row => row.every(v => !v));
}

function renderLights() {
  let html = "";
  for (let r = 0; r < 5; r++) {
    html += "<tr>";
    for (let c = 0; c < 5; c++) {
      html += `<td class="puzzle-cell${lightsState[r][c] ? " on" : ""}" data-r="${r}" data-c="${c}"></td>`;
    }
    html += "</tr>";
  }
  document.getElementById("lightsBoard").innerHTML = html;
}

function newLightsPuzzle() {
  let state;
  do {
    state = gridOf(5, 5, false);
    for (let i = 0; i < 8; i++) {
      lightsPress(state, Math.floor(Math.random() * 5), Math.floor(Math.random() * 5));
    }
  } while (state.every(row => row.every(v => !v)));
  lightsStart = copyGrid(state);
  lightsState = copyGrid(state);
  setPuzzleMsg("lightsMessage", "");
  renderLights();
}

export function initLightsOut() {
  document.getElementById("lightsBoard").addEventListener("click", e => {
    const cell = e.target.closest("[data-r]");
    if (!cell) return;
    const r = Number(cell.dataset.r);
    const c = Number(cell.dataset.c);
    lightsPress(lightsState, r, c);
    renderLights();
    if (lightsSolved()) setPuzzleMsg("lightsMessage", "¡Todas las luces apagadas!", true);
    else setPuzzleMsg("lightsMessage", "");
  });

  document.getElementById("lightsNew").addEventListener("click", newLightsPuzzle);

  document.getElementById("lightsReset").addEventListener("click", () => {
    lightsState = copyGrid(lightsStart);
    setPuzzleMsg("lightsMessage", "");
    renderLights();
  });

  newLightsPuzzle();
}
