import { cargarPartes } from "./nucleo/partes.js?v=3";
import { initAmbiente } from "./nucleo/ambiente.js";
import { initNavegacion } from "./nucleo/navegacion.js?v=2";
import { initTienda } from "./secciones/tienda.js";
import { initCofres } from "./secciones/cofres.js";
import { initRobo } from "./secciones/robo.js";
import { initAdmin } from "./secciones/admin.js";
import { initHeroes } from "./secciones/heroes.js?v=7";
import { initBestiario } from "./secciones/bestiario.js?v=5";
import { initPnj } from "./secciones/pnj.js?v=3";
import { initMapas } from "./secciones/mapas.js?v=45";
import { initTablas } from "./secciones/tablas.js";
import { initMenu } from "./puzzles/menu.js";
import { initTents } from "./puzzles/tents.js?v=3";
import { initHitori } from "./puzzles/hitori.js?v=3";
import { initLightUp } from "./puzzles/lightup.js?v=3";
import { initLightsOut } from "./puzzles/lightsout.js?v=3";
import { initNonograma } from "./puzzles/nonograma.js?v=3";
import { initGalaxias } from "./puzzles/galaxias.js?v=3";
import { initStarBattle } from "./puzzles/starbattle.js?v=3";
import { initHanoi } from "./puzzles/hanoi.js?v=3";
import { initMastermind } from "./puzzles/mastermind.js?v=3";
import { initCipher } from "./puzzles/cifrado.js?v=4";

// Se ejecutan en orden una vez cargadas las partes HTML. initTablas va al final: envuelve las tablas ya generadas.
const MODULOS = [
  initAmbiente, initNavegacion,
  initTienda, initCofres, initRobo, initAdmin, initHeroes, initBestiario, initPnj, initMapas,
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
  // Cada módulo arranca aislado: si uno falla (síncrono o async), solo se queda sin funcionar su pestaña.
  MODULOS.forEach(iniciarModulo => {
    const nombre = iniciarModulo.name || "módulo";
    try {
      const resultado = iniciarModulo();
      if (resultado && typeof resultado.catch === "function") {
        resultado.catch(error => console.error(`[${nombre}] falló al arrancar:`, error));
      }
    } catch (error) {
      console.error(`[${nombre}] falló al arrancar:`, error);
    }
  });
}

iniciar();
