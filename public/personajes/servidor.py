#!/usr/bin/env python3
"""Servidor de desarrollo del catálogo: como http.server pero sin caché (siempre ves el último cambio, también en el celular).
Uso: python3 public/personajes/servidor.py [puerto]"""
import sys
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path


class SinCache(SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store')
        super().end_headers()


puerto = int(sys.argv[1]) if len(sys.argv) > 1 else 8081
raiz = Path(__file__).resolve().parent
print(f'Catálogo en http://localhost:{puerto}')
ThreadingHTTPServer(('', puerto), partial(SinCache, directory=str(raiz))).serve_forever()
