import { directions, gridOf, setPuzzleMsg } from "../nucleo/utilidades.js";

const lightLayout = [
  ["W", "W", "W", "3", "W"],
  ["W", "1", "W", "W", "W"],
  ["W", "W", "W", "W", "B"],
  ["B", "W", "W", "W", "W"],
  ["W", "W", "1", "W", "W"]
];
let lightBulbs = gridOf(5, 5, false);

function isLightWhite(r, c) {
  return lightLayout[r][c] === "W";
}

function litCells() {
  const lit = gridOf(5, 5, false);
  for (let r = 0; r < 5; r++) {
    for (let c = 0; c < 5; c++) {
      if (!lightBulbs[r][c]) continue;
      lit[r][c] = true;
      for (const [dr, dc] of directions) {
        let rr = r + dr;
        let cc = c + dc;
        while (rr >= 0 && rr < 5 && cc >= 0 && cc < 5 && isLightWhite(rr, cc)) {
          lit[rr][cc] = true;
          rr += dr;
          cc += dc;
        }
      }
    }
  }
  return lit;
}

function lightError() {
  for (let r = 0; r < 5; r++) {
    for (let c = 0; c < 5; c++) {
      if (!lightBulbs[r][c]) continue;
      for (const [dr, dc] of directions) {
        let rr = r + dr;
        let cc = c + dc;
        while (rr >= 0 && rr < 5 && cc >= 0 && cc < 5 && isLightWhite(rr, cc)) {
          if (lightBulbs[rr][cc]) return "Dos bombillas se iluminan entre si.";
          rr += dr;
          cc += dc;
        }
      }
    }
  }

  const lit = litCells();
  for (let r = 0; r < 5; r++) {
    for (let c = 0; c < 5; c++) {
      if (isLightWhite(r, c) && !lit[r][c]) return "Todavia hay celdas sin iluminar.";
    }
  }

  for (let r = 0; r < 5; r++) {
    for (let c = 0; c < 5; c++) {
      const v = lightLayout[r][c];
      if (v === "W" || v === "B") continue;
      let count = 0;
      for (const [dr, dc] of directions) {
        const rr = r + dr;
        const cc = c + dc;
        if (rr >= 0 && rr < 5 && cc >= 0 && cc < 5 && lightBulbs[rr][cc]) count++;
      }
      if (count !== Number(v)) return `Un numero ${v} no se cumple.`;
    }
  }
  return null;
}

function renderLight() {
  const lit = litCells();
  let html = "";
  for (let r = 0; r < 5; r++) {
    html += "<tr>";
    for (let c = 0; c < 5; c++) {
      const v = lightLayout[r][c];
      if (v !== "W") {
        html += `<td class="puzzle-cell wall">${v === "B" ? "" : v}</td>`;
      } else {
        const bulb = lightBulbs[r][c] ? '<i class="fa-solid fa-lightbulb" style="color:var(--oro-claro)"></i>' : "";
        html += `<td class="puzzle-cell${lit[r][c] ? " lit" : ""}" data-r="${r}" data-c="${c}">${bulb}</td>`;
      }
    }
    html += "</tr>";
  }
  document.getElementById("lightBoard").innerHTML = html;
}

export function initLightUp() {
  document.getElementById("lightBoard").addEventListener("click", e => {
    const cell = e.target.closest("[data-r]");
    if (!cell) return;
    const r = Number(cell.dataset.r);
    const c = Number(cell.dataset.c);
    lightBulbs[r][c] = !lightBulbs[r][c];
    setPuzzleMsg("lightMessage", "");
    renderLight();
  });

  document.getElementById("lightCheck").addEventListener("click", () => {
    const error = lightError();
    if (error) setPuzzleMsg("lightMessage", error);
    else setPuzzleMsg("lightMessage", "¡Puzzle resuelto!", true);
  });

  document.getElementById("lightReset").addEventListener("click", () => {
    lightBulbs = gridOf(5, 5, false);
    setPuzzleMsg("lightMessage", "");
    renderLight();
  });

  renderLight();
}
