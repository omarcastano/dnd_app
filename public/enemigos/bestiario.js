// Pestaña «Bestiario»: lista de enemigos (nivel y nombre) y, al elegir uno, su vista de combate con la carta y el contador de vida.
// El motor (vida 4/5/6, botín, robo) es el común de personajes/app/combate.js; la carta, la común de enemigos/carta.js (también la usa Mapas).
// Los números de vida y daño salen de `niveles` en enemigos.json (una sola fila por nivel); cada enemigo solo aporta nombres y textos.
import { montarCatalogo } from '../personajes/app/combate.js?v=3';
import { RAIZ_ENEMIGOS, cartaEnemigo, subtituloEnemigo, cargarEnemigos } from './carta.js?v=2';

export async function initBestiario() {
  const raiz = document.querySelector('.bestiario:not(.pnj)');
  const zona = document.getElementById('bestiario-catalogo');
  if (!raiz || !zona) return;
  try {
    const d = await cargarEnemigos();
    montarCatalogo(raiz, zona, { niveles: d.niveles, fichas: d.enemigos }, {
      carta: cartaEnemigo, subtitulo: subtituloEnemigo,
      raizUrl: RAIZ_ENEMIGOS, atributo: 'enemigo', columna: 'Enemigo', volver: '← Enemigos', vacio: 'Aún no hay enemigos', prefijo: 'taberna:bestiario',
    });
  } catch (err) {
    console.error(err);
    zona.innerHTML = '<p class="estado alerta">No se pudo cargar el bestiario</p>';
  }
}
