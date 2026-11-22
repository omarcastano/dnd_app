#!/usr/bin/env python3
"""Voz hablada de humanoide con Qwen3-TTS VoiceDesign (la voz se crea desde una DESCRIPCIÓN; así se hizo la del Sátiro Trovador, que gustó mucho).

Uso (venv del proyecto, ComfyUI apagado):
  .venv/bin/python .claude/skills/crear-enemigo/scripts/voz_diseno.py <id> "frase inicio" "frase muerte" "descripción de la voz" [--semillas 1,2,3] [--salida DIR]
Deja en --salida (por defecto /tmp/voz_diseno_<id>) tomas inicio_<semilla>.wav y muerte_<semilla>.wav para elegir; no toca public/.
"""
import argparse
from pathlib import Path

import numpy as np
import torch
from pedalboard.io import AudioFile
from qwen_tts import Qwen3TTSModel

p = argparse.ArgumentParser()
p.add_argument('id'); p.add_argument('inicio'); p.add_argument('muerte'); p.add_argument('descripcion')
p.add_argument('--semillas', default='1,2,3'); p.add_argument('--salida', type=Path)
a = p.parse_args()
salida = a.salida or Path(f'/tmp/voz_diseno_{a.id}'); salida.mkdir(parents=True, exist_ok=True)
m = Qwen3TTSModel.from_pretrained('Qwen/Qwen3-TTS-12Hz-1.7B-VoiceDesign', device_map='cuda:0', dtype=torch.bfloat16)
for s in [int(x) for x in a.semillas.split(',')]:
    for nombre, texto in (('inicio', a.inicio), ('muerte', a.muerte)):
        torch.manual_seed(s)
        w, sr = m.generate_voice_design(text=texto, instruct=a.descripcion, language='Spanish')
        x = np.asarray(w[0], dtype='float32').reshape(-1)
        with AudioFile(str(salida / f'{nombre}_{s}.wav'), 'w', sr, 1) as o:
            o.write(x.reshape(1, -1))
        print(salida / f'{nombre}_{s}.wav', round(len(x) / sr, 1), 's')
