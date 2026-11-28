#!/usr/bin/env python3
"""Captura de la vista de un enemigo del Bestiario (Chrome headless), para revisarla con Read.

Uso: captura_bestiario.py --enemigo lobo-espinoso --salida frente.png [--dorso] [--derrotar] [--robar] [--mitad] [--alto 1500] [--puerto 8081]
     captura_bestiario.py --pnj tabernera-x --salida frente.png …   (pestaña PNJ; --mitad baja la vida a la mitad para ver el aviso de moral)
Crea una copia temporal de public/index.html con un script que abre la pestaña Bestiario y el enemigo (voltea la carta con --dorso; con --derrotar baja la vida a 0 para ver el botín; con --robar tira lo que lleva el enemigo y marca el primer objeto como robado),
desactiva transiciones/animaciones para que la captura no salga a mitad de giro, y borra la copia al terminar.
Si no hay servidor en el puerto, arranca uno sin caché (personajes/servidor.py) y lo cierra al acabar.
"""
import argparse
import shutil
import socket
import subprocess
import sys
import time
from pathlib import Path

RAIZ = Path(__file__).resolve().parents[4]


def servidor_activo(puerto):
    with socket.socket() as s:
        s.settimeout(0.5)
        return s.connect_ex(('127.0.0.1', puerto)) == 0


def main():
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    quien = p.add_mutually_exclusive_group(required=True)
    quien.add_argument('--enemigo', help='id de enemigos.json (pestaña Bestiario)')
    quien.add_argument('--pnj', help='id de pnj/pnj.json (pestaña PNJ)')
    p.add_argument('--mitad', action='store_true', help='Baja la vida a la mitad (aviso de moral de los PNJ)')
    p.add_argument('--salida', type=Path, required=True)
    p.add_argument('--dorso', action='store_true')
    p.add_argument('--derrotar', action='store_true', help='Baja la vida a 0 (aparece el botín)')
    p.add_argument('--robar', action='store_true', help='Tira el robo del Pícaro y marca el primer objeto')
    p.add_argument('--ancho', type=int, default=420)
    p.add_argument('--alto', type=int, default=1500)
    p.add_argument('--puerto', type=int, default=8081)
    a = p.parse_args()

    chrome = next((c for c in ('google-chrome', 'chromium', 'chromium-browser') if shutil.which(c)), None)
    if not chrome:
        sys.exit('No encuentro Chrome/Chromium (google-chrome, chromium).')

    tab, atributo, ident, zona = ('pnj', 'pnj', a.pnj, 'pnj-catalogo') if a.pnj else ('bestiario', 'enemigo', a.enemigo, 'bestiario-catalogo')
    voltear = f"document.getElementById('{zona}').querySelector('.volteo.gira').click();" if a.dorso else ''
    mitad = (f"const z3=document.getElementById('{zona}');const m=Number(z3.querySelector('.vida-valor b').textContent);"
             "for(let i=0;i<Math.ceil(m/2);i++)z3.querySelector('[data-vida=\"-1\"]').click();") if a.mitad else ''
    derrotar = f"const z=document.getElementById('{zona}');for(let i=0;i<200;i++)z.querySelector('[data-vida=\"-1\"]').click();z.querySelectorAll('[data-cabeza$=\":-1\"]').forEach(b=>{{for(let k=0;k<40;k++)b.click()}});" if a.derrotar else ''
    robar = f"const z2=document.getElementById('{zona}');z2.querySelector('[data-ver-robo]').click();z2.querySelector('[data-robar]').click();" if a.robar else ''
    guion = (
        '<style>*{transition:none!important;animation:none!important}</style><script>'
        f"setTimeout(()=>{{document.querySelector('[data-tab=\"{tab}\"]').click();"
        f"setTimeout(()=>{{document.querySelector('[data-{atributo}=\"{ident}\"]').click();{mitad}{derrotar}{robar}{voltear}}},500);}},1500);</script></body>"
    )
    temporal = RAIZ / 'public' / '_captura.html'
    temporal.write_text((RAIZ / 'public' / 'index.html').read_text(encoding='utf-8').replace('</body>', guion), encoding='utf-8')
    proceso = None
    try:
        if not servidor_activo(a.puerto):
            proceso = subprocess.Popen([sys.executable, str(RAIZ / 'public' / 'personajes' / 'servidor.py'), str(a.puerto)],
                                       stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            time.sleep(1.5)
        a.salida.parent.mkdir(parents=True, exist_ok=True)
        subprocess.run([chrome, '--headless=new', '--no-sandbox', '--disable-gpu', f'--window-size={a.ancho},{a.alto}',
                        '--virtual-time-budget=12000', f'--screenshot={a.salida}', f'http://localhost:{a.puerto}/_captura.html'],
                       stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, timeout=120)
    finally:
        temporal.unlink(missing_ok=True)
        if proceso:
            proceso.terminate()
    print(f'Captura: {a.salida}' if a.salida.exists() else 'No se generó la captura')


if __name__ == '__main__':
    main()
