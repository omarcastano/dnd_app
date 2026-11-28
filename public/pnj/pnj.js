// Pestaña «PNJ»: personajes no jugadores (tabernera, capitán de la guardia, contrabandista…). Misma vista que el Bestiario
// (motor común de personajes/app/combate.js: vida 4/5/6, botín, robo del Pícaro) y los números del mismo nivel de enemigos.json.
// Lo que les hace distintos de las bestias: una REACCIÓN (una vez por combate, la dispara algo que hace el grupo), un TRATO
// (se les puede convencer sin pelear: d20 contra la cifra de su nivel). El panel de combate es el mismo que el de las bestias, sin nada propio.
import { esc } from '../personajes/app/util.js';
import { MEDALLON } from '../personajes/app/cartas.js';
import { ROMANOS, ESQUINAS, filaAtaque, cartaVolteable, montarCatalogo } from '../personajes/app/combate.js?v=3';

const RAIZ = new URL('./', import.meta.url);

// ---------- Cartas ----------
const frente = (e) => `${ESQUINAS}
  <div class="retrato-p"><img src="${new URL(`imagenes/${e.id}.webp`, RAIZ).href}" alt="${esc(e.nombre)}"${e.encuadre ? ` style="object-position:${esc(e.encuadre)}"` : ''}></div>
  <div class="pie-p"><div class="nombre-carta">${esc(e.nombre)}</div>${e.narracion ? MEDALLON(new URL(e.narracion, RAIZ).href) : '<div class="divisor"><i>◆</i></div>'}
  <div class="linaje">${esc(e.oficio)}<b>◆</b>Nivel ${ROMANOS[e.nivel]}</div></div>`;

// Cifra del d20 que pide el trato (por nivel, en reglas.trato_cd). Con `trato.tirada: false` no hay tirada (contar un chiste, invitarle a una ronda…)
const cifraTrato = (reglas, e) => reglas.trato_cd[e.nivel];

const dorso = (e, n, reglas) => `${ESQUINAS}
  <div class="placa"><h3>${esc(e.nombre)}</h3><div class="nivel-p">Nivel ${ROMANOS[e.nivel]}</div></div>
  <div class="cuerpo-p">
    <div class="bloque desc-e"><p class="desc-p">${esc(e.descripcion)}</p></div>
    <div class="bloque"><h5>Reacción</h5><div class="habilidad-e"><b>${esc(e.reaccion.nombre)}</b><p>${esc(e.reaccion.descripcion)}</p></div></div>
    <div class="bloque"><h5>Trato</h5><div class="habilidad-e pnj-trato"><b>${esc(e.trato.via)}</b><p>${e.trato.tirada === false ? '' : `<strong>d20 ${cifraTrato(reglas, e)}+</strong> · `}${esc(e.trato.descripcion)}</p></div></div>
    <div class="bloque"><h5>Ataques</h5>${e.ataques.map((a) => filaAtaque(a, n)).join('')}<p class="nota-e">Con 1-4 falla.</p></div>
  </div>`;


export async function initPnj() {
  const raiz = document.querySelector('.bestiario.pnj');
  const zona = document.getElementById('pnj-catalogo');
  if (!raiz || !zona) return;
  try {
    const [pnj, enemigos] = await Promise.all(['pnj.json', '../enemigos/enemigos.json']
      .map(async (r) => (await fetch(new URL(r, RAIZ), { cache: 'no-cache' })).json()));
    const reglas = pnj.reglas;
    montarCatalogo(raiz, zona, { niveles: enemigos.niveles, fichas: pnj.pnj }, {
      carta: (e, n) => cartaVolteable(e.nombre, frente(e), dorso(e, n, reglas), 'enemigo pnj-dorso'),
      subtitulo: (e) => `${e.oficio} · Nivel ${ROMANOS[e.nivel]}`,
      raizUrl: RAIZ, atributo: 'pnj', columna: 'Personaje', volver: '← Personajes', vacio: 'Aún no hay personajes', prefijo: 'taberna:pnj',
    });
  } catch (err) {
    console.error(err);
    zona.innerHTML = '<p class="estado alerta">No se pudieron cargar los personajes</p>';
  }
}
