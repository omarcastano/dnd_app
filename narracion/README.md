# Narración

Genera las narraciones (mp3) de las cartas a partir de los JSON de `public/personajes/`.

```bash
make setup   # uv sync --all-groups: instala todo en .venv desde el pyproject.toml de la raíz (alias: make audio-setup)
make audio ARGS="public/personajes/clases/druida/druida.json --id eldan-galadriel"   # una carta
make audio ARGS="public/personajes/clases/druida/druida.json"                         # todas las de la clase
```

(Las rutas son relativas a la raíz del repo, desde donde corre `make`.)

## Estándar de voz
El motor por defecto es **Qwen3-TTS** (`--motor qwen`), que **clona siempre la misma narradora**: una voz femenina cálida de
cuento de fantasía, para que todas las narraciones suenen igual. Su referencia está en `narracion/voz/`:
- `narradora.wav` — audio de referencia (la narración aprobada de Eldan).
- `narradora.txt` — el texto exacto que dice ese audio.

Para cambiar de narradora se sustituyen esos dos archivos (≈10-15 s de audio limpio y su transcripción) y se regeneran los audios.
La primera ejecución descarga el modelo `Qwen/Qwen3-TTS-12Hz-1.7B-Base` (varios GB, en la caché de Hugging Face) y necesita GPU NVIDIA.
Regenerar la carta de Eldan produce un clon de su propia voz, casi idéntico pero no byte a byte.

El audio se guarda en `public/personajes/clases/<clase>/narraciones/<id>.mp3` y el script añade al JSON de la carta
`"narracion": "narraciones/<id>.mp3"` (ruta relativa a la clase, justo tras `descripcion`). `app/datos.js` la resuelve y
`make check` comprueba que el archivo exista. El texto narrado es la `descripcion` de la carta.

**Enemigos:** `make audio ARGS="public/enemigos/enemigos.json --id lobo-espinoso"` escribe `public/enemigos/narraciones/<id>.mp3` y enlaza `narracion` en `enemigos.json`. Aquí se narra la `descripcion` **y** cada habilidad («Habilidad, Sangrado. …»).

Opciones: `--id`, `--salida` (carpeta distinta; en ese caso no se modifica el JSON), `--motor qwen|edge`.
Con `--motor edge` (edge-tts, sin GPU): `--acento` (es-CO, es-MX, es-ES), `--voz` (p. ej. `es-ES-XimenaNeural`), `--estilo` (normal, epico, villano).

## Dependencias
Van **solo** en el `pyproject.toml` de la raíz del proyecto (gestionado con `uv`, entorno `.venv/`); no hay `requirements.txt`
ni instalaciones globales. Las mismas dependencias sirven para las imágenes (ComfyUI) y las voces; ver "Dependencias de Python"
en `CLAUDE.md`. Qwen3-TTS avisa de que falta `sox` (programa del sistema); no impide generar.
