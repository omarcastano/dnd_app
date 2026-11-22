#!/usr/bin/env python3
"""Graba (o importa) TÚ MISMO el sonido de un enemigo y lo deja instalado: recorta silencios, normaliza y lo guarda donde lo espera la app.

Uso (desde la raíz del proyecto):
  .venv/bin/python .claude/skills/crear-enemigo/scripts/grabar_sonido.py <id> inicio          # graba el sonido/voz que suena al empezar la narración
  .venv/bin/python .claude/skills/crear-enemigo/scripts/grabar_sonido.py <id> muerte          # graba el que suena al llegar a 0 de vida
  ... --archivo mi_audio.(wav|mp3|ogg|m4a)   # en vez de grabar, usa un archivo que ya tengas
  ... --tono -2                              # semitonos (negativo = más grave, positivo = más agudo)
  ... --max 6                                # segundos máximos (por defecto 6)

Graba con `arecord` (micrófono por defecto del sistema): Enter para empezar, Enter para parar. Después lo reproduce (`aplay`/`paplay`)
y pregunta si te gusta; si no, repite. Al aceptar escribe:
  inicio → public/enemigos/sonidos/<id>-voz.wav   y `sonido` en enemigos.json   (hay que regenerar la narración: borra su mp3 y `make audio`)
  muerte → public/enemigos/sonidos/<id>-muerte.mp3 y `sonido_muerte` en enemigos.json
Solo usa pedalboard (ya está en el .venv). Si la versión de la app no cambia no verás el cambio por la caché: sube `.version-app`.
"""
import argparse
import json
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

import numpy as np
from pedalboard import HighpassFilter, Pedalboard, PitchShift
from pedalboard.io import AudioFile

RAIZ = Path(__file__).resolve().parents[4]
SONIDOS = RAIZ / 'public/enemigos/sonidos'
JSON = RAIZ / 'public/enemigos/enemigos.json'


def grabar(destino):
    if not shutil.which('arecord'):
        sys.exit('No hay `arecord` (paquete alsa-utils). Instálalo o usa --archivo con un audio que ya tengas.')
    input('Pulsa Enter para EMPEZAR a grabar… ')
    proc = subprocess.Popen(['arecord', '-q', '-f', 'S16_LE', '-r', '44100', '-c', '1', str(destino)])
    try:
        input('● Grabando… pulsa Enter para PARAR. ')
    finally:
        proc.terminate()
        proc.wait()


def procesar(entrada, salida, tono, maximo, mp3):
    """Mono, quita ruido grave, recorta silencio inicial/final, tono opcional, fundido corto y volumen normalizado."""
    with AudioFile(str(entrada)) as f:
        audio, sr = f.read(f.frames).mean(axis=0, keepdims=True), f.samplerate
    audio = HighpassFilter(70)(audio, sr)
    x = audio[0]
    activo = np.where(np.abs(x) > max(np.abs(x).max() * 0.04, 1e-4))[0]
    if len(activo) == 0:
        sys.exit('No se oye nada en la grabación (¿micrófono silenciado?).')
    x = x[max(0, activo[0] - int(0.05 * sr)): activo[-1] + int(0.15 * sr)]
    x = x.reshape(1, -1)
    if tono:
        x = Pedalboard([PitchShift(tono)])(x, sr)
    x = x[:, : int(maximo * sr)].copy()
    n_in, n_out = min(int(0.02 * sr), x.shape[1]), min(int(0.15 * sr), x.shape[1])
    x[:, :n_in] *= np.linspace(0, 1, n_in)[None, :]
    x[:, -n_out:] *= np.linspace(1, 0, n_out)[None, :]
    x = x / (np.abs(x).max() or 1) * 0.9
    kw = {'quality': '128 kbps'} if mp3 else {}
    with AudioFile(str(salida), 'w', sr, 1, **kw) as f:
        f.write(x)
    return x.shape[1] / sr


def escuchar(ruta):
    for reproductor in ('paplay', 'aplay'):
        if shutil.which(reproductor):
            subprocess.run([reproductor, str(ruta)], check=False)
            return
    print(f'(no hay reproductor; escúchalo tú: {ruta})')


def main():
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument('id')
    p.add_argument('tipo', choices=['inicio', 'muerte'])
    p.add_argument('--archivo')
    p.add_argument('--tono', type=int, default=0)
    p.add_argument('--max', type=float, default=6.0)
    a = p.parse_args()

    datos = json.loads(JSON.read_text(encoding='utf-8'))
    enemigo = next((e for e in datos['enemigos'] if e['id'] == a.id), None)
    if enemigo is None:
        print(f'⚠ «{a.id}» no está en enemigos.json: se guardará el audio pero no se enlazará.')
    mp3 = a.tipo == 'muerte'
    nombre = f"{a.id}-{'muerte.mp3' if mp3 else 'voz.wav'}"
    clave = 'sonido_muerte' if mp3 else 'sonido'
    SONIDOS.mkdir(parents=True, exist_ok=True)

    with tempfile.TemporaryDirectory() as tmp:
        tmp = Path(tmp)
        while True:
            if a.archivo:
                crudo = Path(a.archivo)
            else:
                crudo = tmp / 'crudo.wav'
                grabar(crudo)
            prueba = tmp / ('prueba.mp3' if mp3 else 'prueba.wav')
            seg = procesar(crudo, prueba, a.tono, a.max, mp3)
            print(f'Resultado: {seg:.1f} s. Reproduciendo…')
            escuchar(prueba)
            r = input('¿Te gusta? [s = guardar / n = grabar otra vez / q = salir] ').strip().lower()
            if r == 's':
                shutil.copy(prueba, SONIDOS / nombre)
                break
            if r == 'q' or a.archivo:  # con --archivo no tiene sentido repetir lo mismo
                print('Cancelado: no se ha cambiado nada.')
                return
    if enemigo is not None:
        enemigo[clave] = f'sonidos/{nombre}'
        if not mp3:
            enemigo.pop('narracion', None)
            (RAIZ / f'public/enemigos/narraciones/{a.id}.mp3').unlink(missing_ok=True)
        JSON.write_text(json.dumps(datos, ensure_ascii=False, indent=2), encoding='utf-8')
    print(f'✔ Guardado public/enemigos/sonidos/{nombre}')
    if not mp3:
        print(f'Ahora regenera la narración (con ComfyUI apagado):\n  make audio ARGS="public/enemigos/enemigos.json --id {a.id}"')


main()
