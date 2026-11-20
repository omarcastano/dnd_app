import { setPuzzleMsg } from "../utilidades.js";

const cipherMessages = [
  "El dios dormido despierta en las ruinas",
  "Busca la llave en el castillo subterraneo",
  "El tesoro esta guardado bajo tres piedras",
  "Los guardianes nunca duermen",
  "La verdad esta en las sombras"
];

let cipherState = {
  original: "",
  cipher: "",
  shift: 0
};

function applyCaesarShift(text, shift) {
  return text.split("").map(c => {
    if (!/[a-zA-Z]/.test(c)) return c;
    const isUpper = c === c.toUpperCase();
    const code = isUpper ? c.charCodeAt(0) - 65 : c.charCodeAt(0) - 97;
    const shifted = (code + shift) % 26;
    return String.fromCharCode(shifted + (isUpper ? 65 : 97));
  }).join("");
}

function renderCipher() {
  document.getElementById("cipherText").textContent = cipherState.cipher;

  const shift = parseInt(document.getElementById("cipherShift").value) || 1;
  document.getElementById("cipherShiftValue").textContent = shift;

  const decrypted = applyCaesarShift(cipherState.cipher, (26 - shift) % 26);
  document.getElementById("decryptedText").textContent = decrypted;
}

function nuevoCifrado() {
  cipherState.original = cipherMessages[Math.floor(Math.random() * cipherMessages.length)];
  cipherState.shift = 1 + Math.floor(Math.random() * 25);
  cipherState.cipher = applyCaesarShift(cipherState.original, cipherState.shift);
  renderCipher();
}

export function initCipher() {
  document.getElementById("cipherShift").addEventListener("input", renderCipher);

  document.getElementById("cipherCheck").addEventListener("click", () => {
    const shift = parseInt(document.getElementById("cipherShift").value) || 1;
    const decrypted = applyCaesarShift(cipherState.cipher, (26 - shift) % 26);

    if (decrypted === cipherState.original) {
      setPuzzleMsg("cipherMessage", "¡Puzzle resuelto!", true);
    } else {
      setPuzzleMsg("cipherMessage", "No es el desplazamiento correcto.");
    }
  });

  document.getElementById("cipherReset").addEventListener("click", () => {
    nuevoCifrado();
    setPuzzleMsg("cipherMessage", "");
  });

  nuevoCifrado();
}
