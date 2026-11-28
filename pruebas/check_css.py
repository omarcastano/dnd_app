"""make check-css: comprueba que el CSS de cada pestaña está encerrado en su contenedor.

Cada CSS de sección debe envolver sus reglas en el contenedor de su pestaña, p. ej.
    :where(#tab-mapas, .mapas-zona) { .libro { … } }
(:where no suma especificidad, así que la cascada no cambia) o empezar el selector por una raíz propia
(.mapa-visor, .tab-heroes, body:has(.tab-heroes.active) …).

FALLA si una clase definida SUELTA (fuera del contenedor) en una sección se define también en otra sección
o en la zona común (base, responsive, cartas, tablas, pie): eso es lo que rompió el asistente de Héroes
cuando mapas.css añadió un `.paso` global. AVISA (sin fallar) de selectores sueltos y de @keyframes repetidos.
"""
import re
import sys
from pathlib import Path

PUBLICO = Path(__file__).resolve().parent.parent / "public"
CSS = "tienda/css/"

# sección → (archivos, raíces del contenedor). Una raíz es un id/clase que solo existe dentro de esa sección
# (o un elemento que la sección cuelga de <body>, como los <dialog> de Mapas).
SECCIONES = {
    "taberna": ([CSS + "tienda.css"], ["#tab-shop"]),
    "cofres": ([CSS + "botin.css"], ["#tab-loot"]),
    "hurto": ([CSS + "robo.css"], ["#tab-rob"]),
    "heroes": (["personajes/app/catalogo.css", "personajes/clases/*/efectos.css"],
               ["#tab-heroes", ".tab-heroes", ".heroes", ".visor", ".efecto", ".ambiente-*"]),
    "bestiario": ([CSS + "bestiario.css"], ["#tab-bestiario", ".tab-bestiario", "#tab-pnj", ".tab-pnj"]),  # PNJ comparte la vista
    "mapas": ([CSS + "mapas.css"], ["#tab-mapas", ".mapas-zona", ".mapa-visor", ".plano-visor", ".enigma-historia"]),
    "enigmas": ([CSS + "puzzles.css", CSS + "enigmas-historia*.css"], ["#tab-puzzles", ".admin-corner"]),
}
# Zona común: la usan varias pestañas a propósito (no se encierra)
COMUNES = [CSS + "base.css", CSS + "responsive.css", CSS + "tablas.css", CSS + "pie.css", "personajes/app/cartas.css"]

CLASE = re.compile(r"\.(-?[_a-zA-Z][\w-]*)")


def trozos(src):
    """Elementos de un nivel: ('r', prelude, cuerpo) para reglas con bloque; ignora comentarios y @import."""
    src = re.sub(r"/\*.*?\*/", "", src, flags=re.S)
    i, n, out = 0, len(src), []
    while i < n:
        if src[i].isspace():
            i += 1
            continue
        j = i
        while j < n and src[j] not in "{;":
            if src[j] in "\"'":
                q, j = src[j], j + 1
                while src[j] != q:
                    j += 1
            j += 1
        if j >= n:
            break
        if src[j] == ";":
            i = j + 1
            continue
        d, k = 1, j + 1
        while d:
            c = src[k]
            if c in "\"'":
                k += 1
                while src[k] != c:
                    k += 1
            elif c == "{":
                d += 1
            elif c == "}":
                d -= 1
            k += 1
        out.append((src[i:j].strip(), src[j + 1:k - 1]))
        i = k
    return out


def es_declaracion(cuerpo):
    return "{" not in cuerpo


def selectores(prel):
    partes, d, cur = [], 0, ""
    for ch in prel:
        d += ch in "([" and 1 or ch in ")]" and -1 or 0
        if ch == "," and d == 0:
            partes.append(cur.strip())
            cur = ""
        else:
            cur += ch
    return partes + [cur.strip()]


def menciona_raiz(sel, raices):
    for r in raices:
        patron = re.escape(r).replace(r"\*", r"[\w-]*") + r"(?![\w-])"
        if re.search(patron, sel):
            return True
    return False


def analizar(src, raices):
    """Devuelve (clases encerradas, {clase: [selectores sueltos]})."""
    encerradas, sueltas = set(), {}

    def recorrer(items, dentro):
        for prel, cuerpo in items:
            if prel.startswith("@"):
                if re.match(r"@(media|supports|container|layer)", prel):
                    recorrer(trozos(cuerpo), dentro)
                continue  # @keyframes, @font-face…
            for sel in selectores(prel):
                anclado = dentro or menciona_raiz(sel, raices) or re.match(r"(body|html|:root)(?![\w-])", sel)
                for c in CLASE.findall(sel):
                    if anclado:
                        encerradas.add(c)
                    else:
                        sueltas.setdefault(c, []).append(sel)
            if not es_declaracion(cuerpo):  # regla anidada: lo de dentro hereda si el contenedor es una raíz
                envuelve = dentro or any(menciona_raiz(s, raices) for s in selectores(prel))
                recorrer(trozos(cuerpo), envuelve)

    recorrer(trozos(src), False)
    return encerradas, sueltas


def keyframes(src):
    return re.findall(r"@keyframes\s+([\w-]+)", re.sub(r"/\*.*?\*/", "", src, flags=re.S))


def comprobar(fuentes):
    """fuentes: lista de (sección o None si común, archivo, texto, raíces). Devuelve (errores, avisos)."""
    definidas, sueltas_por = {}, []
    errores, avisos = [], []
    animaciones = {}
    for seccion, archivo, src, raices in fuentes:
        clave = seccion or "común"
        if seccion is None:
            todas = set(CLASE.findall(" ".join(p for p, _ in _todas_reglas(src))))
            definidas.setdefault(clave, set()).update(todas)
        else:
            enc, sue = analizar(src, raices)
            definidas.setdefault(clave, set()).update(enc | set(sue))
            for c, sels in sue.items():
                sueltas_por.append((seccion, archivo, c, sels))
        for k in keyframes(src):
            animaciones.setdefault(k, []).append(archivo)
    for seccion, archivo, c, sels in sueltas_por:
        otras = [s for s, cl in definidas.items() if s != seccion and c in cl]
        if otras:
            errores.append(f"{archivo}: «.{c}» está suelta (sin contenedor de «{seccion}») y también la define {', '.join(otras)} → {sels[0]}")
        else:
            avisos.append(f"{archivo}: «.{c}» está suelta, fuera del contenedor de «{seccion}» → {sels[0]}")
    for k, archivos in animaciones.items():
        if len(set(archivos)) > 1:
            avisos.append(f"@keyframes «{k}» repetido en {', '.join(sorted(set(archivos)))} (gana el último que se carga)")
    return errores, avisos


def _todas_reglas(src):
    for prel, cuerpo in trozos(src):
        if prel.startswith("@"):
            if re.match(r"@(media|supports|container|layer)", prel):
                yield from _todas_reglas(cuerpo)
            continue
        yield prel, cuerpo
        if not es_declaracion(cuerpo):
            yield from _todas_reglas(cuerpo)


def autoprueba():
    """El caso real que motivó este chequeo: `.paso` suelta en mapas.css rompe el asistente de Héroes."""
    heroes = ":where(#tab-heroes) { .paso { padding: 8px; } }"
    mapas_mal = ".paso { color: red; }"
    mapas_bien = ":where(#tab-mapas, .mapas-zona) { .paso { color: red; } }"
    r = SECCIONES
    mal, _ = comprobar([("heroes", "h.css", heroes, r["heroes"][1]), ("mapas", "m.css", mapas_mal, r["mapas"][1])])
    bien, _ = comprobar([("heroes", "h.css", heroes, r["heroes"][1]), ("mapas", "m.css", mapas_bien, r["mapas"][1])])
    assert any(".paso" in e for e in mal), "la autoprueba no detecta .paso suelta"
    assert not bien, f"la autoprueba da falso positivo: {bien}"


def main():
    autoprueba()
    fuentes = []
    for seccion, (patrones, raices) in SECCIONES.items():
        for patron in patrones:
            for ruta in sorted(PUBLICO.glob(patron)):
                fuentes.append((seccion, str(ruta.relative_to(PUBLICO)), ruta.read_text(encoding="utf-8"), raices))
    for patron in COMUNES:
        for ruta in sorted(PUBLICO.glob(patron)):
            fuentes.append((None, str(ruta.relative_to(PUBLICO)), ruta.read_text(encoding="utf-8"), []))
    errores, avisos = comprobar(fuentes)
    for a in avisos:
        print("AVISO", a)
    for e in errores:
        print("ERROR", e)
    print(f"check-css: {len(fuentes)} archivos, {len(errores)} errores, {len(avisos)} avisos")
    sys.exit(1 if errores else 0)


if __name__ == "__main__":
    main()
