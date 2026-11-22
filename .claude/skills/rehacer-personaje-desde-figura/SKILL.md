---
name: rehacer-personaje-desde-figura
description: Rehace una clase de personaje YA existente de La Taberna a partir de fotos de la miniatura/figura real (p. ej. cambiar la raza a dracónido): regenera retratos de las dos cartas de personaje y las imágenes de los dones para que se parezcan a la figura y combinen con la nueva raza, y reajusta raza, descripciones, reglas de raza y habilidades para que tengan sentido. Úsala cuando el usuario pase fotos de figuras físicas (frente, espalda…) y pida actualizar el aspecto o la raza de un personaje que ya existe. Para crear una clase desde cero usa `crear-personaje`.
---

# Rehacer un personaje desde fotos de su figura

**Entrada**: las fotos de la miniatura real (de frente, de espalda…), la **clase** a actualizar (si no la dice, deduce por la figura: yunque/maza → sacerdote-enano o paladín; **si hay duda, pregunta una sola vez**) y la **raza nueva**. Se apoya en la skill `crear-personaje` (motor de imágenes, voz, scripts y reglas de armas/balance); léela para las rutas y convenciones.

## 0. Leer antes de tocar
1. Mira las fotos con Read. Anota: tipo de cabeza/rasgos de la raza, armadura, prendas (tabardo, delantal, capa), **arma en mano y cómo la sostiene**, escudo, objetos del entorno (yunque…), pose.
2. Lee `public/personajes/clases/<clase>/<clase>.json` completo y mira con Read los retratos actuales y las imágenes de los dones.
3. Armas: solo las de la tienda (sección 1c de `crear-personaje`). Una figura con «martillo» = **Maza**. No inventes armas; si la figura lleva algo que la clase no puede usar, no lo fuerces.
4. **Raza en español**: la traducción habitual es la oficial (Dragonborn → *Dracónido/Dracónida*). Propónla y deja la opción de dejarla en inglés; no preguntes más.

## 1. Retratos (hombre y mujer) — imágenes
Etapa de imágenes de `crear-personaje`: `bash .claude/skills/crear-personaje/scripts/asegurar_comfyui.sh`; al terminar, `parar_comfyui.sh`. Todo lo intermedio va al **scratchpad**, nunca al proyecto hasta elegir.

Lecciones aprendidas (importantes):
- **No uses la foto como `--referencia` (img2img)**: la figura es gris sobre fondo oscuro y el modelo copia el gris y **pierde los rasgos de la raza** (sale un humano). Describe la figura con **prompt solo de texto**.
- Prompt en inglés con peso a la raza: `(dragonborn:1.4) paladin with a lizard dragon head, scaly snout, crest of short spikes…`, `no hair, no human face`. Luego armadura, prenda, **el arma en la mano** (`holding a big war hammer in his right hand`) y colores de la clase (plata y oro, etc.).
- **Fondo bonito, nunca plano**: añade siempre el fondo de las demás cartas de la clase (p. ej. arco de templo de piedra con halo dorado y pilares). Si sale fondo liso, repite.
- Genera **6-8 semillas en un lote** y compón una **hoja de contactos** (PIL, miniaturas 453×558) para elegir de un vistazo; mira solo la hoja, no cada imagen. Elige tú **la que más se parezca a la figura** sin preguntar demasiado; si el usuario dice «elige tú», decide y avanza.
- Versión femenina: mismo prompt con `female`, mismo fondo y mismo arma; elige la que mejor haga pareja (misma pose) con la masculina.
- **Elementos que SDXL ignora** (p. ej. un yunque): no insistas con pesos. Genera el objeto **aparte** sobre fondo blanco (`a single large iron blacksmith anvil, side view… plain white background`), quítale el fondo con relleno desde los bordes (umbral `min(r,g,b)>225`), escálalo (~330 px de ancho) y **pégalo en el suelo junto a los pies** con PIL (`alpha_composite`) sobre ambos retratos. Si hay varios yunques generados, elige el que se lea como tal.
- Tamaño final del retrato 907×1117 `.webp`; sobrescribe `imagenes/<id-carta>.webp` y revisa con Read.

## 2. Imágenes de los dones
Las ilustraciones de los dones (800×800, tipo `don`) suelen mostrar figuras humanas: **si cambia la raza, regenéralas** para que combinen con los retratos.
- Mantén la **escena** de cada don (arrodillado con alas de luz; escudo y cúpula; fuego sagrado) con el mismo sujeto dracónido: `(dragonborn:1.4) paladin … wearing ornate gold and silver plate armor, <escena>`. Usa las armas de la clase (maza, espada corta, escudo).
- **4 semillas por don (12 imágenes en un lote)** y hoja de contactos; elige una por don y cópiala sobre `imagenes/<don>.webp`.
- Los iconos de habilidad y portadas de poder no suelen cambiar con la raza (símbolos): déjalos salvo que muestren una figura.

## 3. Procesos colgados (importante)
`asegurar_comfyui.sh` puede **quedarse esperando aunque ComfyUI ya responda**. Comprueba con `curl -s -m 5 http://127.0.0.1:8188/system_stats` (200 = listo). Si el script lleva más de ~1-2 min sin avanzar: **mata esos PID concretos** (`ps aux | grep asegurar_comfyui`, `kill <pid>`; nunca `pkill -f` con el nombre) y lanza `generar_imagen.py --lote` directamente. Generar es rápido (~10 s/imagen; 12 en 1-2 min). Ejecuta la generación en una sola llamada con `timeout`, no encadenada detrás del script de arranque.

## 4. JSON: que la raza tenga sentido en TODO
Revisa el JSON entero, no solo `raza`:
- `raza` de las dos cartas (Dracónido / Dracónida).
- `descripcion` de las cartas de personaje: rasgos de la figura (escamas, cresta, arma, objeto) en ~160-180 caracteres, 2 frases, solo armas de la tienda.
- `reglas_raza` (ambas cartas): **reemplaza las de la raza anterior** (p. ej. «los humanos repiten una tirada»). Deben ser **pasivas** (sin tirada ni «una vez por tablero»: eso son los dones), nuevas respecto a las demás clases (corre `inventario_clases.py`) y de potencia comparable (p. ej. «+1 punto de vida máximo por las escamas», «inmunes al daño de fuego»). Una regla activa con d20 fue rechazada por parecerse a un don.
- Descripciones de poderes y dones que mencionen cuerpo/origen de la raza anterior («tus manos…», «se envuelve en fuego…»): ajústalas a la nueva (manos escamosas, sangre dracónica…). **No cambies números, rangos, nombres de habilidad ni mecánicas** que no dependan de la raza. Muchas veces basta con cambiar una palabra.
- Busca restos: `grep -i "humano\|humana\|<raza anterior>"` sobre el JSON y los `efectos.js/css` de la clase; debe dar 0.
- Apellidos que suenen a la raza antigua: **solo avisa** (cambiarlos toca ids, imágenes y audios); no los cambies sin que lo pidan.
- Respeta las reglas de balance y variedad de `crear-personaje` (secciones 0b y 2b).

## 5. Audio
Si cambiaste las `descripcion` de los personajes hay que **regenerar su narración** (el audio narra esa descripción): con ComfyUI apagado (`parar_comfyui.sh`), `asegurar_voz.sh` y luego `make audio ARGS="public/personajes/clases/<clase>/<clase>.json --id <id-carta>"` por cada carta. No puedes oírlos: pide al usuario que los escuche.

## 6. Cierre
1. **Sube la versión** en `public/index.html` (`.version-app` y `?v=` de `base.css`, +1 en cada iteración entregada).
2. `make check CLASE=<clase>` → 0 errores, 0 avisos. Intenta `revisar_desbordes.py <clase>`; si Chrome no devuelve resultado, dilo y pide mirar el dorso de las cartas (los textos nuevos pueden ser más largos).
3. `parar_comfyui.sh` al terminar. No hagas commit salvo que lo pidan.
4. Resumen breve: qué imágenes se cambiaron y cuáles quedan como alternativas en el scratchpad, qué reglas/textos se ajustaron, qué no se pudo verificar (audio, desbordes) y qué decisiones quedan abiertas (apellidos, nombre de la raza en inglés).

## Estilo de trabajo con el usuario
- Prioridades que fijó: **parecido a la figura** > estética; fondo bonito, nunca plano; objetos de la foto (arma en mano, yunque) deben aparecer.
- Si dice «elige tú / no me preguntes», decide con tu criterio y entrega; muestra el resultado, no un cuestionario.
- Haz siempre también la **versión femenina**, aunque solo haya foto de una figura.
- Lotes grandes para elegir están bien; los procesos colgados no.
