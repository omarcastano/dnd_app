import { setPuzzleMsg } from "../nucleo/utilidades.js";

const mastermindColors = ["empty", "red", "blue", "green", "yellow", "white", "purple", "orange"];
let mastermindState = {
  secret: [],
  guesses: [],
  currentGuess: [],
  attempts: 0,
  solved: false
};

function nuevaPartida() {
  mastermindState.secret = Array(4).fill().map(() => mastermindColors[1 + Math.floor(Math.random() * 7)]);
  mastermindState.guesses = [];
  mastermindState.currentGuess = Array(4).fill("empty");
  mastermindState.attempts = 0;
  mastermindState.solved = false;
  renderMastermind();
}

function mastermindPegRow(colors, onClick) {
  const row = document.createElement("div");
  row.className = "mastermind-row";
  colors.forEach((color, i) => {
    const peg = document.createElement("div");
    peg.className = `mastermind-peg ${color}`;
    if (onClick) peg.addEventListener("click", () => onClick(i));
    row.appendChild(peg);
  });
  return row;
}

function mastermindHintBox(hints) {
  const box = document.createElement("div");
  box.className = "mastermind-hint";
  for (let r = 0; r < 2; r++) {
    const row = document.createElement("div");
    row.className = "mastermind-hint-row";
    for (let i = r * 2; i < r * 2 + 2; i++) {
      const peg = document.createElement("div");
      peg.className = `mastermind-hint-peg ${hints[i] || "empty"}`;
      row.appendChild(peg);
    }
    box.appendChild(row);
  }
  return box;
}

function cycleMastermindPeg(i) {
  const idx = mastermindColors.indexOf(mastermindState.currentGuess[i]);
  mastermindState.currentGuess[i] = mastermindColors[(idx + 1) % mastermindColors.length];
  renderMastermind();
}

function renderMastermind() {
  const board = document.getElementById("mastermindBoard");
  board.innerHTML = "";

  for (const guess of mastermindState.guesses) {
    const line = document.createElement("div");
    line.className = "mastermind-guess";
    line.append(mastermindPegRow(guess.colors, null), mastermindHintBox(guess.hints));
    board.appendChild(line);
  }

  if (!mastermindState.solved) {
    const line = document.createElement("div");
    line.className = "mastermind-guess";
    line.append(mastermindPegRow(mastermindState.currentGuess, cycleMastermindPeg), mastermindHintBox([]));
    board.appendChild(line);
  }
}

export function initMastermind() {
  document.getElementById("mastermindReset").addEventListener("click", () => {
    nuevaPartida();
    setPuzzleMsg("mastermindMessage", "");
  });

  document.getElementById("mastermindCheck").addEventListener("click", () => {
    if (mastermindState.solved) return;

    if (mastermindState.currentGuess.includes("empty")) {
      setPuzzleMsg("mastermindMessage", "Completa los 4 colores primero.");
      return;
    }

    const blacks = mastermindState.currentGuess.filter((c, i) => c === mastermindState.secret[i]).length;
    if (blacks === 4) {
      mastermindState.solved = true;
      mastermindState.guesses.push({ colors: mastermindState.currentGuess.slice(), hints: Array(4).fill("black") });
      setPuzzleMsg("mastermindMessage", "¡Puzzle resuelto!", true);
      renderMastermind();
      return;
    }

    let whites = 0;
    const secretCounts = {};
    const guessCounts = {};
    for (let i = 0; i < 4; i++) {
      if (mastermindState.currentGuess[i] !== mastermindState.secret[i]) {
        secretCounts[mastermindState.secret[i]] = (secretCounts[mastermindState.secret[i]] || 0) + 1;
        guessCounts[mastermindState.currentGuess[i]] = (guessCounts[mastermindState.currentGuess[i]] || 0) + 1;
      }
    }
    for (const color in guessCounts) {
      if (secretCounts[color]) {
        whites += Math.min(guessCounts[color], secretCounts[color]);
      }
    }

    const hints = Array(blacks).fill("black").concat(Array(whites).fill("white")).concat(Array(4 - blacks - whites).fill("empty"));
    mastermindState.guesses.push({ colors: mastermindState.currentGuess.slice(), hints });
    mastermindState.currentGuess = Array(4).fill("empty");
    mastermindState.attempts++;

    setPuzzleMsg("mastermindMessage", `Intento ${mastermindState.attempts}`);
    renderMastermind();
  });

  nuevaPartida();
}
