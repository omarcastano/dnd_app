#!/usr/bin/env bash
# Deja ComfyUI (v0.46.0) escuchando en 127.0.0.1:8188 con SDXL Base 1.0. Idempotente.
#   asegurar_comfyui.sh              → comprueba; si no corre, lo arranca; si no está instalado, dice qué falta
#   asegurar_comfyui.sh --instalar   → además instala lo que falte (clona, venv con uv, descarga ~7 GB del modelo)
# Dependencias de Python: SOLO en el pyproject.toml de la raíz del proyecto (grupo `imagenes`, entorno `.venv`,
# se crea con `make setup`). ~/ia solo guarda el código de ComfyUI (~/ia/ComfyUI), el modelo y comfyui.log.
# Variables: IA_DIR, PUERTO.
set -u
PROY="$(cd "$(dirname "$0")/../../../.." && pwd)"; VENV="$PROY/.venv"
IA="${IA_DIR:-$HOME/ia}"; PUERTO="${PUERTO:-8188}"; URL="http://127.0.0.1:$PUERTO"
CKPT="$IA/ComfyUI/models/checkpoints/sd_xl_base_1.0.safetensors"
MODELO_URL="https://huggingface.co/stabilityai/stable-diffusion-xl-base-1.0/resolve/main/sd_xl_base_1.0.safetensors"
activo() { curl -sf -m 3 "$URL/system_stats" >/dev/null; }
instalar=0; [ "${1:-}" = "--instalar" ] && instalar=1

if activo; then echo "ComfyUI ya responde en $URL"; exit 0; fi

faltan=()
[ -f "$IA/ComfyUI/main.py" ] || faltan+=("ComfyUI en $IA/ComfyUI")
[ -x "$VENV/bin/python" ] || faltan+=("entorno $VENV (make setup)")
[ -s "$CKPT" ] || faltan+=("modelo $CKPT")

if [ ${#faltan[@]} -gt 0 ]; then
  echo "Falta: ${faltan[*]}"
  if [ $instalar -eq 0 ]; then
    echo "Pide confirmación al usuario (descarga ~7 GB + dependencias) y reejecuta con --instalar."; exit 2
  fi
  command -v git >/dev/null && command -v uv >/dev/null || { echo "Necesitas git y uv (https://docs.astral.sh/uv/)"; exit 3; }
  mkdir -p "$IA"
  [ -f "$IA/ComfyUI/main.py" ] || git clone --branch v0.46.0 --depth 1 https://github.com/comfyanonymous/ComfyUI "$IA/ComfyUI" || exit 4
  [ -x "$VENV/bin/python" ] || ( cd "$PROY" && make setup ) || exit 5
  if [ ! -s "$CKPT" ]; then
    mkdir -p "$(dirname "$CKPT")"
    curl -L --fail -C - -o "$CKPT" "$MODELO_URL" || { echo "Descarga del modelo falló (si pide login, bájalo a mano a $CKPT)"; exit 6; }
  fi
fi

echo "Arrancando ComfyUI…"
( cd "$IA/ComfyUI" && nohup "$VENV/bin/python" main.py --listen 127.0.0.1 --port "$PUERTO" >>"$IA/comfyui.log" 2>&1 & )
for _ in $(seq 1 90); do
  activo && { echo "ComfyUI listo en $URL"; exit 0; }
  sleep 2
done
echo "No respondió en 3 min; revisa $IA/comfyui.log"; tail -15 "$IA/comfyui.log"; exit 7
