PORT ?= 8080
VENV := narracion/.venv
PY := $(VENV)/bin/python

.PHONY: run audio-setup audio check

run:
	npx --yes serve -l $(PORT) public

audio-setup:
	python3 -m venv $(VENV)
	$(VENV)/bin/pip install -r narracion/requirements.txt

audio:
	$(PY) narracion/generar_audio.py $(ARGS)

# Valida que todos los JSON de personajes sean sintácticamente correctos
check:
	@for f in personajes/*/*.json; do python3 -m json.tool "$$f" >/dev/null && echo "ok  $$f" || exit 1; done
