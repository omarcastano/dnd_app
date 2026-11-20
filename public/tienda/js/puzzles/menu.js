import { randomOf, setPuzzleMsg } from "../utilidades.js";
import { openPuzzle } from "./vistas.js";

export const puzzleCodes = [
  { id: "nonogram", name: "Nonograma", code: "5065", difficulty: "Fácil", icon: '<i class="fa-solid fa-border-all"></i>', fg: "#ffffff", bg: "linear-gradient(135deg, #3498db 0%, #1d4f78 100%)" },
  { id: "hitori", name: "Hitori", code: "5905", difficulty: "Fácil", icon: '<i class="fa-solid fa-table-cells"></i>', fg: "#ffffff", bg: "linear-gradient(135deg, #9aa640 0%, #5d6a22 100%)" },
  { id: "tents", name: "Carpas", code: "6659", difficulty: "Media", icon: '<i class="fa-solid fa-tree"></i>', fg: "#ffffff", bg: "linear-gradient(135deg, #2e8b57 0%, #145a36 100%)" },
  { id: "galaxies", name: "Galaxias", code: "6105", difficulty: "Media", icon: '<i class="fa-solid fa-meteor"></i>', fg: "#ffffff", bg: "linear-gradient(135deg, #8e44ad 0%, #4a2360 100%)" },
  { id: "lightup", name: "Light Up", code: "3346", difficulty: "Media", icon: '<i class="fa-solid fa-lightbulb"></i>', fg: "#2a1a0a", bg: "linear-gradient(135deg, #f5d76e 0%, #c9a22a 100%)" },
  { id: "hanoi", name: "Torres de Hanoi", code: "4477", difficulty: "Media", icon: '<i class="fa-solid fa-ring"></i>', fg: "#ffffff", bg: "linear-gradient(135deg, #e67e22 0%, #a04a00 100%)" },
  { id: "stars", name: "Star Battle", code: "3313", difficulty: "Difícil", icon: '<i class="fa-solid fa-star"></i>', fg: "#ffffff", bg: "linear-gradient(135deg, #16a085 0%, #0b5345 100%)" },
  { id: "mastermind", name: "Mastermind", code: "8844", difficulty: "Difícil", icon: '<i class="fa-solid fa-dice"></i>', fg: "#ffffff", bg: "linear-gradient(135deg, #8b0000 0%, #4a0000 100%)" },
  { id: "cipher", name: "Cifrado César", code: "2211", difficulty: "Difícil", icon: '<i class="fa-solid fa-scroll"></i>', fg: "#ffffff", bg: "linear-gradient(135deg, #2d5a2d 0%, #001a00 100%)" },
  { id: "lightsout", name: "Lights Out", code: "7309", difficulty: "Difícil", icon: '<i class="fa-solid fa-power-off"></i>', fg: "#ffffff", bg: "linear-gradient(135deg, #c0392b 0%, #6b1d15 100%)" }
];

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
