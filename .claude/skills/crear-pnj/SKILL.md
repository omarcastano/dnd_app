---
name: crear-pnj
description: Crea un PNJ (personaje no jugador: tabernero, guardia, contrabandista, noble, sacerdotisa…) para la pestaña «PNJ» de La Taberna a partir de lo que dicta el usuario (descripción, nivel 1-7, nombre). Escribe su ficha en public/pnj/pnj.json (oficio, descripción, saludo, últimas palabras, reacción, trato, y dos ataques; vida, daño, botín y robo salen del mismo nivel del Bestiario), genera su retrato con ComfyUI/SDXL local desde la descripción (o usa la imagen que pase el usuario), su voz hablada con Qwen3-TTS VoiceDesign y la narración, y lo deja en el catálogo. Úsala cuando el usuario pida crear/añadir/dictar un PNJ, NPC o personaje no jugador.
---

# Crear un PNJ (pestaña «PNJ»)

El usuario **dicta** los PNJ: una descripción libre (quién es, oficio, carácter, aspecto) y, a veces, nivel y nombre. **Manténlo sencillo**: con lo que dicte, propón todo lo que falte de forma coherente y avanza sin preguntar; pregunta solo si falta el nivel y no se deduce (un pinche de cocina es N1, un capitán veterano N4-N5). Si dicta varios seguidos, créalos todos en tanda (imágenes en un solo lote, voces en otra), no uno a uno.

Esta skill es hermana de `crear-enemigo`: **léela para todo lo que aquí se remite a ella** (imágenes, voces, narración, botín, robo). Aquí solo va lo que cambia.

## 0. Cómo funciona un PNJ (y en qué se diferencia de una bestia)
- **Números = los del Bestiario.** Un PNJ de nivel N tiene la vida (4/5/6 jugadores), el daño básico/fuerte, el botín y el robo del Pícaro de la fila N de `niveles` en `public/enemigos/enemigos.json`. **No hay tabla propia ni números inventados**; si el usuario cambia esa tabla, cambia para bestias y PNJ a la vez.
- **Frente** de la carta: retrato, nombre, medallón ▶ de la narración y «Oficio ◆ Nivel II».
- **Dorso**: descripción → **Reacción** → **Trato** → **Ataques** (básico d20 5-15 y fuerte 16+).
- **Lo especial (la variación frente a las bestias)**. Las bestias meten su habilidad (DOT, miedo, aturdir…) en el golpe fuerte. Los PNJ no: su golpe fuerte es solo daño y lo especial es lo que hace a una persona distinta de un monstruo. Sale de cómo D&D 5e construye a sus PNJ (apéndice de PNJ del *Monster Manual*: *Parry* del Capitán bandido o del Noble, *Leadership* del Caballero, *Cunning Action* del Espía, *Brave* del Gladiador, *Pack Tactics* del Matón):
  1. **Reacción** (`reaccion`): **una vez por combate**, **fuera de su turno**, cuando el **grupo** hace algo concreto (falla un ataque contra él, cura a alguien, se le acercan dos, ataca al más débil, intenta huir, usa magia…). La dispara el grupo, no su d20. Es su recurso de combate.
  2. **Trato** (`trato`): se le puede ganar **sin pelear**. Dos formas (varíalas entre PNJ):
     - **Con tirada** (por defecto): `via` = Persuasión, Soborno, Intimidación, Engaño, Halagar su oficio («Persuasión: alabar su pan»)… Un jugador tira un d20 y lo logra con la cifra de su nivel o más (`reglas.trato_cd`: N1 10, N2 11, N3 12, N4 13, N5 14, N6 16, N7 18; la carta la pinta sola, **no la escribas en el texto**). Si además hay que pagar, el precio va en `via` («Persuasión o 2 monedas»). Esta mecánica gusta: mantenla.
     - **Sin tirada** (`"tirada": false`): algo que **hacen de verdad los jugadores en la mesa** y juzga el máster: contar un chiste que le haga reír, cantarle una canción, invitarle a una ronda, darle una comida de su inventario, ganarle un pulso o una partida de dados, recitarle un brindis, traerle algo concreto. La carta no muestra d20 y `descripcion` dice qué hay que hacer y qué da.
     - Si falla, ya no acepta más tratos en ese encuentro.
     - **Qué da (regla del usuario)**: **algo concreto y de su oficio**, nunca rumores, «lo que oyó anoche», información secreta ni pistas ambiguas. Ejemplos: el tabernero invita a una cerveza o sirve pan caliente (cada jugador recupera 1 de vida), el panadero regala una hogaza (1 comida de la tienda que cura 2), el herrero afila un arma (+1 de daño en el siguiente combate), el mercader hace descuento (1 moneda menos en la siguiente compra), el guardia deja pasar y deja de pelear. Premios pequeños: no rompas la economía de monedas ni la vida (como mucho 1 de vida por jugador o 1 objeto barato).
- **El panel de combate es idéntico al de las bestias (regla del usuario)**: jugadores, vida, reiniciar, botín y robo. **Nada propio del PNJ en el panel**: ni avisos de moral/«Duda»/rendición, ni lo que dice, ni botones extra. Lo que pasa con el trato o si se rinde lo gestiona el máster con lo que pone el dorso de la carta. Si se te ocurre otra mecánica, va en el dorso, no en el panel, y pregunta antes.
- Botín al llegar a 0 y robo del Pícaro: igual que las bestias (sec. 1b y 1c de `crear-enemigo`). Pon siempre `robo.texto` (dónde lo lleva: «Del delantal le cuelga la bolsa con la recaudación del día») y ajusta `robo.objetos` si tiene sentido (un mendigo lleva poco; un mercader, el del nivel o más).
- N6-N7: igual que en `crear-enemigo`, avisa de que son cifras de jefe antes de crear uno.

## 1. Diseño
Lee `public/pnj/pnj.json` (PNJ ya hechos: **no repitas nombres de reacción ni de ataque ni la misma condición de disparo**) y las habilidades de `public/enemigos/enemigos.json` y de las clases (`python3 .claude/skills/crear-personaje/scripts/inventario_clases.py`) para no copiar mecánicas.

**Catálogo de reacciones** (inspiración; varía, que no sean todas daño):
| Reacción | Se dispara cuando… | Qué hace |
|---|---|---|
| Parada | le aciertan un golpe | reduce ese golpe en 2-4 (según nivel) |
| Contraataque / «¡Aquí no se pelea!» | un jugador falla un ataque contra él | ese jugador recibe el daño `efecto` del nivel sin armadura |
| Paso atrás (acción astuta) | le atacan cuerpo a cuerpo | el ataque tiene −2; sale de su alcance |
| Grito de mando | el grupo le baja de la mitad | su siguiente ataque hace +2 (o llama a un perro/guardia que se lleva el siguiente golpe) |
| Desarmar | un jugador saca 1-4 contra él | le quita el arma hasta que gaste un turno en recogerla |
| Escudo humano | lo atacan estando junto a un rehén/aliado | el golpe va al otro |
| Arena a los ojos (truco sucio) | un jugador se le acerca | ese jugador tiene −2 a su siguiente tirada |
| Bebedizo | baja de la mitad de vida | se cura 2-4 una sola vez |
| Contrahechizo / Desprecio | alguien cura o usa una habilidad mágica | esa curación se reduce 2 |
| Soborno en pleno combate | un jugador le ofrece monedas | el trato se puede intentar aunque ya fallaron uno |
Presupuesto de potencia ≈ `efecto` del nivel (lo mismo que una habilidad de bestia de ese nivel); un control vale lo que 2 de daño.
- **Claridad** (regla de `crear-enemigo`): qué dispara la reacción, a quién afecta, cuánto (con número), cuánto dura y excepciones («la armadura no reduce este daño»). Sin metáforas que oculten la regla.
- **Saludo** (`saludo`) **obligatorio en todos**: lo que dice al encontrarlo, en su carácter y su oficio, 2-3 frases cortas (~100-150 caracteres). Ejemplo del tabernero: «¡Bienvenidos a mi taberna, forasteros! Pan recién horneado y cerveza bien fría. Pero aquí se compra o se vuelve uno por donde vino.» (ofrece lo suyo + avisa de su carácter: «el que no compra no es bienvenido»). **No se muestra en ninguna parte de la app (regla del usuario)**: es solo el guion de su voz, que suena al inicio de la narración con el ▶ de la carta, igual que el ruido de las bestias. Nada de bocadillos, citas ni botones extra para oírlo.
- **Últimas palabras** (`ultimas_palabras`) **obligatorias**: su grito o queja al caer («¡Ay, mi pan… mi taberna… quién va a hornear mañana!»). Tampoco se muestra: solo suena con `sonido_muerte` al dejarlo a 0.
- Sin groserías (memoria `vocabulario-sin-groserias`); el humor negro sí vale.
- **Descripción**: ~120-160 caracteres, dos frases: aspecto + cómo es/qué quiere. Más corta que la de las bestias, porque el dorso tiene un bloque más. Es lo que se narra.
- **Oficio** (`oficio`): corto («Tabernera», «Capitán de la guardia», «Contrabandista»); sale en el frente y en el título.
- **Ataques**: `{"golpe":"basico","nombre":"Jarrazo","subtitulo":"Ataque básico"}` y `{"golpe":"fuerte","nombre":"…","subtitulo":"Ataque fuerte"}`. Nombres con sabor a su oficio (el cucharón, la porra, el estoque).

## 2. Retrato (desde la DESCRIPCIÓN, no desde una foto)
El usuario dicta; **no hay figura que fotografiar**. Si en algún momento pasa una imagen suya, úsala tal cual (recórtala si hace falta y guárdala en `public/pnj/imagenes/<id>.webp`, WebP calidad 90) y sáltate la generación.
- Mismo flujo que `crear-enemigo` sec. 3 pero **txt2img** (sin `referencia` ni `fuerza`): `asegurar_comfyui.sh`, lote con `generar_imagen.py --lote` (tipo `retrato`), **8-12 candidatos** (3-4 prompts × 3 semillas), `hoja_contacto.py`, eliges, guardas en `public/pnj/imagenes/<id>.webp` y `parar_comfyui.sh`.
- Prompt en inglés: «fantasy comic book illustration, portrait of a <rasgos de la descripción: edad, complexión, ropa de su oficio, objeto típico>, <lugar: tavern, city gate, docks…>, dramatic lighting, dark fantasy, detailed, half body». Negativo: texto, marcas de agua, manos deformes. Que encaje con el estilo de las cartas de Héroes y Bestiario.
- Elige el que mejor cuenta la descripción (oficio reconocible de un vistazo, rasgos dictados) y explica qué descartaste. **Encuadre**: la carta recorta ~40 % del ancho; si la cara queda cortada, `"encuadre": "40% 20%"`.

## 3. Datos (`public/pnj/pnj.json`, lista `pnj`)
```json
{
  "id": "berta-la-tabernera", "nombre": "Berta la Tabernera", "nivel": 2, "oficio": "Tabernera",
  "descripcion": "…",
  "saludo": "¡Bienvenidos a mi taberna! ¿Una jarra? ¿Pan caliente? Aquí se paga antes de beber, y quien no compra, a la calle.",
  "ultimas_palabras": "¡Mi jarra… mi taberna… quién servirá mañana!",
  "reaccion": { "nombre": "¡Aquí no se pelea!", "descripcion": "La primera vez que un jugador falla un ataque contra ella, le estampa la jarra: ese jugador recibe 2 de daño que la armadura no reduce." },
  "trato": { "via": "Persuasión o 3 monedas", "descripcion": "Si se la convence (o se le paga la cuenta), deja de pelear e invita a una jarra: cada jugador recupera 1 de vida." },
  "ataques": [
    { "golpe": "basico", "nombre": "Jarrazo", "subtitulo": "Ataque básico" },
    { "golpe": "fuerte", "nombre": "Cucharón al rojo", "subtitulo": "Ataque fuerte" }
  ],
  "robo": { "texto": "Del delantal le cuelga la bolsa con la recaudación del día." },
  "sonido": "sonidos/berta-la-tabernera-voz.wav", "sonido_muerte": "sonidos/berta-la-tabernera-muerte.mp3"
}
```
Trato sin tirada: `"trato": { "via": "Contarle un chiste", "tirada": false, "descripcion": "Si el chiste la hace reír (decide el máster), suelta la jarra y regala una tarta de la cocina (cura 2)." }`.
No escribas `narracion` a mano. Valida: `python3 -c "import json;json.load(open('public/pnj/pnj.json'))"`. Las reglas generales (`reglas` del JSON: d20, reacción, trato, `trato_cd`) se tocan solo si el usuario lo pide.

## 4. Voz y narración
- **Todos los PNJ hablan**: `sonido` = **su `saludo` dicho con su voz, palabra por palabra** (suena al inicio de la narración, con el ▶ de la carta), `sonido_muerte` = **sus `ultimas_palabras`** (suena al dejarlo a 0). El texto del JSON y el audio deben coincidir: si cambias uno, regenera el otro (y la narración con `make audio`, que lleva el saludo delante). Método único: **Qwen3-TTS VoiceDesign** con `voz_diseno.py` (receta y reglas en `crear-enemigo` sec. 4b; **edge-tts prohibido para voces**). La descripción de la voz se adapta al PNJ y **puede ser de mujer** («Voz de mujer madura, potente y ronca, de tabernera malhumorada, regañando con fuerza.»). Pásale a `voz_diseno.py` exactamente `saludo` y `ultimas_palabras`; usa la semilla 1 salvo que suene mal (Bartolo y Zorvan usan la 1). Copia la toma elegida a `public/pnj/sonidos/<id>-voz.wav` y `<id>-muerte.mp3`. `grabar_sonido.py` solo escribe en el Bestiario: si el usuario quiere grabar la suya, que lo use con `--archivo` y mueve tú el resultado a `public/pnj/sonidos/` y al JSON.
- **Narración** (ComfyUI apagado, `asegurar_voz.sh`): narra descripción + reacción + trato (`texto_de()` de `narracion/generar_audio.py` ya lo hace con los campos `reaccion` y `trato`).
  - Mientras se revisa: `make audio-borrador ARGS="public/pnj/pnj.json --id <id>"` (queda anotado en `narracion/pendientes-voz-final.json`).
  - Voz final solo cuando el usuario dé el visto bueno: `make audio-final` (o `make audio ARGS="public/pnj/pnj.json --id <id>"`).
  - **No puedes escuchar los audios: díselo** y recuérdale que puede grabar su propia voz.

## 5. Verificación (obligatoria)
- Capturas (servidor sin caché, en serie, **nunca en paralelo**: comparten un archivo temporal):
  `python3 .claude/skills/crear-enemigo/scripts/captura_bestiario.py --pnj <id> --salida <scratchpad>/frente.png`, luego `--dorso` y `--robar`. Míralas con Read: frente (¿cara visible, ▶?), panel sin ningún texto de lo que dice el PNJ, dorso (todo cabe sin recortes: descripción, reacción, trato con «d20 N+» o sin él si `tirada: false`, ataques; si desborda, acorta textos, nunca encojas la letra) y robo con su texto; el panel debe ser igual que el de una bestia.
- `make check-css` y `make probar` (la pestaña `pnj` está en las pruebas; si cambia a propósito, `ACTUALIZAR=1`).
- **Sube la versión visible** (`.version-app` y `?v=` de `base.css` en `public/index.html`). No hagas commit ni despliegue salvo que lo pidan.

## 6. Resumen al usuario
Por cada PNJ: nombre, oficio, nivel con su vida (4/5/6) y daño (de `mostrar_tablas.py`), reacción (y por qué esa), saludo, últimas palabras, trato (con su cifra o la prueba sin tirada, y qué da), qué retratos descartaste, la frase de su voz y que no pudiste escuchar los audios. Señala lo que decidiste tú (nivel, nombre, oficio) para que lo corrija.

## Dónde vive el código (por si hay que tocarlo)
- `public/pnj/pnj.js` (carta) + `public/tienda/partes/pnj.html` + `tienda/js/secciones/pnj.js` (registro en `main.js`).
- Motor común con el Bestiario: `public/personajes/app/combate.js` (lista, vida 4/5/6, botín, robo). Estilos: `tienda/css/bestiario.css` acotado a `:where(#tab-bestiario, #tab-pnj)`; lo propio de PNJ lleva prefijo `pnj-`.
