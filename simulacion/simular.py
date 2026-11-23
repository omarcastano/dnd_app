#!/usr/bin/env python3
"""Simulador de balance de La Taberna (sin interfaz: reglas, dados y condicionales).

Uso:  python3 simulacion/simular.py [--partidas 3000] [--rapido]   (genera simulacion/reporte.html)
                                    [--nivel-min 1] [--nivel-max 2] [--pv 10] [--p-especial 0.5] [--semilla 1]

Lee personajes, enemigos y niveles de public/ (JSON). La tienda y los cofres están copiados de
public/tienda/js (datos/tienda.js y secciones/cofres.js): si cambian allí, actualizar aquí.

REGLAS DE DECISIÓN (acordadas con el autor del juego)
  · Grupo: 4 héroes de clases distintas, como mucho 1 tanque y 1 sanador.
  · Empiezan en nivel 1, con 10 de vida, 0 monedas y 0 objetos. Subir a nivel 2 cuesta 5 monedas (solo en la taberna).
  · Iniciativa: al empezar el combate todos (héroes y bestias) tiran 1d20; orden de mayor a menor, empates al azar.
  · Turno de un héroe: PRIMERO decide «básica» o «especial» (aleatorio; el sanador sana si algún aliado tiene <5 PV;
    el tanque con >3 PV siempre tanquea). DESPUÉS tira 1d20 y usa la mejor opción de esa tabla que permita la tirada.
  · Usar el don (una vez por tablero) gasta el turno; si el d20 del don falla, también se gasta.
  · Conjuros de sanación solo en combate; fuera de combate solo comida y bebida.
  · Taberna (solo al final): cada héroe con SUS monedas: arma útil > armadura > dado > comida > bebida. Sushi mágico cura 1d6.
  · Botín y cofres: cada objeto va a un héroe vivo al azar; lo que roba el Pícaro (Manos Ligeras) y su «ojo de ladrón» son suyos.
  · Escenario: 4 grupos de 1-3 bestias (niveles 1 y 2 mezclados; 2 obligatorios) y 2 cofres custodiados por grupos distintos; el orden de los grupos es aleatorio.
"""
import argparse, json, random, re, statistics
from collections import Counter, defaultdict
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent / "public"

def cargar(ruta):
    return json.load(open(RAIZ / ruta, encoding="utf-8"))

ENEMIGOS = cargar("enemigos/enemigos.json")
NIVELES = {n["nivel"]: n for n in ENEMIGOS["niveles"]}
CLASES = {c["id"]: cargar(f"personajes/clases/{c['id']}/{c['id']}.json") for c in cargar("personajes/clases.json")}

# ---- Tienda: nombre -> (unidades, precio, valor[, manos])
COMIDA = {"Tarta de fresa": (4, 3, 2), "Huevos fritos": (3, 4, 3), "Postres": (8, 2, 1),
          "Calentado": (3, 5, 4), "Panes": (4, 3, 2), "Sushi magico": (1, 6, 0)}   # sushi: 1d6 al comerlo
BEBIDA = {"Con alcohol": (8, 4, 4), "Sin alcohol": (8, 3, 2)}
ARMAS = {"Espada corta": (7, 4, 1, 1), "Espada larga": (1, 5, 2, 1), "Alabarda": (6, 7, 3, 2),
         "Espada doble": (1, 7, 3, 2), "Puñal": (1, 3, 1, 1), "Daga": (4, 4, 1, 1), "Arco": (2, 6, 2, 2),
         "Hacha corta": (2, 4, 1, 1), "Maza": (1, 5, 2, 1)}
ARMADURAS = {"Escudo": (2, 5, 4), "Pechera": (4, 7, 5), "Casco": (4, 6, 3)}
PRECIO_DADO = 3
PUEDE_ESCUDO = {"guerrero-orco", "paladin"}
PUEDE_ARMA = {"guerrero-orco": {"Hacha corta", "Espada larga", "Maza", "Alabarda"},
              "paladin": {"Maza", "Espada corta"},
              "picaro": {"Daga", "Puñal", "Espada corta"},
              "sacerdote-enano": {"Maza", "Daga"},
              "druida": set()}       # Bastón y Libro no se venden
PRECIO_NIVEL = 5

RANGOS_COFRE = [(1, 8), (9, 13), (14, 17), (18, 19), (20, 20)]
COFRES = [
    [[("nada",)], [("moneda", 2)], [("moneda", 2), ("comida", 2)], [("moneda", 2), ("comida", 2), ("dado",)],
     [("moneda", 3), ("comida", 2), ("bebida", 2), ("arma", 1), ("dado",)]],
    [[("moneda", 1), ("comida", 1)], [("moneda", 3), ("comida", 1)], [("moneda", 3), ("comida", 2), ("bebida", 1)],
     [("moneda", 4), ("comida", 2), ("bebida", 2), ("dado",)],
     [("moneda", 5), ("comida", 3), ("bebida", 2), ("arma", 1), ("dado",)]],
    [[("moneda", 2), ("comida", 1)], [("moneda", 4), ("comida", 1)], [("moneda", 4), ("comida", 2), ("bebida", 1)],
     [("moneda", 5), ("comida", 2), ("bebida", 2), ("dado",)],
     [("moneda", 6), ("comida", 3), ("bebida", 3), ("arma", 1), ("dado",)]],
    [[("moneda", 3), ("comida", 1)], [("moneda", 5), ("comida", 2)], [("moneda", 5), ("comida", 2), ("bebida", 2)],
     [("moneda", 6), ("comida", 3), ("bebida", 2), ("dado",)],
     [("moneda", 7), ("comida", 3), ("bebida", 3), ("arma", 1), ("dado",)]],
    [[("moneda", 4), ("comida", 2)], [("moneda", 6), ("comida", 3), ("bebida", 1)], [("moneda", 6), ("comida", 3), ("bebida", 2)],
     [("moneda", 7), ("comida", 4), ("bebida", 2), ("arma", 1), ("dado",)],
     [("moneda", 8), ("comida", 4), ("bebida", 3), ("arma", 1), ("armadura", 1), ("dado",)]],
]

def rango(txt):
    if txt.endswith("+"):
        return int(txt[:-1]), 99
    a, b = txt.split("-")
    return int(a), int(b)

def valor_en(tabla, tirada):
    """Mejor opción de la tabla que permite la tirada (mayor mínimo), o None si falla."""
    mejor = None
    for op in tabla:
        lo, hi = op["r"]
        if lo <= tirada <= hi and (mejor is None or lo > mejor["r"][0]):
            mejor = op
    return mejor

def mejor_combo(pool):
    """Mejores armas de una lista con 2 manos disponibles."""
    mejor, mv = [], 0
    for i, a in enumerate(pool):
        for combo in [[a]] + [[a, pool[k]] for k in range(i + 1, len(pool))]:
            if sum(ARMAS[x][3] for x in combo) <= 2:
                v = sum(ARMAS[x][2] for x in combo)
                if v > mv:
                    mejor, mv = combo, v
    return mejor

# ---------------------------------------------------------------- entidades
class Jugador:
    def __init__(self, clase_id, sexo, pv_base, poder, don, nivel_carta=1):
        d = CLASES[clase_id]
        self.clase = clase_id
        pj = [c for c in d["cartas"] if c["tipo"] == "personaje"][sexo]
        self.nombre, self.raza = pj["nombre"], pj["raza"]
        self.pvmax = pv_base + (1 if self.raza.startswith("Drac") else 0)
        self.pv = self.pvmax
        self.nivel_carta = nivel_carta
        sel = d["seleccion"][1]["opciones"][poder]
        carta = next(c for c in d["cartas"] if c["id"] in sel["cartas"] and c.get("nivel") == nivel_carta)
        self.poder = sel["etiqueta"]
        self.ataques = [{"r": rango(a["rango_d20"]), "valor": a["valor"]} for a in carta["ataques"]]
        self.habs = [{"r": rango(a["rango_d20"]), "valor": a["valor"]} for a in carta["tabla"]]
        self.tipo_hab = carta["tabla"][0]["subtitulo"]
        t = self.tipo_hab
        self.rol = ("tanque" if re.search("Provoca|protección", t) else
                    "soporte" if "Escudo de varias" in t else        # Sacerdote «Runas de Resguardo»: apoyo, no tanque
                    "sanador" if re.search("sanación|Cura en las", t) else
                    "ladron" if "Robo" in t else "dps")
        self.don = d["seleccion"][2]["opciones"][don]["cartas"][0]
        self.don_usado = False
        self.armas, self.armadura = [], None
        self.dado_ataque = self.dado_sanacion = self.dado_destreza = False
        self.vivo = True
        self.monedas = 0                      # cada héroe lleva lo suyo
        self.comida, self.bebida = Counter(), Counter()
        self.m_armas, self.m_armaduras = [], []
        self.borracho_pend = 0
        self.bono_terquedad = False
        self.dano_hecho = self.dano_recibido = self.curado = 0
        self.reset_combate()

    def reset_combate(self):
        self.sangrado = self.quemadura = 0
        self.miedo = self.miedo_val = 0
        self.marca_enemiga = 0
        self.escudo_prox = 0
        self.runa = 0
        self.manantial = self.manantial_val = 0
        self.humo = 0              # turnos enemigos que aún no le hacen daño
        self.humo_extra = False
        self.primer_ataque = True
        self.furia_don = False
        self.bestia = False
        self.recibio_ronda = False
        self.borracho = 0

    @property
    def bono_arma(self):
        return sum(ARMAS[a][2] for a in self.armas)

    @property
    def reduccion(self):
        return ARMADURAS[self.armadura][2] if self.armadura else 0

    def equipar(self):
        """Se equipa lo mejor que pueda usar de lo que lleva en la mochila."""
        pool = [a for a in self.m_armas if a in PUEDE_ARMA[self.clase]] + list(self.armas)
        nuevo = mejor_combo(pool)
        if sum(ARMAS[x][2] for x in nuevo) > self.bono_arma:
            self.m_armas.extend(self.armas)
            self.armas = nuevo
            for x in nuevo:
                self.m_armas.remove(x)
        mejor = self.armadura
        for a in self.m_armaduras:
            if a == "Escudo" and self.clase not in PUEDE_ESCUDO:
                continue
            if mejor is None or ARMADURAS[a][2] > ARMADURAS[mejor][2]:
                mejor = a
        if mejor != self.armadura:
            if self.armadura:
                self.m_armaduras.append(self.armadura)
            self.m_armaduras.remove(mejor)
            self.armadura = mejor

class Enemigo:
    def __init__(self, datos, jugadores=4):
        nv = NIVELES[datos["nivel"]]
        self.id, self.nombre, self.nivel = datos["id"], datos["nombre"], datos["nivel"]
        self.pvmax = self.pv = nv["vida"][{3: 0, 4: 0, 5: 1, 6: 2}[jugadores]]   # SUPUESTO: con 3 héroes, la vida de 4
        self.basico, self.fuerte = nv["basico"], nv["fuerte"]
        sub = datos["ataques"][1]["subtitulo"].lower()
        desc = datos["habilidades"][0]["descripcion"].lower() if datos.get("habilidades") else ""
        self.efecto = next((e for e in ("sangrado", "veneno", "quemadura", "miedo", "marca") if e in sub or e in desc), None)
        if self.efecto == "veneno":
            self.efecto = "sangrado"                        # mismo comportamiento
        m = re.search(r"[−-](\d+) a sus tiradas", desc)
        self.miedo_val = int(m.group(1)) if m else 1
        self.provocado_por, self.provocado_turnos = None, 0
        self.marca_runa = False
        self.aturdido = False

# ---------------------------------------------------------------- partida
class Partida:
    def __init__(self, rng, args, composicion=None):
        """composicion: lista de (clase, índice de poder); si es None se sortea (3-5 héroes, como mucho 1 tanque y 1 sanador)."""
        self.rng, self.args = rng, args
        self.log = Counter()
        n_op = lambda c, i: len(CLASES[c]["seleccion"][i]["opciones"])
        if composicion:
            self.jug = [Jugador(c, sexo, args.pv, poder, don) for c, poder, sexo, don in composicion]
        else:
            while True:
                clases = rng.sample(list(CLASES), rng.randint(3, 5))
                self.jug = [Jugador(c, 0, args.pv, rng.randrange(n_op(c, 1)), rng.randrange(n_op(c, 2))) for c in clases]
                if sum(j.rol == "tanque" for j in self.jug) <= 1 and sum(j.rol == "sanador" for j in self.jug) <= 1:
                    break
        self.n_jug = len(self.jug)
        self.rondas_total = 0
        self.ronda = 0
        self.egida = 0
        self.altar = 0
        self.actuaron = set()

    def d20(self): return self.rng.randint(1, 20)
    def d4(self): return self.rng.randint(1, 4)
    def vivos(self): return [j for j in self.jug if j.vivo]
    def mas_herido(self): return min(self.vivos(), key=lambda x: x.pv / x.pvmax)

    def cura(self, j, n):
        if not j.vivo or n <= 0:
            return
        antes = j.pv
        j.pv = min(j.pvmax, j.pv + n)
        j.curado += j.pv - antes

    def dano_jugador(self, j, n):
        if n <= 0 or not j.vivo:
            return
        j.dano_recibido += n
        if j.pv - n <= 0:
            if j.don == "terquedad-astada" and not j.don_usado and j.pv > 0:
                j.don_usado, j.pv, j.bono_terquedad = True, 1, True
                self.log["terquedad"] += 1
                return
            j.pv, j.vivo = 0, False
            self.log["muertes"] += 1
        else:
            j.pv -= n

    # ---- botín: cada objeto va a un héroe VIVO al azar (salvo lo que roba el Pícaro, que es suyo)
    def dar(self, cat, n=1, quien=None):
        rng = self.rng
        pick = lambda d: rng.choices(list(d), [v[0] for v in d.values()])[0]
        def dest():
            return quien if quien is not None else rng.choice(self.vivos())
        if cat in ("monedas", "moneda"):
            dest().monedas += n
            return
        for _ in range(n):
            h = dest()
            if cat == "comida": h.comida[pick(COMIDA)] += 1
            elif cat == "bebida": h.bebida[pick(BEBIDA)] += 1
            elif cat == "arma":
                a = pick(ARMAS)
                h.m_armas.append(a)
                if a not in PUEDE_ARMA[h.clase]: self.log["arma_inutil"] += 1
                h.equipar()
            elif cat == "armadura":
                a = pick(ARMADURAS)
                h.m_armaduras.append(a)
                if a == "Escudo" and h.clase not in PUEDE_ESCUDO: self.log["armadura_inutil"] += 1
                h.equipar()
            elif cat == "dado":
                d = rng.choice(["ataque", "sanacion", "destreza"])
                if getattr(h, "dado_" + d): self.log["dado_repetido"] += 1
                setattr(h, "dado_" + d, True)

    def tirar_botin(self, nv):
        pesos = NIVELES[nv]["botin"]["pesos"]
        cat = self.rng.choices(list(pesos), list(pesos.values()))[0]
        self.dar(cat, self.rng.randint(*NIVELES[nv]["botin"]["monedas"]) if cat == "monedas" else 1)

    def ojo_de_ladron(self):
        pic = next((j for j in self.vivos() if j.clase == "picaro"), None)
        if pic and self.d20() >= 15:
            self.dar("monedas", 1, quien=pic)
            self.log["ojo_ladron"] += 1

    def abrir_cofre(self):
        filas = self.rng.choice(COFRES[:getattr(self.args, "tipos_cofre", len(COFRES))])      # cofres acotados a los N primeros (de menos a más botín)
        abre = self.rng.choice(self.vivos())            # lo abre alguien al azar; usa SU dado de destreza
        t = min(self.d20() + (self.d4() if abre.dado_destreza else 0), 20)
        fila = next(f for (lo, hi), f in zip(RANGOS_COFRE, filas) if lo <= t <= hi)
        for it in fila:
            if it[0] != "nada":
                self.dar(it[0], it[1] if len(it) > 1 else 1)
        self.ojo_de_ladron()
        self.log["cofres"] += 1

    # ---- comida (cada héroe come de su propia mochila)
    def valor_comida(self, tipo, nombre):
        if nombre == "Sushi magico":
            return self.rng.randint(1, 6)
        return (COMIDA if tipo == "comida" else BEBIDA)[nombre][2]

    def comer(self, j, tipo, nombre):
        getattr(j, tipo)[nombre] -= 1
        self.cura(j, self.valor_comida(tipo, nombre) + (self.d4() if j.dado_sanacion else 0))

    def curar_fuera_combate(self):
        for j in self.vivos():
            while j.pvmax - j.pv >= 2:
                ops = [(COMIDA[k][2] or 3, "comida", k) for k, n in j.comida.items() if n]
                ops += [(BEBIDA[k][2], "bebida", k) for k, n in j.bebida.items() if n]
                ops = [o for o in ops if o[0] <= j.pvmax - j.pv]
                if not ops:
                    break
                ops.sort(key=lambda o: (o[2] == "Con alcohol", -o[0]))   # evita alcohol si puede
                _, tipo, nombre = ops[0]
                self.comer(j, tipo, nombre)
                self.log["comidas_fuera"] += 1
                if nombre == "Con alcohol":
                    j.borracho_pend = 2

    def comer_en_combate(self, j):
        ops = [(COMIDA[k][2] or 3, "comida", k) for k, n in j.comida.items() if n]
        ops += [(BEBIDA[k][2], "bebida", k) for k, n in j.bebida.items() if n and k == "Sin alcohol"]
        if not ops:
            return False
        _, tipo, nombre = max(ops)
        self.comer(j, tipo, nombre)
        self.log["comidas_combate"] += 1
        return True

    # ---- combate
    def turnos_enemigos_pendientes(self, enemigos):
        vivos = [e for e in enemigos if e.pv > 0]
        return len([e for e in vivos if e not in self.actuaron]) or len(vivos)

    def combate(self, enemigos):
        for j in self.jug:
            j.reset_combate()
            j.borracho, j.borracho_pend = j.borracho_pend, 0
        self.egida = self.altar = 0
        for j in self.vivos():
            if j.raza == "Panda":
                self.cura(j, 1)
        # iniciativa: todos tiran 1d20; mayor a menor, empates al azar
        part = [("j", j) for j in self.jug] + [("e", e) for e in enemigos]
        tiradas = sorted(((self.d20(), self.rng.random(), k, x) for k, x in part), key=lambda t: (-t[0], t[1]))
        orden = [(k, x) for _, _, k, x in tiradas]
        self.ronda = 0
        while any(e.pv > 0 for e in enemigos) and self.vivos() and self.ronda < 60:
            self.ronda += 1
            self.rondas_total += 1
            self.actuaron = set()
            for j in self.jug:
                j.recibio_ronda = False
            if self.altar > 0:
                self.altar -= 1
                for j in self.vivos():
                    self.cura(j, 1)
            for k, x in orden:
                if not self.vivos() or not any(e.pv > 0 for e in enemigos):
                    break
                if k == "j":
                    if x.vivo:
                        self.turno_jugador(x, enemigos)
                elif x.pv > 0:
                    self.turno_enemigo(x, enemigos)
            for j in self.vivos():
                j.marca_enemiga = max(0, j.marca_enemiga - 1)
        ganado = all(e.pv <= 0 for e in enemigos) and bool(self.vivos())
        if ganado:
            for e in enemigos:
                self.tirar_botin(e.nivel)
                self.ojo_de_ladron()
                self.log["bestias"] += 1
        return ganado

    # ---- turno enemigo
    def turno_enemigo(self, e, enemigos):
        self.actuaron.add(e)
        if e.aturdido:
            e.aturdido = False
        else:
            if e.provocado_turnos > 0 and e.provocado_por and e.provocado_por.vivo:
                objetivo = e.provocado_por
            else:
                objetivo = self.rng.choice(self.vivos())
            ataques = 2 if (getattr(self.args, "segundo_ataque", False) and self.n_jug == 5 and self.ronda % 3 == 0) else 1   # opcional: regla de 5 jugadores
            for k in range(ataques):
                if k and not self.vivos():
                    break
                if k:
                    objetivo = self.rng.choice(self.vivos())
                t = self.d20()
                if t > 4:
                    self.golpe_a_jugador(objetivo, e.fuerte if t >= 16 else e.basico, e, t >= 16)
        if 0 < e.provocado_turnos < 900:
            e.provocado_turnos -= 1
        self.egida = max(0, self.egida - 1)
        for j in self.jug:
            j.humo = max(0, j.humo - 1)
            j.runa = max(0, j.runa - 1)                  # la runa dura «rondas» de ataques enemigos: se cuenta por turno de bestia

    def golpe_a_jugador(self, j, dano, e, fuerte):
        if not j.vivo:
            return
        if j.humo > 0:
            final = 0
        else:
            if self.egida > 0:
                self.log["mitigado_egida"] += dano - dano // 2
                dano //= 2
                if j.clase == "paladin":
                    e.pv -= 1                      # «los enemigos que te ataquen a ti sufren 1» (simplificado)
            red = j.reduccion
            if j.armadura == "Escudo" and j.clase == "guerrero-orco" and not j.recibio_ronda:
                red += 1
            # Bastión Sagrado (próximo golpe) y Runa (cada golpe mientras dure; con escudo, sus puntos se duplican)
            bastion, j.escudo_prox = j.escudo_prox, 0
            runa = (1 + (ARMADURAS["Escudo"][2] if j.armadura == "Escudo" else 0)) if j.runa > 0 else 0
            sin_extra = max(1, dano - red)
            con_bastion = max(1, dano - red - bastion)
            final = max(1, dano - red - bastion - runa)
            self.log["mitigado_bastion"] += sin_extra - con_bastion
            self.log["mitigado_runa"] += con_bastion - final
            if j.marca_enemiga > 0:
                final += 1
        j.recibio_ronda = True
        self.dano_jugador(j, final)
        if j.vivo and fuerte and e.efecto:
            if e.efecto == "sangrado": j.sangrado = 2
            elif e.efecto == "quemadura" and not j.raza.startswith("Drac"): j.quemadura = 2
            elif e.efecto == "miedo": j.miedo, j.miedo_val = 2, e.miedo_val
            elif e.efecto == "marca": j.marca_enemiga = 2

    # ---- turno jugador
    def turno_jugador(self, j, enemigos):
        if j.sangrado > 0: j.sangrado -= 1; self.dano_jugador(j, 1)
        if j.vivo and j.quemadura > 0: j.quemadura -= 1; self.dano_jugador(j, 1)
        if j.vivo and j.manantial > 0: j.manantial -= 1; self.cura(j, j.manantial_val)
        if not j.vivo or not any(e.pv > 0 for e in enemigos):
            return
        self.actuar(j, enemigos)
        if j.miedo > 0:
            j.miedo -= 1

    def intencion(self, j):
        """Decide ANTES de tirar: 'especial' o 'basica'."""
        if j.rol == "sanador" and any(x.pv < 5 for x in self.vivos()):
            return "especial"
        if j.rol == "tanque" and j.pv > 3:
            return "especial"
        return "especial" if self.rng.random() < self.args.p_especial else "basica"

    def actuar(self, j, enemigos):
        if not j.don_usado and self.quiere_don(j, enemigos):
            self.usar_don(j, enemigos)                    # gasta el turno
            return
        if j.pv <= j.pvmax * 0.35 and self.comer_en_combate(j):
            return
        intencion = self.intencion(j)
        mod = (self.d4() if j.dado_ataque else 0) - (j.miedo_val if j.miedo > 0 else 0)
        if j.borracho > 0:
            mod -= 3
            j.borracho -= 1
        if j.clase in ("druida", "guerrero-orco"):
            mod += 1                                      # +1 conjuros / +1 cuerpo a cuerpo
        t = self.d20() + mod
        if intencion == "especial":
            if j.clase == "paladin" and "sanación" in j.tipo_hab:
                t += 1
            op = valor_en(j.habs, t)
            if op:
                self.aplicar_habilidad(j, op["valor"], enemigos)
        else:
            op = valor_en(j.ataques, t)
            if op:
                self.golpear(j, self.objetivo(enemigos), op["valor"])

    def objetivo(self, enemigos):
        return min((e for e in enemigos if e.pv > 0), key=lambda e: e.pv)

    def golpear(self, j, e, valor):
        dano = valor + j.bono_arma
        if j.primer_ataque:
            j.primer_ataque = False
            if j.raza == "Taurent": dano += 1
            if j.clase == "picaro": dano += 2
        if j.bono_terquedad: dano += 1; j.bono_terquedad = False
        if e.marca_runa: dano += 1; e.marca_runa = False
        if j.humo_extra: dano += 1; j.humo_extra = False
        if j.furia_don or j.bestia: dano *= 2
        self.dano_a_enemigo(j, e, dano)
        return dano

    def dano_a_enemigo(self, j, e, dano):
        if dano <= 0 or e.pv <= 0:
            return
        e.pv -= dano
        j.dano_hecho += dano
        if j.clase == "sacerdote-enano":
            self.cura(self.mas_herido(), 1)
        if e.pv <= 0 and j.raza == "Tiefling":
            self.cura(j, 1)

    def aplicar_habilidad(self, j, v, enemigos):
        tipo = j.tipo_hab
        e = self.objetivo(enemigos)
        if "Provoca" in tipo:
            vivos_e = [x for x in enemigos if x.pv > 0]
            # prefiere un enemigo aún no provocado por él; si ya están todos, renueva (no suma) al que menos le queda
            libres = [x for x in vivos_e if not (x.provocado_turnos > 0 and x.provocado_por is j)]
            x = libres[0] if libres else min(vivos_e, key=lambda y: y.provocado_turnos)
            x.provocado_por, x.provocado_turnos = j, v
        elif "varios" in tipo:
            self.golpear(j, e, v)
            otros = [x for x in enemigos if x.pv > 0 and x is not e]
            if otros:
                self.dano_a_enemigo(j, otros[0], 1)
        elif "garras" in tipo or "especial" in tipo:
            self.golpear(j, e, v)
        elif "sanación" in tipo:
            self.cura(self.mas_herido(), v)
        elif "protección" in tipo:
            obj = self.mas_herido()
            obj.escudo_prox = v + (ARMADURAS["Escudo"][2] if obj.armadura == "Escudo" else 0)
        elif "que cura" in tipo:
            self.cura(j, self.golpear(j, e, v) // 2)
        elif "Robo" in tipo:
            self.robar(j, v, e)
        elif "marca" in tipo:
            self.golpear(j, e, v)
            e.marca_runa = True
        elif "Cura en las" in tipo:
            obj = min((x for x in self.vivos() if x.manantial <= 0), key=lambda x: x.pv / x.pvmax, default=None)
            if obj:
                obj.manantial, obj.manantial_val = 2, v
        elif "Escudo de varias" in tipo:
            obj = self.mas_herido()
            vivos_e = [x for x in enemigos if x.pv > 0]
            turnos = self.turnos_enemigos_pendientes(enemigos) + (v - 1) * len(vivos_e)      # v rondas completas de ataques enemigos
            obj.runa = max(obj.runa, turnos)             # solo una runa por aliado: se queda la que dure más

    def robar(self, j, v, e):
        objetos = NIVELES[e.nivel]["robo"]["objetos"]
        n = min(v, self.rng.choices([int(k) for k in objetos], list(objetos.values()))[0])
        pesos = dict(NIVELES[e.nivel]["botin"]["pesos"])
        pesos["monedas"] += pesos.pop("nada")
        for _ in range(n):
            cat = self.rng.choices(list(pesos), list(pesos.values()))[0]
            self.dar(cat, self.rng.randint(*NIVELES[e.nivel]["botin"]["monedas"]) if cat == "monedas" else 1, quien=j)
            self.log["objetos_robados"] += 1
        if j.nivel_carta == 2:
            self.dano_a_enemigo(j, e, n)

    # ---- dones (una vez por tablero; gastan el turno; si el d20 falla se pierde igual)
    def quiere_don(self, j, enemigos):
        vivos_e = [e for e in enemigos if e.pv > 0]
        if j.don == "terquedad-astada":
            return False                                  # pasivo
        if j.don == "plegaria-de-resurreccion":
            return any(not x.vivo for x in self.jug)
        if j.don == "el-curandero":
            return sum(x.pvmax - x.pv for x in self.vivos()) >= 4
        return (self.mas_herido().pv / self.mas_herido().pvmax <= 0.5 or self.ronda >= 3
                or len(vivos_e) >= 3 or any(e.pv >= 20 for e in vivos_e))

    def usar_don(self, j, enemigos):
        d = j.don
        j.don_usado = True
        self.log[f"don:{d}"] += 1
        e = self.objetivo(enemigos)
        ok = self.d20() >= 12
        if d == "rugido-del-jefe" and ok:
            for x in enemigos:
                if x.pv > 0:
                    x.provocado_por, x.provocado_turnos = j, 999
        elif d == "instinto-salvaje" and ok: j.bestia = True
        elif d == "furia-divina": j.furia_don = True
        elif d == "egida-inquebrantable": self.egida = self.turnos_enemigos_pendientes(enemigos)
        elif d == "el-curandero":
            for x in self.vivos(): self.cura(x, self.d4())
        elif d == "plegaria-de-resurreccion" and ok:
            muerto = next((x for x in self.jug if not x.vivo), None)
            if muerto:
                muerto.vivo, muerto.pv = True, max(1, muerto.pvmax // 2)
        elif d == "golpe-maestro" and ok:
            self.dano_a_enemigo(j, e, 4)
            self.cura(j, 4)
        elif d == "bomba-de-humo":
            j.humo, j.humo_extra = self.turnos_enemigos_pendientes(enemigos), True
        elif d == "aliento-purificador" and ok:
            for x in self.vivos(): x.sangrado = x.quemadura = x.miedo = x.marca_enemiga = 0
        elif d == "altar-ancestral": self.altar = 3
        elif d == "sentencia-del-bambu": e.aturdido = True

# ---------------------------------------------------------------- taberna (solo al final)
def comprar_heroe(j, gastos):
    """Cada héroe con SUS monedas. Jerarquía: arma útil > armadura > dado > comida > bebida."""
    dinero = j.monedas
    for _ in range(50):
        gan = [(sum(ARMAS[x][2] for x in mejor_combo(list(j.armas) + [a])) - j.bono_arma, a)
               for a in PUEDE_ARMA[j.clase] if ARMAS[a][1] <= dinero]
        gan = [g for g in gan if g[0] > 0]
        if gan:
            _, a = max(gan)
            dinero -= ARMAS[a][1]; j.armas = mejor_combo(list(j.armas) + [a]); gastos[a] += 1
            continue
        arm = [(red, a) for a, (_, precio, red) in ARMADURAS.items()
               if (a != "Escudo" or j.clase in PUEDE_ESCUDO) and precio <= dinero and red > j.reduccion]
        if arm:
            _, a = max(arm)
            dinero -= ARMADURAS[a][1]; j.armadura = a; gastos[a] += 1
            continue
        if dinero >= PRECIO_DADO and not j.dado_ataque:
            j.dado_ataque = True; dinero -= PRECIO_DADO; gastos["dado ataque"] += 1; continue
        if dinero >= PRECIO_DADO and j.rol == "sanador" and not j.dado_sanacion:
            j.dado_sanacion = True; dinero -= PRECIO_DADO; gastos["dado sanacion"] += 1; continue
        ops = [((v[2] or 3) / v[1], k) for k, v in COMIDA.items() if v[1] <= dinero]
        if ops:
            k = max(ops)[1]; dinero -= COMIDA[k][1]; gastos[k] += 1; continue
        ops = [(v[2] / v[1], k) for k, v in BEBIDA.items() if v[1] <= dinero]
        if ops:
            k = max(ops)[1]; dinero -= BEBIDA[k][1]; gastos[k] += 1; continue
        break
    return dinero

# ---------------------------------------------------------------- escenario (un «set» fijo)
ENEMIGO_POR_ID = {e["id"]: e for e in ENEMIGOS["enemigos"]}

def rango_arg(txt):
    if isinstance(txt, tuple):
        return txt
    txt = str(txt)
    return tuple(int(x) for x in txt.split("-")) if "-" in txt else (int(txt),) * 2

POR_NIVEL = {nv: [e["id"] for e in ENEMIGOS["enemigos"] if e["nivel"] == nv] for nv in range(1, 8)}

def sortear_conjunto(rng, args, comps):
    """Un set FIJO: héroes (clase, poder y don de cada uno) y los grupos de bestias; de cada grupo se define cuántas bestias de cada nivel
    tiene, si es obligatorio y si custodia un cofre (a lo sumo uno por grupo; hay grupos sin cofre, nunca cofres sin grupo).
    Qué bestia exacta de cada nivel sale, el orden en que se encuentran los grupos y los dados se sortean en CADA ejecución."""
    comp = tuple((c, i, 0, rng.randrange(len(CLASES[c]["seleccion"][2]["opciones"]))) for c, i in rng.choice(comps))
    lo, hi = rango_arg(args.bestias)
    grupos = [{"obl": False, "cofre": False,
               "niv": tuple(sorted(rng.randint(args.nivel_min, args.nivel_max) for _ in range(rng.randint(lo, hi))))}
              for _ in range(args.grupos)]
    for g in rng.sample(grupos, args.obligatorios):
        g["obl"] = True
    n_cofres = rng.randint(args.cofres_min, min(args.cofres_max, args.grupos))
    for g in rng.sample(grupos, n_cofres):
        g["cofre"] = True
    return {"comp": comp, "grupos": grupos, "n_cofres": n_cofres}

def jugar(rng, args, conj):
    """Una ejecución del set: los grupos se encuentran siempre en el mismo orden; los opcionales se deciden al azar."""
    p = Partida(rng, args, conj["comp"])
    peleados = ganados = abiertos = 0
    orden = list(conj["grupos"])
    rng.shuffle(orden)                                   # el orden de encuentro es aleatorio en cada ejecución
    for g in orden:
        if not p.vivos():
            break
        if not g["obl"] and rng.random() >= args.p_opcional:
            continue
        peleados += 1
        if not p.combate([Enemigo(ENEMIGO_POR_ID[rng.choice(POR_NIVEL[nv])], p.n_jug) for nv in g["niv"]]):
            break
        ganados += 1
        if g["cofre"]:                                     # el cofre solo se abre si cae su custodia
            p.abrir_cofre(); abiertos += 1
        p.curar_fuera_combate()
    monedas = [j.monedas for j in p.vivos()]
    gastos = Counter()
    for j in p.vivos():
        comprar_heroe(j, gastos)
    return {"p": p, "grupos": [len(g["niv"]) for g in conj["grupos"]], "n_cofres": conj["n_cofres"],
            "niveles": [nv for g in conj["grupos"] for nv in g["niv"]],
            "peleados": peleados, "ganados": ganados, "abiertos": abiertos, "monedas": monedas, "gastos": gastos}

# ---------------------------------------------------------------- barrido y reporte
import html, itertools, os, sys, time
from multiprocessing import Pool
from types import SimpleNamespace

CORTO = {"guerrero-orco": "guerrero", "sacerdote-enano": "sacerdote"}
ROL_CORTO = {"tanque": "tank", "sanador": "healer", "dps": "dps", "ladron": "ladrón", "soporte": "soporte"}
nombre_clase = lambda c: CORTO.get(c, c)

def _opciones_por_clase():
    """clase -> [(índice de poder, rol)]"""
    ops = {}
    for c in CLASES:
        ops[c] = [(i, Jugador(c, 0, 10, i, 0).rol) for i in range(len(CLASES[c]["seleccion"][1]["opciones"]))]
    return ops

OPCIONES = _opciones_por_clase()
ROL_DE = {(c, i): r for c, lst in OPCIONES.items() for i, r in lst}

def composiciones():
    """Todas las composiciones de 3 a 5 héroes (clases distintas), con como mucho 1 tanque y 1 sanador."""
    res = []
    for tam in (3, 4, 5):
        for sub in itertools.combinations(sorted(CLASES), tam):
            for combo in itertools.product(*[OPCIONES[c] for c in sub]):
                roles = [r for _, r in combo]
                if roles.count("tanque") <= 1 and roles.count("sanador") <= 1:
                    res.append(tuple((c, i) for c, (i, _) in zip(sub, combo)))
    return res

def etiqueta_comp(comp):
    return ", ".join(f"{nombre_clase(c)}-{ROL_CORTO[ROL_DE[(c, i)]]}" for c, i, *_ in comp)

def simular_config(tarea):
    """Juega `n` veces el MISMO set y devuelve contadores planos (se suman bien entre procesos)."""
    conj, base, n, semilla = tarea
    ns = SimpleNamespace(**base)
    rng = random.Random(semilla)
    a = Counter()
    for _ in range(n):
        r = jugar(rng, ns, conj)
        p = r["p"]
        v = p.vivos()
        a["n"] += 1; a["heroes"] += p.n_jug; a["vivos"] += len(v); a["todos"] += len(v) == p.n_jug
        a["superado"] += len(v) > 0
        a["grupos"] += len(r["grupos"]); a["bestias"] += sum(r["grupos"]); a["cofres"] += r["n_cofres"]
        a["peleados"] += r["peleados"]; a["ganados"] += r["ganados"]; a["abiertos"] += r["abiertos"]
        a["rondas"] += p.rondas_total
        a["nivel_sum"] += sum(r["niveles"]); a["nivel_n"] += len(r["niveles"])
        for j in p.jug:
            for k in (f"cl:{j.clase}", f"rol:{j.rol}"):
                a[k + ":n"] += 1; a[k + ":vivo"] += j.vivo; a[k + ":dh"] += j.dano_hecho
                a[k + ":dr"] += j.dano_recibido; a[k + ":cu"] += j.curado
        mon = r["monedas"]
        a["mon_n"] += len(mon); a["mon_sum"] += sum(mon); a["mon_cero"] += sum(m == 0 for m in mon)
        a["mon_nivel"] += sum(m >= PRECIO_NIVEL for m in mon)
        for k, x in r["gastos"].items(): a["compra:" + k] += x
        for k, x in p.log.items(): a["log:" + k] += x
    return dict(a)

def supervivencia(a):
    return a["vivos"] / a["heroes"]

def barrido(args, base):
    comps = composiciones()
    rng = random.Random(args.semilla)
    conjuntos = [sortear_conjunto(rng, args, comps) for _ in range(args.conjuntos)]
    desempate = [rng.random() for _ in conjuntos]
    print(f"{len(comps)} composiciones posibles; {len(conjuntos)} sets fijos x {args.ejecuciones} ejecuciones cada uno...", flush=True)
    t0 = time.time()
    with Pool(args.procesos) as pool:
        res = pool.map(simular_config, [(c, base, args.ejecuciones, args.semilla * 1_000_003 + k) for k, c in enumerate(conjuntos)], chunksize=16)
        print(f"  fase 1 lista en {time.time() - t0:.0f} s", flush=True)
        sv = [supervivencia(a) for a in res]
        idx = range(len(conjuntos))
        cand = {"cerca": sorted(idx, key=lambda k: (abs(sv[k] - 0.5), desempate[k]))[:args.candidatos],
                "alta": sorted(idx, key=lambda k: (-sv[k], desempate[k]))[:args.candidatos],
                "baja": sorted(idx, key=lambda k: (sv[k], desempate[k]))[:args.candidatos]}
        union = sorted(set().union(*cand.values()))
        print(f"fase 2: verificación de {len(union)} sets candidatos con {args.verificacion} ejecuciones c/u...", flush=True)
        ver = dict(zip(union, pool.map(simular_config, [(conjuntos[k], base, args.verificacion, args.semilla * 7_000_003 + k) for k in union])))
    orden = {"cerca": lambda k: (abs(sv[k] - 0.5), abs(supervivencia(ver[k]) - 0.5)),
             "alta": lambda k: (-sv[k], -supervivencia(ver[k])),
             "baja": lambda k: (sv[k], supervivencia(ver[k]))}
    top = {n: [(conjuntos[k], res[k], ver[k]) for k in sorted(ks, key=orden[n])[:args.top]] for n, ks in cand.items()}
    return conjuntos, res, top

# ---------------------------------------------------------------- HTML
CSS = """
:root{--bg:#fbf8f2;--fg:#2a1f14;--mut:#7a6a58;--card:#fff;--line:#e3d9c8;--acc:#8e3b2a;--ok:#2f6b3d}
@media(prefers-color-scheme:dark){:root{--bg:#1a1410;--fg:#efe5d3;--mut:#a89a85;--card:#241c15;--line:#3b2f24;--acc:#e0856e;--ok:#7fc58e}}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--fg);font:15px/1.5 system-ui,sans-serif;padding:24px 16px 64px}
main{max-width:1100px;margin:auto}h1{margin:0 0 4px;font-size:26px}h2{margin:40px 0 8px;font-size:19px;border-bottom:1px solid var(--line);padding-bottom:4px}
h3{margin:22px 0 6px;font-size:16px}p.sub,p.nota{color:var(--mut);margin:4px 0 12px;font-size:13px}
.tabla{overflow-x:auto;background:var(--card);border:1px solid var(--line);border-radius:10px}
table{border-collapse:collapse;width:100%;font-size:14px}th,td{padding:8px 10px;text-align:left;border-bottom:1px solid var(--line);vertical-align:top}
th{font-size:12px;text-transform:uppercase;letter-spacing:.03em;color:var(--mut);background:rgba(0,0,0,.03)}
td.n,th.n{text-align:right;font-variant-numeric:tabular-nums}tr:last-child td{border-bottom:0}
.sv{font-weight:700;color:var(--acc)}.roles span{display:inline-block;background:rgba(142,59,42,.12);border-radius:6px;padding:1px 7px;margin:1px 3px 1px 0;white-space:nowrap;font-size:13px}
.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(310px,1fr));gap:14px}
.barra{height:8px;background:var(--line);border-radius:4px;overflow:hidden;min-width:70px}.barra i{display:block;height:100%;background:var(--ok)}
"""

def pct(x): return f"{100 * x:.1f}%"

def tabla(cabeceras, filas, num=()):
    h = "".join(f'<th class="{"n" if i in num else ""}">{html.escape(c)}</th>' for i, c in enumerate(cabeceras))
    f = "".join("<tr>" + "".join(f'<td class="{"n" if i in num else ""}">{c}</td>' for i, c in enumerate(fila)) + "</tr>" for fila in filas)
    return f'<div class="tabla"><table><thead><tr>{h}</tr></thead><tbody>{f}</tbody></table></div>'

def roles_html(comp):
    return '<div class="roles">' + "".join(f"<span>{html.escape(nombre_clase(c))}-{ROL_CORTO[ROL_DE[(c, i)]]}</span>" for c, i, *_ in comp) + "</div>"

def bloque_detalle(a):
    a = Counter(a)
    n = a["n"]
    por = lambda pref, ks: [[html.escape(k), pct(a[f"{pref}:{k}:vivo"] / a[f"{pref}:{k}:n"]),
                             f'{a[f"{pref}:{k}:dh"] / a[f"{pref}:{k}:n"]:.1f}', f'{a[f"{pref}:{k}:dr"] / a[f"{pref}:{k}:n"]:.1f}',
                             f'{a[f"{pref}:{k}:cu"] / a[f"{pref}:{k}:n"]:.1f}', a[f"{pref}:{k}:n"]]
                            for k in ks if a[f"{pref}:{k}:n"]]
    cab = ["", "Sobrevive", "Daño hecho", "Daño recibido", "Curado", "Apariciones"]
    cl = por("cl", sorted(CLASES)); ro = por("rol", ["dps", "ladron", "sanador", "soporte", "tanque"])
    compras = sorted(((k[7:], v) for k, v in a.items() if k.startswith("compra:")), key=lambda x: -x[1])
    mon = a["mon_n"]
    ev = [(k, a["log:" + k] / n) for k in ("mitigado_runa", "mitigado_bastion", "mitigado_egida", "bestias", "cofres", "comidas_combate", "comidas_fuera", "objetos_robados", "ojo_ladron", "arma_inutil", "armadura_inutil", "terquedad", "muertes")]
    dones = ", ".join(f"{k[8:]} {v / n:.2f}" for k, v in sorted(a.items()) if k.startswith("log:don:"))
    return (f'<div class="grid"><div><h3>Por clase</h3>{tabla(cab, cl, num=range(1, 6))}</div>'
            f'<div><h3>Por rol</h3>{tabla(cab, ro, num=range(1, 6))}</div></div>'
            f'<p class="nota">Encuentros: {a["peleados"] / n:.2f} peleados · {a["ganados"] / n:.2f} ganados · {a["abiertos"] / n:.2f} cofres abiertos de {a["cofres"] / n:.2f} · rondas por partida {a["rondas"] / n:.1f}</p>'
            + (f'<p class="nota">Monedas por superviviente al llegar al tabernero: media {a["mon_sum"] / mon:.1f} · sin monedas {pct(a["mon_cero"] / mon)} · pueden pagar subir a nivel 2 ({PRECIO_NIVEL} monedas) {pct(a["mon_nivel"] / mon)}</p>' if mon else '')
            + '<p class="nota">Compras por partida (arma &gt; armadura &gt; dado &gt; comida &gt; bebida): '
            + (", ".join(f"{html.escape(k)} {v / n:.2f}" for k, v in compras[:8]) or "ninguna") + "</p>"
            + '<p class="nota">Eventos medios por partida: ' + ", ".join(f"{k.replace('_', ' ')} {v:.2f}" for k, v in ev)
            + f'.<br>Dones usados por partida: {html.escape(dones)}</p>')

def media_por(tareas, gruesos, clave):
    d = defaultdict(lambda: [0, 0])
    for t, a in zip(tareas, gruesos):
        k = clave(t)
        d[k][0] += a["vivos"]; d[k][1] += a["heroes"]
    return {k: v[0] / v[1] for k, v in d.items()}

# ---------------------------------------------------------------- ajuste de dificultad (buscar el 50 % en vez de esperar encontrarlo)
# Escalera de dificultad con niveles MEZCLADOS: cada casilla (grupo g, bestia k) es de nivel 2 si (g + k) es impar y de nivel 1 si es par,
# así cada grupo mezcla ambos niveles desde el principio. Pasos 1-20: se añade una bestia (en rueda por los grupos, hasta 5 por grupo);
# después, las bestias de nivel 1 pasan a nivel 2 de una en una hasta que todas son de nivel 2.
GRUPOS_ESC, OBL_ESC, MAX_ESC = 4, 2, 3          # grupos, obligatorios y máximo de bestias por grupo
_NIVEL = lambda g, k: 2 if (g + k) % 2 else 1
_SUBIDAS = sorted(((g, k) for g in range(GRUPOS_ESC) for k in range(MAX_ESC) if _NIVEL(g, k) == 1), key=lambda gk: (gk[1], gk[0]))
PASOS = GRUPOS_ESC * (MAX_ESC - 1) + len(_SUBIDAS)

def escala(paso, n_cofres, grupos=GRUPOS_ESC, obligatorios=OBL_ESC):
    """Escenario de la escalera en el paso `paso` (0 = una bestia por grupo ... PASOS = MAX_ESC bestias de nivel 2 por grupo)."""
    tam = [1] * grupos
    for t in range(min(paso, grupos * (MAX_ESC - 1))):
        tam[t % grupos] += 1
    subidas = set(_SUBIDAS[:max(0, paso - grupos * (MAX_ESC - 1))])
    niv = [tuple(sorted(2 if (g, k) in subidas else _NIVEL(g, k) for k in range(tam[g]))) for g in range(grupos)]
    orden_cofres = list(range(obligatorios, grupos)) + list(range(obligatorios))     # primero los opcionales
    con_cofre = set(orden_cofres[:n_cofres])
    return [{"obl": g < obligatorios, "cofre": g in con_cofre, "niv": niv[g]} for g in range(grupos)]

def composiciones_con_dones():
    res = []
    for comp in composiciones():
        for dones in itertools.product(*[range(len(CLASES[c]["seleccion"][2]["opciones"])) for c, _ in comp]):
            res.append(tuple((c, i, 0, d) for (c, i), d in zip(comp, dones)))
    return res

def comp_valida(comp):
    r = [ROL_DE[(c, i)] for c, i, *_ in comp]
    return r.count("tanque") <= 1 and r.count("sanador") <= 1 and len({c for c, *_ in comp}) == len(comp)

def ajustar_comp(t):
    """Busca (bisección) el paso de la escalera en el que esta composición sobrevive ~50 %."""
    comp, base, cofres, runs, runs_ver, semilla = t
    def ev(paso, n, sem):
        conj = {"comp": comp, "grupos": escala(paso, cofres), "n_cofres": cofres}
        return supervivencia(simular_config((conj, base, n, sem)))
    lo, hi = -1, PASOS + 1                     # lo: último paso con >=50 %; hi: primer paso con <50 %
    while hi - lo > 1:
        mid = (lo + hi) // 2
        if ev(mid, runs, semilla + mid) >= 0.5:
            lo = mid
        else:
            hi = mid
    cand = [x for x in (lo, hi) if 0 <= x <= PASOS]
    ver = {x: ev(x, runs_ver, semilla + 1000 + x) for x in cand}
    paso = min(cand, key=lambda x: abs(ver[x] - 0.5))
    tipo = "no llega al 50 % ni en el paso 0" if lo < 0 else "supera el 50 % hasta el último paso" if hi > PASOS else "ok"
    return {"paso": paso, "surv": ver[paso], "tipo": tipo}

def vecino_comp(rng, comp):
    """Cambia UN héroe (otra clase, poder y don) dejando el resto igual."""
    while True:
        k = rng.randrange(len(comp))
        c2 = rng.choice(list(CLASES)); i2 = rng.randrange(len(CLASES[c2]["seleccion"][1]["opciones"]))
        d2 = rng.randrange(len(CLASES[c2]["seleccion"][2]["opciones"]))
        nueva = list(comp); nueva[k] = (c2, i2, 0, d2)
        if (c2, i2) != (comp[k][0], comp[k][1]) and comp_valida(nueva):
            return tuple(nueva)

def correr_ajuste(args, base):
    rng = random.Random(args.semilla + 77)
    comps = composiciones_con_dones()
    if args.rapido:
        comps = rng.sample(comps, 150)
    tareas = [(c, base, args.cofres_ajuste, args.ajuste_runs, args.ajuste_runs_ver, args.semilla * 31 + k) for k, c in enumerate(comps)]
    originales = rng.sample(comps, min(args.vecinos, len(comps)))
    vec = [vecino_comp(rng, c) for c in originales]
    t_vec = [(c, base, args.cofres_ajuste, args.ajuste_runs, args.ajuste_runs_ver, args.semilla * 53 + k) for k, c in enumerate(vec)]
    print(f"ajuste de dificultad: {len(tareas)} composiciones + {len(t_vec)} vecinos...", flush=True)
    t0 = time.time()
    with Pool(args.procesos) as pool:
        res = pool.map(ajustar_comp, tareas, chunksize=4)
        rv = pool.map(ajustar_comp, t_vec, chunksize=4)
    print(f"  ajuste listo en {time.time() - t0:.0f} s", flush=True)
    # el original se vuelve a ajustar junto al vecino (misma semilla de búsqueda) para comparar con el mismo ruido
    with Pool(args.procesos) as pool:
        ro = pool.map(ajustar_comp, [(c, base, args.cofres_ajuste, args.ajuste_runs, args.ajuste_runs_ver, args.semilla * 53 + k) for k, c in enumerate(originales)], chunksize=4)
    return {"comps": comps, "res": res, "vec": vec, "rv": rv, "orig": ro, "cofres": args.cofres_ajuste}

def stats_escala(paso, cofres):
    g = escala(paso, cofres)
    n = [len(x["niv"]) for x in g]; lv = [v for x in g for v in x["niv"]]
    return sum(n), sum(n) / len(n), sum(lv) / len(lv)

def ajuste_html(args, aj):
    comps, res, cofres = aj["comps"], aj["res"], aj["cofres"]
    P = [r["paso"] for r in res]
    pasos_txt = lambda p: f'<b>{p}</b>' + ("" if 0 <= p <= PASOS else "")
    def fila(c, r):
        tot, prom, nv = stats_escala(r["paso"], cofres)
        nota = "" if r["tipo"] == "ok" else f' <span class="nota">({r["tipo"]})</span>'
        return [roles_html(c), str(len(c)), f'<span class="sv">{r["paso"]}</span>{nota}', str(tot), f"{prom:.2f}", f"{nv:.2f}", pct(r["surv"])]
    cab = ["Roles de los personajes", "Nº", "Paso de dificultad del 50 %", "Bestias en total", "Prom. bestias por grupo", "Prom. nivel de las bestias", "Supervivencia en ese paso"]
    orden = sorted(range(len(comps)), key=lambda k: (-P[k], -res[k]["surv"]))
    fuertes = [fila(comps[k], res[k]) for k in orden[:5]]
    debiles = [fila(comps[k], res[k]) for k in orden[::-1][:5]]
    mediana = st_median(P)
    def media_por(clave):
        d = defaultdict(list)
        for c, r in zip(comps, res):
            for k in clave(c): d[k].append(r["paso"])
        return d
    por_cl = media_por(lambda c: [nombre_clase(x[0]) for x in c])
    por_rol = media_por(lambda c: {ROL_CORTO[ROL_DE[(x[0], x[1])]] for x in c})
    por_n = media_por(lambda c: [len(c)])
    por_poder = media_por(lambda c: [f"{nombre_clase(x[0])}-{ROL_CORTO[ROL_DE[(x[0], x[1])]]}" for x in c])
    bar = lambda x: f'<div class="barra"><i style="width:{100 * max(0, x) / PASOS:.0f}%"></i></div>'
    sec = lambda t, d: tabla([t, "Paso medio del 50 %", "Composiciones", ""], [[html.escape(str(k)), f"{st_mean(v):.1f}", str(len(v)), bar(st_mean(v))] for k, v in sorted(d.items(), key=lambda kv: -st_mean(kv[1]))], num=(1, 2))
    escalera = tabla(["Paso", "Bestias en total", "Prom. bestias por grupo", "Prom. nivel"], [[str(p), str(stats_escala(p, cofres)[0]), f"{stats_escala(p, cofres)[1]:.1f}", f"{stats_escala(p, cofres)[2]:.2f}"] for p in sorted(set(range(0, PASOS + 1, 4)) | {PASOS})], num=(0, 1, 2, 3))
    # robustez: cambiar un héroe
    cambios = [abs(rv["paso"] - o["paso"]) for o, rv in zip(aj["orig"], aj["rv"])]
    q = lambda L, f: sorted(L)[int(f * (len(L) - 1))]
    robustez = (f'<p class="nota">Se cambió <b>un solo héroe</b> (otra clase, poder y don) en {len(cambios)} composiciones y se volvió a buscar su paso del 50 %: '
                f'la diferencia mediana fue de <b>{q(cambios, .5):.0f}</b> pasos, el percentil 90 de <b>{q(cambios, .9):.0f}</b> y el máximo de <b>{max(cambios)}</b> '
                f'(la escalera tiene {PASOS} pasos). Un paso equivale a una bestia más (o una bestia que pasa de nivel 1 a 2) en un grupo.</p>')
    sin_50 = sum(r["tipo"] != "ok" for r in res)
    return f"""
<h2>El escenario que lleva a cada composición al 50 %</h2>
<p class="nota"><b>Por qué.</b> Con tantos sets posibles, sortearlos al azar no garantiza encontrar el que da 50 % para cada composición. Aquí se hace al revés:
para cada una de las {len(comps)} composiciones de héroes (clase, poder y don) se busca, por bisección sobre una escalera de {PASOS + 1} escenarios cada vez más difíciles, el <b>paso en el que sobrevive ≈ 50 %</b>
(cada paso se juega {args.ajuste_runs} veces y el final {args.ajuste_runs_ver}). Cuanto <b>mayor</b> es el paso, más fuerte es la composición. Escenario fijo: {GRUPOS_ESC} grupos ({OBL_ESC} obligatorios), {cofres} cofres (tipos: {nombres_cofres(args.tipos_cofre)}), los de los grupos opcionales primero. {sin_50} composiciones no se pudieron ajustar al 50 % dentro de la escalera.</p>
<h3>La escalera de dificultad</h3>{escalera}
<h3>Las 5 composiciones más fuertes (aguantan el escenario más duro al 50 %)</h3>{tabla(cab, fuertes, num=(1, 2, 3, 4, 5, 6))}
<h3>Las 5 más débiles</h3>{tabla(cab, debiles, num=(1, 2, 3, 4, 5, 6))}
<p class="nota">Mediana de todas las composiciones: paso {mediana:.0f} de {PASOS}.</p>
<div class="grid"><div><h3>Por nº de personajes</h3>{sec("Héroes", por_n)}</div>
<div><h3>Por clase presente</h3>{sec("Clase", por_cl)}</div>
<div><h3>Por rol presente</h3>{sec("Rol", por_rol)}</div>
<div><h3>Por héroe concreto (clase y rol)</h3>{sec("Héroe", por_poder)}</div></div>
<h3>¿Cuánto cambia el 50 % si cambias un héroe?</h3>{robustez}
"""

def st_mean(L): return sum(L) / len(L)
def st_median(L): return sorted(L)[len(L) // 2]

def nombres_cofres(n):
    return ", ".join(["Gris pequeño", "Gris mediano", "Gris grande", "Gris extra grande", "Café grande"][:n])

def filas_top(lista):
    filas = []
    for k, (conj, a, v) in enumerate(lista, 1):
        n = a["n"]
        filas.append([str(k), str(len(conj["grupos"])), f'{a["peleados"] / n:.2f}', f'{a["bestias"] / a["grupos"]:.2f}', f'{a["nivel_sum"] / a["nivel_n"]:.2f}',
                      str(conj["n_cofres"]), str(len(conj["comp"])), roles_html(conj["comp"]),
                      f'<span class="sv">{pct(supervivencia(a))}</span>', pct(supervivencia(v)), pct(a["todos"] / n), pct(a["superado"] / n)])
    return filas

def cab_top(ej, ver):
    return ["#", "Grupos de bestias en el escenario", "Prom. encuentros que pelean", "Prom. bestias por grupo", "Prom. nivel de las bestias", "Cofres en el escenario",
            "Nº de personajes", "Roles de los personajes", f"Tasa de supervivencia ({ej} ejecuciones)", f"Repetida con {ver} ejecuciones",
            f"Grupo completo vivo ({ej})", f"Escenario superado ({ej})"]
NUM_TOP = (0, 1, 2, 3, 4, 5, 6, 8, 9, 10, 11)

def escenario_html(conj):
    filas = []
    for k, g in enumerate(conj["grupos"], 1):
        cnt = Counter(g["niv"])
        filas.append([str(k), "obligatorio" if g["obl"] else "opcional", str(len(g["niv"])),
                      ", ".join(f"{n}× nivel {nv}" for nv, n in sorted(cnt.items())), "sí" if g["cofre"] else "—"])
    return tabla(["Grupo", "Tipo", "Bestias", "Composición por nivel", "Cofre"], filas, num=(0, 2))

def media_por_set(conjuntos, res, clave):
    d = defaultdict(lambda: [0, 0])
    for c, a in zip(conjuntos, res):
        k = clave(c)
        d[k][0] += a["vivos"]; d[k][1] += a["heroes"]
    return {k: v[0] / v[1] for k, v in d.items()}

def generar_html(args, conjuntos, res, tops, seg, aj=None):
    ej, ver = args.ejecuciones, args.verificacion
    cab = cab_top(ej, ver)
    detalles = []
    for k, (conj, a, v) in enumerate(tops["cerca"], 1):
        detalles.append(f'<h3>#{k} · {len(conj["comp"])} héroes · {html.escape(etiqueta_comp(conj["comp"]))}</h3>'
                        f'<p class="sub">Set fijo: {len(conj["grupos"])} grupos de bestias, {conj["n_cofres"]} cofres. Estadísticas de las {v["n"]} ejecuciones de verificación.</p>'
                        + escenario_html(conj) + bloque_detalle(v))
    nbes = lambda c: sum(len(g["niv"]) for g in c["grupos"]) / len(c["grupos"])
    nniv = lambda c: sum(nv for g in c["grupos"] for nv in g["niv"]) / sum(len(g["niv"]) for g in c["grupos"])
    por_n = media_por_set(conjuntos, res, lambda c: len(c["comp"]))
    por_b = media_por_set(conjuntos, res, lambda c: round(nbes(c) * 2) / 2)
    por_cf = media_por_set(conjuntos, res, lambda c: c["n_cofres"])
    por_lv = media_por_set(conjuntos, res, lambda c: round(nniv(c) * 5) / 5)
    por_comp = defaultdict(lambda: [0, 0])
    for c, a in zip(conjuntos, res):
        k = tuple((x[0], x[1]) for x in c["comp"])
        por_comp[k][0] += a["vivos"]; por_comp[k][1] += a["heroes"]
    ranking = sorted(((v[0] / v[1], c) for c, v in por_comp.items()), reverse=True)
    bar = lambda x: f'<div class="barra"><i style="width:{100 * x:.0f}%"></i></div>'
    sec = lambda titulo, d: tabla([titulo, "Supervivencia", ""], [[html.escape(str(k)), pct(v), bar(v)] for k, v in sorted(d.items())], num=(1,))
    top_c = lambda lista: tabla(["Composición", "Nº", "Supervivencia media"], [[roles_html(c), str(len(c)), pct(x)] for x, c in lista], num=(1, 2))
    tabla_top = lambda nombre: tabla(cab, filas_top(tops[nombre]), num=NUM_TOP)
    return f"""<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Balance de La Taberna</title><style>{CSS}</style></head><body><main>
<h1>Balance de La Taberna</h1>
<p class="sub">Simulación por código · bestias de nivel {args.nivel_min}-{args.nivel_max} · héroes de nivel 1 con {args.pv} de vida · generado en {seg:.0f} s</p>

<h2>Las {len(tops['cerca'])} configuraciones con supervivencia más cercana al 50 %</h2>
<p class="nota"><b>Cómo se calcula.</b> Se sortearon {len(conjuntos)} sets fijos. Cada set es una composición de héroes (clase, poder y don), {args.grupos} grupos de bestias de los que se fija cuántas bestias de nivel 1 y de nivel 2 tiene cada uno, y los cofres ya repartidos. Cada set se jugó <b>{ej} veces</b> y su
<b>tasa de supervivencia</b> es el % de personajes que terminan vivos sumando esas {ej} ejecuciones; entre ejecuciones cambian los dados (iniciativa, ataques, botín, cofres), qué bestia exacta de cada nivel sale, el orden de los grupos y si el grupo va o no por los opcionales.
Como elegir «los más cercanos al 50 %» entre tantos sets favorece a los que tuvieron suerte, los sets elegidos se repitieron con {ver} ejecuciones más (columna «Repetida con {ver}»): si ambas cifras se parecen, el dato es fiable.</p>
{tabla_top("cerca")}
<h2>Las {len(tops['alta'])} configuraciones con MAYOR supervivencia</h2>
<p class="nota">Para comprobar el sentido común: deberían ser las composiciones más sólidas en los escenarios más suaves (pocas bestias por grupo, bestias de nivel 1).</p>
{tabla_top("alta")}
<h2>Las {len(tops['baja'])} configuraciones con MENOR supervivencia</h2>
<p class="nota">Y lo contrario: pocos héroes y escenarios con muchas bestias por grupo o de nivel 2.</p>
{tabla_top("baja")}

{ajuste_html(args, aj) if aj else ''}
<h2>Detalle de las configuraciones cercanas al 50 %</h2>
{''.join(detalles)}

<h2>Panorama general</h2>
<p class="nota">Supervivencia media de los personajes en los {len(conjuntos)} sets ({ej} ejecuciones cada uno).</p>
<div class="grid"><div><h3>Por nº de personajes</h3>{sec("Héroes", por_n)}</div>
<div><h3>Por bestias por grupo (redondeado a 0.5)</h3>{sec("Bestias por grupo", por_b)}</div>
<div><h3>Por cofres</h3>{sec("Cofres", por_cf)}</div>
<div><h3>Por nivel medio de las bestias</h3>{sec("Nivel medio", por_lv)}</div></div>
<h3>Mejores composiciones (media de todos sus sets)</h3>{top_c(ranking[:8])}
<h3>Peores composiciones</h3>{top_c(ranking[-8:][::-1])}

<h2>Supuestos del simulador</h2>
<p class="nota">Héroes: 10 de vida (11 los dracónidos), nivel 1, sin monedas ni objetos; subir a nivel 2 cuesta 5 monedas y solo se hace en la taberna. Escenario: {args.grupos} grupos de bestias ({args.obligatorios} obligatorios; los demás los pelea el grupo con un {int(100 * args.p_opcional)} % de probabilidad), de {args.bestias} bestias cada uno; el nivel de cada bestia se sortea 50/50 entre {args.nivel_min} y {args.nivel_max} y luego una bestia de ese nivel al azar; {args.cofres_min if args.cofres_min == args.cofres_max else str(args.cofres_min) + ' a ' + str(args.cofres_max)} cofres de los tipos {nombres_cofres(args.tipos_cofre)} (al azar en cada ejecución), cada uno custodiado por un grupo distinto y solo se abre si ese grupo cae.
Combate: iniciativa d20 para todos; cada bestia ataca una vez por ronda (sin el segundo ataque de la regla de 5 jugadores). Con 3 héroes las bestias tienen la vida de la tabla de 4. Antes de tirar el d20 cada héroe decide habilidad básica o especial (al azar; el sanador cura si algún aliado tiene menos de 5 de vida; el tanque con más de 3 de vida siempre tanquea); después tira y usa la mejor opción de esa tabla. El don gasta el turno aunque falle.
Botín y cofres: cada objeto va a un héroe vivo al azar, salvo lo que roba el Pícaro (Manos Ligeras). Sin curación mágica fuera de combate; solo comida y bebida. Sushi mágico cura 1d6. Compra final por héroe con sus monedas: arma útil &gt; armadura &gt; dado &gt; comida &gt; bebida.</p>
</main></body></html>"""

def main():
    ap = argparse.ArgumentParser(description="Genera simulacion/reporte.html con el balance de La Taberna")
    ap.add_argument("--conjuntos", "--partidas", type=int, default=20000, dest="conjuntos", help="sets fijos distintos que se sortean (alias: --partidas); cada set se juega --ejecuciones veces")
    ap.add_argument("--ejecuciones", type=int, default=30, help="veces que se juega cada set (solo cambian los dados)")
    ap.add_argument("--verificacion", type=int, default=300, help="ejecuciones extra para los sets que salen en las tablas")
    ap.add_argument("--candidatos", type=int, default=60, help="sets por tabla que pasan a verificación")
    ap.add_argument("--top", type=int, default=5)
    ap.add_argument("--grupos", type=int, default=4, help="grupos de bestias del escenario (fijo)")
    ap.add_argument("--obligatorios", type=int, default=2)
    ap.add_argument("--bestias", default="1-3", help="bestias por grupo, al azar en este rango")
    ap.add_argument("--cofres-min", type=int, default=2)
    ap.add_argument("--tipos-cofre", type=int, default=2, help="tipos de cofre posibles: los N primeros (1 Gris pequeño, 2 Gris mediano, ...)")
    ap.add_argument("--cofres-max", type=int, default=2)
    ap.add_argument("--p-opcional", type=float, default=0.5, help="prob. de que el grupo vaya por un grupo opcional")
    ap.add_argument("--nivel-min", type=int, default=1)
    ap.add_argument("--nivel-max", type=int, default=2)
    ap.add_argument("--pv", type=int, default=10)
    ap.add_argument("--p-especial", type=float, default=0.5)
    ap.add_argument("--segundo-ataque", action="store_true", help="aplica a cada bestia el 2.º ataque cada 3 rondas con 5 héroes")
    ap.add_argument("--sin-ajuste", action="store_true", help="omite la búsqueda del escenario del 50 %% por composición (tarda varios minutos)")
    ap.add_argument("--cofres-ajuste", type=int, default=2, help="cofres del escenario de la escalera de dificultad")
    ap.add_argument("--ajuste-runs", type=int, default=100, help="ejecuciones por paso durante la búsqueda")
    ap.add_argument("--ajuste-runs-ver", type=int, default=300, help="ejecuciones para confirmar el paso elegido")
    ap.add_argument("--vecinos", type=int, default=300, help="composiciones a las que se les cambia un héroe para medir robustez")
    ap.add_argument("--semilla", type=int, default=1)
    ap.add_argument("--procesos", type=int, default=os.cpu_count())
    ap.add_argument("--rapido", action="store_true", help="prueba rápida con pocos sets")
    ap.add_argument("--salida", default=str(Path(__file__).resolve().parent / "reporte.html"))
    args = ap.parse_args()
    if args.rapido:
        args.conjuntos, args.verificacion, args.candidatos = 400, 40, 8
    base = dict(p_opcional=args.p_opcional, pv=args.pv, p_especial=args.p_especial, segundo_ataque=args.segundo_ataque, tipos_cofre=args.tipos_cofre)
    t0 = time.time()
    conjuntos, res, tops = barrido(args, base)
    aj = None if args.sin_ajuste else correr_ajuste(args, base)
    Path(args.salida).write_text(generar_html(args, conjuntos, res, tops, time.time() - t0, aj), encoding="utf-8")
    print(f"\nReporte: {args.salida}")
    for nombre, lista in tops.items():
        print(nombre)
        for k, (c, a, v) in enumerate(lista, 1):
            print(f"  #{k} {pct(supervivencia(a))} (repetida: {pct(supervivencia(v))})  grupos {len(c['grupos'])}  encuentros {a['peleados'] / a['n']:.2f}  bestias/grupo {a['bestias'] / a['grupos']:.2f}  "
                  f"nivel {a['nivel_sum'] / a['nivel_n']:.2f}  cofres {c['n_cofres']}  {etiqueta_comp(c['comp'])}")

if __name__ == "__main__":
    main()
