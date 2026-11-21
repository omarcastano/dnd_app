// Dibuja cartas a partir de un JSON de clase. Lo usan el exportador (index.html) y el catálogo (../index.html).
import { icono, dado } from './iconos.js';

const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const lista = (xs) => `<ul>${xs.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>`;
const titulo = (t) => `<div class="caja titulo">${esc(t)}</div>`;
const rango = (r) => `<span class="rango">${dado()}<span class="txt">${esc(r)}</span></span>`;

// Fila "rango d20 | nombre | valor | icono" (ataque o resultado de tabla)
function fila(f) {
  if (!f.nombre) {
    return `<div class="fila">${rango(f.rango_d20)}<span class="nulo">${esc(f.resultado)}</span>${f.icono ? `<span class="ico">${icono(f.icono)}</span>` : ''}</div>`;
  }
  return `<div class="fila">${rango(f.rango_d20)}
    <span class="nombre">${esc(f.nombre)}<small>${esc(f.subtitulo ?? '')}</small></span>
    <span class="valor">${f.valor}</span><span class="ico">${icono(f.icono)}</span></div>`;
}
const filas = (xs) => xs.map(fila).join('');

// `raiz` es la ruta relativa desde la página hasta la carpeta personajes/ (p. ej. '../' o './').
export function renderizarCartas(clase, datos, raiz) {
  // Ruta de la imagen: el campo `imagen` (relativo a la clase) o imagenes/<id>.webp
  const img = (c) => `${raiz}${clase}/${c.imagen ?? `imagenes/${c.id}.webp`}`;
  const imagen = (c, clases) => `<div class="caja ${clases}"><img src="${img(c)}" alt="${esc(c.nombre)}"></div>`;

  const personajeFrente = (c) => `${titulo(c.nombre)}${imagen(c, 'retrato')}
    <div class="caja pie">Raza: ${esc(c.raza)}<br>Clase: ${esc(c.clase)}</div>`;

  const personajeDorso = (c) => `${titulo(c.nombre)}
    <div class="caja texto">
      <h4>Armas:</h4>${lista(c.armas ?? [])}
      <h4>Habilidades de clase:</h4>${lista(c.reglas ?? [])}
      ${c.reglas_raza ? `<h4>Habilidades de raza:</h4>${lista(c.reglas_raza)}` : ''}
    </div>
    <div class="caja pie">Raza: ${esc(c.raza)}<br>Clase: ${esc(c.clase)}</div>`;

  const habilidadTabla = (c) => `<div class="caja panel ataques">${c.ataques ? filas(c.ataques) : ''}</div>
    <div class="caja panel central">
      <h3>${esc(c.nombre)}</h3><p>${esc(c.descripcion ?? '')}</p>
      ${c.tabla ? filas(c.tabla) : ''}
      ${c.nivel ? `<div class="nivel">NIVEL ${c.nivel}</div>` : ''}
    </div>`;

  const habilidadIlustrada = (c) => `${titulo(c.nombre)}${imagen(c, 'banner')}
    <div class="caja panel central">
      ${c.nombre_habilidad ? `<h3>${esc(c.nombre_habilidad)}</h3>` : ''}
      <p class="largo">${esc(c.descripcion ?? '')}</p>
    </div>
    ${c.tabla ? `<div class="caja panel">${filas(c.tabla)}</div>` : ''}`;

  // Cada carta lleva una clase de variante ([clase, html]) para sus medidas en el CSS
  const cartasDe = (c) => {
    if (c.tipo === 'personaje') return [['personaje', personajeFrente(c)], ['personaje', personajeDorso(c)]];
    if (c.tiene_ilustracion) return [[c.nombre_habilidad ? 'ilustrada larga' : 'ilustrada', habilidadIlustrada(c)]];
    return [['tabla', habilidadTabla(c)]];
  };

  return datos.cartas.flatMap(cartasDe).map(([variante, html]) => `<article class="carta ${variante}">${html}</article>`).join('');
}

// Las imágenes que faltan se marcan (no bloquean el resto). Devuelve cuántas faltan.
// Reduce la fuente de rangos, nombres y subtítulos hasta que quepan en su hueco (sin desbordar ni solaparse)
export function ajustarTextos(contenedor) {
  for (const el of contenedor.querySelectorAll('.rango .txt, .nombre small, .nulo, .valor')) {
    let px = parseFloat(getComputedStyle(el).fontSize);
    while (px > 7 && (el.scrollWidth > el.clientWidth + 0.5)) el.style.fontSize = `${px -= 0.25}px`;
  }
}

export async function esperarImagenes(contenedor) {
  await document.fonts.ready;
  const imgs = [...contenedor.querySelectorAll('img')];
  const resultados = await Promise.all(imgs.map((i) => i.decode().then(() => true, () => {
    i.closest('.caja').classList.add('sin-imagen');
    return false;
  })));
  ajustarTextos(contenedor);
  return resultados.filter((ok) => !ok).length;
}
