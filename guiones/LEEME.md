# Guiones de los capítulos (Libro de campañas)

Aquí está **la lógica de la historia** de los capítulos «por escenas»: qué pasa en cada escena, qué se pregunta, qué opciones hay, a dónde lleva cada una («si eligen B, van a D») y bajo qué condiciones.

## Dónde está cada cosa

| Archivo | Qué es | ¿Se edita? |
|---|---|---|
| `public/mapas/guiones/<campaña>-<n>.json` | **Fuente única del guion.** La app (pestaña Mapas) la carga tal cual: lo que cambies aquí cambia en los mapas en cuanto se recarga. | **Sí, aquí se cambia todo.** |
| `guiones/<campaña>-<n>.md` | Vista legible **generada** del JSON: resumen, marcas, diagrama Mermaid del flujo y una ficha por escena con la tabla de opciones (opción → destino, condición, nota). Para leer y analizar. | **No.** Se regenera con `make guiones`. |
| `public/mapas/campanas.json` | Fichas de las campañas. El capítulo apunta a su guion con `"guion": "guiones/<campaña>-<n>.json"` y guarda solo `mapa`, `titulo` y `plano`. Los capítulos aún no convertidos siguen en formato antiguo (`llegada`/`pasos`/`cierre`) dentro de este archivo. | Solo la ficha. |
| `public/mapas/narraciones/*.mp3` | Audio de cada texto que se lee (narración, «tras el combate», pregunta, cada opción). | Se generan (ver abajo). |
| `public/mapas/imagenes/<mapa>.webp` | El mapa del capítulo. **Todo texto debe cuadrar con esta imagen.** | No. |

Guiones que hay ahora: `el-aliento-helado-1` («Los muelles callados»), que es la referencia de cómo debe quedar un capítulo.

## Cómo funciona el guion (esquema del JSON)

```jsonc
{
  "_acerca": "texto explicativo (la app lo ignora)",
  "objetivo": "qué tiene que conseguir el grupo",
  "geografia": "descripción del mapa: qué hay dónde, puertas, colores, qué se ve desde dónde",
  "personajes": [{ "nombre", "rol", "quien", "como_interpretarlo", "que_sabe" }],
  "inicio": "id de la primera escena",
  "estados": { "<marca>": { "texto": "lo que ve el máster", "icono": "icono de Font Awesome" } },
  "opciones_comunes": { "<id>": { "pregunta", "audio_pregunta", "opciones": [ ...opciones ] } },
  "escenas": {
    "<id>": {
      "titulo", "lugar", "x", "y",          // x/y = posición en % de la imagen del mapa
      "narracion", "audio",                 // se lee en voz alta al llegar
      "master",                             // nota solo para el máster (mecánicas, secretos)
      "marca": ["..."],                     // marcas que pone al visitarla
      "combate": { "enemigos": ["nombre exacto de enemigos.json"], "nota", "despliegue" },
      "despues", "audio_despues", "master_despues",   // tras ganar el combate
      "enigma": { "id", "titulo", "contexto", "recompensa", "fallo", ... },
      // y termina con UNA de estas tres cosas:
      "pregunta", "audio_pregunta", "opciones": [ ...opciones ] | "<id de opciones_comunes>",
      "sigue": "<id>",                      // sin elección (p. ej. una emboscada que lleva al combate)
      "fin": true
    }
  }
}
```

**Opción:**

```
{ "opcion": "Vamos a ver la barca", "lectura": "Ir a ver la barca.", "audio",
  "va_a": "<id>", "nota": "para el máster", "si": [marcas], "salvo": [marcas] }
```

Dentro de una lista, `{ "comunes": "<id>", "si", "salvo" }` mete las opciones comunes. Una común que repite el destino de una opción ya visible no se muestra.

**Marcas:** el estado del grupo es el conjunto de **ids de escenas visitadas** más las `marca` de esas escenas. Una opción se ve si tiene todas sus `si` y ninguna de sus `salvo`. Así se recuerda lo hecho (llave, ruido, «ya vimos la barca») y cada camino es coherente.

## Reglas que el guion debe cumplir

Todas las reglas de historia, mapa, coherencia entre capítulos y juego están en `.claude/skills/rehacer-capitulo-por-escenas/SKILL.md`. Resumen:
- Tras cada evento, narración y nueva decisión. Opciones lógicas, nunca al azar.
- **Cada camino posible:** 4 combates, sin callejones sin salida y pasando por el enigma.
- El enigma no se salta. Si lo fallan, se paga un precio (en el capítulo I, una ofrenda de sangre).
- Un lugar no se cierra hasta que el grupo lo visita de verdad: se pueden agotar las posibilidades.
- Toda necesidad del grupo y todo enemigo tienen un porqué claro.
- Los textos cuadran con la imagen del mapa (el agua es azul, dónde están las puertas, qué se ve desde dónde).
- Coherencia con el capítulo anterior y el siguiente. Al volver se dice «volver a la taberna».
- Todo lo que se lee lleva audio.

## Después de cambiar un guion

1. Validar todos los caminos:

   ```
   make validar-guion CAMPANA=el-aliento-helado CAPITULO=1
   ```

2. Regenerar la vista legible:

   ```
   make guiones
   ```

3. Audios de borrador de los textos nuevos o cambiados:

   ```
   .venv/bin/python .claude/skills/rehacer-capitulo-por-escenas/scripts/audios_capitulo.py <campaña> <n> --escribir
   ```

   Luego, el comando `make audio-borrador …` que te indica. Este script escribe en el guion las rutas de audio que falten y compara los textos con git (`--desde HEAD`). La voz final (`make audio-final`) solo se genera cuando el usuario lo pide.
4. Subir las versiones de caché:
   - `const V = '?v=N'` en `public/tienda/js/secciones/mapas.js` (el guion se pide con ese `?v=`);
   - `mapas.js?v=` en `main.js`;
   - `.version-app` y `base.css?v=` en `public/index.html`.
5. Pasar las pruebas: `make check-css`, `make probar` y `make probar-enigmas`.

Para jugar un camino en el navegador:

```
.venv/bin/python .claude/skills/rehacer-capitulo-por-escenas/scripts/recorrer.py <campaña> <n> "opción" SIGUE GANADO ...
```
