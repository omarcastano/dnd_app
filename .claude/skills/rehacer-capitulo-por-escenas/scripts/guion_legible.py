"""Genera la vista legible (Markdown + diagrama Mermaid) del guion de un capítulo por escenas.

Uso:
  .venv/bin/python .claude/skills/rehacer-capitulo-por-escenas/scripts/guion_legible.py <campaña-id> <capítulo 1-4>
  .venv/bin/python .claude/skills/rehacer-capitulo-por-escenas/scripts/guion_legible.py --todos     (= make guiones)

Escribe guiones/<campaña>-<n>.md (fuera de public/, no se publica). Es una VISTA GENERADA para leer y analizar
(personas u otro LLM): la fuente es public/mapas/guiones/<campaña>-<n>.json. Si se edita el .md no cambia nada:
hay que editar el JSON y volver a generarlo.
"""
import json, re, sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from capitulo import cargar, CAMPANAS

ROMANOS = ["I", "II", "III", "IV"]
LETRAS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ"


def opciones(e, s):
    """Lista expandida como en mapas.js: [(opción, ¿viene de comunes?, id de la lista común)]."""
    C = e.get("opciones_comunes", {})
    r = s.get("opciones", [])
    if isinstance(r, str):
        return [(o, True, r) for o in C[r]["opciones"]]
    out = []
    for o in r:
        if "comunes" in o:
            for c in C[o["comunes"]]["opciones"]:
                out.append(({**c, "si": c.get("si", []) + o.get("si", []), "salvo": c.get("salvo", []) + o.get("salvo", [])}, True, o["comunes"]))
        else:
            out.append((o, False, None))
    return out


def pregunta(e, s):
    r = s.get("opciones")
    return s.get("pregunta") or (e["opciones_comunes"][r].get("pregunta") if isinstance(r, str) else None) or "¿Qué hacéis?"


def tipo(s):
    if s.get("fin"): return "fin"
    if s.get("combate"): return "jefe" if s["combate"].get("jefe") else "combate"
    if s.get("enigma"): return "enigma"
    return "escena"


def cond(o):
    p = []
    if o.get("si"): p.append("si " + " y ".join(f"`{x}`" for x in o["si"]))
    if o.get("salvo"): p.append("salvo " + " o ".join(f"`{x}`" for x in o["salvo"]))
    return "; ".join(p) or "siempre"


def mm(t):  # texto seguro para Mermaid
    return re.sub(r'["<>{}|]', "", t).replace("\n", " ")


def generar(campana, n):
    cap = cargar(campana, n)
    e, camp = cap.e, cap.datos["campanas"][cap.ci]
    E = e["escenas"]
    fuente = f"public/mapas/{cap.ficha['guion']}" if cap.ficha.get("guion") else "public/mapas/campanas.json"
    L = []
    w = L.append
    w(f"<!-- GENERADO con `make guiones` desde {fuente}. NO EDITAR: los cambios se hacen en el JSON. -->")
    w(f"# {camp['nombre']} · Capítulo {ROMANOS[n - 1]}: {e['titulo']}\n")
    w(f"> **Fuente única:** `{fuente}` (la app la carga tal cual). Esquema y flujo de trabajo: `guiones/LEEME.md`.")
    w(f"> Mapa: `public/mapas/imagenes/{e['mapa']}.webp` · Validar: `make validar-guion CAMPANA={campana} CAPITULO={n}`\n")
    w(f"**Objetivo:** {e.get('objetivo', '')}\n")
    if e.get("geografia"): w(f"**Cómo es el mapa:** {e['geografia']}\n")
    w(f"**Escena inicial:** `{e['inicio']}` · **Escenas:** {len(E)} · **Combates:** {sum(1 for s in E.values() if s.get('combate'))} escenas de combate (cada camino pasa por 4)\n")

    w("## Marcas (estado del grupo)\n")
    w("Una marca existe si se visitó la escena con ese id o si una escena visitada la pone en `marca`. Las opciones se ven solo si tienen todas sus `si` y ninguna de sus `salvo`.\n")
    marcas = {}
    for sid, s in E.items():
        for m in s.get("marca", []): marcas.setdefault(m, []).append(sid)
    w("| Marca | La ponen | Se muestra al máster |")
    w("|---|---|---|")
    for m, quien in marcas.items():
        w(f"| `{m}` | {', '.join(f'`{q}`' for q in quien)} | {e.get('estados', {}).get(m, {}).get('texto', '—')} |")
    w("")

    if e.get("personajes"):
        w("## Personajes\n")
        for p in e["personajes"]:
            w(f"- **{p['nombre']}** ({p.get('rol', '')}): {p.get('quien', '')} *Cómo interpretarlo:* {p.get('como_interpretarlo', '')} *Qué sabe:* {p.get('que_sabe', '')}")
        w("")

    w("## Diagrama\n")
    w("Flecha continua = opción (con su condición); discontinua = `sigue` (sin elección). Rojo = combate, morado = enigma, verde = fin.\n")
    w("```mermaid\nflowchart TD")
    for sid, s in E.items():
        t = mm(s["titulo"])
        forma = {"combate": f'(["⚔ {t}"])', "jefe": f'(["👑 {t}"])', "enigma": f'{{{{"🧩 {t}"}}}}', "fin": f'((" {t} "))'}.get(tipo(s), f'["{t}"]')
        w(f'  {sid.replace("-", "_")}{forma}')
    for sid, s in E.items():
        a = sid.replace("-", "_")
        if s.get("sigue"): w(f'  {a} -.-> {s["sigue"].replace("-", "_")}')
        vistos = set()
        for o, comun, _ in opciones(e, s):
            clave = (o["va_a"], cond(o))
            if clave in vistos: continue
            vistos.add(clave)
            etiqueta = mm(o["opcion"])[:40] + ("" if cond(o) == "siempre" else " [" + mm(cond(o).replace("`", "")) + "]")
            w(f'  {a} -->|"{etiqueta}"| {o["va_a"].replace("-", "_")}')
    for sid, s in E.items():
        clase = {"combate": "combate", "jefe": "combate", "enigma": "enigma", "fin": "fin"}.get(tipo(s))
        if clase: w(f"  class {sid.replace('-', '_')} {clase}")
    w("  classDef combate fill:#f8d7d7,stroke:#a33\n  classDef enigma fill:#e6dcf5,stroke:#63a\n  classDef fin fill:#d7f0d7,stroke:#393")
    w("```\n")

    if e.get("opciones_comunes"):
        w("## Opciones comunes\n")
        for k, ref in e["opciones_comunes"].items():
            w(f"### `{k}` — {ref.get('pregunta', '')}\n")
            w("| Opción | Va a | Condición | Nota para el máster |")
            w("|---|---|---|---|")
            for o in ref["opciones"]:
                w(f"| {o['opcion']} | `{o['va_a']}` | {cond(o)} | {o.get('nota', '')} |")
            w("")

    w("## Escenas\n")
    for sid, s in E.items():
        w(f"### `{sid}` — {s['titulo']}\n")
        w(f"*{tipo(s).capitalize()}* · Lugar: {s.get('lugar', '')} · Posición: x {s.get('x')} %, y {s.get('y')} %" + (f" · Pone marcas: {', '.join(f'`{m}`' for m in s['marca'])}" if s.get("marca") else ""))
        llegan = sorted({f"`{o}`" for o, t in [(k, x) for k, x in E.items()] for op, _, _ in opciones(e, t) if op["va_a"] == sid} | {f"`{k}` (sigue)" for k, x in E.items() if x.get("sigue") == sid})
        w(f"\nLlegan desde: {', '.join(llegan) if llegan else '— (inicio)'}\n")
        w(f"**Narración** (leer en voz alta):\n> {s.get('narracion', '')}\n")
        if s.get("master"): w(f"**Para el máster:** {s['master']}\n")
        if s.get("combate"):
            c = s["combate"]
            w(f"**Combate:** {' + '.join(c['enemigos'])}. {c.get('nota', '')}" + (f" *Despliegue:* {c['despliegue']}" if c.get("despliegue") else ""))
            w(f"\n**Tras el combate:**\n> {s.get('despues', '')}\n")
            if s.get("master_despues"): w(f"**Para el máster (tras el combate):** {s['master_despues']}\n")
        if s.get("enigma"):
            g = s["enigma"]
            w(f"**Enigma** `{g['id']}` «{g.get('titulo', '')}». Respuesta: `{g.get('respuesta', '—')}`. Si lo resuelven: {g.get('recompensa', '')} Si fallan: {g.get('fallo', '')}\n")
        if s.get("fin"):
            w("**Fin del capítulo** (la carta añade la vuelta a la taberna: monedas de eventos, cofres, compras).\n")
        elif s.get("sigue"):
            w(f"**Sigue sin elegir →** `{s['sigue']}`\n")
        else:
            w(f"**Pregunta:** {pregunta(e, s)}\n")
            w("| # | Opción (botón) | Se lee | Va a | Condición | Nota para el máster |")
            w("|---|---|---|---|---|---|")
            for i, (o, comun, ref) in enumerate(opciones(e, s)):
                w(f"| {i + 1}{' ᶜ' if comun else ''} | {o['opcion']} | {o.get('lectura', '')} | `{o['va_a']}` | {cond(o)} | {o.get('nota', '')} |")
            if any(c for _, c, _ in opciones(e, s)):
                w("\nᶜ = viene de opciones comunes; si va al mismo destino que otra opción ya visible, no se muestra.")
            w("")
    destino = Path("guiones") / f"{campana}-{n}.md"
    destino.parent.mkdir(exist_ok=True)
    destino.write_text("\n".join(L) + "\n", encoding="utf-8")
    print("Escrito", destino)


if __name__ == "__main__":
    if sys.argv[1:] == ["--todos"]:
        datos = json.loads(CAMPANAS.read_text(encoding="utf-8"))
        for c in datos["campanas"]:
            for i, e in enumerate(c["escenarios"], 1):
                if e.get("guion") or e.get("escenas"):
                    generar(c["id"], i)
    else:
        generar(sys.argv[1], int(sys.argv[2]))
