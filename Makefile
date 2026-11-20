SHELL := /usr/bin/bash
PORT ?= 8080

.PHONY: run

run:
	/usr/bin/bash -c "npx --yes serve -l $(PORT) public"
