import { entero, mezclar, setPuzzleMsg } from "../nucleo/utilidades.js";
import { enHistoria, comprobarHistoria, bloqueado, datosHistoria } from "./historia.js?v=2";

// Tres rondas: César (desplazamiento oculto), sustitución (alfabeto desordenado) y Vigenère (clave con varias letras).
// César NO muestra el texto descifrado en vivo: el dial es solo una tabla de traducción. El salto se deduce de una
// palabra que se sabe que aparece en el mensaje («palabra conocida»), se descifra a mano y se ESCRIBE la respuesta
// a una pregunta (una palabra del mensaje que no se puede adivinar). En el libro: campos `mensaje`, `desplazamiento`,
// `pista_clave`, `pregunta` y `respuesta` del enigma (public/mapas/campanas.json).
const A = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

const mensajesCesar = [
  "EL DRAGON DUERME BAJO LA MONTANA",
  "BUSCA LA LLAVE EN EL CASTILLO OLVIDADO",
  "EL TESORO ESTA BAJO TRES PIEDRAS",
  "LOS GUARDIANES NUNCA DUERMEN",
  "LA PUERTA SE ABRE CON LA LUNA LLENA",
  "NO CONFIES EN EL POSADERO CALVO"
];
const mensajesSustitucion = [
  "EL MAGO ESCONDIO EL AMULETO EN LA TORRE DEL NORTE ANTES DE QUE LLEGARAN LOS SOLDADOS",
  "SOLO QUIEN DERROTE AL GUARDIAN DE LA CRIPTA PODRA ABRIR LA PUERTA DE LOS ANTIGUOS REYES",
  "CUANDO LA LUNA ILUMINE LA FUENTE SECA APARECERA EL CAMINO HACIA LA CIUDAD HUNDIDA",
  "EL LADRON DEJO UN MAPA FALSO PARA QUE LOS CAZADORES BUSCARAN EN EL BOSQUE EQUIVOCADO",
  "TRES CAMPANAS SONARAN A MEDIANOCHE Y LA ESTATUA DEL HEROE REVELARA SU SECRETO MAS ANTIGUO"
];
const mensajesVigenere = [
  { texto: "LA REINA ESCONDE UNA SEGUNDA LLAVE", clave: "ORO" },
  { texto: "EL ORACULO MIENTE CUANDO SONRIE", clave: "LUNA" },
  { texto: "NUNCA ABRAS EL COFRE SIN LA LLAVE DE PLATA", clave: "REY" },
  { texto: "LOS ENANOS GUARDAN EL MAPA BAJO EL YUNQUE", clave: "FORJA" },
  { texto: "EL CAMINO SEGURO PASA POR EL RIO SECO", clave: "ALBA" }
];
const nombres = ["César", "Sustitución", "Vigenère"];

let ronda = 0;
let historia = null; // mensaje propio cuando el enigma se abre desde el libro de campañas (solo ronda César)
let reto = null;
let resuelto = false;

const idx = ch => A.indexOf(ch);
const normalizar = t => String(t ?? "").toUpperCase().normalize("NFD").replace(/[^A-Z ]/g, " ").replace(/\s+/g, " ").trim();
const desplazar = (texto, n) => texto.split("").map(ch => (idx(ch) < 0 ? ch : A[(idx(ch) + n + 26) % 26])).join("");

// Libro de campañas: un mensaje de la historia en la ronda César (null vuelve a las tres rondas normales)
export function cifradoDeHistoria(mensaje) {
  historia = mensaje ? normalizar(mensaje) : null;
  ronda = 0;
  nuevoReto();
}

export function vigenere(texto, clave, signo = 1) {
  let i = 0;
  return texto.split("").map(ch => {
    if (idx(ch) < 0) return ch;
    const k = idx(clave[i++ % clave.length]);
    return A[(idx(ch) + signo * k + 26) % 26];
  }).join("");
}

function nuevoReto() {
  resuelto = false;
  if (ronda === 0) {
    const d = historia ? datosHistoria("cipher") : {};
    const original = historia ?? mensajesCesar[entero(mensajesCesar.length)];
    const palabras = original.split(" ");
    const desp = Number.isInteger(d.desplazamiento) ? ((d.desplazamiento % 26) + 26) % 26 || 3 : 3 + entero(20);
    // Normal: se sabe una palabra larga del medio y hay que escribir la última
    const conocidaNormal = palabras.slice(0, -1).filter(p => p.length >= 4).sort((a, b) => b.length - a.length)[0] ?? palabras[0];
    reto = {
      original, cifrado: desplazar(original, desp), desp, intento: 0,
      pista: d.pista_clave ?? `Sabéis que en el mensaje aparece la palabra «${conocidaNormal}».`,
      pregunta: d.pregunta ?? "Escribid la última palabra del mensaje, ya descifrada.",
      respuesta: normalizar(d.respuesta ?? palabras[palabras.length - 1]),
      lectura: ""
    };
  } else if (ronda === 1) {
    const original = mensajesSustitucion[entero(mensajesSustitucion.length)];
    const perm = mezclar(A.split(""));
    // sin letras que se cifren a sí mismas
    for (let i = 0; i < 26; i++) if (perm[i] === A[i]) { const j = (i + 1) % 26; [perm[i], perm[j]] = [perm[j], perm[i]]; }
    const cifrado = original.split("").map(ch => (idx(ch) < 0 ? ch : perm[idx(ch)])).join("");
    reto = { original, cifrado, mapa: {}, perm };
  } else {
    const m = mensajesVigenere[entero(mensajesVigenere.length)];
    const palabra = m.texto.split(" ")[0];
    reto = { original: m.texto, cifrado: vigenere(m.texto, m.clave), clave: m.clave, intento: Array(m.clave.length).fill("A"), palabra };
  }
  setPuzzleMsg("cipherMessage", "");
  render();
}

function descifrarActual() {
  if (ronda === 0) return reto.lectura;
  if (ronda === 1) return reto.cifrado.split("").map(ch => (idx(ch) < 0 ? ch : reto.mapa[ch] || "·")).join("");
  return vigenere(reto.cifrado, reto.intento.join(""), -1);
}

function frecuencias() {
  const cuenta = {};
  reto.cifrado.split("").forEach(ch => { if (idx(ch) >= 0) cuenta[ch] = (cuenta[ch] || 0) + 1; });
  return Object.entries(cuenta).sort((a, b) => b[1] - a[1]);
}

function render() {
  const c = document.getElementById("cipherContainer");
  document.getElementById("cipherRonda").innerHTML = [0, 1, 2].map(i => `<span class="cipher-paso${i === ronda ? " actual" : i < ronda ? " hecho" : ""}">${i + 1}. ${nombres[i]}</span>`).join("");
  document.getElementById("cipherSiguiente").style.display = resuelto && ronda < 2 && !historia ? "" : "none";
  document.getElementById("cipherPista").style.display = ronda === 1 && !resuelto ? "" : "none";
  let html = "";
  if (ronda === 0) {
    // Sin lectura en vivo: el dial solo dice qué letra real hay bajo cada letra del libro si el salto fuera ese.
    const libro = enHistoria("cipher");
    const tabla = `<div class="cipher-shift"><button class="puzzle-btn" data-cif-desp="-1" aria-label="Menos">−</button>
        <input id="cipherShift" type="range" min="0" max="25" value="${reto.intento}" aria-label="Salto del dial">
        <button class="puzzle-btn" data-cif-desp="1" aria-label="Más">+</button><span id="cipherShiftValue">${reto.intento}</span></div>
      <div class="cipher-rueda"><div>${A.split("").map(ch => `<b>${ch}</b>`).join("")}</div><div>${A.split("").map(ch => `<i>${desplazar(ch, -reto.intento)}</i>`).join("")}</div></div>
      <div class="cipher-leyenda">Arriba: letra escrita · Abajo: la letra real si el salto fuera ${reto.intento}. El dial no lee por vosotros: traducid letra a letra.</div>`;
    const respuesta = `<div class="cipher-respuesta"><label for="cipherRespuesta"><i class="fa-solid fa-feather"></i> ${reto.pregunta}</label>
        <input id="cipherRespuesta" type="text" autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="Vuestra respuesta" value="${reto.lectura}"></div>`;
    const pista = `<p class="cipher-pista-clave"><i class="fa-solid fa-key"></i> ${reto.pista}</p>`;
    if (libro) {
      html += `<div class="cipher-libro"><div class="cipher-pagina izquierda"><div class="cipher-label">Lo que dice el libro</div><div class="cipher-text">${reto.cifrado}</div></div>
        <div class="cipher-pagina derecha"><div class="cipher-label">Notas del equipo</div><textarea id="cipherNotas" class="cipher-notas" rows="5" spellcheck="false" placeholder="Apuntad aquí lo que vais traduciendo…"></textarea></div></div>
        <p class="cipher-ayuda">Cada letra se corrió el mismo número de puestos en el alfabeto. Buscad en el libro la palabra que sabéis que aparece, deducid el salto y repartíos las palabras para traducirlas.</p>
        ${pista}${tabla}${respuesta}`;
    } else {
      html += `<p class="cipher-ayuda">Cada letra del mensaje fue desplazada el mismo número de posiciones en el alfabeto. Deduce el salto con la palabra conocida, traduce a mano y escribe la respuesta.</p>
        <div class="cipher-display"><div class="cipher-label">Mensaje cifrado</div><div class="cipher-text">${reto.cifrado}</div></div>
        ${pista}${tabla}${respuesta}`;
    }
  } else if (ronda === 1) {
    html += `<p class="cipher-ayuda">Cada letra se cambió por otra distinta (alfabeto desordenado). Escribe bajo cada letra la que crees que es: se rellenan todas las repetidas. Pista: en español lo más frecuente es E, A, O, S, R, N, I, D, L.</p><div class="cipher-sust">`;
    html += reto.cifrado.split(" ").map(pal => `<div class="cipher-palabra">${pal.split("").map(ch =>
      `<label class="cipher-letra"><b>${ch}</b><input type="text" maxlength="1" data-cif="${ch}" value="${reto.mapa[ch] || ""}" autocomplete="off" autocapitalize="characters"></label>`).join("")}</div>`).join("");
    html += `</div><div class="cipher-frec"><span>Frecuencias:</span> ${frecuencias().map(([l, n]) => `<em>${l}<sub>${n}</sub></em>`).join(" ")}</div>`;
  } else {
    html += `<p class="cipher-ayuda">Aquí cada letra se desplaza según una letra de la clave, que se repite (clave de ${reto.clave.length} letras). La primera palabra del mensaje es <strong>${reto.palabra}</strong>: úsala para deducir la clave. Pulsa ▲▼ en cada letra de la clave.</p>
      <div class="cipher-display"><div class="cipher-label">Mensaje cifrado</div><div class="cipher-text">${reto.cifrado}</div></div>
      <div class="cipher-clave">${reto.intento.map((l, i) => `<div><button class="puzzle-btn" data-cif-k="${i}" data-d="1">▲</button><span class="cipher-k">${l}</span><button class="puzzle-btn" data-cif-k="${i}" data-d="-1">▼</button></div>`).join("")}</div>
      <div class="cipher-display"><div class="cipher-label">Descifrado con la clave «${reto.intento.join("")}»</div><div id="decryptedText" class="cipher-text">${descifrarActual()}</div></div>`;
  }
  c.innerHTML = html;
}

function actualizarCesar() {
  document.getElementById("cipherShiftValue").textContent = reto.intento;
  document.getElementById("cipherShift").value = reto.intento;
  document.querySelector(".cipher-rueda div:last-child").innerHTML = A.split("").map(ch => `<i>${desplazar(ch, -reto.intento)}</i>`).join("");
  document.querySelector(".cipher-leyenda").textContent = `Arriba: letra escrita · Abajo: la letra real si el salto fuera ${reto.intento}. El dial no lee por vosotros: traducid letra a letra.`;
}

function comprobar(auto = false) {
  if (resuelto || bloqueado("cipher")) return;
  // César: la respuesta escrita debe contener la palabra (o palabras) pedida(s), como palabras completas
  const ok = ronda === 0 ? (" " + normalizar(reto.lectura) + " ").includes(" " + reto.respuesta + " ") : descifrarActual() === reto.original;
  if (enHistoria("cipher")) {
    // Modo historia: solo el botón comprueba (gasta un intento) y no se detalla el error
    if (auto) return false;
    if (ronda === 0 && !normalizar(reto.lectura)) { setPuzzleMsg("cipherMessage", "Escribid primero vuestra respuesta."); return false; }
    if (ok) resuelto = true;
    comprobarHistoria("cipher", ok);
    return ok;
  }
  if (ok) {
    resuelto = true;
    setPuzzleMsg("cipherMessage", historia ? "¡Mensaje descifrado!" : ronda < 2 ? "¡Ronda superada! Pulsa «Siguiente ronda»." : "¡Los tres mensajes descifrados! Puzzle resuelto.", true);
    render();
    return true;
  }
  if (auto) return false;
  if (ronda === 1) {
    const hechas = Object.keys(reto.mapa).length;
    setPuzzleMsg("cipherMessage", hechas ? "Aún hay letras mal asignadas o sin poner." : "Empieza por las letras más repetidas.");
  } else setPuzzleMsg("cipherMessage", ronda === 0 ? (normalizar(reto.lectura) ? "No es la respuesta: revisad el salto." : "Escribe primero tu respuesta.") : "La clave aún no es correcta.");
  return false;
}

export function initCipher() {
  const c = document.getElementById("cipherContainer");
  c.addEventListener("input", e => {
    if (bloqueado("cipher")) { if (e.target.id === "cipherShift") e.target.value = reto.intento; return; }
    if (e.target.id === "cipherShift") {
      reto.intento = Number(e.target.value);
      actualizarCesar();
    } else if (e.target.id === "cipherRespuesta") {
      reto.lectura = e.target.value;
    } else if (e.target.dataset.cif) {
      const letra = e.target.dataset.cif;
      const v = e.target.value.toUpperCase().replace(/[^A-Z]/g, "").slice(-1);
      if (v) reto.mapa[letra] = v; else delete reto.mapa[letra];
      c.querySelectorAll(`[data-cif="${letra}"]`).forEach(i => { i.value = v; });
      const usadas = {};
      Object.values(reto.mapa).forEach(x => { usadas[x] = (usadas[x] || 0) + 1; });
      c.querySelectorAll("[data-cif]").forEach(i => i.classList.toggle("repetida", !!usadas[i.value] && usadas[i.value] > 1));
      if (Object.keys(reto.mapa).length >= new Set(reto.cifrado.replace(/ /g, "")).size) comprobar(true);
    }
  });
  c.addEventListener("keydown", e => { if (e.target.id === "cipherRespuesta" && e.key === "Enter") e.preventDefault(); });
  c.addEventListener("click", e => {
    if (bloqueado("cipher")) return;
    const d = e.target.closest("[data-cif-desp]");
    if (d) { reto.intento = (reto.intento + Number(d.dataset.cifDesp) + 26) % 26; actualizarCesar(); return; }
    const k = e.target.closest("[data-cif-k]");
    if (k) {
      const i = Number(k.dataset.cifK);
      reto.intento[i] = A[(idx(reto.intento[i]) + Number(k.dataset.d) + 26) % 26];
      render();
      comprobar(true);
    }
  });
  document.getElementById("cipherCheck").addEventListener("click", () => comprobar());
  document.getElementById("cipherPista").addEventListener("click", () => {
    if (enHistoria("cipher")) return;
    const pendientes = [...new Set(reto.cifrado.replace(/ /g, "").split(""))].filter(ch => reto.mapa[ch] !== A[reto.perm.indexOf(ch)]);
    if (!pendientes.length) return;
    const ch = pendientes[entero(pendientes.length)];
    reto.mapa[ch] = A[reto.perm.indexOf(ch)];
    render();
    setPuzzleMsg("cipherMessage", `Pista: ${ch} es ${reto.mapa[ch]}.`);
    if (Object.keys(reto.mapa).length >= new Set(reto.cifrado.replace(/ /g, "")).size) comprobar(true);
  });
  document.getElementById("cipherSiguiente").addEventListener("click", () => { if (enHistoria("cipher")) return; ronda++; nuevoReto(); });
  document.getElementById("cipherReset").addEventListener("click", () => { if (enHistoria("cipher")) return; ronda = 0; nuevoReto(); });
  // Al entrar o salir del modo historia (clase en la vista) se vuelve a dibujar: libro o rondas normales
  const vista = document.getElementById("view-cipher");
  let enLibro = false;
  new MutationObserver(() => {
    const ahora = vista.classList.contains("modo-historia");
    if (ahora !== enLibro) { enLibro = ahora; ronda = 0; setPuzzleMsg("cipherMessage", ""); nuevoReto(); }
  }).observe(vista, { attributes: true, attributeFilter: ["class"] });
  nuevoReto();
}
