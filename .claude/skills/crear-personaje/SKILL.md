---
name: crear-personaje
description: Crea una clase de personaje completa para el juego de D&D de La Taberna (JSON, imágenes generadas con ComfyUI/SDXL local, efectos, registro en el catálogo `public/personajes/index.html`), usando la clase Druida como plantilla exacta. Úsala cuando el usuario pida crear/añadir un personaje, clase o héroe nuevo, ya sea desde una descripción detallada o desde una imagen de referencia.
---

# Crear una clase de personaje

Hay **dos clases de referencia** ya iteradas; léelas siempre (JSON, `efectos.js`/`efectos.css` y mira sus imágenes con Read) antes de crear nada y úsalas como contexto:
- **Druida** (`public/personajes/clases/druida/`): plantilla base de **2 poderes + 2 dones** (18 imágenes).
- **Paladín** (`public/personajes/clases/paladin/`): referencia de **3 roles** (tanque / sanador / DPS), de descripciones claras y de texto largo con scroll (24 imágenes).
Toda clase nueva replica su estructura, cantidad de cartas y convención de imágenes. No inventes otro esquema. Idioma: todo en español (ids, textos); archivos y ids en kebab-case sin tildes.

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
| Cartas `personaje` | 2 | Versión hombre y mujer (mismo `raza`; `reglas_raza` = habilidades de raza, **las que hagan sentido, sin tope de 2**), con `descripcion` física breve |
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
- ComfyUI v0.46.0 en `~/ia/ComfyUI`, escuchando en `http://127.0.0.1:8188`; modelo **Stable Diffusion XL Base 1.0** (`sd_xl_base_1.0.safetensors`, en `models/checkpoints`). No uses otro modelo ni servicio externo.
- **Antes de generar, asegura el despliegue**: `bash .claude/skills/crear-personaje/scripts/asegurar_comfyui.sh`. Es idempotente: si ya responde en :8188 no hace nada; si está instalado pero apagado lo arranca (`~/ia/ComfyUI` con `~/ia/.venv/bin/python main.py --listen 127.0.0.1 --port 8188`, log en `~/ia/comfyui.log`) y espera a que responda; si falta ComfyUI, el entorno (`uv`, Python 3.12, PyTorch cu128) o el checkpoint, lo indica y termina con código 2. En ese caso **pregunta al usuario** (clonar ComfyUI v0.46.0 y descargar ~7 GB) y, con su OK, ejecuta `asegurar_comfyui.sh --instalar`. Si el arranque falla, lee `~/ia/comfyui.log` y corrige la causa (puerto ocupado, VRAM, dependencias) en vez de saltarte la generación. Nunca sustituyas el modelo por otro ni por un servicio externo.
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

## 4. Efectos (`efectos.js`, `efectos.css`) y registro
Cada valor de `efecto` en `seleccion` necesita una función en `efectos.js` (ver `references/efectos.md`, con los patrones del druida: partículas, aura, tema de pantalla final y ambiente). Tema/paleta acorde a la temática de cada poder.
1. Crear `public/personajes/clases/<clase>/{<clase>.json,efectos.js,efectos.css,imagenes/...}`.
2. Registrar en `public/personajes/clases.json`: añadir `{ "id": "<clase>", "efectos": true }` (mantén el resto).
3. No tocar `public/personajes/index.html` ni `app/`: el catálogo carga cada clase de `clases.json` y permite elegir personajes desde ahí.

## 5. Textos que no caben (referencia: Bastión Sagrado del Paladín)
Las cartas miden 306×572 px y recortan lo que sobra. **Regla: si un texto no cabe, que sea scrollable; no lo recortes ni lo acortes si perdería claridad** (se prioriza la explicación clara de las habilidades). Patrón ya iterado en el paladín: en *Bastión Sagrado* la descripción larga hace scroll **solo en su párrafo** (`.bloque.especial .desc-p { max-height: 5.4em; overflow-y: auto; scrollbar-width: thin }` en `public/personajes/app/cartas.css`), mientras los ataques y las filas de la tabla quedan siempre visibles y nada se solapa. Imítalo: scrollea **el párrafo largo**, no la carta entera ni las filas.
Ya hay scroll en: la descripción de las cartas de poder (patrón anterior), `.pergamino` (dorso del personaje), `.bloque.desc` (descripción de dones) y `.cuerpo-p` como red de seguridad (`justify-content: safe center` evita perder la parte superior de textos centrados). Pasos:
1. `python3 .claude/skills/crear-personaje/scripts/revisar_desbordes.py <clase> --captura <scratchpad>` (Chrome headless; mide cada cara y detecta texto que se sale de su caja o de la carta salvo dentro de un contenedor con scroll; la captura PNG se revisa con Read). Paladín y druida dan 0 problemas: úsalos de contraste.
2. Si reporta `DESBORDE` en un elemento sin scroll: añade `overflow-y: auto; scrollbar-width: thin;` (y un `max-height` si hace falta, como el paladín) al párrafo o contenedor, en `clases/<clase>/efectos.css` o en `cartas.css` si afecta a todas las clases; repite hasta 0 problemas. Para nombres que desbordan en **ancho** (título, nombre de habilidad) acorta el nombre o baja `font-size` en ese selector: un nombre no se scrollea.
3. Reducir texto solo si es redundante; nunca a costa de dejar la habilidad ambigua.

## 6. Verificación (obligatoria)
- Armas: cada entrada de `clase.armas` figura en `tienda.js` (grupo "Armas") o en "Armaduras" si es el escudo.
- `make check CLASE=<clase>`: debe dar 0 errores y 0 avisos (sin "falta imagen" ni "imagen sin usar").
- `revisar_desbordes.py <clase>`: 0 problemas (sección 5).
- `make catalogo` → http://localhost:8081: ver que la clase aparece, cartas con imágenes, la selección de 3 pasos funciona y los efectos se disparan (haz un recorrido con navegador si hay herramienta disponible).
- No hagas commit salvo que lo pidan. Resume al usuario: ids, poderes, dones, qué imágenes quizá quiera repetir.
