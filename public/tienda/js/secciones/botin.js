import { randomOf } from "./utilidades.js";

const ITEMS_BOTIN = {
  moneda: { icono: "coins", color: "#d4a54a", singular: "moneda", plural: "monedas" },
  comida: { icono: "drumstick-bite", color: "#c0813a", singular: "comida", plural: "comidas" },
  bebida: { icono: "beer-mug-empty", color: "#d4a54a", singular: "bebida", plural: "bebidas" },
  arma: { icono: "khanda", color: "#c0392b", singular: "arma", plural: "armas" },
  armadura: { icono: "shield-halved", color: "#3498db", singular: "armadura", plural: "armaduras" },
  dado: { icono: "dice-d20", color: "#6a9a4a", texto: "1d4 para tus tiradas de ataque" },
  nada: { icono: "skull-crossbones", color: "#6a5a40", texto: "Polvo, huesos y poco mas" }
};

function itemHtml([tipo, cantidad]) {
  const item = ITEMS_BOTIN[tipo];
  const icono = `<i class="fa-solid fa-${item.icono}" style="color:${item.color}"></i>`;
  if (item.texto) return `${icono} ${item.texto}`;
  return `${icono} ${cantidad} ${cantidad === 1 ? item.singular : item.plural}`;
}

export function botinHtml(botin) {
  const partes = botin.map(itemHtml);
  if (partes.length === 1) return partes[0];
  return `${partes.slice(0, -1).join(", ")} y ${partes[partes.length - 1]}`;
}

const coinIcon = '<i class="fa-solid fa-coins" style="color:#d4a54a"></i>';
const weaponIcon = '<i class="fa-solid fa-khanda" style="color:#c0392b"></i>';
const shieldIcon = '<i class="fa-solid fa-shield-halved" style="color:#3498db"></i>';
const helmetIcon = '<svg viewBox="0 0 64 64" width="28" height="28"><path d="M12 38c0-16 8-26 20-26s20 10 20 26" fill="none" stroke="#7f8c8d" stroke-width="4" stroke-linecap="round"/><rect x="8" y="36" width="48" height="8" rx="3" fill="#7f8c8d" opacity="0.9"/><rect x="28" y="20" width="8" height="24" rx="2" fill="#1a1008" opacity="0.6"/><path d="M14 44v8M50 44v8" stroke="#7f8c8d" stroke-width="3" stroke-linecap="round"/></svg>';
const chestIcon = '<svg viewBox="0 0 64 64" width="28" height="28"><path d="M32 8 L48 20 L50 44 L42 54 L22 54 L14 44 L16 20 Z" fill="none" stroke="#8e6b3e" stroke-width="3.5" stroke-linejoin="round"/><path d="M24 20 L32 14 L40 20" fill="none" stroke="#8e6b3e" stroke-width="2.5" stroke-linejoin="round"/><line x1="32" y1="14" x2="32" y2="48" stroke="#8e6b3e" stroke-width="2" opacity="0.5"/><line x1="18" y1="32" x2="46" y2="32" stroke="#8e6b3e" stroke-width="2" opacity="0.5"/></svg>';

const lootOutcomes = [
  { chance: 40, options: [{ name: "1 moneda", icon: coinIcon }] },
  { chance: 25, options: [{ name: "2 monedas", icon: coinIcon }] },
  { chance: 15, options: [{ name: "3 monedas", icon: coinIcon }] },
  {
    chance: 10,
    options: [
      { name: "Tarta de fresa", icon: '<i class="fa-solid fa-cake-candles" style="color:#e8a0a0"></i>' },
      { name: "Huevos fritos", icon: '<i class="fa-solid fa-egg" style="color:#f5d76e"></i>' },
      { name: "Postres", icon: '<i class="fa-solid fa-ice-cream" style="color:#f1948a"></i>' },
      { name: "Calentado", icon: '<i class="fa-solid fa-bowl-food" style="color:#c0813a"></i>' },
      { name: "Panes", icon: '<i class="fa-solid fa-bread-slice" style="color:#d4a54a"></i>' },
      { name: "Sushi magico", icon: '<i class="fa-solid fa-fish" style="color:#e74c3c"></i>' },
      { name: "Bebida con alcohol", icon: '<i class="fa-solid fa-wine-bottle" style="color:#8e44ad"></i>' },
      { name: "Bebida sin alcohol", icon: '<i class="fa-solid fa-mug-hot" style="color:#c0813a"></i>' }
    ]
  },
  {
    chance: 7,
    options: [
      { name: "Dado de ataque", icon: '<i class="fa-solid fa-dice" style="color:#e74c3c"></i>' },
      { name: "Dado de sanacion", icon: '<i class="fa-solid fa-dice" style="color:#6a9a4a"></i>' },
      { name: "Dado de destreza", icon: '<i class="fa-solid fa-dice" style="color:#3498db"></i>' }
    ]
  },
  {
    chance: 3,
    options: [
      ...["Espada corta", "Espada larga", "Alabarda", "Espada doble", "Puñal", "Daga", "Hacha corta", "Maza"].map(name => ({ name, icon: weaponIcon })),
      { name: "Arco", icon: '<i class="fa-solid fa-bullseye" style="color:#c0392b"></i>' },
      { name: "Escudo", icon: shieldIcon },
      { name: "Pechera", icon: chestIcon },
      { name: "Casco", icon: helmetIcon }
    ]
  }
];

function rollLoot() {
  let roll = Math.random() * 100;
  for (const outcome of lootOutcomes) {
    if (roll < outcome.chance) return randomOf(outcome.options);
    roll -= outcome.chance;
  }
  return randomOf(lootOutcomes[lootOutcomes.length - 1].options);
}

export function initBotin() {
  const lootBox = document.getElementById("lootBox");
  const lootResult = document.getElementById("lootResult");

  lootBox.addEventListener("click", () => {
    const item = rollLoot();
    lootBox.disabled = true;
    lootBox.classList.add("shaking");
    lootResult.innerHTML = "";
    setTimeout(() => {
      lootBox.classList.remove("shaking");
      lootBox.disabled = false;
      lootResult.innerHTML = `
        <div class="loot-reveal">
          <div class="loot-big-icon">${item.icon}</div>
          <div>${item.name}</div>
        </div>`;
    }, 500);
  });
}
