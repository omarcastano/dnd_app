"""Juega un camino del capítulo en el navegador real (Playwright + Chrome del sistema) y lo cuenta.

Uso:
  .venv/bin/python .claude/skills/rehacer-capitulo-por-escenas/scripts/recorrer.py <campaña-id> <capítulo 1-4> "texto opción" "texto opción" ... [--capturas carpeta] [--movil]

Cada argumento es un trozo del texto de la opción a pulsar (la primera que lo contenga). Palabras especiales:
  SIGUE   pulsa «Continuar / ¡Al combate!»       GANADO  pulsa «Combate ganado»
  ATRAS   tecla ←                                 AUDIO   reproduce la lectura de la decisión y lista qué .mp3 suenan
  ZOOM    abre el plano ampliado (clic en el mapa) y comprueba que muestra las MISMAS marcas que el mapa pequeño
          (escena actual, huellas, destinos A-D) y que el panel dice «Estáis aquí: <escena>»; luego lo cierra
Imprime en cada paso: título de la carta, opciones visibles, estados, contador de combates, bestias de la mesa de combate; al final, errores de
consola. Sirve para repetir exactamente el camino que el usuario cuenta («fui al almacén, volví, peleé…»).
"""
import functools, http.server, json, shutil, sys, threading
from playwright.sync_api import sync_playwright

args = sys.argv[1:]
capturas = None
if "--capturas" in args:
    i = args.index("--capturas"); capturas = args[i + 1]; del args[i:i + 2]
movil = "--movil" in args
if movil: args.remove("--movil")
campana, capitulo, pasos = args[0], int(args[1]), args[2:]
ci = [c["id"] for c in json.load(open("public/mapas/campanas.json", encoding="utf-8"))["campanas"]].index(campana)

class Q(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a): pass
srv = http.server.ThreadingHTTPServer(("127.0.0.1", 0), functools.partial(Q, directory="public"))
threading.Thread(target=srv.serve_forever, daemon=True).start()
url = f"http://127.0.0.1:{srv.server_address[1]}/index.html"

with sync_playwright() as pw:
    b = pw.chromium.launch(executable_path=shutil.which("google-chrome") or shutil.which("chromium"), headless=True, args=["--autoplay-policy=no-user-gesture-required"])
    p = b.new_page(viewport={"width": 390, "height": 844} if movil else {"width": 1280, "height": 900})
    err, mp3 = [], []
    p.on("pageerror", lambda x: err.append(str(x)))
    p.on("console", lambda m: m.type == "error" and "Failed to load" not in m.text and err.append(m.text))
    p.on("request", lambda r: ".mp3" in r.url and mp3.append(r.url.split("/")[-1].split("?")[0]))
    p.goto(url, wait_until="networkidle")
    p.evaluate("Object.keys(localStorage).filter(k => k.endsWith(':aventura')).forEach(k => localStorage.removeItem(k))")
    p.click('.tab-btn[data-tab="mapas"]'); p.click(f'[data-abrir-campana="{ci}"]'); p.click(f'.libro-indice [data-pagina="{capitulo}"]')
    av = p.locator("[data-aventura]"); av.wait_for()

    def contar(n):
        ops = [x.inner_text().split("\n")[1] for x in av.locator(".aventura-opcion").all()]
        est = [x.inner_text().strip() for x in av.locator(".aventura-estados li").all()]
        botones = [x.inner_text().strip() for x in av.locator("[data-av-sigue], [data-av-ganado]").all()]
        print(f"[{n}] {av.locator('.aventura-carta h4').inner_text()} | combates {av.locator('.aventura-contador').inner_text().strip()}")
        if ops: print("     opciones:", ops)
        if botones: print("     botón:", botones)
        if est: print("     estados:", est)
        mesa = [x.inner_text().split("\n")[0].strip() for x in av.locator(".mapas-bestia .titulo-enemigo").all()]
        if av.locator(".mapas-mesa").count(): print("     mesa de combate:", mesa or "SIN FICHAS")
        if capturas: av.screenshot(path=f"{capturas}/paso-{n:02d}.png")

    contar(0)
    for n, paso in enumerate(pasos, 1):
        if paso == "SIGUE": av.locator("[data-av-sigue]").click()
        elif paso == "GANADO": av.locator("[data-av-ganado]").click()
        elif paso == "ATRAS": p.keyboard.press("ArrowLeft")
        elif paso == "AUDIO":
            mp3.clear(); av.locator(".aventura-lectura-decision [data-narracion]").click(); p.wait_for_timeout(8000)
            print("     sonaron:", mp3); continue
        elif paso == "ZOOM":
            marcas = "els => els.map(e => e.className.split(' ')[0] + ':' + e.textContent.trim() + ':' + e.getAttribute('style')).sort()"
            peq = av.locator(".aventura-mapa .plano-lienzo > span").evaluate_all(marcas)
            av.locator(".aventura-mapa").click(); p.wait_for_timeout(400)
            plano = p.locator(".plano-visor[open]")
            gra = plano.locator(".plano-lienzo > span").evaluate_all(marcas)
            titulo = av.locator(".aventura-carta h4").inner_text()
            panel = plano.locator(".plano-leyenda").inner_text()
            ok = peq == gra and titulo.lower() in panel.lower()
            print(f"     zoom: {'OK, igual que el mapa pequeño' if ok else 'DISTINTO'}")
            if not ok: print("       pequeño:", peq, "\n       ampliado:", gra); err.append("el zoom no coincide con el mapa pequeño")
            if capturas: p.screenshot(path=f"{capturas}/zoom-{n:02d}.png")
            p.keyboard.press("Escape"); p.wait_for_timeout(200); continue
        else:
            op = av.locator(".aventura-opcion", has_text=paso)
            if not op.count(): print(f"[{n}] NO HAY opción con «{paso}»"); break
            op.first.click()
        p.wait_for_timeout(400); contar(n)
    print("errores de consola:", err or "ninguno")
    b.close()
srv.shutdown()
