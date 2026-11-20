import argparse
import asyncio
import json
from pathlib import Path

import edge_tts
from pedalboard import Compressor, Distortion, Limiter, LowpassFilter, LowShelfFilter, Pedalboard, PitchShift, Reverb
from pedalboard.io import AudioFile

VOCES = {
    "es-CO": "es-CO-GonzaloNeural",
    "es-MX": "es-MX-JorgeNeural",
    "es-ES": "es-ES-AlvaroNeural",
}


ESTILOS = {
    "normal": {"rate": "+0%", "pitch": "+0Hz", "efectos": None},
    "epico": {"rate": "-12%", "pitch": "-30Hz", "efectos": {"semitonas": 0, "drive_db": 8, "brillo_hz": 4500, "reverb": 0.18}},
    "villano": {"rate": "-16%", "pitch": "-45Hz", "efectos": {"semitonas": -2, "drive_db": 14, "brillo_hz": 3200, "reverb": 0.25}},
}


def procesar(entrada, salida, efectos):
    with AudioFile(str(entrada)) as archivo:
        audio = archivo.read(archivo.frames)
        sample_rate = archivo.samplerate
    # Distorsión y filtro de brillo para la aspereza y oscuridad; reverb para el ambiente.
    cadena = [PitchShift(semitones=efectos["semitonas"])] if efectos["semitonas"] else []
    cadena += [
        LowShelfFilter(cutoff_frequency_hz=180, gain_db=5),
        Compressor(threshold_db=-18, ratio=4),
        Distortion(drive_db=efectos["drive_db"]),
        LowpassFilter(cutoff_frequency_hz=efectos["brillo_hz"]),
        Reverb(room_size=0.6, wet_level=efectos["reverb"], dry_level=0.85),
        Limiter(threshold_db=-1),
    ]
    tablero = Pedalboard(cadena)
    procesado = tablero(audio, sample_rate)
    with AudioFile(str(salida), "w", sample_rate, procesado.shape[0]) as archivo_salida:
        archivo_salida.write(procesado)


async def generar(cartas, voz, estilo, carpeta_salida):
    carpeta_salida.mkdir(parents=True, exist_ok=True)
    config = ESTILOS[estilo]
    for carta in cartas:
        texto = carta.get("descripcion")
        if not texto:
            continue
        ruta = carpeta_salida / f"{carta['id']}-{estilo}.mp3"
        comunicado = edge_tts.Communicate(texto, voz, rate=config["rate"], pitch=config["pitch"])
        if config["efectos"]:
            bruto = ruta.with_name(f"{ruta.stem}.bruto.mp3")
            await comunicado.save(str(bruto))
            procesar(bruto, ruta, config["efectos"])
            bruto.unlink()
        else:
            await comunicado.save(str(ruta))
        print(f"Generado: {ruta}")


def main():
    parser = argparse.ArgumentParser(description="Genera audios de lore con edge-tts.")
    parser.add_argument("archivo", type=Path, help="JSON con una lista 'cartas'")
    parser.add_argument("--id", help="ID de la carta a narrar (por defecto, todas)")
    parser.add_argument("--acento", choices=VOCES, default="es-CO")
    parser.add_argument("--voz", help="Voz exacta de edge-tts (sustituye a --acento), p. ej. es-ES-ElviraNeural")
    parser.add_argument("--estilo", choices=ESTILOS, default="epico")
    parser.add_argument("--salida", type=Path, default=Path(__file__).parent / "audio")
    args = parser.parse_args()

    cartas = json.loads(args.archivo.read_text(encoding="utf-8"))["cartas"]
    if args.id:
        cartas = [c for c in cartas if c["id"] == args.id]
        if not cartas:
            raise SystemExit(f"No se encontró la carta '{args.id}'")

    voz = args.voz or VOCES[args.acento]
    asyncio.run(generar(cartas, voz, args.estilo, args.salida))


if __name__ == "__main__":
    main()
