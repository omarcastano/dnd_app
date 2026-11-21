#!/usr/bin/env bash
# Uso: legacy/exportar.sh <clase>  →  personajes/<clase>/<clase>.pdf (vectorial, A4, 6 cartas por hoja)
set -euo pipefail
clase="${1:?Indica la clase, p. ej. druida}"
raiz="$(cd "$(dirname "$0")/.." && pwd)"
puerto="${PORT_CARTAS:-8765}"
python3 -m http.server "$puerto" -d "$raiz" >/dev/null 2>&1 &
srv=$!
trap 'kill $srv' EXIT
sleep 1
google-chrome --headless=new --no-sandbox --no-pdf-header-footer --virtual-time-budget=5000 \
  --print-to-pdf="$raiz/$clase/$clase.pdf" "http://localhost:$puerto/legacy/index.html?clase=$clase" 2>/dev/null
echo "ok  $raiz/$clase/$clase.pdf"
