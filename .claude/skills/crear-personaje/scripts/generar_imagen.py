#!/usr/bin/env python3
"""Genera imágenes de personajes con ComfyUI local (SDXL Base 1.0) y las deja en .webp con el tamaño de la convención.

Uso:
  generar_imagen.py --tipo retrato --prompt "..." --salida clases/x/imagenes/nombre.webp [--referencia foto.png --fuerza 0.6]
  generar_imagen.py --lote lote.json          # lista de {tipo, prompt, salida, [semilla, referencia, fuerza, negativo]}
Tipos: retrato | don | portada | habilidad   (ver TIPOS). Solo biblioteca estándar + Pillow.
Rutas relativas de `salida` se resuelven desde la raíz del repo. Si la salida existe, se omite salvo --forzar.
"""
import argparse
import io
import json
import random
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
import uuid
from pathlib import Path

from PIL import Image, ImageDraw

SERVIDOR = 'http://127.0.0.1:8188'
CHECKPOINT = 'sd_xl_base_1.0.safetensors'
RAIZ = Path(__file__).resolve().parents[4]

# ancho/alto = tamaño de generación (SDXL rinde ~1 MP); final = tamaño guardado; circulo = máscara redonda con alfa
TIPOS = {
    'retrato':   dict(ancho=896,  alto=1104, final=(907, 1117), circulo=False, pasos=32, cfg=7.0,
                      estilo='comic book ink illustration, bold black linework, detailed cel shading, rich colors, fantasy D&D character portrait, three-quarter view, dynamic pose, detailed background',
                      neg='photo, 3d render, blurry, low quality, deformed hands, extra fingers, extra limbs, text, watermark, signature, cropped head'),
    'don':       dict(ancho=1024, alto=1024, final=(800, 800), circulo=False, pasos=32, cfg=7.0,
                      estilo='digital fantasy illustration, vibrant colors, dramatic lighting, epic composition, highly detailed',
                      neg='blurry, low quality, deformed, text, watermark, signature'),
    'portada':   dict(ancho=1024, alto=1024, final=(512, 512), circulo=True, pasos=30, cfg=7.5,
                      estilo='flat vector emblem logo, bold geometric shapes, limited palette of 3 colors, centered symmetrical, thick clean edges, plain background',
                      neg='photo, realistic, gradient, tiny details, clutter, text, letters, watermark, blurry'),
    'habilidad': dict(ancho=1024, alto=1024, final=(256, 256), circulo=True, pasos=30, cfg=8.0,
                      estilo='simple flat vector icon, single bold symbol, very minimal, 3 flat colors, thick clean shapes, centered, large readable silhouette, plain solid background, no details',
                      neg='photo, realistic, complex, detailed, busy, gradient, texture, small details, clutter, multiple objects, text, letters, numbers, watermark, blurry, border, frame'),
}


def http(ruta, datos=None, cabeceras=None):
    req = urllib.request.Request(SERVIDOR + ruta, data=datos, headers=cabeceras or {})
    with urllib.request.urlopen(req, timeout=600) as r:
        return r.read()


def subir_referencia(ruta):
    """Sube la imagen de referencia a ComfyUI (multipart) y devuelve el nombre que le asigna."""
    ruta = Path(ruta)
    limite = uuid.uuid4().hex
    cuerpo = (f'--{limite}\r\nContent-Disposition: form-data; name="image"; filename="{ruta.name}"\r\n'
              f'Content-Type: application/octet-stream\r\n\r\n').encode() + ruta.read_bytes() + (
              f'\r\n--{limite}\r\nContent-Disposition: form-data; name="overwrite"\r\n\r\ntrue\r\n--{limite}--\r\n').encode()
    r = http('/upload/image', cuerpo, {'Content-Type': f'multipart/form-data; boundary={limite}'})
    return json.loads(r)['name']


def flujo(t, prompt, negativo, semilla, referencia=None, fuerza=0.6):
    g = {
        '1': {'class_type': 'CheckpointLoaderSimple', 'inputs': {'ckpt_name': CHECKPOINT}},
        '2': {'class_type': 'CLIPTextEncode', 'inputs': {'text': prompt, 'clip': ['1', 1]}},
        '3': {'class_type': 'CLIPTextEncode', 'inputs': {'text': negativo, 'clip': ['1', 1]}},
        '6': {'class_type': 'VAEDecode', 'inputs': {'samples': ['5', 0], 'vae': ['1', 2]}},
        '7': {'class_type': 'SaveImage', 'inputs': {'images': ['6', 0], 'filename_prefix': 'personaje'}},
    }
    if referencia:  # img2img: parte de la imagen de referencia
        g['8'] = {'class_type': 'LoadImage', 'inputs': {'image': referencia}}
        g['9'] = {'class_type': 'ImageScale', 'inputs': {'image': ['8', 0], 'upscale_method': 'lanczos', 'width': t['ancho'],
                                                         'height': t['alto'], 'crop': 'center'}}
        g['4'] = {'class_type': 'VAEEncode', 'inputs': {'pixels': ['9', 0], 'vae': ['1', 2]}}
        denoise = fuerza
    else:
        g['4'] = {'class_type': 'EmptyLatentImage', 'inputs': {'width': t['ancho'], 'height': t['alto'], 'batch_size': 1}}
        denoise = 1.0
    g['5'] = {'class_type': 'KSampler', 'inputs': {
        'model': ['1', 0], 'positive': ['2', 0], 'negative': ['3', 0], 'latent_image': ['4', 0], 'seed': semilla,
        'steps': t['pasos'], 'cfg': t['cfg'], 'sampler_name': 'dpmpp_2m', 'scheduler': 'karras', 'denoise': denoise}}
    return g


def generar(item, forzar=False):
    t = TIPOS[item['tipo']]
    salida = Path(item['salida'])
    if not salida.is_absolute():
        salida = RAIZ / salida
    if salida.exists() and not forzar:
        print(f'= {salida.name} ya existe (usa --forzar para rehacer)')
        return
    semilla = item.get('semilla', random.randint(0, 2**32 - 1))
    prompt = f"{item['prompt']}, {t['estilo']}"
    negativo = item.get('negativo', t['neg'])
    ref = subir_referencia(item['referencia']) if item.get('referencia') else None
    pid = json.loads(http('/prompt', json.dumps({'prompt': flujo(t, prompt, negativo, semilla, ref, item.get('fuerza', 0.6))}).encode(),
                          {'Content-Type': 'application/json'}))['prompt_id']
    while True:  # espera a que termine
        h = json.loads(http(f'/history/{pid}'))
        if pid in h:
            break
        time.sleep(1.5)
    est = h[pid]['status']
    if est.get('status_str') == 'error':
        sys.exit(f'ComfyUI falló: {json.dumps(est)[:600]}')
    im = h[pid]['outputs']['7']['images'][0]
    png = http('/view?' + urllib.parse.urlencode({'filename': im['filename'], 'subfolder': im['subfolder'], 'type': im['type']}))
    img = Image.open(io.BytesIO(png)).convert('RGB').resize(t['final'], Image.LANCZOS)
    if t['circulo']:  # esquinas transparentes, como las del druida
        m = Image.new('L', tuple(s * 4 for s in t['final']), 0)
        ImageDraw.Draw(m).ellipse((0, 0, m.width - 1, m.height - 1), fill=255)
        img.putalpha(m.resize(t['final'], Image.LANCZOS))
    salida.parent.mkdir(parents=True, exist_ok=True)
    img.save(salida, 'WEBP', quality=88 if t['circulo'] else 90)
    print(f'+ {salida.relative_to(RAIZ) if salida.is_relative_to(RAIZ) else salida}  (semilla {semilla})')


def main():
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument('--tipo', choices=TIPOS)
    p.add_argument('--prompt')
    p.add_argument('--salida')
    p.add_argument('--negativo')
    p.add_argument('--semilla', type=int)
    p.add_argument('--referencia', help='imagen base para img2img')
    p.add_argument('--fuerza', type=float, default=0.6, help='denoise img2img: 0.4 casi igual … 0.75 solo inspira')
    p.add_argument('--lote', help='JSON con una lista de items')
    p.add_argument('--forzar', action='store_true', help='sobrescribir salidas existentes')
    a = p.parse_args()
    try:
        http('/system_stats')
    except (urllib.error.URLError, OSError):
        sys.exit(f'ComfyUI no responde en {SERVIDOR}. Arráncalo (~/ia/ComfyUI) y reintenta.')
    items = json.loads(Path(a.lote).read_text(encoding='utf-8')) if a.lote else [
        {k: v for k, v in vars(a).items() if k in ('tipo', 'prompt', 'salida', 'negativo', 'semilla', 'referencia', 'fuerza') and v is not None}]
    for i, it in enumerate(items, 1):
        print(f'[{i}/{len(items)}] {it["tipo"]}', flush=True)
        generar(it, a.forzar)


main()
