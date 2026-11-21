PORT ?= 8080
VENV := narracion/.venv
PY := $(VENV)/bin/python

.PHONY: run audio-setup audio check cartas catalogo

run:
	python3 -m http.server $(PORT) -d public

audio-setup:
	python3 -m venv $(VENV)
	$(VENV)/bin/pip install -r narracion/requirements.txt

audio:
	$(PY) narracion/generar_audio.py $(ARGS)

# Valida las clases de personajes: esquema, referencias entre cartas y selección, imágenes (make check CLASE=druida para una sola)
check:
	python3 public/personajes/validar.py $(CLASE)

# Sitio completo sin caché (pestaña Héroes = catálogo de cartas): http://localhost:8081
catalogo:
	python3 public/personajes/servidor.py 8081

# (LEGACY: diseño y esquema antiguos, ya no compatible con public/personajes/clases/) Exporta las cartas a PDF
cartas:
	public/personajes/legacy/exportar.sh $(CLASE)
