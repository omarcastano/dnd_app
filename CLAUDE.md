# D&D - La Taberna

Sitio estático en español, sin build. `public/` es la raíz publicada; `personajes/` (WIP, borrador: faltan imágenes, no se publica) y `narracion/` (audio con edge-tts) no se publican.
- Estilos en `public/tienda/css/` divididos por sección (base, tienda, puzzles, botin, tablas, robo, pie, responsive); el orden de los `<link>` en `index.html` importa (`responsive.css` va último).

## Convenciones
- Todo en español: nombres de archivos, IDs, variables y textos.
- Rutas relativas (el sitio debe funcionar en subruta, p. ej. GitHub Pages).
- Las vistas son fragmentos HTML en `public/tienda/partes/`, cargados con `fetch` por `js/nucleo/partes.js` (hueco `<div data-parte="x.html">` en `index.html`).
- JS en `public/tienda/js/`: `nucleo/` (utilidades, navegación, carga de partes), `datos/` (datos puros: tienda, puzzles), `secciones/` (una por pestaña), `puzzles/` (uno por puzzle). `main.js` solo carga las partes y ejecuta la lista `MODULOS` de `initX()`.
- Nada de `onclick` inline ni globales en `window`: el HTML usa atributos `data-*` (`data-tab`, `data-cerrar-puzzle`, `data-alternar-tarjeta`) y `nucleo/navegacion.js` / cada módulo los atiende por delegación de eventos.
- Para añadir un módulo: crear `initX()` y registrarlo en `MODULOS` de `main.js`.
- Imágenes en `.webp`, nombres en kebab-case sin tildes.
- Cartas de personaje: `personajes/<clase>/<clase>.json` con lista `cartas`, imágenes en `imagenes/`.

## Comandos
- `make run` — servidor local (puerto `PORT=8080`)
- `make check` — valida los JSON de personajes
- `make audio-setup` / `make audio ARGS="..."` — narración
