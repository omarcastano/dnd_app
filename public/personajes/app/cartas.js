// Diseño vigente de las cartas (grimorio: pergamino, verde y oro). Funciones puras: datos normalizados (datos.js) → HTML.
// Cada carta produce una o más caras (el personaje: frente y dorso).
import { esc } from './util.js';

const ROMANOS = ['', 'I', 'II', 'III', 'IV', 'V', 'VI'];
const ESQUINAS = '<i class="esquina a"></i><i class="esquina b"></i><i class="esquina c"></i><i class="esquina d"></i>';
const DIVISOR = '<div class="divisor"><i>◆</i></div>';
// Divisor del frente con un medallón ▶/❚❚ en el centro cuando la carta tiene narración (iconos SVG: quedan centrados en cualquier estado)
const MEDALLON = (ruta) => `<div class="divisor divisor-narracion"><button type="button" class="btn-narracion" data-narracion="${esc(ruta)}" aria-label="Escuchar la narración" title="Escuchar la narración">
  <svg class="ico-play" viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6v12l10-6z"/></svg><svg class="ico-pausa" viewBox="0 0 24 24" aria-hidden="true"><path d="M7 5.5h3.6v13H7zM13.4 5.5H17v13h-3.6z"/></svg></button></div>`;
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
export const carasDeCarta = (c, et) => DISENOS[c.tipo](c, et).map((html, i) => `<article class="carta-p ${c.tipo === 'personaje' ? ['personaje', 'dorso'][i] : c.tipo}">${html}</article>`);

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
