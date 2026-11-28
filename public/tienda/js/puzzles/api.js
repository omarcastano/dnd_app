// API pública de la pestaña «Enigmas» para otras secciones (hoy: el libro de campañas de Mapas).
// Las demás secciones SOLO importan de aquí, nunca de vistas.js, historia.js, cifrado.js ni datos/puzzles.js.
// Ojo: las URLs de import (con su ?v=) deben ser las mismas que usa main.js; un mismo módulo con otra
// query string se carga dos veces y pierde el estado compartido (p. ej. el modo historia).
import { puzzleCodes } from "../datos/puzzles.js";
import { openPuzzle, closePuzzle } from "./vistas.js";
import { cifradoDeHistoria } from "./cifrado.js?v=4";
import { iniciarHistoria, salirHistoria } from "./historia.js?v=2";

// Nombre visible de un enigma por su id (tents, cipher…), o '' si no existe
export const nombreEnigma = (id) => puzzleCodes.find((p) => p.id === id)?.name ?? "";

// Quita el pergamino de historia (elemento .enigma-historia) que haya en cualquier enigma
const quitarPergaminos = () => document.querySelectorAll(".enigma-historia").forEach((n) => n.remove());

/**
 * Abre un enigma en la pestaña Enigmas (la pestaña la activa quien llama).
 * opciones.historia: { intentos, tema, mensaje, datos } → modo historia (intentos del equipo y aspecto del tablero);
 *   `mensaje` solo lo usa el cifrado; `datos` = el objeto `enigma` del paso (cada puzzle lee sus campos con datosHistoria).
 *   Sin `historia`, el enigma se abre normal.
 * opciones.pergamino: HTML que se pone al principio del enigma; su raíz debe llevar la clase `enigma-historia`.
 */
export function abrirEnigmaDeHistoria(id, { historia = null, pergamino = "" } = {}) {
  closePuzzle();
  quitarPergaminos();
  salirHistoria();
  cifradoDeHistoria(id === "cipher" ? historia?.mensaje ?? null : null);
  openPuzzle(id);
  const vista = document.getElementById("view-" + id);
  if (pergamino && vista) vista.insertAdjacentHTML("afterbegin", pergamino);
  if (historia) iniciarHistoria(id, { intentos: historia.intentos, tema: historia.tema, datos: historia.datos });
  return vista;
}

// Deja los enigmas como estaban: sin pergamino, sin modo historia y con el cifrado normal.
// cerrarVista: además vuelve al menú de enigmas (lo que hace el botón «Volver al libro»).
export function cerrarEnigmaDeHistoria({ cerrarVista = false } = {}) {
  quitarPergaminos();
  salirHistoria();
  cifradoDeHistoria(null);
  if (cerrarVista) closePuzzle();
}

// Cierra cualquier enigma abierto y vuelve al menú (lo usa la navegación con [data-cerrar-puzzle])
export const cerrarEnigma = () => closePuzzle();
