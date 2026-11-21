// Asistente de selección: un paso por pantalla; al final, las cartas de las opciones elegidas.
// La elección se recuerda en este dispositivo (localStorage); si no está disponible, simplemente no se guarda.
import { esc } from './util.js';
import { carasDeCarta } from './cartas.js';
import { activarContador, mostrarCartas } from './carrusel.js';
import { reproducirEfecto, temaDe, ponerAmbiente } from './efectos.js';

// Portada de una opción con niveles (Forma Salvaje, Sanación): retrato + nombre + descripción. Es la primera cara del volteo.
const portada = (o) => `<article class="carta-p portada"><i class="esquina a"></i><i class="esquina b"></i><i class="esquina c"></i><i class="esquina d"></i>
  <div class="placa"><h3>${esc(o.etiqueta)}</h3></div>
  <div class="icono-portada"><img src="${o.portada}" alt=""></div>
  <div class="divisor"><i>◆</i></div>
  <p class="detalle-portada">${esc(o.detalle ?? '')}</p>
</article>`;

// Caras de una opción: las cartas reales. Personaje: frente y dorso. Habilidades de dos niveles: portada + nivel 1 + nivel 2.
function carasDeOpcion(o, porId, etiquetas) {
  const caras = o.cartas.map((id) => porId.get(id)).filter(Boolean).flatMap((c) => carasDeCarta(c, etiquetas));
  if (o.portada && caras.length > 1) caras.unshift(portada(o));
  return caras;
}

const tarjetaOpcion = (o, k, caras) => {
  const gira = caras.length > 1;
  return `
    <div class="opcion-caja">
      <div class="carta-sel volteo${gira ? ' gira' : ''}"${gira ? ' role="button" tabindex="0" aria-label="Voltear la carta"' : ''}>
        <div class="volteo-in">
          <div class="cara">${caras[0]}</div>
          ${gira ? `<div class="cara dorso">${caras[1]}</div>` : ''}
        </div>
      </div>
      ${gira ? `<p class="pista-voltear">↻ Toca la carta para voltearla · <b>1</b>/${caras.length}</p>` : ''}
      <button type="button" class="btn-pri" data-elegir="${k}">Elegir ${esc(o.etiqueta)}</button>
    </div>`;
};

// Cada toque gira 180°; la cara oculta se rellena con la siguiente antes de girar (sirve para 2, 3 o más caras)
function voltear(v, caras) {
  const giro = Number(v.dataset.giro ?? 0);
  const idx = (Number(v.dataset.idx ?? 0) + 1) % caras.length;
  v.querySelector(giro % 2 === 0 ? '.dorso' : '.cara:not(.dorso)').innerHTML = caras[idx];
  v.dataset.giro = giro + 1;
  v.dataset.idx = idx;
  v.style.setProperty('--giro', giro + 1);
  const n = v.closest('.opcion-caja').querySelector('.pista-voltear b');
  if (n) n.textContent = idx + 1;
}

export function iniciarSeleccion(contenedor, datos) {
  const pasos = datos.seleccion;
  const porId = new Map(datos.cartas.map((c) => [c.id, c]));
  const indices = []; // opción elegida en cada paso
  const clave = `taberna:${datos.id}:seleccion`;
  const guardar = () => { try { localStorage.setItem(clave, JSON.stringify(indices)); } catch {} };
  const olvidar = () => { try { localStorage.removeItem(clave); } catch {} };
  const recordada = () => {
    try {
      const g = JSON.parse(localStorage.getItem(clave));
      if (Array.isArray(g) && g.length === pasos.length && g.every((k, i) => pasos[i].opciones[k])) return g;
    } catch {}
    return null;
  };
  const elegidas = () => indices.map((k, i) => pasos[i].opciones[k]);

  function paso(i) {
    ponerAmbiente('seleccion');
    const p = pasos[i];
    const caras = p.opciones.map((o) => carasDeOpcion(o, porId, datos.etiquetas));
    contenedor.innerHTML = `
      <div class="paso">
        <p class="progreso">Paso ${i + 1} de ${pasos.length}</p>
        <h3>${esc(p.titulo)}</h3>
        <p class="ayuda">Desliza para ver las opciones y elige</p>
        <div class="contador"></div>
        <div class="opciones">${p.opciones.map((o, k) => tarjetaOpcion(o, k, caras[k])).join('')}</div>
        ${i ? '<button type="button" class="btn-sec" data-atras>← Atrás</button>' : ''}
      </div>`;
    const opciones = contenedor.querySelector('.opciones');
    const claveOpcion = (el) => Number(el.closest('.opcion-caja').querySelector('[data-elegir]').dataset.elegir);

    const elegir = async (k) => {
      if (p.opciones[k].efecto) await reproducirEfecto(p.opciones[k].efecto);
      indices.length = i;
      indices[i] = k;
      if (i + 1 < pasos.length) return paso(i + 1);
      guardar();
      resultado();
    };
    opciones.addEventListener('click', (e) => {
      const elige = e.target.closest('[data-elegir]');
      if (elige) return elegir(Number(elige.dataset.elegir));
      const v = e.target.closest('.volteo.gira');
      if (v) voltear(v, caras[claveOpcion(v)]);
    });
    opciones.addEventListener('keydown', (e) => {
      const v = e.target.closest('.volteo.gira');
      if (v && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); voltear(v, caras[claveOpcion(v)]); }
    });
    activarContador(contenedor.querySelector('.contador'), opciones);
    contenedor.querySelector('[data-atras]')?.addEventListener('click', () => paso(i - 1));
  }

  async function resultado(desplazar = true) {
    const sel = elegidas();
    ponerAmbiente(temaDe(sel.map((o) => o.efecto)));
    const ids = new Set(sel.flatMap((o) => o.cartas));
    contenedor.innerHTML = `
      <div class="resumen">
        <p class="progreso">Tu ${esc(datos.titulo)}</p>
        <div class="chips">${sel.map((o) => `<span>${esc(o.etiqueta)}</span>`).join('')}</div>
        <button type="button" class="btn-sec" data-reiniciar>Elegir de nuevo</button>
      </div>
      <div class="cartas-elegidas"></div>`;
    contenedor.querySelector('[data-reiniciar]').addEventListener('click', () => { indices.length = 0; olvidar(); paso(0); });
    await mostrarCartas(contenedor.querySelector('.cartas-elegidas'), datos.cartas.filter((c) => ids.has(c.id)), datos.etiquetas);
    if (desplazar) contenedor.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  const previa = recordada();
  if (previa) { indices.push(...previa); resultado(false); } else paso(0);
}
