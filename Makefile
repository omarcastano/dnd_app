PORT ?= 8080
UV ?= uv
PY := .venv/bin/python

.PHONY: run setup audio-setup audio audio-borrador audio-final guiones validar-guion check cartas catalogo simular probar probar-enigmas check-css

run:
	python3 -m http.server $(PORT) -d public

# Dependencias de Python: todas en pyproject.toml (uv), un solo entorno .venv dentro del proyecto
setup:
	$(UV) sync --all-groups

audio-setup: setup

audio:
	$(PY) narracion/generar_audio.py $(ARGS)

# Voz rápida de prueba (edge-tts) mientras se revisa; anota cada audio en narracion/pendientes-voz-final.json
audio-borrador:
	$(PY) narracion/generar_audio.py --borrador $(ARGS)

# Cuando el usuario da el visto bueno: pasa todos los borradores pendientes a la narradora (Qwen3-TTS)
audio-final:
	$(PY) narracion/generar_audio.py --final

# Guiones de los capítulos por escenas (fuente: public/mapas/guiones/*.json): regenera la vista legible guiones/*.md
GUION = .claude/skills/rehacer-capitulo-por-escenas/scripts
guiones:
	$(PY) $(GUION)/guion_legible.py --todos

# Recorre todos los caminos de un guion (4 combates, sin callejones, enigma obligatorio): make validar-guion CAMPANA=el-aliento-helado CAPITULO=1
validar-guion:
	$(PY) $(GUION)/validar_caminos.py $(CAMPANA) $(CAPITULO)

# Valida las clases de personajes: esquema, referencias entre cartas y selección, imágenes (make check CLASE=druida para una sola)
check:
	python3 public/personajes/validar.py $(CLASE)

# Sitio completo sin caché (pestaña Héroes = catálogo de cartas): http://localhost:8081
catalogo:
	python3 public/personajes/servidor.py 8081

# (LEGACY: diseño y esquema antiguos, ya no compatible con public/personajes/clases/) Exporta las cartas a PDF
cartas:
	public/personajes/legacy/exportar.sh $(CLASE)

# Simulador de balance (Python): genera simulacion/reporte.html (make simular ARGS="--rapido")
simular:
	$(PY) simulacion/simular.py $(ARGS)

# Red de seguridad visual (Playwright + Chrome del sistema): make probar ACTUALIZAR=1 guarda nuevas referencias
probar:
	ACTUALIZAR=$(ACTUALIZAR) $(PY) pruebas/probar.py

# Juega cada enigma del libro en modo historia: no se resuelve solo ni a lo bruto, la solución se acepta y los intentos se gastan
probar-enigmas:
	$(PY) pruebas/probar_enigmas.py

# Avisa si una clase CSS se define en secciones distintas sin estar dentro del contenedor de su sección
check-css:
	python3 pruebas/check_css.py
