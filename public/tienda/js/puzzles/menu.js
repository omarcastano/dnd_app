import { randomOf, setPuzzleMsg } from "../nucleo/utilidades.js";
import { puzzleCodes } from "../datos/puzzles.js";
import { openPuzzle } from "./vistas.js";

export function initMenu() {
  const puzzleBox = document.getElementById("puzzleBox");

  puzzleBox.addEventListener("click", () => {
    const picked = randomOf(puzzleCodes);
    const result = document.getElementById("puzzleResult");
    puzzleBox.disabled = true;
    puzzleBox.classList.add("shaking");
    result.innerHTML = "";
    setTimeout(() => {
      puzzleBox.classList.remove("shaking");
      puzzleBox.disabled = false;
      puzzleBox.innerHTML = picked.icon;
      puzzleBox.style.background = picked.bg;
      puzzleBox.style.color = picked.fg;
      puzzleBox.style.borderColor = picked.fg;
      result.innerHTML = `<div class="loot-reveal"><div>Te toca: <strong>${picked.name}</strong></div><div>Dificultad: ${picked.difficulty}</div></div>`;
    }, 500);
  });

  const input = document.getElementById("puzzleCodeInput");

  function openPuzzleByCode() {
    const match = puzzleCodes.find(p => p.code === input.value.trim());
    if (!match) {
      setPuzzleMsg("puzzleCodeMessage", "Codigo incorrecto.");
      return;
    }
    setPuzzleMsg("puzzleCodeMessage", "");
    input.value = "";
    openPuzzle(match.id);
  }

  input.addEventListener("input", e => {
    e.target.value = e.target.value.replace(/\D/g, "");
  });

  input.addEventListener("keydown", e => {
    if (e.key === "Enter") openPuzzleByCode();
  });

  document.getElementById("puzzleCodeBtn").addEventListener("click", openPuzzleByCode);
}
