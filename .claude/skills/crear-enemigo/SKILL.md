---
name: crear-enemigo
description: Crea un enemigo (bestia) para el Bestiario de La Taberna a partir de un nivel (1-7), un nombre y una foto de la figura. Genera varias imágenes con ComfyUI/SDXL local y elige la más parecida a la foto, toma vida, daño y botín de la tabla de niveles de public/enemigos/enemigos.json, diseña ataques y habilidades (veneno, sangrado, miedo…), genera la narración con Qwen3-TTS y lo deja en el catálogo. Úsala cuando el usuario pida crear/añadir un enemigo, bicho, monstruo o bestia.
---

# Crear un enemigo (Bestiario)

Entradas del usuario: **nivel** (1-7), **nombre** y **foto(s)** de la figura (ruta; a veces dos ángulos). Si falta algo, pregúntalo; si deja libertad (tipo, habilidad, descripción), propón todo coherente y avanza.

## 0. Principios (del trabajo ya hecho con el usuario; respétalos)
- **La tabla de niveles manda.** Vida, daño básico, daño fuerte y efecto salen de `niveles` en `public/enemigos/enemigos.json`. **Nunca inventes ni «mejores» números** al crear un enemigo. Los números los afina el usuario con su experiencia de juego: si pide cambiarlos, edita esa tabla (un solo sitio), sube la versión visible y **muestra la tabla N1-N7 actualizada** (memoria `enemigos-tabla-niveles-actualizada`).
- **Un solo tipo de enemigo por nivel** (nada de esbirro/soldado/élite): los enemigos de un mismo nivel comparten estadísticas y solo se diferencian por imagen, nombre, descripción, nombres de ataque y habilidad.
- **Daño fijo, no rangos.** Cada ataque es un número fijo, como en las cartas de personajes.
- **Botín por nivel (importantísimo, ver sec. 1b).** Todo enemigo, al llegar a 0 de vida, tira su botín; las probabilidades salen de la tabla de su nivel, nunca del enemigo.
- **Robo del Pícaro (ver sec. 1c).** Todo enemigo lleva objetos que el Pícaro puede robar; cada nivel define cuántos y de qué tipo.
- **Un enemigo por combate**; la dificultad la da la vida (escala con 4/5/6 jugadores) y el efecto, no la cantidad de enemigos.
- **Sin extras que no se pidieron** (contadores de ronda, barras, atajos…). El usuario los rechazó: manténlo simple.
- **Lee todo completo antes de decidir.** El usuario se ha quejado de análisis a medias: cuando una decisión dependa de datos (clases, tienda, tabla), léelos enteros.
- Todo en español (ids, textos, nombres de archivo). Ids y archivos en kebab-case sin tildes. Rutas relativas.

## 1. Contexto de balance (léelo antes de diseñar habilidades)
- **Jugadores**: 4, 5 o 6; **10 puntos de vida cada uno, fijos** (`VIDA_MAX` en `public/personajes/app/seleccion.js`; no suben de nivel). Empiezan sin armas, armadura, comida ni monedas (tal cual los JSON de `public/personajes/clases/`).
- **Escenarios**: ~4 peleas por escenario; **la vida no se recupera** al entrar a un escenario nuevo: solo con comida/bebida y habilidades de sanadores. Entre escenarios hay **una sola visita a la tienda**. Los cofres son aleatorios y mejores cuanto más avanzado el escenario; los bichos tendrán probabilidad de dejar botín (tabla por rehacer). La economía y el loot están **por definir**: la progresión es controlada y se afina sobre la marcha.
- **Tienda** (`public/tienda/js/datos/tienda.js`; las unidades son el **stock total de la campaña**): armaduras 4 pecheras (reduce 5), 4 cascos (3), 2 escudos (4) → un jugador puede llevar pechera + casco (hasta 8) y los escudos no alcanzan para todos; armas +1 a +3 (25 unidades); comida 23 y bebida 16 (curan 1-4, unos 85 PV en total); dados. **Un golpe acertado siempre hace al menos 1 de daño** tras la armadura. Por eso el daño directo de N4-N5 es alto (8-12) y lo que ignora la armadura (el **efecto**) es la presión fiable.
- **Daño de los jugadores** (cartas): ataque básico 1-2 (nivel 1) o 2-3 (nivel 2), DPS `5-11/12+`, tanque `7-13/14+`, sanador `9-15/16+`; las especiales valen casi lo mismo que el básico. Sin equipo, un grupo de 4 hace ~4 de daño por ronda; con equipo completo y nivel 2, ~14. Las vidas de la tabla salen de (daño del grupo por ronda × rondas que debe aguantar, ~3,4-3,5; menos en N1 tras el ajuste del usuario) y escalan ×1,3 con 5 y ×1,5 con 6 jugadores.
- **Ataques del enemigo por ronda**: 4 jug. → 1 por ronda; 5 → 1 y un segundo cada 3 rondas; 6 → 1 y un segundo cada 2 (cada ataque es otro d20 y puede ir a otro jugador). Esta regla vive en `reglas.ataques_por_ronda` del JSON (no se muestra en la UI).
- **Tirada del enemigo (d20)**: `1-4` falla, `5-15` golpe básico, `16+` golpe fuerte (dispara su habilidad). Es global (constante `D20` en `public/enemigos/bestiario.js` y `reglas.d20` del JSON); no lo cambies por enemigo.
- **Efecto** (`efecto` de la fila del nivel): puntos de daño **que ignoran la armadura** asociados al golpe fuerte (N1: sangrado 1 × 2 rondas = 2). La habilidad debe valer ese presupuesto.
- N6 (mini jefe) y N7 (jefe final) tienen cifras **viejas y pendientes de rehacer** (sin `efecto`): si te piden uno de esos niveles, avisa al usuario y acuerda con él los números antes de crear nada. Mini jefe: 2 habilidades; jefe final: 3 + una reacción al bajar de la mitad de vida; ambos escalan sus ataques por ronda con los jugadores.

## 1b. Botín (regla importante)
Al derrotar a un enemigo (vida a 0 en su vista) la app **tira el botín al azar y lo muestra** («Botín: Tarta de fresa · cura 2»). Está implementado en `public/enemigos/bestiario.js` y los datos viven en la fila del nivel (`botin` en `niveles` de `enemigos.json`), así que **un enemigo nuevo lo hereda solo al fijar su `nivel`; no hay que escribir nada de botín en el enemigo.**
- **Qué puede dejar**: nada; monedas (`monedas: [mín, máx]`); o **cualquier ítem de la tienda** (comida, bebida, dado, arma, armadura), elegido al azar entre los de `public/tienda/js/datos/tienda.js` (si la tienda cambia, el botín cambia solo).
- **Regla de diseño**: **cuanto más bajo el nivel, menos probable el botín bueno (armas y armaduras)** y más probable no dejar nada. Todos los enemigos pueden dejar cualquier ítem, pero a nivel bajo la probabilidad de armas/armaduras es muy baja. Con el nivel suben armas y armaduras y baja «nada».
- **Pesos** (% que suman 100; el usuario los afinará; N6 y N7 son provisionales). **La fuente de verdad es `enemigos.json`: para ver o mostrar las tablas vigentes ejecuta `python3 .claude/skills/crear-enemigo/scripts/mostrar_tablas.py` (niveles, botín y enemigos existentes) y no copies de aquí.** Esta tabla es solo una copia informativa y puede estar desactualizada:
  | Nivel | nada | monedas | comida | bebida | dado | arma | armadura | monedas |
  |---|---|---|---|---|---|---|---|---|
  | N1 | 25 | 47 | 14 | 9 | 2 | 2 | 1 | 1-2 |
  | N2 | 20 | 42 | 14 | 10 | 5 | 5 | 4 | 1-3 |
  | N3 | 15 | 36 | 14 | 10 | 7 | 10 | 8 | 2-4 |
  | N4 | 10 | 31 | 13 | 10 | 9 | 15 | 12 | 2-5 |
  | N5 | 8 | 26 | 12 | 10 | 9 | 18 | 17 | 3-6 |
  | N6 | 0 | 20 | 10 | 8 | 10 | 26 | 26 | 4-8 |
  | N7 | 0 | 15 | 8 | 7 | 10 | 30 | 30 | 6-10 |
- **Si el usuario cambia el botín**, edítalo en la fila del nivel (comprueba que los pesos suman 100), sube la versión y muestra la tabla de botín junto a la de niveles. Si pide un botín propio para un enemigo concreto, pregúntale cómo quiere que conviva con el del nivel antes de tocar el código.
- El botín se guarda en este dispositivo mientras el enemigo está derrotado y se descarta al subir la vida o reiniciar.

## 1c. Robo del Pícaro (regla importante)
La habilidad *Manos Ligeras* del Pícaro (`public/personajes/clases/picaro/picaro.json`): «el valor de la habilidad es el número de objetos que robas (**1 o 2**) y tú decides cuáles de los que lleve el enemigo» (nivel 2: además le haces un daño igual al número de objetos robados). Por eso **todo enemigo debe llevar objetos** entre los que el Pícaro elige.
- **Dónde vive**: `robo` en la fila del nivel (`niveles` de `enemigos.json`): `objetos` (**probabilidad de llevar 0, 1, 2… objetos**, suma 100; **escala con el nivel**: N1 lleva poco y puede no llevar nada, los jefes siempre llevan varios para que haya algo que elegir cuando roba 2), y **el tipo de cada objeto usa exactamente los pesos del botín** (lo que allí es «nada» pasa a monedas), de modo que armas, armaduras y dados son igual de raros al robar que al derrotar y suben igual con el nivel (no hay `pesos` propios en `robo`: se editan en `botin`). Los objetos salen de la tienda.
- **Qué hace la app**: en la vista del enemigo, el botón «Ver qué lleva» tira sus objetos (se guardan en este dispositivo); al tocar un objeto se marca como robado; «Reiniciar» lo borra. El daño del nivel 2 y el número de objetos (1 o 2) los lleva a mano el jugador, como el resto de la vida.
- **Robo ≠ botín**: el robo es lo que lleva encima y se puede quitar con vida; el botín es lo que aparece al derrotarlo. Son tiradas independientes.
- **Que tenga sentido (por enemigo)**: cada enemigo puede llevar `"robo": {"objetos": [1, 2], "texto": "…"}`: cambia la cantidad (un lobo lleva menos que un bandido; mínimo 1 para poder robar) y el `texto` explica dónde lo lleva (el lobo: «Entre las espinas de su lomo cuelgan restos de sus víctimas»). **Siempre añade `texto` y ajusta `objetos` a la criatura** (`"objetos": {"0": 40, "1": 45, "2": 15}`; animal: menos objetos que el nivel; humanoide/bruja/guerrero: el del nivel; dragón/jefe: el del nivel o más). **Puede no llevar nada**: la app muestra «No lleva nada». **Lo valioso** (armas, armaduras y dados de ataque, que dan +1d4) **es muy raro a nivel bajo** (N1: 2 % armas, 1 % armaduras, 2 % dados) y sube con el nivel; esto se controla en el `botin` del nivel.
- Si el usuario cambia el robo, edítalo en la fila del nivel (pesos suman 100), sube la versión y muestra la tabla con `mostrar_tablas.py`.

## 2. Diseño del enemigo
Lee `public/enemigos/enemigos.json` (enemigos ya hechos: **no repitas nombres de habilidad ni de ataque**) y las habilidades de las clases (`python3 .claude/skills/crear-personaje/scripts/inventario_clases.py`) para no copiar mecánicas.
- **Ataques (siempre 2)**: `{"golpe":"basico"}` (d20 `5-15`) y `{"golpe":"fuerte"}` (d20 `16+`). Su número sale del nivel; tú solo pones `nombre` y `subtitulo` (qué es: «Ataque básico», «Ataque que causa sangrado»…). El fuerte suele llevar la habilidad.
- **Habilidades por nivel**: N1-N5 una; N6 dos; N7 tres + reacción. Catálogo (aparece desde):
  | Habilidad | Desde | Notas |
  |---|---|---|
  | Veneno | N1 | daño al inicio del turno de la víctima, 2 rondas, ignora armadura |
  | Sangrado | N1 | 1 por ronda, 2 rondas, ignora armadura, no se acumula (el lobo) |
  | Miedo | N1 | −1 a −3 a las tiradas de ataque 2 turnos (como Embriagado) |
  | Quemadura | N2 | fuego, 2 rondas; **los dracónidos son inmunes** |
  | Maldición / Marca de presa / Furia | N2 | −1 a curaciones / +1-2 de daño al marcado / +1-2 con menos de la mitad de vida |
  | Aturdir / Perforante / Robo de vida | N3 | aturdir: pierde su siguiente turno (**los taurent son inmunes**); perforante ignora 1-3 de armadura |
  | Zarpazo en área / Coraza / Regeneración | N4 | 2 jugadores a la vez / reduce 1-2 el daño recibido / +1-2 vida por ronda |
  Estados que ya existen en el juego: veneno, miedo, aturdimiento, embriagado, provocado, marcado. El *Aliento Purificador* del Sacerdote los limpia. Tienes libertad creativa, pero respeta el presupuesto `efecto` del nivel y que la **armadura no reduzca** los efectos de estado.
- **Claridad (regla)**: la habilidad debe entenderse sola: **qué ocurre, a quién, cuánto (con número), cuánto dura, si se acumula y las excepciones** («La armadura no reduce este daño y el sangrado no se acumula»). Sin metáforas que oculten la regla. Los números del texto deben coincidir con `niveles` (el texto está escrito a mano; si cambian los números, hay que actualizarlo).
- **Descripción**: ~140-180 caracteres, dos frases, rasgos físicos + cómo ataca. Es lo que se narra.
- **Tipo** (`tipo`): «Bestia», «No-muerto», «Humanoide»… (sale en el frente: «Bestia ◆ Nivel I»).

## 3. Imágenes (ComfyUI + SDXL local; no hay ControlNet ni IP-Adapter, solo img2img)
Orden obligatorio: **imágenes primero, audio después**, nunca a la vez (GPU de 12 GB; ver `crear-personaje` sec. 0). Usa el scratchpad para todo lo temporal.
1. `bash .claude/skills/crear-personaje/scripts/asegurar_comfyui.sh` (puede tardar minutos: se mueve a segundo plano; espera con `curl http://127.0.0.1:8188/system_stats`, no repitas el comando). **Si falta ComfyUI/SDXL (código 2): pídele permiso al usuario (descarga de varios GB) y reejecuta con `--instalar`.** Otros códigos: lee el mensaje y `~/ia/comfyui.log`; no cambies de modelo ni uses servicios externos.
2. **Mira la foto con Read** y recórtala a la figura (PIL, ~730×670 px alrededor del bicho; sin el fondo de escritorio). Con dos ángulos, úsalos ambos. Anota los rasgos distintivos (la cresta de espinas del lobo era lo más importante: describe **esos rasgos en el prompt**).
3. Genera **al menos 15-20 candidatos** con `generar_imagen.py --lote` (tipo `retrato`, 907×1117): foto de referencia × fuerzas **0,55 / 0,68 / 0,74 / 0,80 / 0,86** × 2-3 semillas. Aprendido: `≤0,6` sale casi la foto (miniatura sobre una mesa, nada de estilo cómic); `0,74-0,86` da estilo cómic conservando pose y rasgos; por encima pierde rasgos. Si los rasgos distintivos salen flojos, repite con un prompt que los enfatice. Prompt en inglés: descripción del animal/criatura + rasgos + entorno oscuro de noche.
4. `python3 .claude/skills/crear-enemigo/scripts/hoja_contacto.py <scratchpad>/lobo*.webp --salida <scratchpad>/hoja.png` y mírala con Read. **Elige la más parecida a la foto** (pose, rasgos, colores, proporciones), sin texto raro ni anatomía rota; explica la elección al usuario y di qué descartaste.
5. Guarda la elegida en `public/enemigos/imagenes/<id>.webp` (WebP, calidad 90).
6. **Encuadre**: la carta es mucho más estrecha que la imagen (recorta ~40 % del ancho). Mira la carta (sec. 6) y, si queda cortada la cabeza o el rasgo clave, añade `"encuadre": "12% 50%"` (CSS `object-position`) en el JSON. Si el animal sale muy apaisado y pierde lo importante, regenera más compacto.
7. **Apaga ComfyUI al terminar**: `bash .claude/skills/crear-personaje/scripts/parar_comfyui.sh` (nunca `pkill -f` con un nombre que aparezca en tu propia línea de comandos: mata tu shell).

## 4. Datos (`public/enemigos/enemigos.json`)
Añade a `enemigos` (el catálogo lo lee solo; no hay que registrar nada más):
```json
{
  "id": "lobo-espinoso", "nombre": "Lobo Espinoso", "nivel": 1, "tipo": "Bestia", "encuadre": "12% 50%",
  "descripcion": "…",
  "ataques": [
    { "golpe": "basico", "nombre": "Mordisco", "subtitulo": "Ataque básico" },
    { "golpe": "fuerte", "nombre": "Desgarro espinoso", "subtitulo": "Ataque que causa sangrado" }
  ],
  "sonido": "sonidos/lobo-espinoso-aullido.wav", "sonido_muerte": "sonidos/lobo-espinoso-muerte.mp3",
  "robo": { "objetos": { "0": 40, "1": 45, "2": 15 }, "texto": "Entre las espinas de su lomo cuelgan restos de sus víctimas." },
  "habilidades": [ { "nombre": "Sangrado", "descripcion": "…" } ]
}
```
No escribas `narracion` a mano (la añade el script de audio). Valida: `python3 -c "import json;json.load(open('public/enemigos/enemigos.json'))"`.

## 4b. Sonidos de la bestia (AudioLDM2 local; van ANTES de la narración)
Cada bestia lleva **dos sonidos propios de su criatura**, en `public/enemigos/sonidos/`:
- `sonido` (p. ej. `"sonidos/lobo-espinoso-aullido.wav"`): **efecto final de la narración** (aullido, rugido, siseo…); `generar_audio.py` lo pega tras la voz (0,4 s de silencio, volumen un poco bajo el de la voz, fundido final) y queda un solo mp3.
- `sonido_muerte` (p. ej. `"sonidos/lobo-espinoso-muerte.mp3"`): **se reproduce solo cuando la vida llega a 0** (quejido/estertor de la criatura; la app lo hace al tocar el botón que la deja en 0, no al abrir la vista).
**Adecúalos a la criatura**, no uses el del lobo para todas. Prompts en inglés (punto de partida; el modelo no es fiable con voces humanas):
| Criatura | `sonido` (final de la narración) | `sonido_muerte` |
|---|---|---|
| Lobo / animal | `a lone wolf howling at night, long mournful howl, quiet forest, natural echo` | `a wolf yelping and whimpering in pain, a short dying cry that fades into a weak breath` |
| Dragón | `a huge dragon roaring, deep echoing growl` | `a dragon roaring in agony then collapsing, deep fading groan` |
| No-muerto | `an undead groaning, hollow rasping moan, eerie` | `an undead moaning and crumbling to dust, fading rattle` |
| Diablo | `a demon growling deeply, low menacing snarl` | `a demon screeching in pain and fading away` |
| Bruja / guerrero (voz humana) | **el modelo suele fallar**: pide al usuario una grabación libre de derechos | idem |
Proceso (**solo con ComfyUI apagado**; la GPU no admite a la vez imágenes, sonidos y narración):
1. Modelo: `cvssp/audioldm2` (~4,5 GB en la caché de Hugging Face, ya descargado; licencia CC BY-NC-SA 4.0, solo uso no comercial) y dependencias del grupo `sonidos` del `pyproject.toml` (`make setup`). Si faltan, **pide permiso antes de descargar**.
2. Genera **6 candidatos de cada sonido**: `.venv/bin/python narracion/generar_sonido.py --prompt "…" --salida <scratchpad>/sonidos --prefijo <id>-aullido --candidatos 6 --segundos 6 --pasos 100 --mp3` (muerte: ~4 s). ~15-40 s por candidato.
3. **No puedes escuchar audio**: deja los candidatos en una carpeta con su ruta completa y pide al usuario que elija. Mientras tanto usa el primero de forma provisional y dilo. Copia los elegidos a `public/enemigos/sonidos/` (`sonido` en `.wav` tal cual; `sonido_muerte` en `.mp3`) y escribe los campos en el JSON.
4. **Monitoriza la generación** (Monitor sobre el log y los archivos) y **lee el log cuando el proceso termine**: una vez se cayó por un error y se dio por «en marcha». Aprendido: con `transformers` reciente AudioLDM2 falla («GPT2Model no tiene `_update_model_kwargs_for_generation`»); el script ya lo parchea, no lo toques. Un candidato tarda segundos, no minutos: si no hay archivos nuevos en 1-2 minutos, algo falla.

## 5. Narración (Qwen3-TTS, voz clonada de `narracion/voz/`)
Solo con ComfyUI apagado. `bash .claude/skills/crear-personaje/scripts/asegurar_voz.sh` (código 2 → pide permiso, `--instalar`; 3 falta la voz de referencia; 4 poca VRAM → `parar_comfyui.sh`). Luego:
```bash
make audio ARGS="public/enemigos/enemigos.json --id <id>"
```
El audio narra **la descripción y la habilidad** («… Habilidad, Sangrado. Si el Desgarro…») y, si el enemigo tiene `sonido` (sec. 4b), lo añade al final, se guarda en `public/enemigos/narraciones/<id>.mp3` y se enlaza en el JSON. La carta muestra el medallón ▶ en el frente. Dura ~25 s. **No puedes escucharlo: díselo al usuario.** No cambies la voz ni el motor. Si cambias después la descripción o la habilidad, regenera el audio.

## 6. Verificación (obligatoria)
- Servidor sin caché: `make catalogo` (puerto 8081) o, si ya corre, reutilízalo. Captura: `python3 .claude/skills/crear-enemigo/scripts/captura_bestiario.py --enemigo <id> --salida <scratchpad>/frente.png` (y `--dorso`). Mira las dos con Read: frente (¿se ve la cabeza y el rasgo clave? ¿botón ▶?) y dorso (¿todo cabe sin recortes? orden: descripción, habilidad, ataques, vida). Comprueba que la vista del enemigo muestra el corazón con la vida correcta (4/5/6 jugadores).
- Los números de la carta deben coincidir con la fila del nivel en `niveles`.
- **Sonido de muerte**: comprueba que el archivo de `sonido_muerte` existe y se sirve (`curl -I`); en el navegador suena al dejar la vida en 0.
- **Robo**: `captura_bestiario.py --enemigo <id> --robar --salida …` debe mostrar el `texto` del enemigo y un objeto marcado como robado.
- **Botín**: derrota al enemigo (`captura_bestiario.py --enemigo <id> --derrotar --salida …`) y comprueba que aparece «Derrotado» y un botín. Su nivel debe tener `botin` con pesos que sumen 100.
- **Sube la versión visible**: `.version-app` en `public/index.html` (`0.0.N`) y el `?v=` de `base.css`; si tocaste `bestiario.css`, también su `?v=`. Una subida por iteración entregada.
- No hagas commit ni despliegue salvo que lo pidan.

## 7. Resumen final al usuario
Ejecuta `mostrar_tablas.py` y pega sus tablas. Di: enemigo, nivel, vida (4/5/6), daño básico/fuerte, efecto y habilidad (por qué esa y con qué presupuesto), qué candidatos de imagen descartaste y por qué, que no pudiste escuchar el audio y la **tabla de niveles vigente** (con su botín). Señala cualquier decisión que tomaste por tu cuenta (tipo, nombres de ataque) para que la corrija.
