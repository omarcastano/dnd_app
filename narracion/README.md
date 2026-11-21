# Narración

Genera audios de lore con edge-tts a partir de los JSON de `public/personajes/`.

```bash
make audio-setup   # crea .venv e instala requirements.txt
make audio ARGS="../public/personajes/clases/guerrero/guerrero.json --id durotan-frostwolf --estilo epico"
```

Opciones: `--id`, `--acento` (es-CO, es-MX, es-ES), `--voz`, `--estilo` (normal, epico, villano), `--salida` (por defecto `narracion/audio/`).
