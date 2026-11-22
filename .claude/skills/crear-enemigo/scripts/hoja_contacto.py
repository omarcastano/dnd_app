#!/usr/bin/env python3
"""Junta varias imágenes en una hoja de contacto con su nombre, para compararlas de un vistazo (Read sobre el PNG).

Uso: hoja_contacto.py img1.webp img2.webp ... --salida hoja.png [--columnas 6] [--ancho 300]
Usa un prefijo de nombre largo sin problema: el rótulo es el nombre de archivo sin extensión.
"""
import argparse
from pathlib import Path

from PIL import Image, ImageDraw


def main():
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument('imagenes', nargs='+', type=Path)
    p.add_argument('--salida', type=Path, required=True)
    p.add_argument('--columnas', type=int, default=6)
    p.add_argument('--ancho', type=int, default=300, help='Ancho de cada miniatura (el alto sigue la proporción 907x1117)')
    a = p.parse_args()

    ancho, alto, rotulo = a.ancho, round(a.ancho * 1117 / 907), 20
    filas = -(-len(a.imagenes) // a.columnas)
    hoja = Image.new('RGB', (ancho * a.columnas, (alto + rotulo) * filas), 'white')
    pincel = ImageDraw.Draw(hoja)
    for i, ruta in enumerate(sorted(a.imagenes)):
        x, y = (i % a.columnas) * ancho, (i // a.columnas) * (alto + rotulo)
        hoja.paste(Image.open(ruta).convert('RGB').resize((ancho, alto)), (x, y + rotulo))
        pincel.text((x + 4, y + 4), ruta.stem, fill='black')
    a.salida.parent.mkdir(parents=True, exist_ok=True)
    hoja.save(a.salida)
    print(f'{len(a.imagenes)} imágenes → {a.salida}')


if __name__ == '__main__':
    main()
