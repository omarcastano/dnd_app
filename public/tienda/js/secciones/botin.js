const ITEMS_BOTIN = {
  moneda: { icono: "coins", color: "#d4a54a", singular: "moneda", plural: "monedas" },
  comida: { icono: "drumstick-bite", color: "#c0813a", singular: "comida", plural: "comidas" },
  bebida: { icono: "beer-mug-empty", color: "#d4a54a", singular: "bebida", plural: "bebidas" },
  arma: { icono: "khanda", color: "#c0392b", singular: "arma", plural: "armas" },
  armadura: { icono: "shield-halved", color: "#3498db", singular: "armadura", plural: "armaduras" },
  dado: { icono: "dice-d20", color: "#6a9a4a", texto: "1d4 para tus tiradas de ataque" },
  nada: { icono: "skull-crossbones", color: "#7a6845", texto: "Polvo, huesos y poco mas" }
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
