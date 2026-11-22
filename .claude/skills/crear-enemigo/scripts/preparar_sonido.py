#!/usr/bin/env python3
"""Prepara sonidos libres (ogg/flac/mp3/wav descargados) para el Bestiario con pedalboard: mono, tono opcional, recorte con fundido final y volumen normalizado.

Uso: preparar_sonido.py ENTRADA [ENTRADA…] --salida carpeta [--tonos 0,4] [--max 6] [--formato wav|mp3]
Por cada entrada y tono deja `<nombre>_orig.<fmt>` (tono 0) o `<nombre>_+4.<fmt>` (subido 4 semitonos; negativo = más grave).
Sin ffmpeg: solo usa pedalboard (ya está en el .venv, dependencias base del pyproject.toml). `sonido` va en .wav y `sonido_muerte` en .mp3.
"""
import argparse
from pathlib import Path

import numpy as np
from pedalboard import Pedalboard, PitchShift
from pedalboard.io import AudioFile


def main():
    p = argparse.ArgumentParser()
    p.add_argument('entradas', nargs='+')
    p.add_argument('--salida', required=True)
    p.add_argument('--tonos', default='0', help='semitonos separados por comas, p. ej. 0,4')
    p.add_argument('--max', type=float, default=6.0, help='segundos máximos')
    p.add_argument('--formato', default='wav', choices=['wav', 'mp3'])
    a = p.parse_args()
    salida = Path(a.salida)
    salida.mkdir(parents=True, exist_ok=True)
    for ruta in a.entradas:
        with AudioFile(ruta) as f:
            audio, sr = f.read(f.frames), f.samplerate
        audio = audio.mean(axis=0, keepdims=True)
        for tono in (int(t) for t in a.tonos.split(',')):
            x = Pedalboard([PitchShift(tono)])(audio, sr) if tono else audio
            x = x[:, :int(a.max * sr)].copy()
            n = min(int(0.5 * sr), x.shape[1])
            x[:, -n:] *= np.linspace(1, 0, n)[None, :]
            x = x / (np.abs(x).max() or 1) * 0.9
            destino = salida / f"{Path(ruta).stem}_{'+%d' % tono if tono else 'orig'}.{a.formato}"
            with AudioFile(str(destino), 'w', sr, 1) as f:
                f.write(x)
            print(f'+ {destino} ({x.shape[1] / sr:.1f} s)')


if __name__ == '__main__':
    main()
