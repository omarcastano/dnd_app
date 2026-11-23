import argparse
import asyncio
import json
import re
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


_UNIDADES = ["cero", "uno", "dos", "tres", "cuatro", "cinco", "seis", "siete", "ocho", "nueve", "diez", "once", "doce", "trece",
             "catorce", "quince", "dieciséis", "diecisiete", "dieciocho", "diecinueve", "veinte", "veintiuno", "veintidós", "veintitrés",
             "veinticuatro", "veinticinco", "veintiséis", "veintisiete", "veintiocho", "veintinueve"]
_DECENAS = {3: "treinta", 4: "cuarenta", 5: "cincuenta", 6: "sesenta", 7: "setenta", 8: "ochenta", 9: "noventa"}
_ENLACES = {"por", "a", "de", "o", "y", "en", "con", "si", "que", "al", "del", "el", "la", "los", "las", ""}


def numero_en_palabras(n):
    if n < 30:
        return _UNIDADES[n]
    if n < 100:
        d, u = divmod(n, 10)
        return _DECENAS[d] + (f" y {_UNIDADES[u]}" if u else "")
    return str(n)


def para_voz(texto):
    """El TTS lee mal cifras y signos: escribe todo en palabras («−1» → «menos uno», «1-4» → «de uno a cuatro», «16+» → «dieciséis o más», «d20» → «dado de veinte»)."""
    t = texto.replace("\u2212", "-").replace("\u2013", "-")

    def dado(m):
        n = int(m[2]) if m[2] else 1
        cuerpo = f"{numero_en_palabras(n) if n > 1 else 'un'} {'dados' if n > 1 else 'dado'} de {numero_en_palabras(int(m[3]))}"
        return ("más " if m[1] else "") + cuerpo

    # Notación de dados: «d20» → «dado de veinte», «2d6» → «dos dados de seis», «+1d4» → «más un dado de cuatro»
    t = re.sub(r"(?<![\w])(\+)?(?:un\s+)?(\d*)d(\d+)(?![\w])", dado, t)
    t = re.sub(r"(?<![\w])(\d+)\s*-\s*(\d+)(?![\w])", lambda m: f"de {numero_en_palabras(int(m[1]))} a {numero_en_palabras(int(m[2]))}", t)
    t = re.sub(r"(\d+)\s*\+", lambda m: f"{numero_en_palabras(int(m[1]))} o más", t)
    t = re.sub(r"(?<![\w])-(\d+)", lambda m: f"menos {numero_en_palabras(int(m[1]))}", t)
    t = re.sub(r"(?<![\w])\+(\d+)", lambda m: f"más {numero_en_palabras(int(m[1]))}", t)

    def suelto(m):
        n, resto = int(m[1]), t[m.end():]
        if n == 1 and not t[:m.start()].rstrip().endswith(("menos", "más")):
            sig = re.match(r"\s*([\wáéíóúñ]*)", resto)[1].lower()
            if sig not in _ENLACES:
                return "una" if sig.endswith(("a", "as")) and sig not in {"punto"} else "un"
        return numero_en_palabras(n)

    return re.sub(r"(?<![\w])(\d+)(?![\w])", suelto, t)


def texto_de(carta):
    """Texto que se narra: la descripción y, si la carta tiene habilidades (enemigos), también cada una."""
    texto = carta.get("descripcion")
    if not texto:
        return None
    habilidades = " ".join(f"Habilidad, {h['nombre']}. {h['descripcion']}" for h in carta.get("habilidades", []))
    return para_voz(f"{texto} {habilidades}".strip())


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


def con_sonido(voz, sample_rate, ruta, hueco=0.4, fundido=1.2, db=-3.0):
    """Pone un efecto de sonido (aullido, rugido…) AL INICIO, antes de la narración: entrada suave, volumen un poco por debajo del pico de la voz, fundido final y `hueco` s de silencio antes de que empiece la voz."""
    import numpy as np

    with AudioFile(str(ruta)) as archivo:
        efecto = archivo.resampled_to(sample_rate).read(int(archivo.duration * sample_rate) + 1)
    efecto = efecto.mean(axis=0).astype("float32")
    efecto *= (float(np.max(np.abs(voz))) * 10 ** (db / 20)) / (float(np.max(np.abs(efecto))) or 1.0)
    n = min(int(fundido * sample_rate), len(efecto))
    efecto[-n:] *= np.linspace(1.0, 0.0, n, dtype="float32")
    corto = min(int(0.05 * sample_rate), len(efecto))
    efecto[:corto] *= np.linspace(0.0, 1.0, corto, dtype="float32")  # entrada suave: sin chasquido
    return np.concatenate([efecto, np.zeros(int(hueco * sample_rate), dtype="float32"), voz])


def generar_qwen(cartas, carpeta_salida, base):
    import numpy as np
    import torch  # pesado: solo se importa con este motor
    from qwen_tts import Qwen3TTSModel

    carpeta_salida.mkdir(parents=True, exist_ok=True)
    modelo = Qwen3TTSModel.from_pretrained(MODELO_QWEN, device_map="cuda:0", dtype=torch.bfloat16)
    referencia = modelo.create_voice_clone_prompt(
        ref_audio=str(VOZ_REF / "narradora.wav"), ref_text=(VOZ_REF / "narradora.txt").read_text(encoding="utf-8").strip()
    )
    for carta in cartas:
        texto = texto_de(carta)
        if not texto:
            continue
        torch.manual_seed(1234)
        ondas, sample_rate = modelo.generate_voice_clone(text=texto, language="Spanish", voice_clone_prompt=referencia)
        ruta = carpeta_salida / f"{carta['id']}.mp3"
        voz = np.asarray(ondas[0], dtype="float32").reshape(-1)
        if carta.get("sonido"):  # ruta relativa a la carpeta del JSON
            voz = con_sonido(voz, sample_rate, base / carta["sonido"])
        with AudioFile(str(ruta), "w", sample_rate, 1, quality="128 kbps") as salida_audio:
            salida_audio.write(voz.reshape(1, -1))
        print(f"Generado: {ruta}")


async def generar(cartas, voz, estilo, carpeta_salida):
    carpeta_salida.mkdir(parents=True, exist_ok=True)
    config = ESTILOS[estilo]
    for carta in cartas:
        texto = texto_de(carta)
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
    parser.add_argument("archivo", type=Path, help="JSON con una lista 'cartas' (clases) o 'enemigos' (public/enemigos/enemigos.json)")
    parser.add_argument("--id", help="ID de la carta a narrar (por defecto, todas)")
    parser.add_argument("--motor", choices=["qwen", "edge"], default="qwen", help="qwen (por defecto): voz clonada de la narradora; edge: edge-tts")
    parser.add_argument("--acento", choices=VOCES, default="es-CO", help="Solo motor edge")
    parser.add_argument("--voz", help="Solo motor edge. Voz exacta de edge-tts (sustituye a --acento), p. ej. es-ES-ElviraNeural")
    parser.add_argument("--estilo", choices=ESTILOS, default="epico", help="Solo motor edge")
    parser.add_argument("--salida", type=Path, help="Carpeta de salida (por defecto, narraciones/ junto al JSON)")
    args = parser.parse_args()

    crudo = json.loads(args.archivo.read_text(encoding="utf-8"))
    cartas = crudo.get("cartas") or crudo["enemigos"]
    if args.id:
        cartas = [c for c in cartas if c["id"] == args.id]
        if not cartas:
            raise SystemExit(f"No se encontró la carta '{args.id}'")

    salida = args.salida or args.archivo.parent / "narraciones"
    if args.motor == "qwen":
        generar_qwen(cartas, salida, args.archivo.parent)
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
