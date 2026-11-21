# D&D - La Taberna

Sitio estático en español, sin build. `public/` es la raíz publicada. `public/personajes/` es la pestaña «Héroes» (iframe); el workflow no publica `legacy/`, `plantilla/` ni `*.py` (`make catalogo` los sirve en local). `narracion/` no se publica.
- Estilos en `public/tienda/css/` divididos por sección (base, tienda, puzzles, botin, tablas, robo, pie, responsive); el orden de los `<link>` en `index.html` importa (`responsive.css` va último).

## Convenciones
- Todo en español: nombres de archivos, IDs, variables y textos.
- Rutas relativas (el sitio debe funcionar en subruta, p. ej. GitHub Pages).
- Las vistas son fragmentos HTML en `public/tienda/partes/`, cargados con `fetch` por `js/nucleo/partes.js` (hueco `<div data-parte="x.html">` en `index.html`).
- JS en `public/tienda/js/`: `nucleo/` (utilidades, navegación, carga de partes), `datos/` (datos puros: tienda, puzzles), `secciones/` (una por pestaña), `puzzles/` (uno por puzzle). `main.js` solo carga las partes y ejecuta la lista `MODULOS` de `initX()`.
- Nada de `onclick` inline ni globales en `window`: el HTML usa atributos `data-*` (`data-tab`, `data-cerrar-puzzle`, `data-alternar-tarjeta`) y `nucleo/navegacion.js` / cada módulo los atiende por delegación de eventos.
- Para añadir un módulo: crear `initX()` y registrarlo en `MODULOS` de `main.js`.
- Imágenes en `.webp`, nombres en kebab-case sin tildes.
- Cartas de personaje: `public/personajes/clases/<clase>/<clase>.json` (bloque `clase` + `cartas` con `tipo` personaje/tabla/ilustrada + `seleccion`), imágenes en `imagenes/` por convención de nombre (`<id>.webp`). Clases registradas en `public/personajes/clases.json`. Código en `public/personajes/app/` (`datos.js` aplica las convenciones, `cartas.js`+`cartas.css` dibujan, `seleccion.js`, `carrusel.js`, `efectos.js` motor genérico; los efectos propios de una clase viven en su carpeta). `public/personajes/legacy/` es el diseño y esquema antiguos, incompatible con el actual.
- **Para crear una clase nueva usar la plantilla `public/personajes/plantilla/`** (`plantilla.json` + `LEEME.md` con tipos de carta, convenciones y pasos). Copiarla a `clases/<clase>/` y registrarla en `clases.json`; no es una clase real.

## Comandos
- `make run` — servidor local (puerto `PORT=8080`)
- `make check` — valida personajes (esquema, referencias, imágenes); `CLASE=x` para una sola
- `make catalogo` — catálogo de cartas en http://localhost:8081 (sin caché)
- `make audio-setup` / `make audio ARGS="..."` — narración
