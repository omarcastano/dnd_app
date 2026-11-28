"""Pone los campos de audio de un capítulo por escenas (en su guion, public/mapas/guiones/, si lo tiene) y prepara la lista de borradores a generar.

Uso:
  .venv/bin/python .claude/skills/rehacer-capitulo-por-escenas/scripts/audios_capitulo.py <campaña-id> <capítulo 1-4> [--escribir] [--desde HEAD]

Qué se narra (todo lleva audio):
  - escena.narracion      -> escena.audio          narraciones/<campaña>-<n>-escena-<id>.mp3
  - escena.despues        -> escena.audio_despues  narraciones/<campaña>-<n>-escena-<id>-despues.mp3
  - escena.pregunta       -> escena.audio_pregunta narraciones/<campaña>-<n>-pregunta-<slug del texto>.mp3
  - opción.lectura        -> opción.audio          narraciones/<campaña>-<n>-opcion-<slug de la lectura>.mp3
  - opciones_comunes[x].pregunta / sus opciones, igual.
Con --escribir rellena los campos que falten (en escenas respeta rutas antiguas que ya existan, p. ej. «paso-3»)
y recalcula siempre la ruta de preguntas y opciones a partir de su texto (así cambiar un texto nunca pisa el audio
de otro texto que aún lo use).

Genera narracion/pendiente-<campaña>-<n>.json con los audios que hay que (re)generar:
  - el archivo .mp3 no existe, o
  - el texto cambió respecto a la versión de git --desde (por defecto HEAD).
Después: make audio-borrador ARGS="narracion/pendiente-<campaña>-<n>.json --salida public/mapas/narraciones"
"""
import argparse, json, re, subprocess, sys, unicodedata
from pathlib import Path

ap = argparse.ArgumentParser()
ap.add_argument("campana"); ap.add_argument("capitulo", type=int)
ap.add_argument("--escribir", action="store_true", help="rellena/recalcula los campos de audio en campanas.json")
ap.add_argument("--desde", default="HEAD", help="versión de git con la que comparar textos (vacío = no comparar)")
a = ap.parse_args()

sys.path.insert(0, str(Path(__file__).parent))
from capitulo import cargar
cap = cargar(a.campana, a.capitulo)
e = cap.e
if "escenas" not in e: sys.exit("Este capítulo aún no está en formato por escenas.")
pref = f"{a.campana}-{a.capitulo}"

def slug(t):
    t = unicodedata.normalize("NFD", t.lower())
    t = "".join(ch for ch in t if unicodedata.category(ch) != "Mn")
    return re.sub(r"[^a-z0-9]+", "-", t).strip("-")[:90].strip("-")

def items(cap):
    """(objeto, campo_texto, campo_audio, ruta_por_convención, ¿se recalcula siempre?)"""
    for sid, s in cap.get("escenas", {}).items():
        if s.get("narracion"): yield s, "narracion", "audio", f"narraciones/{pref}-escena-{sid}.mp3", False
        if s.get("despues"): yield s, "despues", "audio_despues", f"narraciones/{pref}-escena-{sid}-despues.mp3", False
        if s.get("pregunta"): yield s, "pregunta", "audio_pregunta", f"narraciones/{pref}-pregunta-{slug(s['pregunta'])}.mp3", True
        if isinstance(s.get("opciones"), list):
            for o in s["opciones"]:
                if "comunes" in o: continue
                t = o.get("lectura") or o.get("opcion")
                yield o, "lectura" if o.get("lectura") else "opcion", "audio", f"narraciones/{pref}-opcion-{slug(t)}.mp3", True
    for ref in cap.get("opciones_comunes", {}).values():
        if ref.get("pregunta"): yield ref, "pregunta", "audio_pregunta", f"narraciones/{pref}-pregunta-{slug(ref['pregunta'])}.mp3", True
        for o in ref.get("opciones", []):
            t = o.get("lectura") or o.get("opcion")
            yield o, "lectura" if o.get("lectura") else "opcion", "audio", f"narraciones/{pref}-opcion-{slug(t)}.mp3", True

# Textos de la versión anterior, por ruta de audio
antes = {}
if a.desde:
    try:
        ev = cargar(a.campana, a.capitulo, a.desde).e
        if not ev.get("escenas"):  # en esa versión el capítulo aún estaba entero en campanas.json
            import json as _j
            ev = _j.loads(subprocess.run(["git", "show", f"{a.desde}:public/mapas/campanas.json"], capture_output=True, text=True, check=True).stdout)["campanas"][cap.ci]["escenarios"][a.capitulo - 1]
        for obj, ct, ca, _, _ in items(ev):
            if obj.get(ca): antes[obj[ca]] = obj[ct]
    except Exception as ex:
        print(f"(no comparo con {a.desde}: {ex.__class__.__name__})")

sin_lectura = []
for obj, ct, ca, conv, recalcular in items(e):
    if ca == "audio" and ct == "opcion": sin_lectura.append(obj["opcion"])
    if a.escribir and (recalcular or not obj.get(ca)): obj[ca] = conv

pendientes, faltan_campo = {}, []
for obj, ct, ca, conv, _ in items(e):
    ruta = obj.get(ca)
    if not ruta: faltan_campo.append(obj[ct][:60]); continue
    archivo = Path("public/mapas") / ruta
    if not archivo.exists() or (ruta in antes and antes[ruta] != obj[ct]):
        pendientes[Path(ruta).stem] = obj[ct]

if a.escribir:
    cap.guardar()
lista = Path(f"narracion/pendiente-{pref}.json")
lista.write_text(json.dumps({"mapas": [{"id": i, "descripcion": t} for i, t in pendientes.items()]}, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")

if sin_lectura: print("OJO: opciones sin `lectura` (infinitivo para leer en voz alta):", *sin_lectura, sep="\n  - ")
if faltan_campo: print("OJO: textos sin campo de audio (usa --escribir):", *faltan_campo, sep="\n  - ")
print(f"{len(pendientes)} audios por generar -> {lista}")
for i in pendientes: print("  ", i)
if pendientes:
    print(f'\nmake audio-borrador ARGS="{lista} --salida public/mapas/narraciones"')
