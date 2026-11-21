import { groups } from "../datos/tienda.js";

function stockClass(n) {
  if (n <= 2) return "stock-low";
  if (n <= 5) return "stock-med";
  return "stock-high";
}

function groupCard(group) {
  const card = document.createElement("div");
  card.className = "card group-card";
  card.innerHTML = `
    <div class="card-header" data-alternar-tarjeta>
      <div class="card-title-group">
        <span class="card-icon">${group.icon}</span>
        <span class="card-name">${group.name}</span>
      </div>
      <div class="card-meta">
        <span class="expand-icon">▼</span>
      </div>
    </div>
    <div class="card-body">
      <div class="card-content">
        ${group.note ? `<p class="card-desc">${group.note}</p>` : ""}
        ${group.table ? `
          <table class="loot-table food-table">
            <thead>
              <tr>
                ${(group.headers || ["Nombre", "Unidades", "Precio (monedas)", "Curacion (pts)"]).map((h, i) => `<th class="${i ? "num-cell" : ""}">${h}</th>`).join("")}
              </tr>
            </thead>
            <tbody>
              ${group.table.map(row => `
                <tr>
                  ${row.map((value, i) => `<td class="${i ? "num-cell" : "loot-cell"}">${value}</td>`).join("")}
                </tr>`).join("")}
            </tbody>
          </table>` : ""}
        ${group.items.map(item => `
          <div class="item-row">
            <div class="item-head">
              <span class="card-icon">${item.icon}</span>
              <span class="card-name">${item.name}</span>
              <span class="card-price">${item.price}</span>
              <span class="card-stock ${stockClass(item.stock)}">x${item.stock}</span>
            </div>
            <p class="card-desc">${item.desc}</p>
            <div class="card-effect effect-${item.effectType}">
              <strong>Efecto</strong>
              ${item.effect}
            </div>
          </div>`).join("")}
      </div>
    </div>`;
  return card;
}

export function initTienda() {
  const shop = document.getElementById("shop");
  groups.forEach(group => shop.appendChild(groupCard(group)));
  shop.addEventListener("click", e => {
    const cabecera = e.target.closest("[data-alternar-tarjeta]");
    if (cabecera) cabecera.parentElement.classList.toggle("open");
  });
}
