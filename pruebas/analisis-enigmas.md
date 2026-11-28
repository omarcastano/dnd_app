# Análisis de los enigmas (modo historia y normal)

Criterio: en una mesa de 4-5 jugadores, 3-10 minutos, que obligue a pensar y a repartirse el trabajo, sin poder
resolverse a lo bruto ni porque el tablero «chive» la solución. Probado con `make probar-enigmas`.

## Cifrado (libro: 5 enigmas)
- **Problema**: el dial mostraba el texto descifrado en vivo; bastaba pulsar «+» hasta leer algo con sentido. Ni pensar ni equipo.
- **Ahora**: el texto descifrado no aparece nunca. El dial es solo una tabla de traducción (letra escrita → letra real
  para un salto). El salto se **deduce** de una palabra que la historia dice que aparece (`pista_clave`: FARO, HUESOS,
  GRANO, LUNA, RUINAS), buscándola entre las palabras cifradas de su tamaño (a veces hay varias candidatas). Luego se
  traduce a mano (hoja de «Notas del equipo») y se **escribe** la respuesta a una `pregunta` (una palabra que no está
  en la narración ni en la pista: NIEBLA, SIETE, TUERTO, CERA, SAUCE). «Comprobar» gasta intento. Modo normal: misma
  mecánica en la ronda César (palabra conocida → escribir la última palabra).

## Lights Out (libro: 5)
- **Problema**: 6×6 con límite mínimo+50 % (≥14 toques); se podía avanzar tanteando y el tablero de 36 casillas no se planea en grupo.
- **Ahora**: en historia 5×5 y límite **mínimo + 3**; «Modo: señalar» marca casillas en azul sin gastar, para planear
  en grupo antes de tocar. Tocar al azar agota el límite (probado).

## Torres de Hanoi (libro: 2)
- **Problema**: algoritmo conocido; quien lo sabe lo hace sin pensar, quien no, tantea con 41 movimientos de margen.
- **Ahora**: **regla del giro** (`regla: "circular"`): cada pieza solo puede ir al soporte de su derecha (1→2→3→1).
  El truco clásico no sirve; hay que razonar la recursión. Mínimo por BFS (3 piezas = 21, 4 piezas = 59), límite +25 %.
  Molino: 3 piezas; sacristía (mapa 4): 4. En modo normal es una casilla opcional.

## Mastermind (libro: 3)
- **Problema**: 5 huecos × 8 colores con repetición (32 768 códigos) y 8 intentos: casi imposible para un grupo sin
  método, así que se jugaba a probar suerte.
- **Ahora**: en historia 6 colores sin repetir (720 códigos): con las pistas negras/blancas se deduce en 5-7 intentos
  (el solucionador de la prueba lo abre en 6-7). Una fila con repetidos no gasta intento.

## Nonograma (libro: 2)
- **Problema**: dibujo de ruido aleatorio sin relación con la historia; trabajoso pero sin recompensa narrativa.
- **Ahora**: `figura` del enigma: el Paso del Centinela (torre con cuerno) y el símbolo de los cinco cuellos de la
  Hidra. Ambas comprobadas: se resuelven solo con lógica de líneas. Las pistas no se atenúan en historia.

## Hitori, Light Up, Carpas, Star Battle
- **Problema**: en historia seguían marcando en rojo los errores (sombras pegadas, repetidos, bombillas que se ven,
  carpas que se tocan, cifras «excedidas»), los muros de Light Up se ponían verdes al cumplirse y Star Battle contaba
  estrellas: el tablero hacía de corrector. Además el tablero no se regeneraba al entrar desde el libro (se podía traer
  resuelto del modo normal).
- **Ahora**: sin ningún aviso en historia (solo «Comprobar»), y tablero nuevo al entrar/salir del modo historia.
  Tamaños (7×7, 8×8, 8×8) adecuados para grupo. Star Battle no aparece en ninguna campaña.

## Galaxias (libro: 3)
- **Estado**: ya exigía pensar (la simetría se pinta sola, pero el reparto hay que deducirlo) y no delata nada.
  Solo se añade tablero nuevo al entrar en historia. Riesgo: el generador no garantiza solución única (se acepta
  cualquier reparto válido).
