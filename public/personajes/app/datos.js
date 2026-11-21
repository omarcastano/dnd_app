// Carga y normaliza el JSON de una clase: aplica las convenciones para que el renderizado no tenga que conocerlas.
//   · imagen de carta personaje/ilustrada  → `imagen` o `imagenes/<id>.webp`
//   · icono de una fila con nombre         → `icono` o `imagenes/habilidades/<slug(nombre)>.webp`
//   · retrato de una opción con `portada`  → `imagenes/<slug(etiqueta)>.webp`
//   · personaje: `reglas` y `armas` salen del bloque `clase` salvo que la carta las defina
// Todas las rutas quedan resueltas desde la carpeta de la clase (`base`).
import { slug } from './util.js';

export const ETIQUETAS = {
  armas: 'Armas', habilidades_clase: 'Habilidades de clase', habilidades_raza: 'Habilidades de raza',
  ataques: 'Ataque básico', tabla: 'Ataque especial', nivel: 'Nivel', dado: 'D20',
};
export const TIPOS = ['personaje', 'tabla', 'ilustrada'];

export const rutaClase = (id) => `clases/${id}/`;

function normalizarFila(f, base) {
  if (!f.nombre) return f;
  return { ...f, icono: base + (f.icono ?? `imagenes/habilidades/${slug(f.nombre)}.webp`) };
}

export function normalizar(id, crudo) {
  const base = rutaClase(id);
  const clase = crudo.clase ?? {};
  const cartas = crudo.cartas.map((c) => {
    const n = { ...c };
    if (c.tipo === 'personaje') {
      n.clase = clase.nombre ?? id;
      n.reglas = c.reglas ?? clase.reglas ?? [];
      n.armas = c.armas ?? clase.armas ?? [];
    }
    if (c.tipo !== 'tabla') n.imagen = base + (c.imagen ?? `imagenes/${c.id}.webp`);
    for (const k of ['ataques', 'tabla']) if (c[k]) n[k] = c[k].map((f) => normalizarFila(f, base));
    return n;
  });
  const seleccion = (crudo.seleccion ?? []).map((p) => ({
    ...p,
    opciones: p.opciones.map((o) => ({ ...o, portada: o.portada ? `${base}imagenes/${slug(o.etiqueta)}.webp` : null })),
  }));
  return {
    id,
    titulo: clase.nombre ?? id,
    etiquetas: { ...ETIQUETAS, ...crudo.etiquetas },
    cartas,
    seleccion,
  };
}

export async function cargarClase(id) {
  const r = await fetch(`${rutaClase(id)}${id}.json`, { cache: 'no-cache' });
  if (!r.ok) throw new Error(`${id}.json: ${r.status}`);
  return normalizar(id, await r.json());
}
