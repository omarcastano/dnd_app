// Utilidades compartidas (sin dependencias del DOM).
const ENTIDADES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' };
export const esc = (t) => String(t ?? '').replace(/[&<>"]/g, (c) => ENTIDADES[c]);

// "Zarpazo Veloz" → "zarpazo-veloz" (kebab-case sin tildes, como los nombres de archivo)
export const slug = (t) => String(t).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
export const rnd = (a, b) => a + Math.random() * (b - a);
