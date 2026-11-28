"""Recorre TODOS los caminos posibles de un capítulo por escenas y avisa de los problemas.

Uso:
  .venv/bin/python .claude/skills/rehacer-capitulo-por-escenas/scripts/validar_caminos.py <campaña-id> <capítulo 1-4> [--combates 4] [--max-caminos 5000000]

Comprueba (estado = escena + marcas, igual que mapas.js):
  - destinos (`va_a`, `sigue`, `inicio`) que no existen;
  - caminos sin salida (ninguna opción visible) o bucles infinitos;
  - finales con un número de combates distinto del esperado (4; en el capítulo IV, 4 + el jefe:
    las escenas con `"jefe": true` en `combate` se cuentan aparte y debe haber exactamente 1);
  - escenas inalcanzables;
  - escenas con una sola opción visible (aviso: solo es aceptable cuando ya hicieron todo lo opcional);
  - enigmas que se pueden saltar: avisa si algún camino llega a `fin` sin pasar por una escena con `enigma`.
Termina con código 1 si hay errores (los avisos de «solo 1 opción» no cuentan como error).
"""
import argparse, json, sys
from collections import Counter

ap = argparse.ArgumentParser()
ap.add_argument("campana"); ap.add_argument("capitulo", type=int)
ap.add_argument("--combates", type=int, default=4, help="combates normales por final (sin contar el jefe)")
ap.add_argument("--max-caminos", type=int, default=5_000_000)
a = ap.parse_args()

sys.path.insert(0, str(__import__("pathlib").Path(__file__).parent))
from capitulo import cargar
e = cargar(a.campana, a.capitulo).e
if "escenas" not in e: sys.exit("Este capítulo aún no está en formato por escenas.")
E, C = e["escenas"], e.get("opciones_comunes", {})

def opciones(s):
    r = s.get("opciones", [])
    r = C[r]["opciones"] if isinstance(r, str) else r
    out = []
    for o in r:
        if "comunes" in o:
            out += [{**c, "si": c.get("si", []) + o.get("si", []), "salvo": c.get("salvo", []) + o.get("salvo", []), "comun": 1} for c in C[o["comunes"]]["opciones"]]
        else:
            out.append(o)
    return out

def visibles(s, m):
    v, destinos = [], set()
    for o in opciones(s):
        if all(x in m for x in o.get("si", [])) and not any(x in m for x in o.get("salvo", [])) and not (o.get("comun") and o["va_a"] in destinos):
            destinos.add(o["va_a"]); v.append(o)
    return v

errores, avisos = [], []
if e.get("inicio") not in E: errores.append(f"inicio inexistente: {e.get('inicio')}")
for sid, s in E.items():
    for o in opciones(s):
        if o["va_a"] not in E: errores.append(f"{sid}: destino inexistente {o['va_a']}")
    if s.get("sigue") and s["sigue"] not in E: errores.append(f"{sid}: sigue inexistente {s['sigue']}")
    if not (s.get("fin") or s.get("sigue") or s.get("opciones")): errores.append(f"{sid}: no tiene opciones, sigue ni fin")
if errores:
    print("\n".join(errores)); sys.exit(1)

hay_enigma = any(s.get("enigma") for s in E.values())
alcanzadas, finales, maxlen = set(), 0, 0
sys.setrecursionlimit(10000)

def dfs(sid, marcas, comb, jefes, enigma, camino):
    global finales, maxlen
    if finales >= a.max_caminos: return
    if len(camino) > 80: errores.append("bucle: " + " > ".join(camino[-8:])); return
    s = E[sid]; alcanzadas.add(sid)
    m = marcas | {sid} | set(s.get("marca", []))
    if s.get("combate"):
        if s["combate"].get("jefe"): jefes += 1
        else: comb += 1
    enigma = enigma or bool(s.get("enigma"))
    if s.get("fin"):
        finales += 1; maxlen = max(maxlen, len(camino))
        if comb != a.combates: errores.append(f"final con {comb} combates: " + " > ".join(camino))
        if a.capitulo == 4 and jefes != 1: errores.append(f"final con {jefes} jefes: " + " > ".join(camino))
        if hay_enigma and not enigma: errores.append("final sin pasar por el enigma: " + " > ".join(camino))
        return
    if s.get("sigue"): return dfs(s["sigue"], m, comb, jefes, enigma, camino + [s["sigue"]])
    v = visibles(s, m)
    if not v: errores.append("sin salida: " + " > ".join(camino)); return
    if len(v) == 1: avisos.append(f"solo 1 opción en {sid} tras " + " > ".join(camino[-3:]))
    for o in v: dfs(o["va_a"], m, comb, jefes, enigma, camino + [o["va_a"]])

dfs(e["inicio"], frozenset(), 0, 0, False, [e["inicio"]])
for k in E:
    if k not in alcanzadas: errores.append("inalcanzable: " + k)

print(f"Escenas: {len(E)} | finales posibles: {finales}{' (cortado en --max-caminos)' if finales >= a.max_caminos else ''} | camino más largo: {maxlen}")
if avisos:
    print("\nAVISOS (revisa que solo pase cuando ya hicieron todo lo opcional):")
    for p, n in Counter(avisos).most_common(40): print(f"{n:7}× {p}")
if errores:
    print("\nERRORES:")
    for p, n in Counter(errores).most_common(60): print(f"{n:7}× {p}")
    sys.exit(1)
print("\nOK: todo camino llega a fin con los combates esperados, sin callejones" + (" y pasando por el enigma." if hay_enigma else "."))
