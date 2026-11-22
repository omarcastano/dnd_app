// Diseño vigente de las cartas (grimorio: pergamino, verde y oro). Funciones puras: datos normalizados (datos.js) → HTML.
// Cada carta produce una o más caras (el personaje: frente y dorso).
import { esc } from './util.js';

const ROMANOS = ['', 'I', 'II', 'III', 'IV', 'V', 'VI'];
const ESQUINAS = '<i class="esquina a"></i><i class="esquina b"></i><i class="esquina c"></i><i class="esquina d"></i>';
const DIVISOR = '<div class="divisor"><i>◆</i></div>';
// Divisor del frente con un medallón ▶/❚❚ en el centro cuando la carta tiene narración (iconos SVG: quedan centrados en cualquier estado)
export const MEDALLON = (ruta) => `<div class="divisor divisor-narracion"><button type="button" class="btn-narracion" data-narracion="${esc(ruta)}" aria-label="Escuchar la narración"><span class="nar-icono"><svg viewBox="0 0 16 16" aria-hidden="true"><path d="M2 1l13 7-13 7z"/></svg><span class="nar-ondas" aria-hidden="true"><i></i><i></i><i></i><i></i></span></span><span class="nar-play">Escuchar</span><span class="nar-pausa">Pausar</span></button></div>`;
const ICONOS_ROL = {
  dano: ['Daño', '<g transform="rotate(45 12 12)"><path d="M12 0.5l1.7 3v11.5h-3.4V3.5z"/><rect x="6.5" y="15" width="11" height="2.2" rx="1.1"/><rect x="10.8" y="17" width="2.4" height="3.6"/><circle cx="12" cy="21.8" r="1.5"/></g>'],
  tanque: ['Tanque', '<path d="M12 2l8 3v6c0 5-3.5 9-8 11-4.5-2-8-6-8-11V5z"/>'],
  apoyo: ['Apoyo', '<path d="M12 1.5l2.6 7.9 7.9 2.6-7.9 2.6L12 22.5l-2.6-7.9L1.5 12l7.9-2.6z"/>'],
  sanacion: ['Sanación', '<path d="M9 2h6v7h7v6h-7v7H9v-7H2V9h7z"/>'],
};
const rol = (r, cls = 'rol') => (ICONOS_ROL[r] ? `<svg class="${cls} rol-${r}" viewBox="0 0 24 24" role="img" aria-label="${ICONOS_ROL[r][0]}"><title>${ICONOS_ROL[r][0]}</title>${ICONOS_ROL[r][1]}</svg>` : '');
const lista = (xs) => `<ul>${xs.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>`;
const img = (src, alt = '') => (src ? `<img src="${src}" alt="${esc(alt)}">` : '');

function fila(f, et) {
  const hex = `<div class="hex"><span><small>${esc(et.dado)}</small>${esc(f.rango_d20)}</span></div>`;
  if (!f.nombre) return `<div class="fila-p nulo-p sin-valor">${hex}<div class="quien">${esc(f.resultado)}</div></div>`;
  return `<div class="fila-p">${hex}
    <div class="quien"><span class="ico-p">${img(f.icono)}</span><div><b>${esc(f.nombre)}</b><em>${esc(f.subtitulo ?? '')}</em></div></div>
    <div class="valor-p">${f.valor}</div></div>`;
}

const linaje = (c) => `${esc(c.raza)}<b>◆</b>${esc(c.clase)}`;
const bloqueTabla = (c, et) => `<div class="bloque"><h5>${esc(et.tabla)}</h5>${c.tabla.map((f) => fila(f, et)).join('')}</div>`;

const DISENOS = {
  personaje: (c, et) => [
    `${ESQUINAS}<div class="retrato-p">${img(c.imagen, c.nombre)}</div>

     <div class="pie-p"><div class="nombre-carta">${esc(c.nombre)}</div>${c.narracion ? MEDALLON(c.narracion) : DIVISOR}<div class="linaje">${linaje(c)}</div></div>`,
    `${ESQUINAS}<div class="placa"><div class="nombre-carta">${esc(c.nombre)}</div></div>
     <div class="pergamino">
       ${c.descripcion ? `<section class="presentacion"><p class="descripcion-dorso">${esc(c.descripcion)}</p></section>` : ''}
       <section><h4>${esc(et.armas)}</h4>${lista(c.armas)}</section>
       <section><h4>${esc(et.habilidades_clase)}</h4>${lista(c.reglas)}</section>
       ${c.reglas_raza ? `<section><h4>${esc(et.habilidades_raza)}</h4>${lista(c.reglas_raza)}</section>` : ''}
     </div>
     <div class="linaje-pie">${linaje(c)}</div>`,
  ],
  tabla: (c, et) => [`${ESQUINAS}
    <div class="placa"><h3>${esc(c.nombre)}</h3>${c.nivel ? `<div class="nivel-p">${esc(et.nivel)} ${ROMANOS[c.nivel] ?? c.nivel}</div>` : ''}</div>
    <div class="cuerpo-p">
      ${c.ataques ? `<div class="bloque"><h5>${esc(et.ataques)}</h5>${c.ataques.map((f) => fila(f, et)).join('')}</div>` : ''}
      <div class="bloque especial"><h5>${esc(et.tabla)}</h5><p class="desc-p">${esc(c.descripcion ?? '')}</p>${(c.tabla ?? []).map((f) => fila(f, et)).join('')}</div>
    </div>`],
  ilustrada: (c, et) => [`${ESQUINAS}
    <div class="placa"><h3>${esc(c.nombre)}</h3></div>
    <div class="banner-p">${img(c.imagen, c.nombre)}</div>
    <div class="cuerpo-p">
      <div class="bloque desc">${c.nombre_habilidad ? `<div class="nombre-habilidad">${esc(c.nombre_habilidad)}</div>` : ''}<p class="desc-p">${esc(c.descripcion ?? '')}</p></div>
      ${c.tabla ? bloqueTabla(c, et) : ''}
    </div>`],
};

// Caras (HTML de cada <article>) de una carta
// Roles de una carta: los de la clase (personaje) o los de sus habilidades (tabla/ilustrada)
const rolesDe = (c) => c.roles ?? ['dano', 'tanque', 'sanacion', 'apoyo'].filter((r) => [...(c.ataques ?? []), ...(c.tabla ?? [])].some((f) => f.rol === r));
// Con una lista de cartas (portada de una opción) junta los roles de todas
export const bloqueRoles = (c) => { const rs = Array.isArray(c) ? ['dano', 'tanque', 'sanacion', 'apoyo'].filter((r) => c.some((x) => rolesDe(x).includes(r))) : rolesDe(c); return rs.length ? `<div class="roles-carta">${rs.map((r) => rol(r, 'rol rol-grande')).join('')}</div>` : ''; };

export const carasDeCarta = (c, et) => DISENOS[c.tipo](c, et).map((html, i) => `<article class="carta-p ${c.tipo === 'personaje' ? ['personaje', 'dorso'][i] : c.tipo}">${html}${bloqueRoles(c)}</article>`);

export const renderizarCartas = (cartas, et) => cartas.flatMap((c) => carasDeCarta(c, et)).join('');

// Marca las imágenes que faltan (no bloquean el resto). Devuelve cuántas faltan.
export async function esperarImagenes(contenedor) {
  await document.fonts.ready;
  const resultados = await Promise.all([...contenedor.querySelectorAll('img')].map((i) => i.decode().then(() => true, () => {
    i.parentElement.classList.add('sin-imagen');
    return false;
  })));
  return resultados.filter((ok) => !ok).length;
}
