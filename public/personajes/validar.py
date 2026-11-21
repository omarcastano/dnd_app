#!/usr/bin/env python3
"""Valida las clases de personajes (esquema, referencias e imágenes). Uso: python3 public/personajes/validar.py [clase ...]

Errores (exit 1): JSON roto, campos obligatorios, ids repetidos o inexistentes, tipos desconocidos, clases mal registradas.
Avisos: imágenes que faltan (borrador) o que nadie usa, y audios en narraciones/ que ninguna carta enlaza.
Una carta puede llevar `narracion` (ruta a un .mp3 relativa a la clase); si el archivo no existe es un error.
Valida también `plantilla/` para que el ejemplo no se desactualice. Las convenciones de imágenes deben coincidir con app/datos.js.
"""
import json
import re
import sys
import unicodedata
from pathlib import Path

RAIZ = Path(__file__).resolve().parent
TIPOS = {'personaje', 'tabla', 'ilustrada'}
OBLIGATORIOS = {
    'personaje': ['nombre', 'raza'],
    'tabla': ['nombre', 'tabla'],
    'ilustrada': ['nombre', 'descripcion'],
}
errores, avisos = [], []


def slug(t):
    t = unicodedata.normalize('NFD', t).encode('ascii', 'ignore').decode().lower()
    return re.sub(r'[^a-z0-9]+', '-', t).strip('-')


def validar_filas(ctx, filas):
    for n, f in enumerate(filas, 1):
        if 'rango_d20' not in f:
            errores.append(f'{ctx} fila {n}: falta rango_d20')
        if 'nombre' in f and 'valor' not in f:
            errores.append(f'{ctx} fila {n}: "{f["nombre"]}" no tiene valor')
        if 'nombre' not in f and 'resultado' not in f:
            errores.append(f'{ctx} fila {n}: necesita nombre+valor o resultado')


def validar_clase(id, carpeta, es_plantilla=False):
    ruta = carpeta / f'{id}.json'
    if not ruta.exists():
        errores.append(f'{id}: falta {ruta.relative_to(RAIZ)}')
        return
    try:
        d = json.loads(ruta.read_text(encoding='utf-8'))
    except json.JSONDecodeError as e:
        errores.append(f'{id}: JSON inválido ({e})')
        return

    clase = d.get('clase') or {}
    for k in ('nombre', 'reglas', 'armas'):
        if k not in clase:
            errores.append(f'{id}: falta clase.{k}')
    usadas = set()  # imágenes referenciadas
    audios = set()  # narraciones referenciadas
    ids = set()
    for c in d.get('cartas', []):
        cid = c.get('id', '?')
        ctx = f'{id}/{cid}'
        if cid in ids:
            errores.append(f'{ctx}: id repetido')
        ids.add(cid)
        if c.get('tipo') not in TIPOS:
            errores.append(f'{ctx}: tipo "{c.get("tipo")}" desconocido (usa {sorted(TIPOS)})')
            continue
        for k in OBLIGATORIOS[c['tipo']]:
            if k not in c:
                errores.append(f'{ctx}: falta {k}')
        if c['tipo'] == 'personaje':
            for k in ('reglas', 'armas'):
                if k not in c and k not in clase:
                    errores.append(f'{ctx}: sin {k} (ni propias ni en clase)')
        if 'nivel' in c and not 1 <= c['nivel'] <= 6:
            errores.append(f'{ctx}: nivel fuera de 1-6')
        if c.get('narracion'):
            audios.add(c['narracion'])
            if not (carpeta / c['narracion']).is_file():
                errores.append(f'{ctx}: falta el audio {c["narracion"]}')
        if c['tipo'] != 'tabla':
            usadas.add(c.get('imagen', f'imagenes/{cid}.webp'))
        for k in ('ataques', 'tabla'):
            validar_filas(f'{ctx}.{k}', c.get(k, []))
            for f in c.get(k, []):
                if 'nombre' in f:
                    usadas.add(f.get('icono', f'imagenes/habilidades/{slug(f["nombre"])}.webp'))

    for i, p in enumerate(d.get('seleccion', []), 1):
        for o in p.get('opciones', []):
            ctx = f'{id}/seleccion paso {i} "{o.get("etiqueta", "?")}"'
            if not o.get('cartas'):
                errores.append(f'{ctx}: sin cartas')
            for cid in o.get('cartas', []):
                if cid not in ids:
                    errores.append(f'{ctx}: la carta "{cid}" no existe')
            if o.get('portada'):
                usadas.add(f'imagenes/{slug(o["etiqueta"])}.webp')

    carpeta_audio = carpeta / 'narraciones'
    if carpeta_audio.is_dir():
        for u in sorted(str(p.relative_to(carpeta)) for p in carpeta_audio.glob('*.mp3')):
            if u not in audios:
                avisos.append(f'{id}: audio sin enlazar {u}')

    existentes = {str(p.relative_to(carpeta)) for p in (carpeta / 'imagenes').rglob('*') if p.is_file() and p.suffix == '.webp'}
    if not es_plantilla:  # la plantilla no lleva imágenes
        for u in sorted(usadas - existentes):
            avisos.append(f'{id}: falta imagen {u}')
        for u in sorted(existentes - usadas):
            avisos.append(f'{id}: imagen sin usar {u}')
        for u in sorted(p.name for p in (carpeta / 'imagenes').rglob('*') if p.is_file() and p.suffix != '.webp' and p.name != '.gitkeep'):
            errores.append(f'{id}: {u} no es .webp')


def main(filtro):
    try:
        registro = json.loads((RAIZ / 'clases.json').read_text(encoding='utf-8'))
    except (OSError, json.JSONDecodeError) as e:
        sys.exit(f'clases.json: {e}')
    registradas = {c['id'] for c in registro}
    for c in registro:
        if filtro and c['id'] not in filtro:
            continue
        carpeta = RAIZ / 'clases' / c['id']
        validar_clase(c['id'], carpeta)
        for ext in ('js', 'css') if c.get('efectos') else ():
            if not (carpeta / f'efectos.{ext}').exists():
                errores.append(f'{c["id"]}: declara efectos pero falta efectos.{ext}')
    for carpeta in sorted((RAIZ / 'clases').iterdir()):
        if carpeta.is_dir() and carpeta.name not in registradas:
            avisos.append(f'{carpeta.name}: carpeta en clases/ no registrada en clases.json')
    if not filtro:
        validar_clase('plantilla', RAIZ / 'plantilla', es_plantilla=True)

    for a in avisos:
        print('aviso ', a)
    for e in errores:
        print('ERROR ', e)
    print(f'{len(errores)} errores, {len(avisos)} avisos')
    sys.exit(1 if errores else 0)


main(set(sys.argv[1:]))
