---
name: rehacer-capitulo-por-escenas
description: Convierte (o revisa) un capítulo del Libro de campañas de La Taberna (pestaña Mapas, public/mapas/campanas.json) al formato «por escenas» del capítulo I de «El Aliento Helado», que es la referencia pulida. Red de escenas con narración + decisión tras cada evento, opciones coherentes con marcas, enigma obligatorio, textos comprobados contra la imagen del mapa, coherencia con los capítulos anterior y siguiente, audios de borrador (edge-tts) de todo lo que se lee y validación de todos los caminos. Úsala cuando el usuario pida rehacer, pasar a escenas, mejorar o revisar las decisiones o la historia de otro capítulo o campaña del libro.
---

# Rehacer un capítulo por escenas (Libro de campañas)

La referencia es el **capítulo I de «El Aliento Helado» («Los muelles callados»)**: léelo entero antes de empezar: su guion es `public/mapas/guiones/el-aliento-helado-1.json` y su vista legible, `guiones/el-aliento-helado-1.md`. Esquema y flujo de trabajo: `guiones/LEEME.md`. Todo lo que sigue son las reglas que el usuario fue pidiendo, una a una, hasta dejar ese capítulo como quería. **Trabaja un solo capítulo cada vez**, impleméntalo entero y entrégalo para que el usuario lo revise; no toques otros capítulos ni campañas sin que lo pida.

Lee también `CLAUDE.md` (formato de datos, reglas del juego, convenciones, pruebas).

## Reglas de la historia (lo que el usuario exige)

1. **Tras cada evento, narración y nueva decisión.** Después de cada combate, enigma, desvío, puerta cerrada, descubrimiento o situación hay: (a) narración de lo que pasó («Tras el combate»: campo `despues`), (b) una pregunta y (c) opciones. Nunca «vuelve solo al camino». Las únicas excepciones son las escenas `sigue` (una emboscada o una consecuencia que lleva directamente a otra escena, normalmente a un combate) y el `fin`.
2. **Opciones lógicas, nada aleatorio.** Cada opción tiene que llevar a un desenlace que se deduzca de lo que el grupo eligió y sabe. Si una opción lleva a los lobos, la narración explica por qué aparecen allí (el ruido de los golpes, que siguieron el rastro…). La `nota` de la opción le dice al máster qué pasará y el «Cómo empieza» de la carta de combate la reutiliza.
3. **No cerrar posibilidades (agotar lugares).** Un lugar no desaparece de las opciones hasta que el grupo lo **visita de verdad**. Verlo de pasada desde otra escena no cuenta: en el capítulo I, «rodear el almacén» pasaba junto a la barca y la marcaba como vista, y la barca desapareció de las opciones. Desde cada escena «hub» se puede ir a cualquier sitio pendiente; usa `opciones_comunes` y la entrada `{ "comunes": id, "si": [...], "salvo": [...] }` dentro de una lista para no repetir opciones. Solo queda una opción cuando ya se ha hecho todo lo demás.
4. **El enigma no se salta.** Puede haber alternativas («dejamos el cuaderno y registramos la casa a golpes»), pero acaban en «no encontramos nada, no queda otra que resolverlo» y llevan al enigma (escena `sigue` hacia la del enigma). Si **fallan** el enigma (se quedan sin intentos) tampoco hay atajo gratis («buscamos y la encontramos»): solo queda **pagar un precio**. En el capítulo I, una inscripción en la tapa del cuaderno («Lo que la cabeza no abre, la sangre lo abre») exige una **ofrenda de sangre**; la hacen, la página se abre y encuentran la llave. La narración dice que hay que hacer la ofrenda, y la nota del máster dice que él decide cuánta vida pierde cada héroe (no fijes la cifra). Busca un precio parecido que encaje con cada historia: sangre, mejor que dinero. La escena del enigma pregunta «¿Lo habéis descifrado?» con una opción para «Sí» y otra para «No».
5. **Toda necesidad del grupo se explica en la historia.** Si necesitan algo (fuego, una llave, una cuerda), la narración tiene que dejar claro **para qué** y **por qué no vale lo obvio**. En el capítulo I el usuario no entendía por qué hacía falta fuego para la barca. Se resolvió así: la barca es la única forma de llegar al faro; mar adentro hay una niebla helada tan espesa que solo se cruza con el farol de proa encendido; la niebla apaga el fuego normal (la yesca y las brasas de la chimenea fallan) y solo aguanta el fuego de diablo del brasero.
6. **Cada enemigo tiene un papel y un motivo claros.** Quién es, qué hace allí, por qué ahora y qué relación tiene con el villano de la campaña. En el capítulo I el trovador (sátiro) es el contrabandista de la Hermandad: desde que Tormund desapareció, usa su barca cada noche de niebla para llevar el aceite del almacén al faro. Se cuenta tres veces: el diablillo lo dice si le dan pan, aparece en una hoja de carga tras el combate y el propio sátiro lo canta. Añádelo también a `personajes` (rol, cómo interpretarlo, qué sabe).
7. **La taberna es el lugar de reposo.** Al volver se dice siempre «volver a la taberna», nunca «volver al pueblo» («Volvemos a la taberna y zarpamos al alba»).
8. **Pistas que empujan al siguiente capítulo.** Las pistas, objetos y amenazas apuntan al lugar del capítulo siguiente (en el capítulo I: el faro, la llama azul, la moneda con la gárgola de Vórtiga, el gorro y las huellas de garra de Tormund). Las opciones opcionales dan pistas o recursos (comida, información, debilitar al enemigo del capítulo siguiente: «echar el aceite al mar»), pero nunca son obligatorias.
9. **Marcas coherentes.** Las escenas visitadas y sus `marca` (llave, ruido, chimenea, trasera-abierta…) deciden qué opciones se ven y cómo empieza un combate. Por ejemplo, con `ruido` los esperan y no hay sorpresa: es otra escena distinta (`almacen-grua` frente a `almacen-grua-esperados`). Las marcas que importan al máster van en `estados`, con texto y un icono de Font Awesome. Una marca que esconde un lugar solo la pone la escena que lo explora.

## Reglas del mapa (comprobar siempre contra la imagen)

El usuario detectó errores que salían de no mirar la imagen:
- la grúa «vista desde las rendijas», cuando está detrás del almacén;
- «trepar por la grúa» y encontrarse con los lobos;
- el «agua negra», cuando el agua del mapa es **azul**;
- un «islote» que era una lengua de arena;
- una escalera que era una rampa;
- cuencos en la mesa que estaban en la encimera;
- bloques de hielo en el canal que no existían;
- vigilar el muelle desde una ventana que el acantilado tapaba.

Por eso:
1. **Mapa primero.** Antes de escribir, genera la rejilla y los recortes con `scripts/mapa_rejilla.py` y **míralos con Read**: el mapa entero y las 9 zonas ampliadas.
2. **Escribe la geografía** en el campo `geografia` del capítulo, que se muestra en la guía del máster como «Cómo es el mapa». Debe recoger:
   - qué hay en cada zona y qué está junto a qué;
   - dónde están las puertas y desde dónde se entra;
   - escaleras, rampas, puentes y su forma (recto o curvo);
   - colores (el agua es azul);
   - alturas, y qué se ve desde dónde: líneas de visión y lo que las tapa;
   - por dónde se llega a cada sitio.
3. **Cada texto, opción, color, puerta, distancia y x/y** se comprueba contra la imagen. Para cada cosa que escribas, vuelve a mirar el recorte de esa zona. No inventes elementos que no están en el mapa (hielo, islotes, ventanas), y si la historia necesita algo que el mapa no muestra (la niebla mar adentro, un farol), que sea algo que no contradiga la imagen.
4. **Posiciones.** Cada escena lleva `x`/`y` en % de la imagen, en el sitio donde ocurre. Después de escribirlas, vuelve a correr `mapa_rejilla.py` y mira `escenas.png` para confirmar que cada id cae donde dice su texto. Haz lo mismo con `plano.entrada`, `plano.salida` y `plano.ruta`.

## Coherencia entre capítulos

Antes de diseñar, lee de la campaña:
- `gancho`, `introduccion`, `villano` y `epilogo`;
- el capítulo **anterior** (su `fin` o su `cierre`);
- el **siguiente** (su `llegada`, `pasos` y `cierre`).

Apunta los hechos que deben cuadrar:
- quién sabe qué;
- qué objetos llevan;
- quién está vivo o desaparecido;
- dónde termina el grupo;
- qué marcas opcionales del capítulo anterior se mencionan (por ejemplo, el aceite echado al mar).

Después:
- La primera escena (`inicio`) arranca donde terminó el capítulo anterior. El `fin` deja al grupo camino del lugar del siguiente y vuelve a la taberna.
- Si el capítulo anterior o el siguiente (aún en formato antiguo) contradice la nueva historia, **no lo cambies sin preguntar**: díselo al usuario con la frase exacta y una propuesta. Ejemplo conocido: el capítulo II de «El Aliento Helado» dice que en los barcos varados hay «las cuerdas y el aceite que compraron a Tormund», pero en el capítulo I el aceite lo pasaba de contrabando el trovador en la barca de Tormund.
- Mantén los nombres, el tono y los objetos de la campaña (villano, hermandad, monedas…).

## Reglas de juego que el capítulo debe cumplir

- **4 combates obligatorios** en cada camino posible, de 1 o 2 bestias, con nombres exactos de `public/enemigos/enemigos.json`.
- Nivel de las bestias según el mapa: Mapa 1 = 1-2, Mapa 2 = 2-3, Mapa 3 = 3-4, Mapa 4 = 4-5. Reutiliza las bestias que ya tenía el capítulo en `pasos[].combate` siempre que cuadren.
- **Capítulo IV:** después de los 4 combates va el **jefe final**: el villano de la campaña (`villano.bestia`; la Hidra Quíntuple, de nivel 7, en «La Guarida de la Hidra»). El formato por escenas **todavía no tiene jefe**, así que hay que añadirlo en el código:
  - marcar `"jefe": true` dentro del `combate` de la escena;
  - en `mapas.js`, que el contador `combatesHechos(...)/4` no cuente al jefe y muestre una corona cuando el jefe esté vencido;
  - que el icono y el tipo de la escena sean `jefe` (como `tipoPaso`);
  - el validador ya espera exactamente 1 jefe en el capítulo 4.
- **Un enigma por capítulo**: el `enigma` que ya tenía el capítulo (id de `tienda/js/datos/puzzles.js` con `titulo`, `contexto`, `recompensa`, `fallo` y los campos propios del puzzle; ver CLAUDE.md, «Modo historia»). Va en la escena del enigma, y su `recompensa` y su `fallo` deben coincidir con las escenas a las que llevan «Sí» y «No».
- Cofres, monedas de eventos y compra en la taberna los muestra solos la carta `fin` («De vuelta en la taberna»). No los repitas en el texto.
- Mecánicas en las notas del máster (`master`, `nota`, `combate.nota`, `combate.despliegue`): «quien falle una tirada cae al agua y pierde 1 de vida», «empiezan tumbados», «gastan/ganan 1 comida», «+1 de vida cada uno». Nada de mecánicas inventadas fuera de las reglas del juego.

## Formato de datos (copiar del capítulo I)

El capítulo pasa de `llegada`/`pasos`/`cierre`/`decision_llegada`/`audio_llegada`/`audio_cierre` (todo dentro de `campanas.json`) a **dos archivos enlazados**:

- **`public/mapas/campanas.json`:** la ficha del capítulo, solo con `mapa`, `titulo`, `guion` y `plano`, con `"guion": "guiones/<campaña>-<n>.json"`.
- **`public/mapas/guiones/<campaña>-<n>.json`:** el **guion**, fuente única de la historia. Contiene `_acerca` (qué es este archivo y dónde está su vista legible), `objetivo`, `geografia`, `personajes`, `inicio`, `estados`, `opciones_comunes` y `escenas`. `mapas.js` lo carga y lo mezcla con la ficha, así que cualquier cambio en el guion se ve en los mapas.
- **`guiones/<campaña>-<n>.md`:** vista legible **generada** con `make guiones`, para leer y analizar (personas u otro LLM): resumen, marcas, diagrama Mermaid y la tabla «opción → destino, condición» de cada escena. No se edita; siempre se regenera.

Los scripts de la skill (`scripts/capitulo.py`) leen y escriben a través de ese enlace. Para un capítulo nuevo, crea el guion copiando la estructura de `el-aliento-helado-1.json` y pon el campo `guion` en la ficha.

- **Qué se borra:** los campos antiguos, después de aprovechar su contenido (bestias, enigma, pistas, narraciones buenas) y quitar `paso` de los personajes.
- **Escena:**
  - Básicos: `titulo`, `lugar`, `x`, `y`, `narracion`, `audio` y, si aplica, `master` y `marca`.
  - Combate: `combate` `{enemigos, nota, despliegue}`, más `despues`, `audio_despues` y `master_despues`.
  - Enigma: `enigma`.
  - Al final, una de tres cosas: (a) `pregunta`, `audio_pregunta` y `opciones`; (b) `sigue`; o (c) `fin: true`.
- **Opción:**
  - `opcion`: primera persona del plural, como la diría el grupo, por ejemplo «Vamos a ver la barca».
  - `lectura`: infinitivo para leer en voz alta, con punto final, por ejemplo «Ir a ver la barca.».
  - `audio`, `va_a` y, si hacen falta, `nota` (para el máster), `si` y `salvo`.
- **`opciones` como texto** (`"opciones": "con-la-llave"`): la escena usa entera la lista común. **Como lista**: las opciones propias van primero y luego `{ "comunes": id }`. Una opción común que va al mismo destino que otra ya visible no se repite.
- **Voz de los textos:** español de España, segunda persona del plural (vosotros) y presente: «Cruzáis el puente…». Narraciones de 60 a 130 palabras, sensoriales y concretas, y la de combate termina con la amenaza delante.
- **Ids** en kebab-case sin tildes.
- **Escritura del JSON:** con un script de Python. Lo más cómodo es `from capitulo import cargar` (está en `scripts/`): `cap = cargar(campaña, n)`, modificar `cap.e[...]` y `cap.guardar()`. Si no, `json.dumps(…, ensure_ascii=False, indent=2)`: el guion lleva salto de línea final y `campanas.json` no. Nunca a mano con `sed`.

La interfaz (una carta por escena que entra deslizando, el mapa arriba y el texto abajo, «Atrás», migas, contador de combates, teclas A-E y ←, lectura en voz alta de la pregunta y las opciones) ya está hecha en `public/tienda/js/secciones/mapas.js` y en `mapas.css`. No la rediseñes; cambia solo datos, salvo el soporte del jefe o algo que el usuario pida.

## Audios: borradores primero, voz final solo cuando lo diga el usuario

- **Todo lo que se lee lleva audio:** narración, «Tras el combate» (`despues`), pregunta y **cada opción** (su `lectura`). Al usuario le molestó que faltaran («siempre falta esto»).
- **Mientras se desarrolla:** solo borradores con edge-tts. Usa `scripts/audios_capitulo.py <campaña> <n> --escribir`, que pone las rutas por convención y lista lo que falta o cambió respecto a git. Luego:

  ```
  make audio-borrador ARGS="narracion/pendiente-<campaña>-<n>.json --salida public/mapas/narraciones"
  ```

  Cada borrador queda apuntado en `narracion/pendientes-voz-final.json`.
- **Nunca** `make audio-final` ni Qwen por iniciativa propia: solo cuando el usuario diga que todo está bien.
- **Al entregar**, di cuántos audios quedan pendientes de la voz final.

## Proceso

1. **Leer:** CLAUDE.md, el capítulo I de referencia, la campaña entera (para la coherencia) y el capítulo que se va a rehacer.
2. **Mapa:**

   ```
   .venv/bin/python .claude/skills/rehacer-capitulo-por-escenas/scripts/mapa_rejilla.py <campaña> <n> <scratchpad>/mapa
   ```

   Mira todas las imágenes y escribe la geografía.
3. **Diseñar la red:**
   - `inicio` con 3 o 4 caminos;
   - el primer combate al que se llega por varias vías, cada una con su motivo;
   - hubs desde los que se exploran los lugares pendientes;
   - el lugar clave cerrado (llave, contraseña…) que obliga a pasar por el enigma;
   - variantes según las marcas (sorpresa o avisados);
   - opcionales con recompensa;
   - el combate final del capítulo con al menos 2 formas de afrontarlo (ir de cara o tender una emboscada) y escenas finales que se pueden hacer en cualquier orden antes del `fin`.
   - Haz una tabla de escenas: id, lugar, x/y, combate, marca y destinos.
4. **Escribir** el guion en `public/mapas/guiones/<campaña>-<n>.json` con un script de Python (guárdalo en el scratchpad para poder rehacerlo). Deja en `campanas.json` solo la ficha con el enlace `guion`.
5. **Validar caminos** hasta que diga OK; revisa cada aviso de «solo 1 opción»:

   ```
   make validar-guion CAMPANA=<campaña> CAPITULO=<n>
   ```

   El cálculo crece rápido; el capítulo I tiene unos 2 millones de caminos y tarda alrededor de un minuto, así que usa `timeout` amplio.
6. **Revisar contra el mapa otra vez:** posiciones en `escenas.png`, y cada texto, una vez más, contra los recortes.
7. **Releer la historia de punta a punta** como la oiría la mesa. Comprueba que:
   - cada necesidad está explicada y cada enemigo tiene papel;
   - nada contradice lo anterior;
   - no se cierra ningún lugar sin visitarlo;
   - el enigma es obligatorio;
   - las preguntas encajan con todas sus opciones visibles: si un hub mezcla «entrar» con «ir a otro sitio», la pregunta debe ser genérica, del tipo «¿Qué hacéis?».
8. **Audios de borrador** (`audios_capitulo.py` y luego `make audio-borrador`). Comprueba que todos los enlazados existen: el script no debe listar nada pendiente. Borra los .mp3 y las entradas de `narracion/pendientes-voz-final.json` de los textos que ya no existen.
8b. **Generar la vista legible** con `make guiones` y repasar `guiones/<campaña>-<n>.md`: el diagrama y las tablas ayudan a ver huecos, opciones raras o escenas a las que se llega sin motivo. Regenérala **cada vez** que cambie el guion; si no, el .md queda desfasado.
9. **Probar en el navegador** varios caminos, entre ellos los raros: volver atrás, hacer los opcionales y saltarse cosas.

   ```
   .venv/bin/python .claude/skills/rehacer-capitulo-por-escenas/scripts/recorrer.py <campaña> <n> "opción" SIGUE GANADO AUDIO ...
   ```

   Sin errores de consola.
10. **Versiones** (CLAUDE.md): sube
    - `const V = '?v=N'` de `mapas.js`, porque el JSON se pide con ese `?v=`;
    - `mapas.js?v=` en `main.js`;
    - `main.js?v=` en `index.html`, si cambió `main.js`;
    - `.version-app` y `base.css?v=` en `index.html`.

    Usa la misma URL en todos los imports.
11. **Pruebas:**
    - `make check-css`.
    - `make probar`. Si cambian solo capturas de Mapas por el texto nuevo, míralas y copia **solo esas** de `pruebas/actuales/` a `pruebas/referencias/`. No uses `ACTUALIZAR=1` a ciegas, porque pisaría fallos ajenos.
    - `make probar-enigmas`. El Lights Out del capítulo II a veces falla al azar en «tocar al azar»: repítelo antes de dar nada por roto.
12. **Entregar** en español:
    - cómo es el mapa;
    - el resumen de la historia y de los caminos;
    - qué se aprovechó del capítulo antiguo;
    - las incoherencias detectadas en otros capítulos (sin tocarlos);
    - el resultado del validador y de las pruebas;
    - la versión;
    - cuántos audios quedan pendientes de la voz final;
    - las rutas del guion (`public/mapas/guiones/…json`) y de su vista legible (`guiones/…md`).

    Después, esperar la revisión del usuario.

## Errores ya cometidos (no repetir)

- La primera versión fue un árbol de un solo nivel con una línea de tiempo vertical: «la interfaz está horrible y el tema de las decisiones aún no lo entiendes».
- Faltaba la narración de «Tras el combate», y faltaban los audios de las preguntas y opciones.
- Se generaron audios con Qwen durante el desarrollo: era demasiado lento. Usa borradores.
- Textos que no coincidían con el mapa: grúa, agua negra, islote, escalera o rampa, ventanas tapadas.
- Un lugar se escondía porque otra escena lo marcaba como visto de pasada.
- Registrar la casa daba la llave sin pasar por el enigma, y fallar el enigma se resolvía «buscando» gratis (ahora: ofrenda de sangre).
- No se entendía por qué hacía falta fuego, ni qué hacía allí el trovador.
- Se decía «volver al pueblo» en vez de «volver a la taberna».
