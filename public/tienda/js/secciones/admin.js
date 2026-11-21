import { setPuzzleMsg } from "../nucleo/utilidades.js";
import { puzzleCodes } from "../datos/puzzles.js";

const ADMIN_PASSWORD = "defare123";

function renderAdminTable() {
  let html = '<span class="admin-head">Puzzle</span><span class="admin-head">Codigo</span>';
  for (const p of puzzleCodes) {
    html += `<span>${p.name}</span><span class="admin-code">${p.code}</span>`;
  }
  document.getElementById("adminTable").innerHTML = html;
}

export function initAdmin() {
  document.getElementById("adminToggle").addEventListener("click", () => {
    const panel = document.getElementById("adminPanel");
    panel.style.display = panel.style.display === "none" ? "block" : "none";
  });

  document.getElementById("adminLogin").addEventListener("click", () => {
    const password = document.getElementById("adminPassword").value;
    if (password !== ADMIN_PASSWORD) {
      setPuzzleMsg("adminMessage", "Contrasena incorrecta.");
      document.getElementById("adminContent").style.display = "none";
      return;
    }
    setPuzzleMsg("adminMessage", "");
    renderAdminTable();
    document.getElementById("adminContent").style.display = "block";
  });
}
