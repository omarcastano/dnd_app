---
name: crear-personaje
description: Crea una clase de personaje completa para el juego de D&D de La Taberna (JSON, imágenes generadas con ComfyUI/SDXL local, narraciones de audio con Qwen3-TTS local, efectos, registro en el catálogo (pestaña Héroes)), usando la clase Druida como plantilla exacta. Úsala cuando el usuario pida crear/añadir un personaje, clase o héroe nuevo, ya sea desde una descripción detallada o desde una imagen de referencia.
---

# Crear una clase de personaje

Hay **dos clases de referencia** ya iteradas; léelas siempre (JSON, `efectos.js`/`efectos.css` y mira sus imágenes con Read) antes de crear nada y úsalas como contexto:
- **Druida** (`public/personajes/clases/druida/`): plantilla base de **2 poderes + 2 dones** (18 imágenes).
- **Paladín** (`public/personajes/clases/paladin/`): referencia de **3 roles** (tanque / sanador / DPS), de descripciones claras y de texto largo con scroll (24 imágenes).
Toda clase nueva replica su estructura, cantidad de cartas y convención de imágenes. No inventes otro esquema. Idioma: todo en español (ids, textos); archivos y ids en kebab-case sin tildes.

## Flujo de trabajo (orden obligatorio)
1. Datos de partida (sección 1) y JSON de la clase (sección 2), con la `descripcion` final de las 2 cartas de personaje: **esa descripción es el texto de la narración**, así que debe quedar definitiva *antes* de generar el audio.
2. **Etapa de imágenes** (sección 3): asegura ComfyUI, genera **todas** las imágenes y, al terminar, **apágalo** con `bash .claude/skills/crear-personaje/scripts/parar_comfyui.sh`.
3. **Etapa de audio** (sección 3b, obligatoria; solo con ComfyUI apagado): genera un mp3 por cada carta de personaje. El audio se enlaza en el JSON (`narracion`) y se reproduce desde el medallón ▶ del frente de la carta.
4. Efectos y registro en `clases.json` (sección 4), desbordes (sección 5) y verificación (sección 6).
**Imágenes y audio van siempre por separado, nunca a la vez: los dos modelos no caben juntos en la GPU de 12 GB** (medido: con SDXL cargado en ComfyUI la GPU está en ~9,2 GB y quedan ~3 GB libres; el audio necesita ~6 GB). Una etapa, se libera la GPU, la otra. No arranques ComfyUI mientras generas audios, ni lances audios mientras ComfyUI esté encendido.
No des la clase por terminada sin sus 2 narraciones: una carta de personaje sin audio es una clase incompleta.

## 0. Entorno y modelos locales (imágenes y audio)
**Dependencias de Python: un único `pyproject.toml` en la raíz del repo** (+ `uv.lock`), con `uv` y un solo `.venv/` (`make setup` = `uv sync --all-groups`). Nunca `pip install` global, `requirements.txt` sueltos ni otro `.toml` (tampoco en `~/ia`). **Sin forzar versiones**: nada de `override-dependencies` ni pins artificiales; si hay que añadir un paquete, prueba `uv lock` en una copia y descártalo si no resuelve de forma natural (Chatterbox se descartó así: exige `torch 2.6` y ComfyUI usa `2.11`). Grupos: base (`edge-tts`, `pedalboard`), `imagenes` (ComfyUI) y `voces` (`qwen-tts`).

| | Imágenes | Audio (narración) |
|---|---|---|
| Modelo | Stable Diffusion XL Base 1.0 en ComfyUI v0.46.0 | Qwen3-TTS 1.7B Base (clona una voz) |
| Dónde vive | código y checkpoint (~7 GB) en `~/ia/ComfyUI`; servidor en `http://127.0.0.1:8188` | pesos (~4,3 GB) en la caché de Hugging Face (`~/.cache/huggingface`); voz de referencia en `narracion/voz/` (en el repo) |
| Asegurar el despliegue | `bash .claude/skills/crear-personaje/scripts/asegurar_comfyui.sh` | `bash .claude/skills/crear-personaje/scripts/asegurar_voz.sh` |
| Si falta algo | sale con código 2 → **pregunta al usuario** (descargas grandes) y reejecuta con `--instalar` | igual: código 2 → pregunta y `--instalar` |
| Generar | `scripts/generar_imagen.py` (sección 3) | `make audio ARGS="..."` (sección 3b) |

Protocolo (para imágenes y audio): **antes de generar, ejecuta el script `asegurar_*` correspondiente**; es idempotente (si ya está listo no hace nada). Scripts de `scripts/`: `asegurar_comfyui.sh`, `parar_comfyui.sh` y `asegurar_voz.sh`. Códigos de `asegurar_comfyui.sh`: 0 listo, 2 falta algo instalable, 3 faltan `git`/`uv`, 4-6 falló el clonado/entorno/descarga, 7 no respondió a tiempo. De `asegurar_voz.sh`: 0 listo, 2 falta algo instalable, 3 falta la voz de referencia (`narracion/voz/narradora.wav` + `.txt`, la aporta el repo; no se instala), 4 poca VRAM libre, 5 falló la instalación. Ante un fallo lee el mensaje y el log (`~/ia/comfyui.log`) y corrige la causa; no te saltes la generación ni cambies de modelo ni uses servicios externos.
- **Imágenes y audio nunca a la vez (GPU de 12 GB)**: ComfyUI es un servidor que **mantiene SDXL cargado en la GPU mientras esté encendido** (~9 GB en uso medidos, ~3 GB libres); el audio es un proceso que carga Qwen3-TTS (~6 GB), genera y termina (libera la GPU solo). Por eso: primero la etapa de imágenes completa, luego `bash .claude/skills/crear-personaje/scripts/parar_comfyui.sh` (apaga ComfyUI, espera a que la GPU quede libre y muestra la VRAM; idempotente), luego la etapa de audio. `asegurar_voz.sh` se niega a seguir (código 4) si hay menos de ~6 GB libres, y te dice que ejecutes `parar_comfyui.sh`. Si necesitas más imágenes después de los audios, vuelve a ejecutar `asegurar_comfyui.sh` (el audio ya habrá terminado y liberado la GPU). Usa siempre estos scripts para apagar ComfyUI: no uses `pkill -f` con el nombre del proceso (puede matar tu propia shell).
- El primer arranque de ComfyUI tras `make setup` puede tardar varios minutos; `asegurar_comfyui.sh` espera hasta 3 min (código 7 = no respondió a tiempo, pero puede seguir cargando: reejecuta el script). `generar_imagen.py` usa siempre el puerto 8188: no cambies `PUERTO`.
- Avisos que **no** son errores: ComfyUI "PYTORCH CUDA VERSION BELOW 13.0" (se usa cu128 a propósito por el driver) y Qwen3-TTS "SoX could not be found" / "flash-attn is not installed".
- Esta skill cubre **imagen y audio**; no hay ningún modelo de vídeo desplegado.

## 1. Entrada y datos de partida
El usuario da **(a)** una descripción detallada o **(b)** una imagen de referencia (ruta). En el caso (b) mira la imagen con Read y escribe tú la descripción (rasgos, ropa, colores, objeto/arma, temática). Pide solo lo que falte (y comprueba las armas contra la tienda, sección 1c) y no puedas decidir con criterio propio: nombre de la clase, raza(s), temática de los 2 poderes y de los 2 dones. Si dejan libertad, propón todo coherente y avanza.

## 1b. Variante de tres roles (referencia: Paladín)
Por defecto la clase tiene **2 poderes y 2 dones** (Druida). Si el usuario pide **tres roles** (tanque / sanador / DPS u otra terna), o la descripción lo implica, sigue el **Paladín** (`clases/paladin/paladin.json`): **un rol = un poder (niveles 1 y 2)** y el paso 2 pasa a ser "Elige tu poder" con 3 opciones. Hay **3 dones** (el paladín: *Plegaria de Resurrección* con tabla d20, *Égida Inquebrantable* y *Furia Divina* con `nombre_habilidad` y sin tabla). Todo lo demás es igual:

| | 2 poderes (Druida) | 3 roles (Paladín) |
|---|---|---|
| Cartas `tabla` | 4 | 6 (3 roles × 2 niveles) |
| Cartas `ilustrada` (dones) | 2 | 3 (1 con tabla d20, 2 con `nombre_habilidad`) |
| Opciones en "Elige tu poder" y "Elige tu don" | 2 y 2 | 3 y 3 |
| Ataques básicos (compartidos por todos los roles) | 4 | 4 |
| Habilidades especiales | 8 | 12 |
| Iconos de habilidad | 12 | 16 |
| Imágenes totales | 18 | 24 (2 retratos + 3 portadas + 3 dones + 16 iconos) |
| Efectos en `efectos.js` | 2 | los que haga falta: uno por rol y los dones pueden tener el suyo (el paladín: `castigo`, `luz`, `egida`, `resurreccion`; `temas` agrupa en 3 pantallas finales) |

Cómo se diferencian los roles en el paladín (copia el patrón):
- **DPS** (*Castigo Divino*): tabla `1-14 / 15-18 / 19+`, subtítulo "Ataque especial", valores 2-3 (nivel 1) y 3-4 (nivel 2).
- **Sanador** (*Luz Sanadora*): `1-10 / 11-16 / 17+`, subtítulo "Conjuro de sanación", valores 1-2 y 2-3.
- **Tanque** (*Bastión Sagrado*): `1-10 / 11-16 / 17+`, subtítulo "Conjuro de protección", valores 1-2 y 2-3; la descripción explica la mecánica (reduce el siguiente ataque enemigo en tantos puntos como indique la habilidad, se suma el escudo).
- Los 4 ataques básicos son iguales en los 3 roles, con subtítulo "Ataque básico" (en el druida, al ser conjuros, "Conjuro de ataque"). La carta del personaje incluye `reglas_raza` (paladín: humanos repiten un d20 fallido).
Si los roles son otros, aplica la misma lógica según su función. El catálogo ya admite 3 opciones por paso (carrusel); no hay que tocar código.

## 1c. Armas: solo las de la tienda (regla obligatoria)
Las armas que puede usar un personaje son **únicamente las que se venden en la tienda** (`public/index.html` → datos en `public/tienda/js/datos/tienda.js`, grupo `"Armas"`). **No inventes armas** (ni "martillo rúnico", "katana", etc.). Lee la lista actual del archivo cada vez (puede cambiar):
```bash
sed -n '/name: "Armas"/,/items:/p' public/tienda/js/datos/tienda.js     # nombre, unidades, precio, daño (+), manos
```
Hoy: Espada corta (1 mano, +1), Espada larga (1, +2), Alabarda (2, +3), Espada doble (2, +3), Puñal (1, +1), Daga (1, +1), Arco (2, +2), Hacha corta (1, +1), Maza (1, +2). Reglas de la tienda: máximo 2 armas, una por mano; las de 2 manos ocupan ambas. El **Escudo** no es arma: está en el grupo "Armaduras" (también de la tienda).
- `clase.armas` (**las que hagan sentido, no hay máximo**: 2, 3, 4… según la temática; el "máximo 2" de la tienda es lo que se *lleva a la vez*, no cuántas puede usar la clase) y cualquier mención de armas en `clase.reglas`, descripciones de personaje, habilidades y dones salen **solo de esa lista**, con el nombre exacto de la tienda. Elige las que encajen con la temática y el rol (el pícaro: Daga/Puñal; el arquero: Arco…). Si una de las dos es de 2 manos, la otra no puede ser usada a la vez: acláralo en `reglas` o elige dos de 1 mano.
- Una clase puede incluir además el escudo (Armaduras) si encaja. Si la temática pide algo que no está en la tienda (p. ej. un libro de conjuros, un martillo), **no lo pongas como arma**: usa la más cercana de la tienda (Maza por martillo) o pregunta al usuario, y dilo en el resumen.
- Los retratos y dones: pinta al personaje **empuñando esas armas** (prompt con "holding a short sword", "a mace", etc.) para que la imagen coincida con la carta.
- Los números de daño de habilidades y el "Daño (+)" del arma no se contradicen: las habilidades no deben duplicar ni anular lo que ya da el arma.

### Sin topes artificiales en armas, habilidades de clase y de raza
Los ejemplos del druida y el paladín tienen 2 de cada, pero **no es un límite**. `clase.armas`, `clase.reglas` y `reglas_raza` pueden tener las entradas que hagan sentido para el personaje (un guerrero puede usar 5 armas; una raza puede tener 3 habilidades). No rellenes por cuota ni recortes por cuota: cada entrada debe aportar algo y ser clara. Si hay muchas, el scroll del dorso (sección 5) las contiene. Los topes de 2 que sí aplican son otros (2 ataques básicos por nivel, 2 habilidades especiales por poder y nivel).

## 2. Estructura obligatoria (idéntica al druida)
Parte de `references/plantilla.json` (copia fiel del esquema del druida con marcadores). Resultado en `public/personajes/clases/<clase>/<clase>.json`:

| Elemento | Cantidad | Detalle |
|---|---|---|
| `clase` | 1 | `nombre`, `reglas` (habilidades de clase: normalmente una restricción y una bonificación, **pero no hay tope**; las que hagan sentido), `armas` (**de la tienda**, ver 1c; **sin tope de 2**) |
| Cartas `personaje` | 2 | Versión hombre y mujer (mismo `raza`; `reglas_raza` = habilidades de raza, **las que hagan sentido, sin tope de 2**), con `descripcion` (~160-180 caracteres, ver 3b) **y `narracion`** (el mp3 de esa descripción, sección 3b) |
| Cartas `tabla` | 4 | 2 poderes × niveles 1 y 2. id `<poder>-nivel-<n>` |
| Cartas `ilustrada` | 2 | Los 2 dones. Uno con `tabla` d20 (1-11 nada / 12+ efecto, "una vez por tablero de mazmorra"); el otro con `nombre_habilidad` y sin tabla |
| `seleccion` | 3 pasos | "¿Quién eres?" (Hombre/Mujer) → "Elige tu poder" (2 opciones, `portada: true`, cartas nivel-1 y nivel-2) → "Elige tu don" (2 opciones) |

Cada carta `tabla`: `ataques` = **2 ataques básicos por nivel** (`5+` y `12+`, subtítulo "Conjuro de ataque" o equivalente) y `tabla` = fila "No ocurre nada" + **2 habilidades especiales**. Los ataques básicos del nivel son **los mismos en los dos poderes** (mismos nombres → mismo icono, se genera una vez). Totales por clase base: **4 ataques básicos + 8 habilidades especiales = 12 iconos** (16 con tres roles).
Valores y rangos como el druida: básicos nivel 1 = 1 y 2, nivel 2 = 2 y 3. Poder ofensivo: tabla `1-14` / `15-18` / `19+`, valores 2-3 (nivel 1) y 3-4 (nivel 2). Poder de apoyo/curación: `1-10` / `11-16` / `17+`, valores 1-2 (nivel 1) y 2-3 (nivel 2). `rango_d20` siempre texto. Toda fila con `nombre` lleva `valor` y `subtitulo`. Nombres de habilidades distintos entre sí (cada uno = un icono propio).

### Las habilidades deben entenderse (regla de contenido)
Un jugador debe saber qué hace cada habilidad con solo leer la carta. **Prohibido** nombres o descripciones ambiguos o solo "bonitos" ("Danza de las sombras", "Bendición eterna", "Furia primigenia" sin decir qué hacen).
- **Nombre de habilidad**: evocador pero con el verbo/efecto reconocible (Golpe de Escudo, Luz Sanadora, Muro de Fe). Si el nombre es poético, el subtítulo lo aclara (`subtitulo`: "Ataque cuerpo a cuerpo", "Curación a un aliado", "Reduce el daño recibido"…); nunca dejes un subtítulo genérico que no informe.
- Modelo a imitar: la descripción de *Bastión Sagrado* ("elige a un aliado (o a ti). El próximo ataque enemigo que reciba ese aliado se reduce en tantos puntos como indique la habilidad…") y la de *Égida Inquebrantable* (cuándo, a quién, cuánto, hasta cuándo).
- **`descripcion`** de cada carta `tabla` y de los dones: di explícitamente **qué ocurre, a quién (a ti, a un aliado, a todos los aliados, a un enemigo), cuánto (dados/puntos), cuántas veces (una vez por tablero de mazmorra, por turno…) y las excepciones** (como "no afecta a no-muertos" en el curandero). Sin metáforas que oculten la regla.
- Todo efecto con número lleva el número ("1d4", "+2", "el doble de daño"); el `valor` de la fila coincide con lo que dice el texto.
- **Texto largo = scroll, no recortar**: prefiere una explicación clara y completa antes que una corta y ambigua (ver sección de desbordes).
- Antes de terminar, relee cada habilidad como si fuera la primera vez que ves el juego: ¿se entiende qué hace y cuánto? Si no, reescribe.

## 3. Imágenes (`clases/<clase>/imagenes/`)
Total esperado: **18** (24 con tres roles). Rutas por convención (las resuelve `app/datos.js`; si no coinciden la carta sale sin imagen):

| Imagen | Ruta | Tamaño final | `--tipo` | Complejidad |
|---|---|---|---|---|
| Retrato personaje (×2) | `<id-carta>.webp` | 907×1117 | `retrato` | Alta, sin límite. Estilo cómic de tinta como Eldan/Selene |
| Portada de poder (×2) | `<slug(etiqueta)>.webp` | 512×512 circular | `portada` | Emblema plano, simple |
| Don (×2) | `<id-carta>.webp` | 800×800 | `don` | Alta, sin límite (son grandes) |
| Icono habilidad (×12) | `habilidades/<slug(nombre)>.webp` | 256×256 circular | `habilidad` | **Muy simple**: un símbolo, 3 colores planos |

`slug` = minúsculas, sin tildes, no alfanumérico → `-`. Todo `.webp`. Los iconos y portadas son circulares con alfa (el script ya aplica la máscara). **Los iconos se ven diminutos (~28 px en la carta): un solo símbolo grande, siluetas gruesas, cero detalle, nada de texto.** Nunca prompts complejos para `habilidad`/`portada`.

### Generación: ComfyUI local, SDXL
- ComfyUI v0.46.0 en `~/ia/ComfyUI` (solo código y modelo; las dependencias de Python están en el `pyproject.toml` del proyecto, nunca en `~/ia`), escuchando en `http://127.0.0.1:8188`; modelo **Stable Diffusion XL Base 1.0** (`sd_xl_base_1.0.safetensors`, en `models/checkpoints`). No uses otro modelo ni servicio externo.
- **Antes de generar, asegura el despliegue** con `bash .claude/skills/crear-personaje/scripts/asegurar_comfyui.sh` (protocolo, códigos y `--instalar` en la sección 0). Arranca ComfyUI desde `~/ia/ComfyUI` con el `.venv/bin/python` del proyecto (log en `~/ia/comfyui.log`). Nunca sustituyas el modelo por otro ni por un servicio externo.
- Usa `scripts/generar_imagen.py` (añade el estilo del tipo y convierte/redimensiona/enmascara a .webp). Prompts en **inglés**, descriptivos. Estilo y negativos por defecto ya están en el script; tú solo describes el sujeto.
- Primero el **retrato de referencia** y mantén coherencia: reutiliza en el prompt del hombre/mujer los mismos rasgos (raza, pelo, colores de ropa, objeto) y fija `semilla` si repites.
- Una por una para el primer retrato (revísalo con Read y repite con otra semilla si sale mal); el resto en lote:
```bash
python3 .claude/skills/crear-personaje/scripts/generar_imagen.py --lote lote.json   # lista de {tipo, prompt, salida, [semilla, referencia, fuerza]}
python3 .claude/skills/crear-personaje/scripts/generar_imagen.py --tipo retrato --prompt "..." --salida public/personajes/clases/<clase>/imagenes/<id>.webp [--referencia img --fuerza 0.6] [--forzar]
```
  Pon `lote.json` en el scratchpad. El script omite imágenes que ya existen (`--forzar` para rehacer). ~10 s por imagen.
- **Desde una imagen de referencia:** pásala con `--referencia` al generar el retrato (img2img; `--fuerza` 0.45 casi igual … 0.7 solo inspirada) *y* describe el personaje en el prompt. Para el otro género/variantes usa fuerza ≥0.65 con la descripción cambiada. Si el usuario quiere la imagen tal cual, conviértela a .webp 907×1117 (recorte centrado) en vez de regenerarla.
- Revisa con Read al menos los retratos, las portadas y 3-4 iconos. Rehaz con otra semilla los que tengan texto, manos mal, o iconos demasiado detallados (simplifica el prompt: "a single X, minimal").
- Prompts de iconos: sujeto + una palabra de color de la clase, p. ej. `a crescent moon and a star`, `a bear claw swipe`, `a glowing leaf heart`. Mantén una paleta común por clase (añade `green and cream palette`) para que el set parezca uno.

## 3b. Narraciones de audio (obligatorio en las cartas de personaje)
**Siempre que crees un personaje hay que generar su audio.** Cada carta `personaje` (hombre y mujer) lleva una narración: el audio narra su `descripcion` (el detalle del personaje) y se enlaza en el JSON (`"narracion": "narraciones/<id>.mp3"`, ruta relativa a la clase; `app/datos.js` la resuelve y `make check` comprueba que exista). **En la carta**, `app/cartas.js` dibuja con ese campo un medallón dorado ▶/❚❚ en el **frente** (en el divisor entre el nombre y la raza; `app/narracion.js` lo reproduce, con anillo de progreso); sin `narracion` la carta no muestra botón y se queda con el divisor normal. La `descripcion` sigue visible en el dorso.
1. **Texto**: la `descripcion` es lo que se narra **y** lo que se ve en el dorso de la carta. Escríbela **más larga y algo épica, pero contenida**: ~160-180 caracteres, dos frases, rasgos físicos + un gesto ligado a su temática/poder (ej.: «Elfa etérea de túnicas verdes tejidas con hojas y enredaderas vivas. Su bastón, coronado por un orbe luminoso, despierta el bosque entero con apenas un susurro.»). Más larga desborda el dorso (el pergamino hace scroll, pero no abuses). Menciona solo armas de la tienda (1c).
2. **ComfyUI debe estar apagado** (`bash .claude/skills/crear-personaje/scripts/parar_comfyui.sh`; imágenes y audio no caben juntos en la GPU) y luego `bash .claude/skills/crear-personaje/scripts/asegurar_voz.sh` (sección 0).
3. Genera **una por carta de personaje** (nunca sin `--id`: sin él narraría también poderes y dones, que no se pidieron):
```bash
make audio ARGS="public/personajes/clases/<clase>/<clase>.json --id <id-carta>"
```
   Escribe `clases/<clase>/narraciones/<id>.mp3` y añade `narracion` al JSON justo tras `descripcion` (no lo edites a mano). Cada audio dura ~12-17 s; la primera llamada tarda más por la carga del modelo.
4. **La voz es un estándar ya aprobado**: el motor por defecto (Qwen3-TTS) **clona siempre la misma narradora** de `narracion/voz/` (mujer cálida, voz de cuento de fantasía), así todas las clases suenan igual. **No cambies de voz, motor (`--motor edge`) ni uses VoiceDesign** salvo que el usuario lo pida expresamente; si pide otra voz, se sustituyen `narradora.wav` y `narradora.txt` (ver `narracion/README.md`) y se regeneran todas.
5. Comprueba que el mp3 existe, que `narracion` quedó en el JSON y que el medallón aparece en el frente de la carta (`make catalogo`, o una captura con Chrome headless). Si cambias después la `descripcion`, regenera ese audio. No puedes escuchar el audio: dilo al usuario y pídele que lo escuche.

## 4. Efectos (`efectos.js`, `efectos.css`) y registro
Cada valor de `efecto` en `seleccion` necesita una función en `efectos.js` (ver `references/efectos.md`, con los patrones del druida: partículas, aura, tema de pantalla final y ambiente). Tema/paleta acorde a la temática de cada poder.
1. Crear `public/personajes/clases/<clase>/{<clase>.json,efectos.js,efectos.css,imagenes/...}`.
2. Registrar en `public/personajes/clases.json`: añadir `{ "id": "<clase>", "efectos": true }` (mantén el resto).
3. No tocar `public/index.html` ni `app/`: el catálogo carga cada clase de `clases.json` y permite elegir personajes desde ahí.

## 5. Textos que no caben (referencia: Bastión Sagrado del Paladín)
Las cartas miden 306×572 px y recortan lo que sobra. **Regla: si un texto no cabe, que sea scrollable; no lo recortes ni lo acortes si perdería claridad** (se prioriza la explicación clara de las habilidades). Patrón ya iterado en el paladín: en *Bastión Sagrado* la descripción larga hace scroll **solo en su párrafo** (`.bloque.especial .desc-p { max-height: 5.4em; overflow-y: auto; scrollbar-width: thin }` en `public/personajes/app/cartas.css`), mientras los ataques y las filas de la tabla quedan siempre visibles y nada se solapa. Imítalo: scrollea **el párrafo largo**, no la carta entera ni las filas.
Ya hay scroll en: la descripción de las cartas de poder (patrón anterior), `.pergamino` (dorso del personaje), `.bloque.desc` (descripción de dones) y `.cuerpo-p` como red de seguridad (`justify-content: safe center` evita perder la parte superior de textos centrados). Pasos:
1. `python3 .claude/skills/crear-personaje/scripts/revisar_desbordes.py <clase> --captura <scratchpad>` (Chrome headless; mide cada cara y detecta texto que se sale de su caja o de la carta salvo dentro de un contenedor con scroll; la captura PNG se revisa con Read). Paladín y druida dan 0 problemas: úsalos de contraste.
2. Si reporta `DESBORDE` en un elemento sin scroll: añade `overflow-y: auto; scrollbar-width: thin;` (y un `max-height` si hace falta, como el paladín) al párrafo o contenedor, en `clases/<clase>/efectos.css` o en `cartas.css` si afecta a todas las clases; repite hasta 0 problemas. Para nombres que desbordan en **ancho** (título, nombre de habilidad) acorta el nombre o baja `font-size` en ese selector: un nombre no se scrollea.
3. Reducir texto solo si es redundante; nunca a costa de dejar la habilidad ambigua.

## 6. Verificación (obligatoria)
- Armas: cada entrada de `clase.armas` figura en `tienda.js` (grupo "Armas") o en "Armaduras" si es el escudo.
- `make check CLASE=<clase>`: debe dar 0 errores y 0 avisos (sin "falta imagen", "imagen sin usar", "falta el audio" ni "audio sin enlazar"). **Las 2 cartas `personaje` deben tener su `narracion` y su mp3 en `clases/<clase>/narraciones/` (sección 3b); si falta, genéralo antes de terminar.**
- `revisar_desbordes.py <clase>`: 0 problemas (sección 5).
- `make catalogo` → http://localhost:8081: ver que la clase aparece, cartas con imágenes, la selección de 3 pasos funciona y los efectos se disparan (haz un recorrido con navegador si hay herramienta disponible).
- No hagas commit salvo que lo pidan. Resume al usuario: ids, poderes, dones, qué imágenes quizá quiera repetir y que escuche las narraciones (no puedes oírlas).
