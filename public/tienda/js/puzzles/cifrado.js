import { entero, mezclar, setPuzzleMsg } from "../nucleo/utilidades.js";
import { enHistoria, comprobarHistoria, bloqueado } from "./historia.js";

// Tres rondas: César (desplazamiento oculto), sustitución (alfabeto desordenado) y Vigenère (clave con varias letras).
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
const desplazar = (texto, n) => texto.split("").map(ch => (idx(ch) < 0 ? ch : A[(idx(ch) + n + 26) % 26])).join("");

// Libro de campañas: un mensaje de la historia en la ronda César (null vuelve a las tres rondas normales)
export function cifradoDeHistoria(mensaje) {
  historia = mensaje ? mensaje.toUpperCase().normalize("NFD").replace(/[^A-Z ]/g, "").replace(/\s+/g, " ").trim() : null;
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
    const original = historia ?? mensajesCesar[entero(mensajesCesar.length)];
    const desp = 3 + entero(20);
    reto = { original, cifrado: desplazar(original, desp), desp, intento: 1 };
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
  if (ronda === 0) return desplazar(reto.cifrado, -reto.intento);
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
  if (ronda === 0 && enHistoria("cipher")) {
    // Modo historia: un libro antiguo abierto; a la izquierda el texto cifrado, a la derecha la lectura con el dial
    html += `<div class="cipher-libro"><div class="cipher-pagina izquierda"><div class="cipher-label">Lo que dice el libro</div><div class="cipher-text">${reto.cifrado}</div></div>
      <div class="cipher-pagina derecha"><div class="cipher-label">Lo que leéis</div><div id="decryptedText" class="cipher-text">${descifrarActual()}</div></div></div>
      <p class="cipher-ayuda">Cada letra fue desplazada el mismo número de posiciones en el alfabeto. Girad el dial y, cuando creáis que se lee, pulsad «Comprobar».</p>
      <div class="cipher-shift"><button class="puzzle-btn" data-cif-desp="-1" aria-label="Menos">−</button>
        <input id="cipherShift" type="range" min="0" max="25" value="${reto.intento}">
        <button class="puzzle-btn" data-cif-desp="1" aria-label="Más">+</button><span id="cipherShiftValue">${reto.intento}</span></div>
      <div class="cipher-rueda"><div>${A.split("").map(ch => `<b>${ch}</b>`).join("")}</div><div>${A.split("").map(ch => `<i>${desplazar(ch, reto.intento)}</i>`).join("")}</div></div>`;
  } else if (ronda === 0) {
    html += `<p class="cipher-ayuda">Cada letra del mensaje fue desplazada el mismo número de posiciones en el alfabeto. Gira la rueda hasta que el texto tenga sentido.</p>
      <div class="cipher-display"><div class="cipher-label">Mensaje cifrado</div><div class="cipher-text">${reto.cifrado}</div></div>
      <div class="cipher-shift"><button class="puzzle-btn" data-cif-desp="-1" aria-label="Menos">−</button>
        <input id="cipherShift" type="range" min="0" max="25" value="${reto.intento}">
        <button class="puzzle-btn" data-cif-desp="1" aria-label="Más">+</button><span id="cipherShiftValue">${reto.intento}</span></div>
      <div class="cipher-rueda"><div>${A.split("").map(ch => `<b>${ch}</b>`).join("")}</div><div>${A.split("").map(ch => `<i>${desplazar(ch, reto.intento)}</i>`).join("")}</div></div>
      <div class="cipher-leyenda">Arriba: letra del mensaje cifrado · Abajo: la letra real con ese desplazamiento</div>
      <div class="cipher-display"><div class="cipher-label">Descifrado</div><div id="decryptedText" class="cipher-text">${descifrarActual()}</div></div>`;
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
  document.querySelector(".cipher-rueda div:last-child").innerHTML = A.split("").map(ch => `<i>${desplazar(ch, reto.intento)}</i>`).join("");
  document.getElementById("decryptedText").textContent = descifrarActual();
}

function comprobar(auto = false) {
  if (resuelto || bloqueado("cipher")) return;
  const ok = descifrarActual() === reto.original;
  if (enHistoria("cipher")) {
    // Modo historia: solo el botón comprueba (gasta un intento) y no se detalla el error
    if (auto) return false;
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
  } else setPuzzleMsg("cipherMessage", ronda === 0 ? "No es el desplazamiento correcto." : "La clave aún no es correcta.");
  return false;
}

export function initCipher() {
  const c = document.getElementById("cipherContainer");
  c.addEventListener("input", e => {
    if (bloqueado("cipher")) { if (e.target.id === "cipherShift") e.target.value = reto.intento; return; }
    if (e.target.id === "cipherShift") {
      reto.intento = Number(e.target.value);
      actualizarCesar();
      comprobar(true);
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
  c.addEventListener("click", e => {
    if (bloqueado("cipher")) return;
    const d = e.target.closest("[data-cif-desp]");
    if (d) { reto.intento = (reto.intento + Number(d.dataset.cifDesp) + 26) % 26; actualizarCesar(); comprobar(true); return; }
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
    if (ahora !== enLibro) { enLibro = ahora; resuelto = false; setPuzzleMsg("cipherMessage", ""); render(); }
  }).observe(vista, { attributes: true, attributeFilter: ["class"] });
  nuevoReto();
}
