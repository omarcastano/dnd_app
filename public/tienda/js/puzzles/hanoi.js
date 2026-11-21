import { setPuzzleMsg } from "../nucleo/utilidades.js";

let hanoiState = {
  towers: [
    [3, 2, 1],
    [],
    []
  ],
  selected: null
};

function renderHanoi() {
  const widths = [60, 90, 120];
  const colors = ["#e74c3c", "#3498db", "#f39c12"];
  for (let t = 0; t < 3; t++) {
    const tower = document.getElementById(`hanoiTower${t + 1}`);
    tower.innerHTML = "";
    tower.classList.toggle("hanoi-selected", hanoiState.selected === t);
    for (const ring of hanoiState.towers[t]) {
      const div = document.createElement("div");
      div.className = "hanoi-ring";
      div.textContent = ring;
      div.style.width = widths[ring - 1] + "px";
      div.style.background = colors[ring - 1];
      tower.appendChild(div);
    }
  }
}

function hanoiTowerClick(tower) {
  const stack = hanoiState.towers[tower];
  if (hanoiState.selected === null) {
    if (stack.length > 0) hanoiState.selected = tower;
    renderHanoi();
    return;
  }

  if (hanoiState.selected === tower) {
    hanoiState.selected = null;
    renderHanoi();
    return;
  }

  const from = hanoiState.towers[hanoiState.selected];
  const ring = from[from.length - 1];
  hanoiState.selected = null;
  if (stack.length > 0 && ring > stack[stack.length - 1]) {
    setPuzzleMsg("hanoiMessage", "No puedes poner un anillo grande sobre uno pequeño.");
    renderHanoi();
    return;
  }

  from.pop();
  stack.push(ring);
  setPuzzleMsg("hanoiMessage", hanoiState.towers[2].length === 3 ? "¡Puzzle resuelto!" : "", true);
  renderHanoi();
}

export function initHanoi() {
  for (let t = 0; t < 3; t++) {
    document.getElementById(`hanoiTower${t + 1}`).addEventListener("click", () => hanoiTowerClick(t));
  }

  document.getElementById("hanoiReset").addEventListener("click", () => {
    hanoiState = { towers: [[3, 2, 1], [], []], selected: null };
    setPuzzleMsg("hanoiMessage", "");
    renderHanoi();
  });

  renderHanoi();
}
