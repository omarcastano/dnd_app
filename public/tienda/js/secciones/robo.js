import { tablaLoot } from "./utilidades.js";

const ROBO = [
  { tirada: "1 – 16", resultado: "Te descubren", estilo: "color:#e8a0a0;" },
  { tirada: "17 – 20", resultado: '<i class="fa-solid fa-sack-dollar" style="color:#d4a54a"></i> Robo exitoso: 100% del botin' }
];

export function initRobo() {
  document.getElementById("robTabla").innerHTML = tablaLoot(
    ['<th><i class="fa-solid fa-dice-d20" style="color:#e74c3c"></i> Tirada</th>', '<th><i class="fa-solid fa-coins" style="color:#d4a54a"></i> Resultado</th>'],
    ROBO.map(fila => `
      <tr>
        <td class="roll-cell">${fila.tirada}</td>
        <td class="loot-cell"${fila.estilo ? ` style="${fila.estilo}"` : ""}>${fila.resultado}</td>
      </tr>`)
  );
}
