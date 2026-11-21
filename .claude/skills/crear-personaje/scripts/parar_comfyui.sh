#!/usr/bin/env bash
# Apaga el servidor de ComfyUI y espera a que libere la GPU. Imágenes y audio NO deben coexistir en la GPU (12 GB):
# haz primero una etapa (todas las imágenes), ejecuta este script y después la otra (los audios).
# Idempotente: si ComfyUI no corre, no hace nada. Códigos: 0 apagado/no corría · 1 no se pudo apagar.
set -u
PUERTO="${PUERTO:-8188}"
pids=$(pgrep -f "[m]ain.py --listen 127.0.0.1 --port $PUERTO")
if [ -z "$pids" ]; then echo "ComfyUI no está corriendo"; exit 0; fi
kill $pids
for _ in $(seq 1 20); do
  pgrep -f "[m]ain.py --listen 127.0.0.1 --port $PUERTO" >/dev/null || break
  sleep 1
done
if pgrep -f "[m]ain.py --listen 127.0.0.1 --port $PUERTO" >/dev/null; then
  echo "ComfyUI no se apagó con SIGTERM; revisa los procesos: pgrep -af 'main.py --listen'"; exit 1
fi
if command -v nvidia-smi >/dev/null; then
  # El driver tarda unos segundos en liberar la memoria tras morir el proceso: espera a tener ~6 GB libres
  for _ in $(seq 1 20); do
    libre=$(nvidia-smi --query-gpu=memory.total,memory.used --format=csv,noheader,nounits | awk -F', ' 'NR==1{print $1-$2}')
    [ "${libre:-0}" -ge 6000 ] && break
    sleep 1
  done
  echo "ComfyUI apagado. VRAM en uso: $(nvidia-smi --query-gpu=memory.used,memory.total --format=csv,noheader)"
  [ "${libre:-0}" -ge 6000 ] || echo "Aviso: quedan solo ${libre} MiB libres; otra aplicación usa la GPU."
else
  echo "ComfyUI apagado"
fi
