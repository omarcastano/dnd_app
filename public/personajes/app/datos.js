// Carga y normaliza el JSON de una clase: aplica las convenciones para que el renderizado no tenga que conocerlas.
//   · imagen de carta personaje/ilustrada  → `imagen` o `imagenes/<id>.webp`
//   · icono de una fila con nombre         → `icono` o `imagenes/habilidades/<slug(nombre)>.webp`
//   · retrato de una opción con `portada`  → `imagenes/<slug(etiqueta)>.webp`
//   · narración (audio)                    → `narracion` (ruta relativa a la clase, p. ej. `narraciones/<id>.mp3`)
//   · personaje: `reglas` y `armas` salen del bloque `clase` salvo que la carta las defina
// Todas las rutas quedan resueltas desde la carpeta de la clase (`base`).
import { slug } from './util.js';

export const ETIQUETAS = {
  armas: 'Armas', habilidades_clase: 'Habilidades de clase', habilidades_raza: 'Habilidades de raza',
  ataques: 'Habilidades básicas', tabla: 'Habilidades especiales', nivel: 'Nivel', dado: 'D20',
};
export const TIPOS = ['personaje', 'tabla', 'ilustrada'];

// Rutas absolutas desde este módulo: valen igual desde cualquier página que lo cargue
export const RAIZ = new URL('../', import.meta.url);
export const rutaClase = (id) => new URL(`clases/${id}/`, RAIZ).href;

// Rol de una habilidad: `rol` explícito ('dano' | 'tanque' | 'sanacion' | 'apoyo') o deducido del subtítulo
export function rolDe(f) {
  if (f.rol) return f.rol;
  const t = (f.subtitulo ?? '').toLowerCase();
  if (/sanaci|cura/.test(t)) return 'sanacion';
  if (/protecci|escudo|provoca/.test(t)) return 'tanque';
  if (/ataque/.test(t)) return 'dano';
  return null;
}

function normalizarFila(f, base) {
  if (!f.nombre) return f;
  return { ...f, rol: rolDe(f), icono: base + (f.icono ?? `imagenes/habilidades/${slug(f.nombre)}.webp`) };
}

export function normalizar(id, crudo) {
  const base = rutaClase(id);
  const clase = crudo.clase ?? {};
  const roles = ['dano', 'tanque', 'sanacion', 'apoyo'].filter((r) => crudo.cartas.some((c) => [...(c.ataques ?? []), ...(c.tabla ?? [])].some((f) => f.nombre && rolDe(f) === r)));
  const cartas = crudo.cartas.map((c) => {
    const n = { ...c };
    if (c.tipo === 'personaje') {
      n.clase = clase.nombre ?? id;
      n.roles = clase.roles ?? roles;
      n.reglas = c.reglas ?? clase.reglas ?? [];
      n.armas = c.armas ?? clase.armas ?? [];
    }
    if (c.narracion) n.narracion = base + c.narracion;
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
