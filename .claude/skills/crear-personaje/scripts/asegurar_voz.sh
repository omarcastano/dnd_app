#!/usr/bin/env bash
# Deja listo el motor de narración (Qwen3-TTS clonando la narradora de narracion/voz/). Idempotente.
#   asegurar_voz.sh              → comprueba y dice qué falta (código 2 si falta algo instalable)
#   asegurar_voz.sh --instalar   → instala lo que falte: `make setup` (uv → .venv) y descarga del modelo (~4,3 GB)
# Dependencias de Python: SOLO en el pyproject.toml de la raíz (grupo `voces`, entorno `.venv`); nunca pip global.
# Códigos: 0 listo · 2 falta algo (pide permiso y reejecuta con --instalar) · 3 falta la voz de referencia ·
#          4 poca VRAM libre (apaga ComfyUI) · 5 falló la instalación
set -u
PROY="$(cd "$(dirname "$0")/../../../.." && pwd)"; PY="$PROY/.venv/bin/python"
MODELO="Qwen/Qwen3-TTS-12Hz-1.7B-Base"
CACHE="${HF_HOME:-$HOME/.cache/huggingface}/hub/models--${MODELO//\//--}"
instalar=0; [ "${1:-}" = "--instalar" ] && instalar=1

# La voz de referencia es el estándar del juego: no se genera ni se instala, la aporta el repo
if [ ! -s "$PROY/narracion/voz/narradora.wav" ] || [ ! -s "$PROY/narracion/voz/narradora.txt" ]; then
  echo "Falta la voz de referencia: narracion/voz/narradora.wav y narradora.txt (ver narracion/README.md)"; exit 3
fi

faltan=()
{ [ -x "$PY" ] && "$PY" -c "import qwen_tts" >/dev/null 2>&1; } || faltan+=("entorno $PROY/.venv con qwen-tts (make setup)")
[ -d "$CACHE/snapshots" ] || faltan+=("modelo $MODELO (~4,3 GB, caché de Hugging Face)")

if [ ${#faltan[@]} -gt 0 ]; then
  echo "Falta: ${faltan[*]}"
  if [ $instalar -eq 0 ]; then
    echo "Pide confirmación al usuario (descarga de varios GB) y reejecuta con --instalar."; exit 2
  fi
  command -v uv >/dev/null || { echo "Necesitas uv (https://docs.astral.sh/uv/)"; exit 5; }
  ( cd "$PROY" && make setup ) || exit 5
  [ -d "$CACHE/snapshots" ] || "$PY" -c "from huggingface_hub import snapshot_download; snapshot_download('$MODELO')" || exit 5
fi

# El modelo necesita ~5 GB de VRAM; ComfyUI con SDXL cargado ocupa buena parte de la GPU
if command -v nvidia-smi >/dev/null; then
  libre=$(nvidia-smi --query-gpu=memory.total,memory.used --format=csv,noheader,nounits | awk -F', ' 'NR==1{print $1-$2}')
  if [ "${libre:-99999}" -lt 6000 ]; then
    echo "Solo hay ${libre} MiB de VRAM libre (hacen falta ~6000). Apaga ComfyUI: kill \$(pgrep -f '[m]ain.py --listen 127.0.0.1') y reintenta."; exit 4
  fi
fi
echo "Motor de voz listo (Qwen3-TTS + voz de narracion/voz/)"
