"""Red de seguridad visual de La Taberna (make probar).

Levanta un servidor estático de public/, recorre cada pestaña y varios estados clave con Playwright,
falla si hay errores en consola o excepciones, y compara cada captura con su referencia aprobada
(pruebas/referencias/<estado>.png). Genera pruebas/informe.html con capturas y diferencias resaltadas.

    make probar               # compara con las referencias
    make probar ACTUALIZAR=1  # guarda las capturas actuales como nuevas referencias
"""
import base64
import functools
import html
import http.server
import io
import os
import shutil
import socketserver
import sys
import threading
from pathlib import Path

from PIL import Image, ImageChops
from playwright.sync_api import sync_playwright

RAIZ = Path(__file__).resolve().parent.parent
PUBLICO = RAIZ / "public"
DIR = Path(__file__).resolve().parent
REFERENCIAS = DIR / "referencias"
ACTUALES = DIR / "actuales"
INFORME = DIR / "informe.html"
UMBRAL_PIXEL = 24      # diferencia por canal a partir de la cual un píxel cuenta como distinto
UMBRAL_PROPORCION = 0.001  # proporción de píxeles distintos tolerada (0,1 %)
VIEWPORTS = {"escritorio": {"width": 1280, "height": 900}, "movil": {"width": 390, "height": 844}}

# Estabiliza las capturas: sin animaciones, sin el canvas animado de fondo y con Math.random fijo
CSS_ESTABLE = """*,*::before,*::after{animation:none!important;transition:none!important;caret-color:transparent!important}
#ambiente{visibility:hidden!important}"""
JS_SEMILLA = """(() => { let s = 123456789; Math.random = () => { s |= 0; s = s + 0x6D2B79F5 | 0;
  let t = Math.imul(s ^ s >>> 15, 1 | s); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; })();"""


class Silencioso(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a):
        pass

    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()


def navegador():
    for nombre in ("google-chrome", "chromium", "chromium-browser", "brave-browser", "google-chrome-stable"):
        ruta = shutil.which(nombre)
        if ruta:
            return ruta
    return None  # Playwright usará su propio Chromium (uv run playwright install chromium)


def pestana(p, tab):
    p.click(f'.tab-btn[data-tab="{tab}"]')
    p.wait_for_timeout(300)


# Cada estado: (nombre, función que lo prepara partiendo de la app recién cargada)
def estados():
    def heroes_clase(p):
        pestana(p, "heroes")
        p.wait_for_selector("#heroes-catalogo .clase [data-elegir]")
        p.locator("#heroes-catalogo .clase [data-elegir]").first.click()
        p.wait_for_timeout(600)

    def bestiario_enemigo(p):
        pestana(p, "bestiario")
        p.wait_for_selector("[data-enemigo]")
        p.locator("[data-enemigo]").first.click()
        p.wait_for_timeout(600)

    def libro_portada(p):
        pestana(p, "mapas")
        p.wait_for_selector("[data-abrir-campana]")

    def libro_capitulo(p):
        libro_portada(p)
        p.locator("[data-abrir-campana]").first.click()
        p.wait_for_timeout(300)
        p.locator('#mapas-campanas [data-pagina="1"]').first.click()
        p.wait_for_timeout(500)

    def catalogo_mapas(p):
        pestana(p, "mapas")
        p.click('[data-vista-mapas="catalogo"]')
        p.wait_for_selector("[data-ver-mapa]")
        p.wait_for_timeout(500)

    def visor_mapa(p):
        catalogo_mapas(p)
        p.locator("[data-ver-mapa]").first.click()
        p.wait_for_timeout(500)

    def enigmas_menu(p):
        pestana(p, "puzzles")

    def enigma_abierto(p):
        pestana(p, "puzzles")
        p.fill("#puzzleCodeInput", "6659")
        p.click("#puzzleCodeBtn")
        p.wait_for_timeout(500)

    def enigma_historia(p):
        libro_capitulo(p)
        # Los capítulos I y II son por escenas: el enigma solo se ve en su escena, así que se deja el recorrido del II en «runas»
        p.evaluate("""() => localStorage.setItem('taberna:mapas:el-aliento-helado:2:aventura', JSON.stringify({pasos: [{e: 'runas', o: null}], fase: 0}))""")
        p.locator('#mapas-campanas [data-pagina="2"]').first.click()
        p.wait_for_timeout(400)
        p.locator("#mapas-campanas .boton-enigma").first.click()
        p.wait_for_timeout(600)

    def taberna_tarjeta(p):
        pestana(p, "shop")
        p.locator("#tab-shop [data-alternar-tarjeta]").first.click()
        p.wait_for_timeout(300)

    def cofres_abierto(p):
        pestana(p, "loot")
        p.locator("#chestSelectRow button, #chestSelectRow .chest-select").first.click()
        p.wait_for_timeout(300)

    def aventura(p):
        libro_capitulo(p)
        for letra in ("C", "B"):  # almacén → espiar por las rendijas
            p.locator(f'#mapas-campanas .aventura-opcion[data-av-ref="{letra}"]').click()
            p.wait_for_timeout(450)

    def plano(p):
        libro_capitulo(p)
        p.locator('#mapas-campanas [data-ver-paso="-1"]').first.click()
        p.wait_for_timeout(600)

    def admin(p):
        p.click("#adminToggle")
        p.wait_for_timeout(200)

    return [
        ("admin", admin),
        ("taberna", lambda p: pestana(p, "shop")),
        ("taberna-tarjeta", taberna_tarjeta),
        ("cofres-abierto", cofres_abierto),
        ("mapas-plano", plano),
        ("cofres", lambda p: pestana(p, "loot")),
        ("heroes", lambda p: pestana(p, "heroes")),
        ("heroes-clase", heroes_clase),
        ("bestiario", lambda p: pestana(p, "bestiario")),
        ("bestiario-enemigo", bestiario_enemigo),
        ("pnj", lambda p: pestana(p, "pnj")),
        ("mapas-libro-portada", libro_portada),
        ("mapas-libro-capitulo", libro_capitulo),
        ("mapas-aventura", aventura),
        ("mapas-catalogo", catalogo_mapas),
        ("mapas-visor", visor_mapa),
        ("enigmas-menu", enigmas_menu),
        ("enigmas-puzzle", enigma_abierto),
        ("enigmas-historia", enigma_historia),
    ]


def comparar(ref, act):
    """Devuelve (proporción de píxeles distintos, imagen con las diferencias resaltadas en rojo)."""
    a, b = Image.open(ref).convert("RGB"), Image.open(act).convert("RGB")
    ancho, alto = max(a.width, b.width), max(a.height, b.height)
    lienzo = lambda im: (lambda c: (c.paste(im), c)[1])(Image.new("RGB", (ancho, alto), (255, 0, 255)))
    a, b = lienzo(a), lienzo(b)
    mascara = ImageChops.difference(a, b).convert("L").point(lambda v: 255 if v > UMBRAL_PIXEL else 0)
    distintos = sum(mascara.histogram()[255:])
    resaltado = Image.composite(Image.new("RGB", (ancho, alto), (255, 0, 0)), b.point(lambda v: v // 3), mascara)
    return distintos / (ancho * alto), resaltado


def b64(im_o_ruta, ancho=420):
    im = Image.open(im_o_ruta) if isinstance(im_o_ruta, Path) else im_o_ruta
    im = im.convert("RGB")
    im.thumbnail((ancho, 4000))
    buf = io.BytesIO()
    im.save(buf, "JPEG", quality=70)
    return "data:image/jpeg;base64," + base64.b64encode(buf.getvalue()).decode()


def main():
    actualizar = os.environ.get("ACTUALIZAR") not in (None, "", "0")
    REFERENCIAS.mkdir(exist_ok=True)
    ACTUALES.mkdir(exist_ok=True)
    servidor = socketserver.ThreadingTCPServer(("127.0.0.1", 0), functools.partial(Silencioso, directory=str(PUBLICO)))
    servidor.daemon_threads = True
    threading.Thread(target=servidor.serve_forever, daemon=True).start()
    url = f"http://127.0.0.1:{servidor.server_address[1]}/index.html"

    filas, fallos = [], 0
    with sync_playwright() as pw:
        ruta = navegador()
        nav = pw.chromium.launch(executable_path=ruta, headless=True) if ruta else pw.chromium.launch(headless=True)
        for (base, preparar), (vp, tam) in [(e, v) for v in VIEWPORTS.items() for e in estados()]:
            nombre = f"{base}-{vp}"
            ctx = nav.new_context(viewport=tam, device_scale_factor=1, reduced_motion="reduce", locale="es-ES")
            ctx.add_init_script(JS_SEMILLA)
            p = ctx.new_page()
            errores = []
            p.on("console", lambda m: m.type == "error" and not m.text.startswith("Failed to load resource") and errores.append(f"consola: {m.text}"))
            p.on("response", lambda r: r.status >= 400 and r.url.startswith("http://127.0.0.1") and errores.append(f"HTTP {r.status}: {r.url}"))
            p.on("pageerror", lambda e: errores.append(f"excepción: {e}"))
            try:
                p.goto(url, wait_until="networkidle")
                p.add_style_tag(content=CSS_ESTABLE)
                p.wait_for_selector(".tab-btn[data-tab]")
                p.wait_for_timeout(400)
                preparar(p)
                p.wait_for_load_state("networkidle")
                p.evaluate("document.fonts.ready")
                p.wait_for_timeout(300)
                actual = ACTUALES / f"{nombre}.png"
                p.screenshot(path=str(actual), full_page=True)
            except Exception as e:  # noqa: BLE001
                errores.append(f"no se pudo preparar el estado: {e}")
                actual = None
            ctx.close()

            ref = REFERENCIAS / f"{nombre}.png"
            prop, resaltado = None, None
            if actual and actualizar:
                shutil.copy(actual, ref)
            elif actual and ref.exists():
                prop, resaltado = comparar(ref, actual)
            elif actual:
                errores.append("no hay referencia (ejecuta make probar ACTUALIZAR=1)")
            ok = not errores and (prop is None or prop <= UMBRAL_PROPORCION)
            fallos += not ok
            filas.append((nombre, ok, errores, prop, ref, actual, resaltado))
            print(f"{'OK   ' if ok else 'FALLO'} {nombre:24} {'' if prop is None else f'{prop:.4%} distinto'} {' | '.join(errores)}")
        nav.close()
    servidor.shutdown()

    partes = []
    for nombre, ok, errores, prop, ref, actual, resaltado in filas:
        imgs = []
        if ref.exists():
            imgs.append(("Referencia", b64(ref)))
        if actual:
            imgs.append(("Actual", b64(actual)))
        if resaltado is not None:
            imgs.append(("Diferencias (rojo)", b64(resaltado)))
        partes.append(f"""<section class="{'ok' if ok else 'fallo'}"><h2>{'✔' if ok else '✘'} {html.escape(nombre)}
<small>{'' if prop is None else f'{prop:.4%} de píxeles distintos'}</small></h2>
{''.join(f'<p class="err">{html.escape(e)}</p>' for e in errores)}
<div class="imgs">{''.join(f'<figure><figcaption>{t}</figcaption><img src="{s}"></figure>' for t, s in imgs)}</div></section>""")
    INFORME.write_text(f"""<!doctype html><html lang="es"><meta charset="utf-8"><title>Pruebas visuales</title>
<style>body{{font-family:sans-serif;background:#1b1b1b;color:#eee;margin:16px}}section{{border-left:6px solid #3a3;padding:4px 12px;margin:16px 0}}
section.fallo{{border-color:#d33}}.err{{color:#f88}}.imgs{{display:flex;gap:12px;flex-wrap:wrap}}figure{{margin:0}}img{{max-width:420px;border:1px solid #555}}small{{color:#aaa;font-weight:normal}}</style>
<h1>Pruebas visuales — {len(filas) - fallos}/{len(filas)} correctas{' (referencias actualizadas)' if actualizar else ''}</h1>
{''.join(partes)}</html>""", encoding="utf-8")
    print(f"Informe: {INFORME}")
    sys.exit(1 if fallos else 0)


if __name__ == "__main__":
    main()
