// Iconos SVG en línea (vectoriales, heredan el color con currentColor).
// Dado: imagen exacta del diseño (iconos/d20.webp, compartida por todas las clases); el círculo es CSS (.d20)
const D20 = `<span class="d20"><img src="${new URL('./iconos/d20.webp', import.meta.url).href}" alt=""></span>`;

const PATA = `<svg viewBox="0 0 32 32" fill="#f08a6a"><ellipse cx="16" cy="21" rx="7" ry="6"/><ellipse cx="7" cy="14" rx="3" ry="4"/><ellipse cx="13" cy="9" rx="3" ry="4"/><ellipse cx="20" cy="9" rx="3" ry="4"/><ellipse cx="26" cy="14" rx="3" ry="4"/></svg>`;

const ICONOS = {
  // Bastón: rama bifurcada en Y con orbe cian (contorno oscuro + relleno marrón)
  conjuro: `<svg viewBox="0 0 32 32" fill="none" stroke-linecap="round" stroke-linejoin="round"><circle cx="18" cy="11" r="6" fill="#5ad8e0" stroke="#2a1608" stroke-width="1.6"/><g stroke="#2a1608" stroke-width="6"><path d="M6 27 16 16"/><path d="M16 16C10 15 8 9 12 5M16 16C22 18 26 14 25 8"/></g><g stroke="#7a4a2a" stroke-width="3.2"><path d="M6 27 16 16"/><path d="M16 16C10 15 8 9 12 5M16 16C22 18 26 14 25 8"/></g><path d="M16 8.5a3.5 3.5 0 0 1 3-2" stroke="#fff" stroke-width="1.4"/></svg>`,
  garras: PATA,
  bestia: PATA,
  arma: `<svg viewBox="0 0 32 32"><path d="M7 25 24 8" stroke="#555" stroke-width="3.5" stroke-linecap="round"/><path d="M22 6l4 0 0 4z" fill="#555"/><path d="M6 20l6 6" stroke="#6b3f1d" stroke-width="3" stroke-linecap="round"/></svg>`,
  daga: `<svg viewBox="0 0 32 32"><path d="M25 5 12 18l2 2L27 7z" fill="#777"/><path d="M9 17l6 6M6 26l5-5" stroke="#6b3f1d" stroke-width="3" stroke-linecap="round"/></svg>`,
  arco: `<svg viewBox="0 0 32 32" fill="none" stroke="#6b3f1d" stroke-width="2.5" stroke-linecap="round"><path d="M9 4c12 4 12 20 0 24"/><path d="M9 4v24" stroke-width="1"/><path d="M6 16h20" stroke="#555"/><path d="M22 12l4 4-4 4" stroke="#555"/></svg>`,
  escudo: `<svg viewBox="0 0 32 32"><path d="M16 3 27 7v8c0 7-5 11-11 14C10 26 5 22 5 15V7z" fill="#8aa4c8" stroke="#2a2a2a" stroke-width="2"/></svg>`,
  bomba: `<svg viewBox="0 0 32 32"><circle cx="15" cy="19" r="9" fill="#333"/><path d="M20 10l4-4" stroke="#6b3f1d" stroke-width="2.5"/><path d="M26 2v4M23 4h6" stroke="#f5a623" stroke-width="2" stroke-linecap="round"/></svg>`,
  bebida: `<svg viewBox="0 0 32 32"><path d="M12 4h8v6l5 12a4 4 0 0 1-4 6H11a4 4 0 0 1-4-6l5-12z" fill="#5cc26e" stroke="#2a2a2a" stroke-width="2"/></svg>`,
  veneno: `<svg viewBox="0 0 32 32"><path d="M16 4c5 7 9 10 9 15a9 9 0 0 1-18 0c0-5 4-8 9-15z" fill="#7bd05a" stroke="#2a2a2a" stroke-width="2"/></svg>`,
  magia: `<svg viewBox="0 0 32 32"><path d="M16 3l3 9 9 4-9 4-3 9-3-9-9-4 9-4z" fill="#b05bd0"/></svg>`,
  drenar: `<svg viewBox="0 0 32 32"><circle cx="16" cy="16" r="11" fill="#7a3d9a"/><path d="M16 8c4 5 6 7 6 10a6 6 0 0 1-12 0c0-3 2-5 6-10z" fill="#d94a4a"/></svg>`,
  invocar: `<svg viewBox="0 0 32 32"><circle cx="16" cy="16" r="12" fill="none" stroke="#b05bd0" stroke-width="2.5"/><path d="M16 5l9 17H7z" fill="none" stroke="#b05bd0" stroke-width="2"/></svg>`,
  moneda: `<svg viewBox="0 0 32 32"><circle cx="16" cy="16" r="12" fill="#f2c230" stroke="#a37a10" stroke-width="2"/><text x="16" y="21" font-size="14" text-anchor="middle" fill="#a37a10" font-weight="700">$</text></svg>`,
  mordida: `<svg viewBox="0 0 32 32"><path d="M4 12c6-6 18-6 24 0-6 12-18 12-24 0z" fill="#e8d8c8" stroke="#2a2a2a" stroke-width="2"/><path d="M9 13l2 5 2-5M15 13l2 5 2-5M21 13l2 5 1-5" stroke="#d94a4a" stroke-width="1.6" fill="none"/></svg>`,
  provocar: `<svg viewBox="0 0 32 32"><path d="M6 9h20v12H15l-5 5v-5H6z" fill="#f5a623" stroke="#2a2a2a" stroke-width="2"/><path d="M16 12v5M16 19v1" stroke="#2a2a2a" stroke-width="2.5" stroke-linecap="round"/></svg>`,
  trampa: `<svg viewBox="0 0 32 32" fill="#777" stroke="#2a2a2a" stroke-width="1.5"><path d="M3 24l5-14 4 8 4-12 4 12 4-8 5 14z"/></svg>`,
  sanacion: `<svg viewBox="0 0 32 32"><circle cx="16" cy="16" r="13" fill="#fff" stroke="#8bc34a" stroke-width="2"/><path d="M16 8v16M8 16h16" stroke="#b05bd0" stroke-width="5" stroke-linecap="round"/></svg>`,
};

export const icono = (nombre) => ICONOS[nombre] ?? '';
export const dado = () => D20;
