// Narración de una carta: el medallón ▶ del frente lleva `data-narracion` con la ruta del audio (viene del JSON de la clase, ver datos.js).
// Un solo audio a la vez; volver a tocar el botón lo pausa. Se atiende por delegación de eventos.
let audio = null;
let boton = null;

const marcar = (b, sonando) => {
  b.classList.toggle('sonando', sonando);
  if (!sonando) b.style.removeProperty('--p');
  b.setAttribute('aria-label', sonando ? 'Pausar la narración' : 'Escuchar la narración');
};

function parar() {
  if (audio) audio.pause();
  if (boton) marcar(boton, false);
  audio = boton = null;
}

// Devuelve true si el clic era de un botón de narración (y ya está atendido)
export function atenderNarracion(e) {
  const b = e.target.closest('[data-narracion]');
  if (!b) return false;
  e.stopPropagation(); // que no voltee la carta ni abra el visor
  e.preventDefault();
  if (b === boton) { parar(); return true; }
  parar();
  audio = new Audio(b.dataset.narracion);
  boton = b;
  marcar(b, true);
  const este = audio;
  este.addEventListener('timeupdate', () => { if (audio === este && este.duration) b.style.setProperty('--p', (este.currentTime / este.duration) * 100); });
  este.addEventListener('ended', () => { if (audio === este) parar(); });
  este.addEventListener('error', () => { if (audio === este) parar(); });
  este.play().catch(() => { if (audio === este) parar(); });
  return true;
}
