import { cargarPartes } from "./nucleo/partes.js";
import { initAmbiente } from "./nucleo/ambiente.js";
import { initNavegacion } from "./nucleo/navegacion.js";
import { initTienda } from "./secciones/tienda.js";
import { initCofres } from "./secciones/cofres.js";
import { initRobo } from "./secciones/robo.js";
import { initAdmin } from "./secciones/admin.js";
import { initHeroes } from "./secciones/heroes.js?v=7";
import { initBestiario } from "./secciones/bestiario.js";
import { initTablas } from "./secciones/tablas.js";
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

// Se ejecutan en orden una vez cargadas las partes HTML. initTablas va al final: envuelve las tablas ya generadas.
const MODULOS = [
  initAmbiente, initNavegacion,
  initTienda, initCofres, initRobo, initAdmin, initHeroes, initBestiario,
  initMenu, initTents, initHitori, initLightUp, initLightsOut, initNonograma,
  initGalaxias, initStarBattle, initHanoi, initMastermind, initCipher,
  initTablas
];

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
  MODULOS.forEach(iniciarModulo => iniciarModulo());
}

iniciar();
