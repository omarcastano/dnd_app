#!/usr/bin/env python3
"""Imprime las tablas vigentes de enemigos (niveles y botín) leyendo public/enemigos/enemigos.json, en Markdown.

Uso: mostrar_tablas.py
La fuente de verdad es el JSON: úsalo en vez de copiar números de memoria o de SKILL.md (que solo trae una copia informativa).
También comprueba que los pesos del botín de cada nivel suman 100 y avisa si no.
"""
import json
from pathlib import Path

RUTA = Path(__file__).resolve().parents[4] / 'public' / 'enemigos' / 'enemigos.json'
TIPOS = ['nada', 'monedas', 'comida', 'bebida', 'dado', 'arma', 'armadura']


def main():
    d = json.loads(RUTA.read_text(encoding='utf-8'))
    print('## Niveles\n')
    print('| Nivel | Cuándo | Vida (4 / 5 / 6 jug.) | Básico | Fuerte | Efecto | Habilidades |')
    print('|---|---|---|---|---|---|---|')
    for n in d['niveles']:
        print(f"| N{n['nivel']} | {n['nombre']} | {' / '.join(map(str, n['vida']))} | {n['basico']} | {n['fuerte']} | {n.get('efecto', '—')} | {n['habilidades']} |")
    print('\n## Botín (% por nivel)\n')
    print('| Nivel | ' + ' | '.join(t.capitalize() for t in TIPOS) + ' | Cantidad de monedas |')
    print('|---|' + '---|' * (len(TIPOS) + 1))
    for n in d['niveles']:
        b = n.get('botin')
        if not b:
            print(f"| N{n['nivel']} | sin botín definido |")
            continue
        suma = sum(b['pesos'].values())
        aviso = '' if suma == 100 else f' ⚠ suman {suma}'
        print(f"| N{n['nivel']} | " + ' | '.join(str(b['pesos'].get(t, 0)) for t in TIPOS) + f" | {b['monedas'][0]}-{b['monedas'][1]}{aviso} |")
    print('\n## Enemigos\n')
    for e in sorted(d['enemigos'], key=lambda x: x['nivel']):
        print(f"- N{e['nivel']} · {e['nombre']} ({e['tipo']})")


if __name__ == '__main__':
    main()
