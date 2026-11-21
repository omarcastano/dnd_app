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


# Motor por defecto: Qwen3-TTS clonando siempre la misma narradora (narracion/voz/narradora.wav + narradora.txt con su texto).
# Así todas las narraciones suenan con la misma voz. Para cambiar de narradora basta sustituir esos dos archivos.
VOZ_REF = Path(__file__).parent / "voz"
MODELO_QWEN = "Qwen/Qwen3-TTS-12Hz-1.7B-Base"


def generar_qwen(cartas, carpeta_salida):
    import numpy as np
    import torch  # pesado: solo se importa con este motor
    from qwen_tts import Qwen3TTSModel

    carpeta_salida.mkdir(parents=True, exist_ok=True)
    modelo = Qwen3TTSModel.from_pretrained(MODELO_QWEN, device_map="cuda:0", dtype=torch.bfloat16)
    referencia = modelo.create_voice_clone_prompt(
        ref_audio=str(VOZ_REF / "narradora.wav"), ref_text=(VOZ_REF / "narradora.txt").read_text(encoding="utf-8").strip()
    )
    for carta in cartas:
        texto = carta.get("descripcion")
        if not texto:
            continue
        torch.manual_seed(1234)
        ondas, sample_rate = modelo.generate_voice_clone(text=texto, language="Spanish", voice_clone_prompt=referencia)
        ruta = carpeta_salida / f"{carta['id']}.mp3"
        with AudioFile(str(ruta), "w", sample_rate, 1, quality="128 kbps") as salida_audio:
            salida_audio.write(np.asarray(ondas[0], dtype="float32").reshape(1, -1))
        print(f"Generado: {ruta}")


async def generar(cartas, voz, estilo, carpeta_salida):
    carpeta_salida.mkdir(parents=True, exist_ok=True)
    config = ESTILOS[estilo]
    for carta in cartas:
        texto = carta.get("descripcion")
        if not texto:
            continue
        ruta = carpeta_salida / f"{carta['id']}.mp3"
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
    parser = argparse.ArgumentParser(description="Genera narraciones (mp3) de las cartas con Qwen3-TTS (voz clonada de narracion/voz/) o edge-tts.")
    parser.add_argument("archivo", type=Path, help="JSON con una lista 'cartas'")
    parser.add_argument("--id", help="ID de la carta a narrar (por defecto, todas)")
    parser.add_argument("--motor", choices=["qwen", "edge"], default="qwen", help="qwen (por defecto): voz clonada de la narradora; edge: edge-tts")
    parser.add_argument("--acento", choices=VOCES, default="es-CO", help="Solo motor edge")
    parser.add_argument("--voz", help="Solo motor edge. Voz exacta de edge-tts (sustituye a --acento), p. ej. es-ES-ElviraNeural")
    parser.add_argument("--estilo", choices=ESTILOS, default="epico", help="Solo motor edge")
    parser.add_argument("--salida", type=Path, help="Carpeta de salida (por defecto, narraciones/ junto al JSON de la clase)")
    args = parser.parse_args()

    crudo = json.loads(args.archivo.read_text(encoding="utf-8"))
    cartas = crudo["cartas"]
    if args.id:
        cartas = [c for c in cartas if c["id"] == args.id]
        if not cartas:
            raise SystemExit(f"No se encontró la carta '{args.id}'")

    salida = args.salida or args.archivo.parent / "narraciones"
    if args.motor == "qwen":
        generar_qwen(cartas, salida)
    else:
        asyncio.run(generar(cartas, args.voz or VOCES[args.acento], args.estilo, salida))

    # Enlaza el audio en el JSON (ruta relativa a la carpeta de la clase) justo tras `descripcion`
    if not args.salida:
        for carta in cartas:
            if carta.get("descripcion") and (salida / f"{carta['id']}.mp3").exists():
                nueva = {}
                for k, v in carta.items():
                    if k != "narracion":
                        nueva[k] = v
                    if k == "descripcion":
                        nueva["narracion"] = f"narraciones/{carta['id']}.mp3"
                carta.clear()
                carta.update(nueva)
        args.archivo.write_text(json.dumps(crudo, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()
