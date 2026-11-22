// Pestaña «Bestiario»: catálogo de enemigos (frente: imagen y nombre; dorso: descripción, ataques con d20 y habilidades).
// Los números de vida y daño salen de `niveles` en enemigos.json (una sola fila por nivel); cada enemigo solo aporta nombres y textos.
// Las cartas reutilizan el diseño de personajes/app/cartas.css y el volteo de catalogo.css.
import { esc } from '../personajes/app/util.js';

const RAIZ = new URL('./', import.meta.url);
const ROMANOS = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII'];
const ESQUINAS = '<i class="esquina a"></i><i class="esquina b"></i><i class="esquina c"></i><i class="esquina d"></i>';

// Rango del d20 de cada tipo de golpe (los mismos para todos los enemigos)
const D20 = { basico: '7-15', fuerte: '16+' };

const frente = (e) => `${ESQUINAS}
  <div class="retrato-p"><img src="${new URL(`imagenes/${e.id}.webp`, RAIZ).href}" alt="${esc(e.nombre)}"${e.encuadre ? ` style="object-position:${esc(e.encuadre)}"` : ''}></div>
  <div class="pie-p"><div class="nombre-carta">${esc(e.nombre)}</div><div class="divisor"><i>◆</i></div>
  <div class="linaje">${esc(e.tipo)}<b>◆</b>Nivel ${ROMANOS[e.nivel]}</div></div>`;

const filaAtaque = (a, n) => `<div class="fila-p fila-enemigo">
  <div class="hex"><span><small>D20</small>${D20[a.golpe]}</span></div>
  <div class="quien"><div><b>${esc(a.nombre)}</b><em>${esc(a.subtitulo)}</em></div></div>
  <div class="valor-p" title="Daño">${n[a.golpe]}</div></div>`;

const dorso = (e, n) => `${ESQUINAS}
  <div class="placa"><h3>${esc(e.nombre)}</h3><div class="nivel-p">Nivel ${ROMANOS[e.nivel]}</div></div>
  <div class="cuerpo-p">
    <div class="bloque desc-e"><p class="desc-p">${esc(e.descripcion)}</p></div>
    <div class="bloque"><h5>${e.habilidades.length > 1 ? 'Habilidades' : 'Habilidad'}</h5>${e.habilidades.map((h) => `<div class="habilidad-e"><b>${esc(h.nombre)}</b><p>${esc(h.descripcion)}</p></div>`).join('')}</div>
    <div class="bloque"><h5>Ataques</h5>${e.ataques.map((a) => filaAtaque(a, n)).join('')}<p class="nota-e">Con 1-6 el enemigo falla.</p></div>
    <div class="bloque vida-e"><h5>Vida según jugadores</h5>
      <div class="vidas">${[4, 5, 6].map((j, i) => `<div><b>${n.vida[i]}</b><span>${j} jug.</span></div>`).join('')}</div></div>
  </div>`;

const carta = (e, n) => `<div class="carta-sel volteo gira" role="button" tabindex="0" aria-label="Voltear la carta de ${esc(e.nombre)}">
  <div class="volteo-in"><div class="cara"><article class="carta-p personaje">${frente(e)}</article></div>
  <div class="cara dorso"><article class="carta-p enemigo">${dorso(e, n)}</article></div></div></div>`;

function ajustarEscala(raiz) {
  raiz.style.setProperty('--escala-bestiario', Math.min(1, (innerWidth - 32) / 306).toFixed(3));
}

function voltear(v) {
  const giro = Number(v.dataset.giro ?? 0) + 1;
  v.dataset.giro = giro;
  v.style.setProperty('--giro', giro);
}

export async function initBestiario() {
  const raiz = document.querySelector('.bestiario');
  const catalogo = document.getElementById('bestiario-catalogo');
  if (!raiz || !catalogo) return;
  ajustarEscala(raiz);
  addEventListener('resize', () => ajustarEscala(raiz));
  try {
    const d = await (await fetch(new URL('enemigos.json', RAIZ), { cache: 'no-cache' })).json();
    const porNivel = d.niveles.map((n) => [n, d.enemigos.filter((e) => e.nivel === n.nivel)]).filter(([, es]) => es.length);
    catalogo.innerHTML = porNivel.map(([n, es]) => `
      <section class="nivel-enemigos"><h2>Nivel ${ROMANOS[n.nivel]} <small>${esc(n.nombre)}</small></h2>
      <div class="rejilla-enemigos">${es.map((e) => carta(e, n)).join('')}</div></section>`).join('');
    catalogo.addEventListener('click', (e) => { const v = e.target.closest('.volteo.gira'); if (v) voltear(v); });
    catalogo.addEventListener('keydown', (e) => {
      const v = e.target.closest('.volteo.gira');
      if (v && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); voltear(v); }
    });
  } catch (err) {
    console.error(err);
    catalogo.innerHTML = '<p class="estado alerta">No se pudo cargar el bestiario</p>';
  }
}
