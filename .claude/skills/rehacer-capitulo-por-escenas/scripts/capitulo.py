"""Carga un capítulo del libro tal como lo ve la app: la ficha de public/mapas/campanas.json mezclada con su guion
(public/mapas/guiones/<campaña>-<n>.json, campo `guion`), que es la fuente única de escenas, opciones y estados.

    from capitulo import cargar
    cap = cargar("el-aliento-helado", 1)          # cap.e = capítulo mezclado; cap.guardar() escribe donde toca
    cap = cargar("el-aliento-helado", 1, "HEAD")  # versión de git (solo lectura)
Los objetos de cap.e son los mismos que los del guion: modificar cap.e["escenas"][...] y llamar a cap.guardar()
escribe el guion (o campanas.json si el capítulo aún no tiene guion aparte).
"""
import json, subprocess
from pathlib import Path

CAMPANAS = Path("public/mapas/campanas.json")
MAPAS = Path("public/mapas")
CAMPOS_GUION = ["objetivo", "geografia", "personajes", "inicio", "estados", "escenas", "opciones_comunes"]


def _leer(ruta, ref):
    if ref is None:
        return json.loads(Path(ruta).read_text(encoding="utf-8"))
    return json.loads(subprocess.run(["git", "show", f"{ref}:{ruta}"], capture_output=True, text=True, check=True).stdout)


class Capitulo:
    def __init__(self, campana, n, ref=None):
        self.ref = ref
        self.datos = _leer(CAMPANAS, ref)
        self.ci = next((i for i, c in enumerate(self.datos["campanas"]) if c["id"] == campana), None)
        if self.ci is None:
            raise SystemExit(f"No existe la campaña {campana}: {[c['id'] for c in self.datos['campanas']]}")
        self.campana, self.n = campana, n
        self.ficha = self.datos["campanas"][self.ci]["escenarios"][n - 1]
        self.ruta_guion = MAPAS / self.ficha["guion"] if self.ficha.get("guion") else None
        self.guion = None
        if self.ruta_guion:
            try:
                self.guion = _leer(self.ruta_guion, ref)
            except subprocess.CalledProcessError:
                self.guion = {}
        self.e = {**self.ficha, **{k: v for k, v in (self.guion or {}).items() if k != "_acerca"}}

    def guardar(self):
        if self.ref is not None:
            raise RuntimeError("Una versión de git es solo lectura")
        if self.ruta_guion:
            for k in CAMPOS_GUION:
                if k in self.e: self.guion[k] = self.e[k]
            self.ruta_guion.write_text(json.dumps(self.guion, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        else:
            self.datos["campanas"][self.ci]["escenarios"][self.n - 1] = self.e
            CAMPANAS.write_text(json.dumps(self.datos, ensure_ascii=False, indent=2), encoding="utf-8")


def cargar(campana, n, ref=None):
    return Capitulo(campana, n, ref)
