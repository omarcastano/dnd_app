#!/usr/bin/env python3
"""Inventario de las clases existentes para evitar repetir habilidades al crear una nueva.

Uso: python3 .claude/skills/crear-personaje/scripts/inventario_clases.py
Lee cada carpeta de public/personajes/clases/ y su <clase>/<clase>.json; imprime, por clase:
armas, reglas de clase y de raza, poderes (rol, ataques, habilidades especiales con
rango/valor/subtítulo) y dones (nombre, tabla). Al final, nombres de habilidad repetidos.
"""
import json
import sys
from collections import defaultdict
from pathlib import Path

RAIZ = Path(__file__).resolve().parents[4] / "public" / "personajes"


def cargar(ruta):
    with open(ruta, encoding="utf-8") as f:
        return json.load(f)


def main():
    # Se recorren las carpetas (no solo clases.json) para incluir clases aún sin registrar.
    clases = sorted(p.name for p in (RAIZ / "clases").iterdir() if p.is_dir())
    usados = defaultdict(list)
    for entrada in clases:
        cid = entrada["id"] if isinstance(entrada, dict) else entrada
        ruta = RAIZ / "clases" / cid / f"{cid}.json"
        if not ruta.exists():
            continue
        d = cargar(ruta)
        c = d.get("clase", {})
        print(f"\n=== {c.get('nombre', cid)} ({cid}) ===")
        print("Armas:", ", ".join(c.get("armas", [])))
        for r in c.get("reglas", []):
            print("  Regla de clase:", r)
        for carta in d.get("cartas", []):
            t = carta.get("tipo")
            if t == "personaje":
                for r in carta.get("reglas_raza", []):
                    print(f"  Regla de raza ({carta.get('raza', '?')}):", r)
            elif t == "tabla":
                print(f"- Poder «{carta['nombre']}» nivel {carta.get('nivel')}")
                for f in carta.get("ataques", []) + carta.get("tabla", []):
                    print(f"    {f['rango_d20']:>6} {f['nombre']} ({f.get('valor')}) · {f.get('subtitulo', '')}")
                    usados[f["nombre"].lower()].append(c.get("nombre", cid))
                print("    Descripción:", carta.get("descripcion", ""))
            elif t == "ilustrada":
                nombre = carta.get("nombre_habilidad") or carta.get("nombre")
                print(f"- Don «{carta.get('nombre')}»: {nombre} — {carta.get('descripcion', '')}")
                usados[nombre.lower()].append(c.get("nombre", cid))
    rep = {k: v for k, v in usados.items() if len(set(v)) > 1}
    print("\nNombres de habilidad compartidos entre clases:", rep or "ninguno")


if __name__ == "__main__":
    sys.exit(main())
