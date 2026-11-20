import { switchTab } from "./navegacion.js";
import { initTienda } from "./tienda.js";
import { initCofres } from "./cofres.js";
import { initRobo } from "./robo.js";
import { initZonas } from "./zonas.js";
import { initBotin } from "./botin.js";
import { initAdmin } from "./admin.js";
import { initTablas } from "./tablas.js";
import { closePuzzle } from "./puzzles/vistas.js";
import { initMenu } from "./puzzles/menu.js";
import { initTents } from "./puzzles/tents.js";
import { initHitori } from "./puzzles/hitori.js";
import { initLightUp } from "./puzzles/lightup.js";
import { initLightsOut } from "./puzzles/lightsout.js";
import { initNonograma } from "./puzzles/nonograma.js";
import { initGalaxias } from "./puzzles/galaxias.js";
import { initStarBattle } from "./puzzles/starbattle.js";
import { initHanoi } from "./puzzles/hanoi.js";
import { initMastermind } from "./puzzles/mastermind.js";
import { initCipher } from "./puzzles/cifrado.js";

// Los botones del HTML usan onclick inline, así que estas funciones deben ser globales.
window.switchTab = switchTab;
window.closePuzzle = closePuzzle;

async function cargarPartes() {
  const huecos = [...document.querySelectorAll("[data-parte]")];
  const textos = await Promise.all(huecos.map(async hueco => {
    const respuesta = await fetch(new URL(`../partes/${hueco.dataset.parte}`, import.meta.url));
    if (!respuesta.ok) {
      throw new Error(`No se pudo cargar ${hueco.dataset.parte} (${respuesta.status}).`);
    }
    return respuesta.text();
  }));
  huecos.forEach((hueco, i) => {
    const plantilla = document.createElement("template");
    plantilla.innerHTML = textos[i];
    hueco.replaceWith(plantilla.content);
  });
}

async function iniciar() {
  try {
    await cargarPartes();
  } catch (error) {
    const aviso = document.createElement("p");
    aviso.className = "puzzle-message";
    aviso.textContent = `La tienda no se pudo abrir. ${error.message}`;
    document.body.prepend(aviso);
    return;
  }

  initTienda();
  initCofres();
  initRobo();
  initZonas();
  initBotin();
  initMenu();
  initTents();
  initHitori();
  initLightUp();
  initLightsOut();
  initNonograma();
  initGalaxias();
  initStarBattle();
  initAdmin();
  initHanoi();
  initMastermind();
  initCipher();
  initTablas();
}

iniciar();
