import { tablaLoot } from "../nucleo/utilidades.js";
import { botinHtml } from "./botin.js";

const RANGOS_COFRE = [[1, 8], [9, 13], [14, 17], [18, 19], [20, 20]];

const COFRES = [
  {
    id: "chest-1",
    nombre: "Gris pequeño",
    fondo: ["#c9ced3", "#8d949b"],
    texto: "#2a1a0a",
    botines: [
      [["nada"]],
      [["moneda", 2]],
      [["moneda", 2], ["comida", 2]],
      [["moneda", 2], ["comida", 2], ["dado"]],
      [["moneda", 3], ["comida", 2], ["bebida", 2], ["arma", 1], ["dado"]]
    ]
  },
  {
    id: "chest-2",
    nombre: "Gris mediano",
    fondo: ["#aab1b8", "#6a7178"],
    texto: "#1a1008",
    botines: [
      [["moneda", 1], ["comida", 1]],
      [["moneda", 3], ["comida", 1]],
      [["moneda", 3], ["comida", 2], ["bebida", 1]],
      [["moneda", 4], ["comida", 2], ["bebida", 2], ["dado"]],
      [["moneda", 5], ["comida", 3], ["bebida", 2], ["arma", 1], ["dado"]]
    ]
  },
  {
    id: "chest-3",
    nombre: "Gris grande",
    fondo: ["#8a9198", "#4f565d"],
    texto: "#f0e6d0",
    botines: [
      [["moneda", 2], ["comida", 1]],
      [["moneda", 4], ["comida", 1]],
      [["moneda", 4], ["comida", 2], ["bebida", 1]],
      [["moneda", 5], ["comida", 2], ["bebida", 2], ["dado"]],
      [["moneda", 6], ["comida", 3], ["bebida", 3], ["arma", 1], ["dado"]]
    ]
  },
  {
    id: "chest-4",
    nombre: "Gris extra grande",
    fondo: ["#6b7279", "#353b41"],
    texto: "#f0e6d0",
    botines: [
      [["moneda", 3], ["comida", 1]],
      [["moneda", 5], ["comida", 2]],
      [["moneda", 5], ["comida", 2], ["bebida", 2]],
      [["moneda", 6], ["comida", 3], ["bebida", 2], ["dado"]],
      [["moneda", 7], ["comida", 3], ["bebida", 3], ["arma", 1], ["dado"]]
    ]
  },
  {
    id: "chest-5",
    nombre: "Café grande",
    fondo: ["#a0673a", "#5a3317"],
    texto: "#f0e6d0",
    botines: [
      [["moneda", 4], ["comida", 2]],
      [["moneda", 6], ["comida", 3], ["bebida", 1]],
      [["moneda", 6], ["comida", 3], ["bebida", 2]],
      [["moneda", 7], ["comida", 4], ["bebida", 2], ["arma", 1], ["dado"]],
      [["moneda", 8], ["comida", 4], ["bebida", 3], ["arma", 1], ["armadura", 1], ["dado"]]
    ]
  }
];

function renderCofres() {
  document.getElementById("chestSelectRow").innerHTML = COFRES.map((cofre, i) =>
    `<button class="puzzle-btn chest-select${i === 0 ? " active" : ""}" data-chest="${cofre.id}">${cofre.nombre}</button>`
  ).join("");

  document.getElementById("chestPanels").innerHTML = COFRES.map((cofre, i) => `
    <div id="${cofre.id}" class="chest-panel${i === 0 ? " active" : ""}">
      <div class="loot-box-wrap">
        <button class="loot-box chest-box" style="background: linear-gradient(135deg, ${cofre.fondo[0]} 0%, ${cofre.fondo[1]} 100%); color: ${cofre.texto};" title="Tirar el dado"><i class="fa-solid fa-box-archive"></i></button>
        <div class="loot-result">Haz clic en la caja</div>
      </div>
      ${tablaLoot(
        ['<th><i class="fa-solid fa-dice-d20" style="color:#e74c3c"></i> Tirada</th>', "<th>Botin</th>"],
        RANGOS_COFRE.map(([min, max], f) => `
          <tr>
            <td class="roll-cell" data-min="${min}" data-max="${max}">${min === max ? min : `${min} – ${max}`}</td>
            <td class="loot-cell">${botinHtml(cofre.botines[f])}</td>
          </tr>`)
      )}
    </div>`).join("");
}

export function initCofres() {
  renderCofres();

  document.querySelectorAll(".chest-select").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".chest-select").forEach(b => b.classList.toggle("active", b === btn));
      document.querySelectorAll(".chest-panel").forEach(p => p.classList.toggle("active", p.id === btn.dataset.chest));
    });
  });

  const destrezaToggle = document.getElementById("chestDestreza");

  document.querySelectorAll(".chest-panel").forEach(panel => {
    const box = panel.querySelector(".chest-box");
    const result = panel.querySelector(".loot-result");
    const rows = Array.from(panel.querySelectorAll("tbody tr"));
    box.addEventListener("click", () => {
      const d20 = Math.floor(Math.random() * 20) + 1;
      const bonus = destrezaToggle.checked ? Math.floor(Math.random() * 4) + 1 : 0;
      const total = Math.min(d20 + bonus, 20);
      const row = rows.find(r => total >= Number(r.cells[0].dataset.min) && total <= Number(r.cells[0].dataset.max));
      box.disabled = true;
      box.classList.add("shaking");
      result.innerHTML = "";
      setTimeout(() => {
        box.classList.remove("shaking");
        box.disabled = false;
        result.innerHTML = `
          <div class="loot-reveal">
            <div>${row.cells[1].innerHTML}</div>
          </div>`;
      }, 500);
    });
  });
}
