export const groups = [
  {
    name: "Comida",
    icon: '<i class="fa-solid fa-utensils" style="color:var(--cobre)"></i>',
    note: "Puedes comer dentro y fuera de combate.<br><br>En combate, comer gasta tu turno: en vez de tirar para atacar, te curas.",
    table: [
      ["Tarta de fresa", 4, 3, 2],
      ["Huevos fritos", 3, 4, 3],
      ["Postres", 8, 2, 1],
      ["Calentado", 3, 5, 4],
      ["Panes", 4, 3, 2],
      ["Sushi magico", 1, 6, "Desconocido"]
    ],
    items: []
  },
  {
    name: "Bebidas",
    icon: '<i class="fa-solid fa-beer-mug-empty" style="color:var(--oro)"></i>',
    note: "Puedes beber dentro y fuera de combate.<br><br>En combate, beber gasta tu turno: en vez de tirar para atacar, te curas.<br><br><strong>Con alcohol:</strong><br>• Si la bebes en combate, durante 2 turnos tienes −3 en tus tiradas de ataque.<br>• Si la bebes fuera de combate, en el siguiente combate empiezas Embriagado los primeros 2 turnos (−3 en tus tiradas de ataque).",
    headers: ["Bebida", "Unidades", "Precio (monedas)", "Curacion (pts)"],
    table: [
      ["Con alcohol", 8, 4, 4],
      ["Sin alcohol", 8, 3, 2]
    ],
    items: []
  },
  {
    name: "Armas",
    icon: '<i class="fa-solid fa-khanda" style="color:var(--sangre)"></i>',
    note: "Puedes llevar hasta 2 armas, una en cada mano.<br><br>Armas cortas: ocupan 1 mano, así que puedes llevar 2.<br>Armas de 2 manos: ocupan las dos manos, así que no puedes llevar otra arma.<br><br>El daño de cada arma se suma a todas tus habilidades, si no fallas el ataque.",
    headers: ["Arma", "Unidades", "Precio (monedas)", "Daño (+)", "Manos"],
    table: [
      ["Espada corta", 7, 4, 1, 1],
      ["Espada larga", 1, 5, 2, 1],
      ["Alabarda", 6, 7, 3, 2],
      ["Espada doble", 1, 7, 3, 2],
      ["Puñal", 1, 3, 1, 1],
      ["Daga", 4, 4, 1, 1],
      ["Arco", 2, 6, 2, 2],
      ["Hacha corta", 2, 4, 1, 1],
      ["Maza", 1, 5, 2, 1]
    ],
    items: []
  },
  {
    name: "Armaduras",
    icon: '<i class="fa-solid fa-user-shield" style="color:var(--hielo)"></i>',
    note: "Solo puedes llevar una armadura.<br><br>Cada armadura reduce el daño que recibes de cada golpe en la cantidad indicada.<br>Un golpe acertado siempre hace al menos 1 de daño.",
    headers: ["Armadura", "Unidades", "Precio (monedas)", "Reduce (puntos)"],
    table: [
      ['<i class="fa-solid fa-shield-halved" style="color:var(--hielo)"></i> Escudo', 2, 5, 4],
      ['<svg viewBox="0 0 64 64" width="28" height="28"><path d="M32 8 L48 20 L50 44 L42 54 L22 54 L14 44 L16 20 Z" fill="none" stroke="#8e6b3e" stroke-width="3.5" stroke-linejoin="round"/><path d="M24 20 L32 14 L40 20" fill="none" stroke="#8e6b3e" stroke-width="2.5" stroke-linejoin="round"/><line x1="32" y1="14" x2="32" y2="48" stroke="#8e6b3e" stroke-width="2" opacity="0.5"/><line x1="18" y1="32" x2="46" y2="32" stroke="#8e6b3e" stroke-width="2" opacity="0.5"/></svg> Pechera', 4, 7, 5],
      ['<svg viewBox="0 0 64 64" width="28" height="28"><path d="M12 38c0-16 8-26 20-26s20 10 20 26" fill="none" stroke="#7f8c8d" stroke-width="4" stroke-linecap="round"/><rect x="8" y="36" width="48" height="8" rx="3" fill="#7f8c8d" opacity="0.9"/><rect x="28" y="20" width="8" height="24" rx="2" fill="#1a1008" opacity="0.6"/><path d="M14 44v8M50 44v8" stroke="#7f8c8d" stroke-width="3" stroke-linecap="round"/></svg> Casco', 4, 6, 3]
    ],
    items: []
  },
  {
    name: "Dados",
    icon: '<i class="fa-solid fa-dice" style="color:var(--rubi)"></i>',
    note: "Los dados de 1d4 se suman a la tirada que les corresponde.<br><br>Por ejemplo: si sacas 3 en el d20 y 4 en el 1d4, tienes 7 en total.<br><br>El dado de sanacion se usa al curarte con comida o bebida. El de destreza sirve para abrir cofres y robar al tabernero.",
    headers: ["Dado", "Unidades", "Precio (monedas)", "Sirve para"],
    table: [
      ['<i class="fa-solid fa-dice" style="color:var(--rubi)"></i> Dado de ataque', 5, 3, "Ataque"],
      ['<i class="fa-solid fa-dice" style="color:var(--esmeralda)"></i> Dado de sanacion', 4, 3, "Curar"],
      ['<i class="fa-solid fa-dice" style="color:var(--hielo)"></i> Dado de destreza', 4, 3, "Destreza"]
    ],
    items: []
  }
];
