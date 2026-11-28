"""Juega los enigmas del libro de campañas en modo historia (make probar-enigmas).

Para cada enigma de public/mapas/campanas.json abre la campaña y el capítulo en el navegador, pulsa «Abrir enigma» y:
  1. comprueba que el tablero no se da por resuelto solo y que no delata la solución (sin texto descifrado en vivo,
     sin cifras «cumplidas», sin avisos de error en rojo);
  2. en el primero de cada tipo, juega «a lo bruto» (tanteo sin pensar) y comprueba que NO se llega: el enigma no
     se resuelve y, donde hay límite, se agota;
  3. resuelve el enigma con un solucionador (como lo haría un equipo que piensa) y comprueba que «Comprobar» lo acepta;
  4. comprueba que «Comprobar» con una respuesta mala gasta un intento del equipo.
Usa el Chrome del sistema como pruebas/probar.py. Sale con código 1 si algo falla.
"""
import functools
import itertools
import json
import random
import re
import socketserver
import sys
import threading
import unicodedata
from collections import deque
from pathlib import Path

from playwright.sync_api import sync_playwright

sys.path.insert(0, str(Path(__file__).resolve().parent))
from probar import PUBLICO, Silencioso, navegador  # noqa: E402

CAMPANAS = json.loads((PUBLICO / "mapas" / "campanas.json").read_text(encoding="utf-8"))["campanas"]
A = "ABCDEFGHIJKLMNOPQRSTUVWXYZ"
DIRS = [(1, 0), (-1, 0), (0, 1), (0, -1)]
fallos = []


def afirmar(cond, texto):
    print(f"   {'ok ' if cond else 'MAL'} {texto}")
    if not cond:
        fallos.append(texto)


def normalizar(t):
    t = unicodedata.normalize("NFD", str(t).upper())
    return re.sub(r"\s+", " ", re.sub(r"[^A-Z ]", " ", t)).strip()


# ---------- navegación ----------
def abrir(nav, url, ci, ei, pi, eid):
    ctx = nav.new_context(viewport={"width": 1280, "height": 900}, locale="es-ES", reduced_motion="reduce")
    p = ctx.new_page()
    errores = []
    p.on("pageerror", lambda e: errores.append(str(e)))
    p.on("console", lambda m: m.type == "error" and not m.text.startswith("Failed to load resource") and errores.append(m.text))
    p.goto(url, wait_until="networkidle")
    p.click('.tab-btn[data-tab="mapas"]')
    p.wait_for_selector(f'[data-abrir-campana="{ci}"]')
    p.click(f'[data-abrir-campana="{ci}"]')
    p.wait_for_timeout(200)
    if isinstance(pi, str):  # capítulo por escenas: se deja el recorrido en la escena del enigma
        clave = f"taberna:mapas:{CAMPANAS[ci]['id']}:{ei + 1}:aventura"
        p.evaluate("([k, v]) => localStorage.setItem(k, v)", [clave, json.dumps({"pasos": [{"e": pi, "o": None}], "fase": 0})])
    p.locator(f'#mapas-campanas [data-pagina="{ei + 1}"]').first.click()
    p.wait_for_timeout(300)
    sel = f'[data-enigma-escena="{pi}"]' if isinstance(pi, str) else f'[data-enigma-paso="{pi}"]'
    p.click(f'#mapas-campanas .boton-enigma[data-enigma="{eid}"]{sel}')
    p.wait_for_selector(f"#view-{eid}.modo-historia")
    p.wait_for_timeout(300)
    return ctx, p, errores


def vista(p, eid):
    return f"#view-{eid}"


def intentos(p, eid):
    return p.locator(f"{vista(p, eid)} .historia-intentos .intento:not(.gastado)").count()


def exito(p, eid):
    return p.locator(f"#view-{eid}.historia-exito").count() == 1


def fallado(p, eid):
    return p.locator(f"#view-{eid}.historia-fallo").count() == 1


def comprobar(p, boton):
    p.click(boton)
    p.wait_for_timeout(150)


def leer_tabla(p, sel):
    """Filas de la tabla como listas de dicts {cls, txt, r, c}."""
    return p.evaluate("""sel => [...document.querySelectorAll(sel + ' tr')].map(tr => [...tr.children].map(td => ({
        cls: td.className, txt: td.textContent.trim(), r: td.dataset.r ?? null, c: td.dataset.c ?? null })))""", sel)


# ---------- solucionadores ----------
def conectadas(sombra, n):
    libres = [(r, c) for r in range(n) for c in range(n) if not sombra[r][c]]
    if not libres:
        return False
    visto = {libres[0]}
    pila = [libres[0]]
    while pila:
        r, c = pila.pop()
        for dr, dc in DIRS:
            x = (r + dr, c + dc)
            if 0 <= x[0] < n and 0 <= x[1] < n and not sombra[x[0]][x[1]] and x not in visto:
                visto.add(x)
                pila.append(x)
    return len(visto) == len(libres)


def resolver_hitori(v):
    n = len(v)
    s = [[False] * n for _ in range(n)]

    def choca(r, c):
        if s[r][c] and ((r and s[r - 1][c]) or (c and s[r][c - 1])):
            return True
        if not s[r][c]:
            if any(not s[r][k] and v[r][k] == v[r][c] for k in range(c)):
                return True
            if any(not s[k][c] and v[k][c] == v[r][c] for k in range(r)):
                return True
        return False

    def rec(i):
        if i == n * n:
            return conectadas(s, n)
        r, c = divmod(i, n)
        for val in (False, True):
            s[r][c] = val
            if not choca(r, c) and rec(i + 1):
                return True
        s[r][c] = False
        return False

    return s if rec(0) else None


def resolver_carpas(n, arboles, filas, cols):
    arb = set(arboles)
    cand = [(r, c) for r in range(n) for c in range(n) if (r, c) not in arb and any((r + dr, c + dc) in arb for dr, dc in DIRS)]
    puestas, f, co = [], [0] * n, [0] * n

    def emparejable():
        de_arbol = {}

        def probar(i, visto):
            for a in arboles:
                if a not in visto and abs(a[0] - puestas[i][0]) + abs(a[1] - puestas[i][1]) == 1:
                    visto.add(a)
                    if a not in de_arbol or probar(de_arbol[a], visto):
                        de_arbol[a] = i
                        return True
            return False

        return all(probar(i, set()) for i in range(len(puestas)))

    def rec(k):
        if len(puestas) == len(arboles):
            return f == filas and co == cols and emparejable()
        if k == len(cand):
            return False
        r, c = cand[k]
        if f[r] < filas[r] and co[c] < cols[c] and all(max(abs(r - a), abs(c - b)) > 1 for a, b in puestas):
            puestas.append((r, c)); f[r] += 1; co[c] += 1
            if rec(k + 1):
                return True
            puestas.pop(); f[r] -= 1; co[c] -= 1
        # poda: si la fila ya pasó y no se cumple, no sigue
        if k + 1 < len(cand) and cand[k + 1][0] != r and f[r] != filas[r]:
            return False
        return rec(k + 1)

    return puestas if rec(0) else None


def visibles(d, r, c):
    n = len(d)
    out = [(r, c)]
    for dr, dc in DIRS:
        rr, cc = r + dr, c + dc
        while 0 <= rr < n and 0 <= cc < n and d[rr][cc] == "W":
            out.append((rr, cc)); rr += dr; cc += dc
    return out


def resolver_lightup(d):
    n = len(d)
    bomb = [[False] * n for _ in range(n)]
    prohib = [[False] * n for _ in range(n)]
    ilum = [[0] * n for _ in range(n)]
    muros = [(r, c, int(d[r][c])) for r in range(n) for c in range(n) if d[r][c].isdigit()]

    def muros_ok(final=False):
        for r, c, k in muros:
            puestas = libres = 0
            for dr, dc in DIRS:
                rr, cc = r + dr, c + dc
                if 0 <= rr < n and 0 <= cc < n and d[rr][cc] == "W":
                    if bomb[rr][cc]:
                        puestas += 1
                    elif not prohib[rr][cc] and not ilum[rr][cc]:
                        libres += 1
            if puestas > k or puestas + libres < k or (final and puestas != k):
                return False
        return True

    def poner(r, c, delta):
        for rr, cc in visibles(d, r, c):
            ilum[rr][cc] += delta

    def rec():
        if not muros_ok():
            return False
        obj = next(((r, c) for r in range(n) for c in range(n) if d[r][c] == "W" and not ilum[r][c]), None)
        if not obj:
            return muros_ok(True)
        marcadas = []
        for r, c in visibles(d, *obj):
            if prohib[r][c] or ilum[r][c]:
                continue
            bomb[r][c] = True; poner(r, c, 1)
            if rec():
                return True
            bomb[r][c] = False; poner(r, c, -1)
            prohib[r][c] = True; marcadas.append((r, c))
        for r, c in marcadas:
            prohib[r][c] = False
        return False

    return bomb if rec() else None


def resolver_lightsout(g):
    n = len(g)
    mejor = None
    for primera in itertools.product([0, 1], repeat=n):
        e = [row[:] for row in g]
        pulsos = []

        def pulsar(r, c):
            for dr, dc in [(0, 0)] + DIRS:
                rr, cc = r + dr, c + dc
                if 0 <= rr < n and 0 <= cc < n:
                    e[rr][cc] ^= 1
            pulsos.append((r, c))

        for c, x in enumerate(primera):
            if x:
                pulsar(0, c)
        for r in range(1, n):
            for c in range(n):
                if e[r - 1][c]:
                    pulsar(r, c)
        if not any(any(f) for f in e) and (mejor is None or len(pulsos) < len(mejor)):
            mejor = pulsos
    return mejor


def camino_hanoi(n, circular):
    inicio, meta = "0" * n, "2" * n
    previo = {inicio: None}
    cola = deque([inicio])
    while cola:
        e = cola.popleft()
        if e == meta:
            break
        arriba = [-1, -1, -1]
        for i in range(n - 1, -1, -1):
            arriba[int(e[i])] = i
        for de in range(3):
            x = arriba[de]
            if x < 0:
                continue
            for a in range(3):
                if a == de or (circular and a != (de + 1) % 3) or (arriba[a] >= 0 and arriba[a] < x):
                    continue
                s = e[:x] + str(a) + e[x + 1:]
                if s not in previo:
                    previo[s] = (e, de, a)
                    cola.append(s)
    pasos, e = [], meta
    while previo[e]:
        e, de, a = previo[e]
        pasos.append((de, a))
    return pasos[::-1]


def evaluar_mm(intento, clave):
    negras = sum(a == b for a, b in zip(intento, clave))
    comunes = sum(min(intento.count(x), clave.count(x)) for x in set(intento))
    return negras, comunes - negras


def resolver_galaxias(n, centros):
    """centros: [(cr, cc)] en coordenadas dobles. Devuelve asignación n×n o None."""
    asig = [[-1] * n for _ in range(n)]
    for k, (cr, cc) in enumerate(centros):
        rs = [(cr - 1) // 2, (cr + 1) // 2] if cr % 2 else [cr // 2]
        cs = [(cc - 1) // 2, (cc + 1) // 2] if cc % 2 else [cc // 2]
        for r in rs:
            for c in cs:
                asig[r][c] = k

    def conexa(k):
        celdas = [(r, c) for r in range(n) for c in range(n) if asig[r][c] == k]
        visto = {celdas[0]}
        pila = [celdas[0]]
        while pila:
            r, c = pila.pop()
            for dr, dc in DIRS:
                x = (r + dr, c + dc)
                if 0 <= x[0] < n and 0 <= x[1] < n and asig[x[0]][x[1]] == k and x not in visto:
                    visto.add(x); pila.append(x)
        return len(visto) == len(celdas)

    def alcanzable(r, c, k):
        """¿la celda toca (por un lado) alguna celda ya de la galaxia k? (crecimiento conexo)"""
        return any(0 <= r + dr < n and 0 <= c + dc < n and asig[r + dr][c + dc] == k for dr, dc in DIRS)

    def rec():
        libre = next(((r, c) for r in range(n) for c in range(n) if asig[r][c] < 0), None)
        if not libre:
            return all(conexa(k) for k in range(len(centros)))
        r, c = libre
        opciones = sorted(range(len(centros)), key=lambda k: abs(centros[k][0] - 2 * r) + abs(centros[k][1] - 2 * c))
        for k in opciones:
            mr, mc = centros[k][0] - r, centros[k][1] - c
            if not (0 <= mr < n and 0 <= mc < n) or asig[mr][mc] >= 0:
                continue
            if not (alcanzable(r, c, k) or alcanzable(mr, mc, k)) and abs(centros[k][0] - 2 * r) + abs(centros[k][1] - 2 * c) > 2 * n:
                continue
            asig[r][c] = asig[mr][mc] = k
            if rec():
                return True
            asig[r][c] = asig[mr][mc] = -1
        return False

    sys.setrecursionlimit(10000)
    return asig if rec() else None


# ---------- jugadores por enigma ----------
def jugar_cipher(p, en, primero):
    v = vista(p, "cipher")
    afirmar(p.locator(f"{v} #decryptedText").count() == 0, "el cifrado no muestra texto descifrado en vivo")
    cif = p.inner_text(f"{v} .cipher-pagina.izquierda .cipher-text").strip()
    mensaje = normalizar(en["mensaje"])
    if primero:
        # tanteo: girar el dial las 26 posiciones no lee nada ni resuelve
        for _ in range(26):
            p.click(f'{v} [data-cif-desp="1"]')
        texto = normalizar(p.inner_text(v))
        afirmar(mensaje not in texto, "girar el dial entero no muestra el mensaje en claro")
        afirmar(not exito(p, "cipher") and intentos(p, "cipher") == 3, "girar el dial no resuelve ni gasta intentos")
        comprobar(p, "#cipherCheck")
        afirmar(intentos(p, "cipher") == 3, "Comprobar sin respuesta no gasta intento")
    p.fill(f"{v} #cipherRespuesta", "FARO DEL NORTE")
    comprobar(p, "#cipherCheck")
    afirmar(intentos(p, "cipher") == 2 and not exito(p, "cipher"), "respuesta mala gasta un intento")
    # como un equipo: buscar la palabra conocida entre las cifradas de su tamaño y deducir el salto
    conocida = re.findall(r"\b[A-Z]{3,}\b", en["pista_clave"])
    conocida = [w for w in conocida if w in mensaje.split()][0]
    salto = None
    for w in cif.split():
        if len(w) == len(conocida):
            d = (A.index(w[0]) - A.index(conocida[0])) % 26
            if "".join(A[(A.index(ch) - d) % 26] for ch in w) == conocida:
                salto = d
                break
    afirmar(salto == en["desplazamiento"] % 26, f"la palabra conocida «{conocida}» da el salto {salto}")
    claro = "".join(A[(A.index(ch) - salto) % 26] if ch in A else ch for ch in cif)
    afirmar(claro == mensaje, "con ese salto el libro se lee entero")
    p.fill(f"{v} #cipherRespuesta", en["respuesta"].lower())
    comprobar(p, "#cipherCheck")
    afirmar(exito(p, "cipher"), f"«{en['respuesta']}» se acepta con Comprobar")


def jugar_lightsout(p, en, primero, abrir_otro):
    v = vista(p, "lightsout")
    filas = leer_tabla(p, "#lightsBoard")
    g = [[1 if " on" in td["cls"] else 0 for td in fila] for fila in filas]
    afirmar(len(g) == 5, "Lights Out en historia es 5×5")
    info = p.inner_text("#lightsInfo")
    limite = int(re.search(r"de (\d+)", info).group(1))
    minimo = int(re.search(r"Mínimo posible: (\d+)", info).group(1))
    afirmar(limite == minimo + 3, f"límite de pulsaciones = mínimo + 3 ({limite})")
    # señalar no gasta
    p.click("#lightsPlan")
    p.click('#lightsBoard [data-r="0"][data-c="0"]')
    p.click("#lightsPlan")
    afirmar("Pulsaciones: 0 de" in p.inner_text("#lightsInfo"), "señalar runas no gasta pulsaciones")
    comprobar(p, "#lightsCheck")
    afirmar(intentos(p, "lightsout") == 2, "Comprobar con luces encendidas gasta un intento")
    sol = resolver_lightsout(g)
    afirmar(sol is not None and len(sol) == minimo, f"el solucionador encuentra el mínimo ({minimo})")
    for r, c in sol:
        p.click(f'#lightsBoard [data-r="{r}"][data-c="{c}"]')
    afirmar(not exito(p, "lightsout"), "apagarlas todas no lo da por resuelto sin Comprobar")
    comprobar(p, "#lightsCheck")
    afirmar(exito(p, "lightsout"), "la solución se acepta con Comprobar")
    if primero:
        ctx2, p2, _ = abrir_otro()
        random.seed(1)
        for _ in range(limite + 1):
            p2.click(f'#lightsBoard [data-r="{random.randrange(5)}"][data-c="{random.randrange(5)}"]')
        afirmar(fallado(p2, "lightsout") and not exito(p2, "lightsout"), "tocar al azar agota las pulsaciones y falla")
        ctx2.close()


def jugar_hanoi(p, en, primero, abrir_otro):
    n = en.get("anillos", 3)
    circular = en.get("regla", "circular") == "circular"
    afirmar(p.locator("#hanoiRegla:not([hidden])").count() == 1, "se muestra la regla del giro")
    # movimiento prohibido por la regla: de la torre 1 a la 3
    p.click("#hanoiContainer .hanoi-tower >> nth=0")
    p.click("#hanoiContainer .hanoi-tower >> nth=2")
    afirmar("regla del giro" in p.inner_text("#hanoiMessage"), "1→3 está prohibido por la regla del giro")
    comprobar(p, "#hanoiCheck")
    afirmar(intentos(p, "hanoi") == 2, "Comprobar con la pila sin mover gasta un intento")
    pasos = camino_hanoi(n, circular)
    for de, a in pasos:
        p.click(f"#hanoiContainer .hanoi-tower >> nth={de}")
        p.click(f"#hanoiContainer .hanoi-tower >> nth={a}")
    afirmar(not exito(p, "hanoi"), "la pila completa no se da por buena sin Comprobar")
    comprobar(p, "#hanoiCheck")
    afirmar(exito(p, "hanoi"), f"la solución de {len(pasos)} movimientos se acepta")
    if primero:
        ctx2, p2, _ = abrir_otro()
        limite = int(re.search(r"de (\d+)", p2.inner_text("#hanoiInfo")).group(1))
        random.seed(2)
        hechos = 0
        while not fallado(p2, "hanoi") and hechos < 400:
            de = random.randrange(3)
            p2.click(f"#hanoiContainer .hanoi-tower >> nth={de}")
            p2.click(f"#hanoiContainer .hanoi-tower >> nth={(de + 1) % 3}")
            hechos += 1
        afirmar(fallado(p2, "hanoi"), f"mover al azar agota los {limite} movimientos y falla")
        ctx2.close()


def jugar_mastermind(p, en, primero):
    v = vista(p, "mastermind")
    colores = p.locator("#mastermindPaleta [data-color]").count()
    afirmar(colores == 6, "la cerradura usa 6 colores")
    # repetir colores está prohibido y no gasta
    for _ in range(5):
        p.click('#mastermindPaleta [data-color="0"]')
    comprobar(p, "#mastermindCheck")
    afirmar(intentos(p, "mastermind") == 8, "una combinación con colores repetidos no gasta intento")
    p.click("#mastermindClear")
    candidatos = list(itertools.permutations(range(6), 5))
    usados = 0
    while candidatos and not exito(p, "mastermind") and not fallado(p, "mastermind"):
        guess = candidatos[0]
        for c in guess:
            p.click(f'#mastermindPaleta [data-color="{c}"]')
        antes = intentos(p, "mastermind")
        comprobar(p, "#mastermindCheck")
        usados += 1
        afirmar(intentos(p, "mastermind") == antes - 1, f"intento {usados} gasta uno") if usados == 1 else None
        fila = p.locator("#mastermindBoard .mastermind-guess:not(.actual):not(.secreto)").nth(usados - 1)
        negras = fila.locator(".mastermind-hint-peg.black").count()
        blancas = fila.locator(".mastermind-hint-peg.white").count()
        candidatos = [k for k in candidatos if evaluar_mm(guess, k) == (negras, blancas)]
    afirmar(exito(p, "mastermind"), f"deduciendo con las pistas se abre en {usados} intentos (de 8)")


def jugar_nonogram(p, en, primero):
    fig = en["figura"]
    n = len(fig)
    comprobar(p, "#nonoCheck")
    afirmar(intentos(p, "nonogram") == 2, "Comprobar con el tapiz vacío gasta un intento")
    for r in range(n):
        for c in range(n):
            if fig[r][c] == "#":
                p.locator(f'#nonoBoard [data-r="{r}"][data-c="{c}"]').dispatch_event("pointerdown", {"button": 0, "pointerType": "mouse"})
                p.evaluate("window.dispatchEvent(new PointerEvent('pointerup'))")
    afirmar(p.locator("#nonoBoard .cumplida").count() == 0, "las pistas no se atenúan al cumplirse")
    afirmar(not exito(p, "nonogram"), "el dibujo completo no se da por bueno sin Comprobar")
    comprobar(p, "#nonoCheck")
    afirmar(exito(p, "nonogram"), "la figura de la historia se acepta con Comprobar")


def jugar_hitori(p, en, primero):
    filas = leer_tabla(p, "#hitoriBoard")
    v = [[int(td["txt"]) for td in fila] for fila in filas]
    s = resolver_hitori(v)
    afirmar(s is not None, "el solucionador resuelve el Hitori")
    comprobar(p, "#hitoriCheck")
    afirmar(intentos(p, "hitori") == 2, "Comprobar sin tachar gasta un intento")
    # dos losas rotas pegadas no se marcan en rojo en historia
    p.click('#hitoriBoard [data-r="0"][data-c="0"]')
    p.click('#hitoriBoard [data-r="0"][data-c="1"]')
    afirmar(p.locator("#hitoriBoard .error, #hitoriBoard .repetido").count() == 0, "no hay avisos en rojo mientras se juega")
    for c in (0, 1):  # deshacer: sombra → círculo → limpio
        p.click(f'#hitoriBoard [data-r="0"][data-c="{c}"]')
        p.click(f'#hitoriBoard [data-r="0"][data-c="{c}"]')
    for r, fila in enumerate(s):
        for c, x in enumerate(fila):
            if x:
                p.click(f'#hitoriBoard [data-r="{r}"][data-c="{c}"]')
    comprobar(p, "#hitoriCheck")
    afirmar(exito(p, "hitori"), "la solución se acepta con Comprobar")


def jugar_tents(p, en, primero):
    filas = leer_tabla(p, "#puzzleTable")
    cols = [int(td["txt"]) for td in filas[0][1:]]
    n = len(cols)
    filas_n = [int(f[0]["txt"]) for f in filas[1:]]
    arboles = [(r, c) for r, f in enumerate(filas[1:]) for c, td in enumerate(f[1:]) if "tree" in td["cls"]]
    sol = resolver_carpas(n, arboles, filas_n, cols)
    afirmar(sol is not None, "el solucionador coloca las carpas")
    comprobar(p, "#puzzleCheck")
    afirmar(intentos(p, "tents") == 2, "Comprobar sin carpas gasta un intento")
    for r, c in sol:
        p.click(f'#puzzleTable [data-r="{r}"][data-c="{c}"]')
    afirmar(p.locator("#puzzleTable .cumplida, #puzzleTable .excedida, #puzzleTable .error").count() == 0, "las cifras no confirman nada mientras se juega")
    comprobar(p, "#puzzleCheck")
    afirmar(exito(p, "tents"), "la solución se acepta con Comprobar")


def jugar_lightup(p, en, primero):
    filas = leer_tabla(p, "#lightBoard")
    d = [["W" if td["r"] is not None else (td["txt"] or "B") for td in f] for f in filas]
    sol = resolver_lightup(d)
    afirmar(sol is not None, "el solucionador ilumina la caverna")
    comprobar(p, "#lightCheck")
    afirmar(intentos(p, "lightup") == 2, "Comprobar a oscuras gasta un intento")
    for r, f in enumerate(sol):
        for c, x in enumerate(f):
            if x:
                p.click(f'#lightBoard [data-r="{r}"][data-c="{c}"]')
    afirmar(p.locator("#lightBoard .cumplido, #lightBoard .error").count() == 0, "los muros no se ponen verdes ni rojos")
    comprobar(p, "#lightCheck")
    afirmar(exito(p, "lightup"), "la solución se acepta con Comprobar")


def jugar_galaxies(p, en, primero):
    n = p.evaluate("getComputedStyle(document.getElementById('galaxyBoard')).getPropertyValue('--n')")
    n = int(str(n).strip() or 8)
    puntos = p.evaluate("""() => [...document.querySelectorAll('#galaxyBoard .gal-punto')].map(b => [parseFloat(b.style.top), parseFloat(b.style.left)])""")
    centros = [(round(t / 100 * 2 * n - 1), round(l / 100 * 2 * n - 1)) for t, l in puntos]
    asig = resolver_galaxias(n, centros)
    afirmar(asig is not None, "el solucionador reparte los remolinos")
    comprobar(p, "#galaxyCheck")
    afirmar(intentos(p, "galaxies") == 2, "Comprobar sin repartir gasta un intento")
    for k in range(len(centros)):
        p.click(f'#galaxyBoard [data-galaxia="{k}"]')
        hechas = set()
        fijas = {(int(x["r"]), int(x["c"])) for x in p.evaluate("""() => [...document.querySelectorAll('#galaxyBoard .gal-celda.fija')].map(e => ({r: e.dataset.r, c: e.dataset.c}))""")}
        for r in range(n):
            for c in range(n):
                if asig[r][c] == k and (r, c) not in fijas and (r, c) not in hechas:
                    p.locator(f'#galaxyBoard .gal-celda[data-r="{r}"][data-c="{c}"]').dispatch_event("pointerdown", {"button": 0, "pointerType": "mouse"})
                    p.evaluate("window.dispatchEvent(new PointerEvent('pointerup'))")
                    hechas.add((r, c)); hechas.add((centros[k][0] - r, centros[k][1] - c))
    comprobar(p, "#galaxyCheck")
    afirmar(exito(p, "galaxies"), "el reparto simétrico se acepta con Comprobar")


def main():
    servidor = socketserver.ThreadingTCPServer(("127.0.0.1", 0), functools.partial(Silencioso, directory=str(PUBLICO)))
    servidor.daemon_threads = True
    threading.Thread(target=servidor.serve_forever, daemon=True).start()
    url = f"http://127.0.0.1:{servidor.server_address[1]}/index.html"
    vistos = set()
    with sync_playwright() as pw:
        ruta = navegador()
        nav = pw.chromium.launch(executable_path=ruta, headless=True) if ruta else pw.chromium.launch(headless=True)
        for ci, camp in enumerate(CAMPANAS):
            for ei, esc in enumerate(camp["escenarios"]):
                lugares = list(enumerate(esc.get("pasos", []))) + list((esc.get("escenas") or {}).items())
                for pi, paso in lugares:
                    en = paso.get("enigma")
                    if not en:
                        continue
                    eid = en["id"]
                    primero = eid not in vistos
                    vistos.add(eid)
                    donde = f"paso {pi + 1}" if isinstance(pi, int) else f"escena {pi}"
                    print(f"· {camp['id']} / capítulo {ei + 1} / {donde}: {eid} — {en.get('titulo', '')}")
                    otro = functools.partial(abrir, nav, url, ci, ei, pi, eid)
                    ctx, p, errores = otro()
                    try:
                        afirmar(not exito(p, eid), "al abrirlo no aparece resuelto")
                        jugador = globals()[f"jugar_{eid}"]
                        if eid in ("lightsout", "hanoi"):
                            jugador(p, en, primero, lambda: otro())
                        else:
                            jugador(p, en, primero)
                    except Exception as e:  # noqa: BLE001
                        afirmar(False, f"{eid}: excepción {e}")
                    afirmar(not errores, f"sin errores de consola {errores if errores else ''}")
                    ctx.close()
        nav.close()
    servidor.shutdown()
    print(f"\n{'TODO BIEN' if not fallos else f'{len(fallos)} FALLOS'}")
    for f in fallos:
        print("  -", f)
    sys.exit(1 if fallos else 0)


if __name__ == "__main__":
    main()
