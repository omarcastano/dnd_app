#!/usr/bin/env python3
"""Genera efectos de sonido (aullidos, rugidos…) con AudioLDM2, local y en GPU.

Uso: generar_sonido.py --prompt "a lone wolf howling at night" --salida carpeta [--prefijo lobo] [--candidatos 6] [--segundos 5] [--pasos 100] [--semilla 1]
Escribe un .wav por candidato (<prefijo>_<semilla>.wav, mono, 16 kHz, que es lo que da el modelo) para escucharlos y elegir.
Modelo: cvssp/audioldm2 (licencia CC BY-NC-SA 4.0; solo uso no comercial), ~4,5 GB en la caché de Hugging Face; la primera vez se descarga.
Necesita la GPU libre (~6 GB): apaga ComfyUI antes (parar_comfyui.sh). Dependencias: grupo `sonidos` del pyproject.toml (make setup).
"""
import argparse
import random
from pathlib import Path

MODELO = 'cvssp/audioldm2'
NEGATIVO = 'low quality, speech, talking, singing, music, noise, static, distortion'


def main():
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument('--prompt', required=True, help='Descripción del sonido, en inglés')
    p.add_argument('--salida', type=Path, required=True, help='Carpeta donde dejar los candidatos')
    p.add_argument('--prefijo', default='sonido')
    p.add_argument('--candidatos', type=int, default=6)
    p.add_argument('--segundos', type=float, default=5.0)
    p.add_argument('--pasos', type=int, default=100)
    p.add_argument('--semilla', type=int, help='Semilla inicial (por defecto, aleatoria); cada candidato suma 1')
    p.add_argument('--negativo', default=NEGATIVO)
    a = p.parse_args()

    import numpy as np  # pesado: solo se importa al generar
    import torch
    from diffusers import AudioLDM2Pipeline
    from scipy.io import wavfile

    a.salida.mkdir(parents=True, exist_ok=True)
    tubo = AudioLDM2Pipeline.from_pretrained(MODELO, torch_dtype=torch.float16, use_safetensors=True).to('cuda')
    inicio = a.semilla if a.semilla is not None else random.randint(0, 2**31 - 1)
    for i in range(a.candidatos):
        semilla = inicio + i
        audio = tubo(a.prompt, negative_prompt=a.negativo, num_inference_steps=a.pasos, audio_length_in_s=a.segundos,
                     num_waveforms_per_prompt=1, generator=torch.Generator('cuda').manual_seed(semilla)).audios[0]
        pico = float(np.max(np.abs(audio))) or 1.0
        ruta = a.salida / f'{a.prefijo}_{semilla}.wav'
        wavfile.write(ruta, 16000, (audio / pico * 0.9 * 32767).astype(np.int16))  # normalizado a -1 dBFS aprox.
        print(f'Generado: {ruta}', flush=True)


if __name__ == '__main__':
    main()
