// Página que usa el exportador a PDF: dibuja todas las cartas de una clase (?clase=druida).
import { renderizarCartas, esperarImagenes } from './render.js';

const clase = new URLSearchParams(location.search).get('clase') ?? 'druida';
const datos = await (await fetch(`../${clase}/${clase}.json`)).json();
const contenedor = document.getElementById('cartas');
contenedor.innerHTML = renderizarCartas(clase, datos, '../');
await esperarImagenes(contenedor);
document.body.dataset.listo = '1';
