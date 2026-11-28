"""Prepara el mapa de un capítulo para analizarlo y comprobar posiciones.

Uso:
  .venv/bin/python .claude/skills/rehacer-capitulo-por-escenas/scripts/mapa_rejilla.py <campaña-id> <capítulo 1-4> <carpeta-salida>

Crea en <carpeta-salida> (usar el scratchpad):
  - rejilla.png      el mapa entero con rejilla cada 10 % (etiquetas x/y en %), como usan `x`/`y` de las escenas
  - zona-<f><c>.png  9 recortes ampliados (3×3, con solape) con rejilla cada 5 %, para ver detalles: puertas,
                     escaleras, colores del agua, qué hay junto a qué
  - escenas.png      (si el capítulo ya tiene `escenas`) cada escena dibujada en su x/y con su id, más la entrada
                     y salida del plano: para comprobar que cada texto cae donde dice
Luego hay que MIRAR las imágenes con Read (no basta con generarlas).
"""
import json, sys
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

campana, capitulo, salida = sys.argv[1], int(sys.argv[2]), Path(sys.argv[3])
salida.mkdir(parents=True, exist_ok=True)
sys.path.insert(0, str(Path(__file__).parent))
from capitulo import cargar
e = cargar(campana, capitulo).e
im = Image.open(f"public/mapas/imagenes/{e['mapa']}.webp").convert("RGB")
W, H = im.size
try:
    fuente = ImageFont.truetype("DejaVuSans-Bold.ttf", 14)
except OSError:
    fuente = ImageFont.load_default()

def rejilla(img, x0, y0, x1, y1, paso):
    """Dibuja líneas en % del mapa ENTERO sobre un recorte que va de (x0,y0) a (x1,y1) en %."""
    d = ImageDraw.Draw(img); w, h = img.size
    px = lambda x: (x - x0) / (x1 - x0) * w
    py = lambda y: (y - y0) / (y1 - y0) * h
    v = 0
    while v <= 100:
        if x0 <= v <= x1:
            d.line([(px(v), 0), (px(v), h)], fill=(255, 0, 255), width=1); d.text((px(v) + 2, 2), f"x{v}", fill=(255, 255, 0), font=fuente, stroke_width=2, stroke_fill=(0, 0, 0))
        if y0 <= v <= y1:
            d.line([(0, py(v)), (w, py(v))], fill=(255, 0, 255), width=1); d.text((2, py(v) + 2), f"y{v}", fill=(255, 255, 0), font=fuente, stroke_width=2, stroke_fill=(0, 0, 0))
        v += paso
    return img

rejilla(im.copy(), 0, 0, 100, 100, 10).save(salida / "rejilla.png")
for f, (y0, y1) in enumerate([(0, 40), (30, 70), (60, 100)]):
    for c, (x0, x1) in enumerate([(0, 40), (30, 70), (60, 100)]):
        r = im.crop((int(x0 / 100 * W), int(y0 / 100 * H), int(x1 / 100 * W), int(y1 / 100 * H)))
        r = r.resize((r.width * 2, r.height * 2), Image.LANCZOS)
        rejilla(r, x0, y0, x1, y1, 5).save(salida / f"zona-{'nms'[f]}{'oce'[c]}.png")

if "escenas" in e:
    img = im.copy(); d = ImageDraw.Draw(img)
    puntos = [(sid, s["x"], s["y"], (255, 200, 0)) for sid, s in e["escenas"].items() if "x" in s]
    for k in ("entrada", "salida"):
        if e.get("plano", {}).get(k): puntos.append((k.upper(), e["plano"][k]["x"], e["plano"][k]["y"], (0, 255, 120)))
    for sid, x, y, col in puntos:
        X, Y = x / 100 * W, y / 100 * H
        d.ellipse([X - 6, Y - 6, X + 6, Y + 6], fill=col, outline=(0, 0, 0), width=2)
        d.text((X + 8, Y - 8), sid, fill=(255, 255, 255), font=fuente, stroke_width=3, stroke_fill=(0, 0, 0))
    img.save(salida / "escenas.png")
print("Listo:", *sorted(p.name for p in salida.glob("*.png")), sep="\n  ")
