import { tablaLoot } from "../nucleo/utilidades.js";

const ZONAS = [
  ["#1", "Todos los monstruos", "0", "0", "0", "0"],
  ["#1", "Boss que bloque al tabernero", "1d4", "1", "2", "4"],
  ["#1", "Boss guardian (limita el paso a la zona 2)", "1d4", "1", "3", "5"],
  ["#2", "Todos los monstruos", "1d4", "1", "1", "2"],
  ["#2", "Boss que bloque al tabernero", "1d4", "2", "4", "6"],
  ["#2", "Boss guardian (limita el paso a la zona 3)", "1d4", "3", "6", "8"],
  ["#3", "Todos los monstruos", "1d4", "3", "2", "3"],
  ["#3", "Boss que bloque al tabernero", "1d4", "4", "6", "8"],
  ["#3", "Boss guardian (limita el paso a la zona 4)", "1d6", "5", "8", "10"],
  ["#4", "Todos los monstruos", "1d4", "5", "3", "4"],
  ["#4", "Boss Final", "1d6", "6", "10", "12"]
];

export function initZonas() {
  document.getElementById("zonasTabla").innerHTML = tablaLoot(
    [
      '<th class="num-cell">Calabozo</th>',
      "<th>Aplica para</th>",
      '<th class="num-cell"><i class="fa-solid fa-dice-d20" style="color:#6a9a4a"></i> Dado de ataque</th>',
      '<th class="num-cell">Dano adicional</th>',
      '<th class="num-cell">Vida adicional (4 jugadores)</th>',
      '<th class="num-cell">Vida adicional (5 jugadores)</th>'
    ],
    ZONAS.map(([calabozo, aplica, ...valores]) => `
      <tr>
        <td class="roll-cell">${calabozo}</td>
        <td class="loot-cell">${aplica}</td>
        ${valores.map(valor => `<td class="num-cell">${valor}</td>`).join("")}
      </tr>`)
  );
}
