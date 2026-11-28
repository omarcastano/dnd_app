// Modo historia de los enigmas: cuando un puzzle se abre desde el libro de campañas (pestaña Mapas).
// Reglas: el puzzle NO se da por resuelto solo; únicamente al pulsar «Comprobar», que gasta un intento.
// Los intentos son limitados y compartidos por todo el equipo; al agotarlos el enigma queda fallado y el tablero bloqueado.
// Cada puzzle consulta este módulo: enHistoria(id) para no autocomprobar, comprobarHistoria(id, ok) en su botón Comprobar,
// y bloqueado(id) para ignorar jugadas cuando el enigma ya terminó. Algunos (Hanoi, Lights Out) limitan además los movimientos.
let estado = null; // { id, intentos, max, terminado, resultado: 'exito' | 'fallo' | null, tema, datos }

export const enHistoria = (id) => estado?.id === id;
export const bloqueado = (id) => enHistoria(id) && estado.terminado;
export const intentosRestantes = (id) => (enHistoria(id) ? estado.intentos : Infinity);
// Datos propios del enigma en la campaña (el objeto `enigma` del paso: figura, palabra, desplazamiento…) o {}
export const datosHistoria = (id) => (enHistoria(id) ? estado.datos : {});

export function iniciarHistoria(id, { intentos = 3, tema = '', datos = {} } = {}) {
  estado = { id, intentos, max: intentos, terminado: false, resultado: null, tema, datos: datos ?? {} };
  const vista = document.getElementById('view-' + id);
  vista?.classList.add('modo-historia');
  if (tema) vista?.setAttribute('data-tema', tema);
  vista?.classList.remove('historia-exito', 'historia-fallo');
  void vista?.offsetWidth; // reinicia la animación de apertura
  vista?.classList.add('historia-abre');
  pintar();
}

export function salirHistoria() {
  if (!estado) return;
  const vista = document.getElementById('view-' + estado.id);
  vista?.classList.remove('modo-historia', 'historia-abre', 'historia-exito', 'historia-fallo');
  vista?.removeAttribute('data-tema');
  vista?.querySelector('.historia-intentos')?.remove();
  vista?.querySelector('.historia-veredicto')?.remove();
  estado = null;
}

// Llamar desde el botón Comprobar del puzzle. Devuelve true si el modo historia gestionó la comprobación.
// `ok` = el tablero actual es la solución. Gasta un intento; muestra el veredicto sin detallar el error.
export function comprobarHistoria(id, ok) {
  if (!enHistoria(id)) return false;
  if (estado.terminado) return true;
  estado.intentos = Math.max(0, estado.intentos - 1);
  if (ok) terminar('exito');
  else if (estado.intentos === 0) terminar('fallo');
  else veredicto(`No es la solución. Os quedan ${estado.intentos} ${estado.intentos === 1 ? 'intento' : 'intentos'}: hablad entre vosotros antes del siguiente.`, false);
  pintar();
  return true;
}

// Para puzzles con límite de movimientos (Hanoi, Lights Out): agota el enigma sin pasar por Comprobar.
export function fallarHistoria(id, motivo) {
  if (!enHistoria(id) || estado.terminado) return;
  estado.intentos = 0;
  terminar('fallo', motivo);
  pintar();
}

function terminar(resultado, motivo) {
  estado.terminado = true;
  estado.resultado = resultado;
  const vista = document.getElementById('view-' + estado.id);
  vista?.classList.add(resultado === 'exito' ? 'historia-exito' : 'historia-fallo');
  veredicto(resultado === 'exito'
    ? '¡Enigma resuelto! Volved al libro para leer lo que habéis ganado.'
    : motivo ?? 'Se acabaron los intentos. El enigma queda sin resolver: volved al libro y aplicad la consecuencia.', resultado === 'exito');
}

function veredicto(texto, ok) {
  const vista = document.getElementById('view-' + estado.id);
  if (!vista) return;
  let v = vista.querySelector('.historia-veredicto');
  if (!v) {
    v = document.createElement('div');
    v.className = 'historia-veredicto';
    v.setAttribute('role', 'status');
    vista.querySelector('.historia-intentos')?.after(v) ?? vista.prepend(v);
  }
  v.textContent = texto;
  v.classList.toggle('ok', ok);
  v.classList.remove('aparece'); void v.offsetWidth; v.classList.add('aparece');
}

function pintar() {
  const vista = document.getElementById('view-' + estado.id);
  if (!vista) return;
  let c = vista.querySelector('.historia-intentos');
  if (!c) {
    c = document.createElement('div');
    c.className = 'historia-intentos';
    const pergamino = vista.querySelector('.enigma-historia');
    pergamino ? pergamino.after(c) : vista.prepend(c);
  }
  const puntos = Array.from({ length: estado.max }, (_, i) => `<span class="intento${i < estado.intentos ? '' : ' gastado'}"></span>`).join('');
  c.innerHTML = `<b>Intentos del equipo</b> ${puntos} <small>Solo «Comprobar» dice si está bien, y cada comprobación gasta un intento.</small>`;
}
