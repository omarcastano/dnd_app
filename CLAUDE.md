# D&D - La Taberna

Sitio estático en español, sin build. `public/` es la raíz publicada. La pestaña «Héroes» (`tienda/partes/heroes.html` + `initHeroes()` de `public/personajes/app/catalogo.js`) muestra las clases de `public/personajes/`; el workflow no publica `legacy/`, `plantilla/` ni `*.py` (`make run` los sirve en local). `narracion/` no se publica.
- Estilos en `public/tienda/css/` divididos por sección (base, tienda, puzzles, botin, tablas, robo, pie, responsive); el orden de los `<link>` en `index.html` importa (`responsive.css` va último).

## Convenciones
- **Versión visible de la app**: etiqueta `.version-app` en `public/index.html` (arriba a la izquierda, formato `0.0.N`). **Hay que subirla en cada iteración entregada al usuario** (y el `?v=` de `base.css` en el mismo archivo); así el usuario sabe qué versión ve y detecta la caché.
- Todo en español: nombres de archivos, IDs, variables y textos.
- Rutas relativas (el sitio debe funcionar en subruta, p. ej. GitHub Pages).
- Las vistas son fragmentos HTML en `public/tienda/partes/`, cargados con `fetch` por `js/nucleo/partes.js` (hueco `<div data-parte="x.html">` en `index.html`).
- JS en `public/tienda/js/`: `nucleo/` (utilidades, navegación, carga de partes), `datos/` (datos puros: tienda, puzzles), `secciones/` (una por pestaña), `puzzles/` (uno por puzzle). `main.js` solo carga las partes y ejecuta la lista `MODULOS` de `initX()`.
- Nada de `onclick` inline ni globales en `window`: el HTML usa atributos `data-*` (`data-tab`, `data-cerrar-puzzle`, `data-alternar-tarjeta`) y `nucleo/navegacion.js` / cada módulo los atiende por delegación de eventos.
- Para añadir un módulo: crear `initX()` y registrarlo en `MODULOS` de `main.js`.
- Imágenes en `.webp`, nombres en kebab-case sin tildes.
- Cartas de personaje: `public/personajes/clases/<clase>/<clase>.json` (bloque `clase` + `cartas` con `tipo` personaje/tabla/ilustrada + `seleccion`), imágenes en `imagenes/` por convención de nombre (`<id>.webp`). Clases registradas en `public/personajes/clases.json`. Código en `public/personajes/app/` (`datos.js` aplica las convenciones, `cartas.js`+`cartas.css` dibujan (estilos acotados a `.heroes`, no tocar `body`/`:root`), `seleccion.js`, `carrusel.js`, `efectos.js` motor genérico; los efectos propios de una clase viven en su carpeta). `public/personajes/legacy/` es el diseño y esquema antiguos, incompatible con el actual.
- **Para crear una clase nueva usar la plantilla `public/personajes/plantilla/`** (`plantilla.json` + `LEEME.md` con tipos de carta, convenciones y pasos). Copiarla a `clases/<clase>/` y registrarla en `clases.json`; no es una clase real.

## Comandos
- `make run` — servidor local (puerto `PORT=8080`)
- `make check` — valida personajes (esquema, referencias, imágenes); `CLASE=x` para una sola
- `make catalogo` — el sitio en http://localhost:8081 sin caché (pestaña Héroes = catálogo de cartas)
- `make setup` — instala TODAS las dependencias de Python (`uv sync --all-groups` → `.venv`); `make audio ARGS="..."` — narración: motor Qwen3-TTS que clona siempre la misma narradora (`narracion/voz/`), ver `narracion/README.md` (`make audio-setup` es un alias de `make setup`)

## Dependencias de Python
- **Todas las dependencias de Python viven en el `pyproject.toml` de la raíz** (+ `uv.lock`), con `uv` y un único entorno `.venv/` dentro del proyecto. Nunca `pip install` global ni `requirements.txt` sueltos, ni otro `pyproject.toml` (ni en `~/ia`) para este proyecto.
- Base: narración (`edge-tts`, `pedalboard`). Grupo `imagenes`: ComfyUI/SDXL (el código y el modelo están en `~/ia/ComfyUI`; `asegurar_comfyui.sh` lo arranca con el `.venv` del proyecto). Grupo `voces`: voces open source (Qwen3-TTS).
- **Sin forzar versiones**: nada de `override-dependencies` ni pins artificiales. Antes de añadir un paquete, comprobar con `uv lock` que resuelve de forma natural; si choca con otro (p. ej. Chatterbox exige `torch 2.6` y ComfyUI usa `2.11`), se descarta ese paquete.
