#!/usr/bin/env python3
"""Detecta textos que se desbordan en las cartas de una clase. Uso: revisar_desbordes.py <clase> [--captura carpeta]
Sirve la raíz del repo, abre Chrome headless con revisar_desbordes.html y lista los problemas (exit 1 si hay).
Con --captura guarda un PNG de todas las cartas para revisarlo a ojo con Read."""
import json
import re
import shutil
import subprocess
import sys
import threading
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

RAIZ = Path(__file__).resolve().parents[4]
PAG = '.claude/skills/crear-personaje/scripts/revisar_desbordes.html'

class Silencioso(SimpleHTTPRequestHandler):
    def log_message(self, *a): pass

def main():
    args = sys.argv[1:]
    if not args:
        sys.exit(__doc__)
    clase, captura = args[0], (args[args.index('--captura') + 1] if '--captura' in args else None)
    chrome = next((c for c in ('google-chrome', 'chromium', 'chromium-browser') if shutil.which(c)), None)
    if not chrome:
        sys.exit('No hay Chrome/Chromium; revisa con un navegador en `make catalogo` (consola: mide scrollHeight > clientHeight).')
    srv = ThreadingHTTPServer(('127.0.0.1', 0), partial(Silencioso, directory=str(RAIZ)))
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    url = f'http://127.0.0.1:{srv.server_port}/{PAG}?clase={clase}'
    base = [chrome, '--headless=new', '--no-sandbox', '--disable-gpu', '--virtual-time-budget=15000']
    dom = subprocess.run(base + ['--dump-dom', url], capture_output=True, text=True, timeout=90).stdout
    m = re.search(r'<pre id="resultado"[^>]*>(.*?)</pre>', dom, re.S)
    if not m or not m.group(1).strip():
        sys.exit('No se obtuvo resultado de Chrome (¿clase inexistente?).')
    res = json.loads(m.group(1).replace('&quot;', '"').replace('&amp;', '&').replace('&lt;', '<').replace('&gt;', '>'))
    if captura:
        Path(captura).mkdir(parents=True, exist_ok=True)
        subprocess.run(base + [f'--screenshot={captura}/{clase}-cartas.png', '--window-size=1400,2400', url], capture_output=True, timeout=90)
        print(f'captura: {captura}/{clase}-cartas.png')
    for p in res['problemas']:
        print('DESBORDE', p)
    print(f'{len(res["problemas"])} problemas')
    sys.exit(1 if res['problemas'] else 0)

main()
