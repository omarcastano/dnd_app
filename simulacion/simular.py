#!/usr/bin/env python3
"""Simulador de balance de La Taberna (sin interfaz: reglas, dados y condicionales).

Uso:  python3 simulacion/simular.py [--ejecuciones 2000] [--rapido]      (genera simulacion/reporte.html)

Juega la CAMPAÑA completa: 4 mapas seguidos (ESCENARIOS). Cada mapa tiene 4 grupos de 1-2 bestias; el nivel de las bestias es fijo por mapa
(mapa 1: niveles 1-2, mapa 2: 2-3, mapa 3: 3-4, mapa 4: 4-5). El mapa NO es una variable del set: el set es solo el EQUIPO (4 o 5 héroes de
clases distintas, una carta de poder por héroe, como mucho 1 tanque y 1 sanador); los grupos exactos de cada mapa se sortean en cada ejecución.
Cada mapa tiene además 4 COFRES FIJOS: 2 del nivel mínimo y 2 del nivel máximo de sus bestias (mapa 1: 2 de nivel 1 y 2 de nivel 2; mapa 2: 2 de nivel 2 y 2 de nivel 3; …).
CHECKPOINTS: se juega el mapa 1 `--ejecuciones` veces; los equipos que lo superan (tras comprar al tabernero) son el checkpoint, que se toma como
verdad absoluta: el mapa 2 arranca desde esos estados (sorteados), y así con el 3 y el 4. No se combinan mapas: el coste es el del mapa 1 por 4.
Lee personajes, enemigos y niveles de public/ (JSON). La tienda está copiada de public/tienda/js/datos/tienda.js: si cambia allí, actualizar aquí.

REGLAS DE DECISIÓN (acordadas con el autor del juego)
  · Los héroes empiezan en nivel 1, con 10 de vida (el poder puede fijar otra en su carta: `vida`, y `vida_nivel_2` al subir a nivel 2; +1 los dracónidos), 0 monedas y 0 objetos. Subir a nivel 2 cuesta 5 monedas (solo en la taberna; sin 5 monedas no se sube).
  · Iniciativa: al empezar el combate todos (héroes y bestias) tiran 1d20 (+1d4 el héroe que lleve dado de destreza); orden de mayor a menor, empates al azar. Cada bestia ataca una vez por ronda.
  · La Runa de Resguardo del sacerdote-soporte quita 2 puntos de daño a cada golpe que reciba el aliado protegido (los puntos del escudo, si lo porta, se duplican).
  · El paladín tanque se cura 2 puntos de vida al final de cada ronda de combate (la luz que lo rodea; `regeneracion` en su poder).
  · El sanador (conjuro de sanación y manantial) cura primero al tanque si le falta vida; si no, al más herido.
  · Bastión Sagrado del paladín (protección): durante tantos turnos de cada bestia como indique la tabla, todo golpe que una bestia dirija a un aliado lo recibe el paladín y el aliado no sufre nada. El paladín recibe la mitad del daño (hacia abajo) más 1 punto, sin armadura; si el golpe era contra él, lo recibe normal.
  · La provocación del tanque (Grito de guerra del guerrero) obliga a TODAS las bestias vivas a atacarle solo a él durante los turnos de la tabla.
  · Turno de un héroe: PRIMERO decide «básica» o «especial» (aleatorio; el sanador sana si algún aliado tiene <5 PV;
    el tanque con >3 PV siempre tanquea). DESPUÉS tira 1d20 y usa la mejor opción de esa tabla que permita la tirada. Los dones NO se simulan.
  · La vida solo se recupera comiendo/bebiendo (comida y bebida de la mochila) o con las habilidades de sanación en combate. Nada se cura solo.
  · Dados (1d4, se suman al d20 de la tirada): el de ataque en las tiradas de ataque y demás habilidades; el de sanación SOLO en la tirada de la habilidad de sanar de un sanador (no suma a la comida ni a la cantidad que cura); el de destreza solo al abrir cofres.
  · Cofres: al superar el mapa se abren los 4 (d20 por cofre, +1d4 si algún héroe vivo tiene dado de destreza; tope 20) con las tablas de public/tienda/js/secciones/cofres.js; cada objeto va a un héroe vivo al azar. Si el equipo cae, no los abre.
  · Al terminar cada mapa superado (también el último): los caídos vuelven con 1 PV y el equipo visita al tabernero. PRIMERO el grupo le compra al tanque (escudo si su clase lo usa, nivel 2 y dado de destreza), poniendo entre todos las monedas que le falten. Después cada héroe, con SUS monedas:
    primero sube a nivel 2 si tiene 5; luego arma útil > armadura > dado > comida > bebida. Sushi mágico cura 1d6. Lo comprado pasa al siguiente mapa.
  · Botín: cada objeto va a un héroe vivo al azar; lo que roba el Pícaro (Manos Ligeras) y su «ojo de ladrón» son suyos. Monedas, objetos y nivel pasan de un mapa al siguiente.
  · En cada ejecución de un mapa se sortean: los 4 grupos, el orden de encuentro (los 4 grupos son obligatorios: el equipo los pelea todos, salvo que caiga antes; con --obligatorios menor que --grupos el resto se pelea con prob. --p-opcional) y la bestia exacta de cada nivel.
"""
import argparse, copy, json, random, re
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
ARMADURAS = {"Escudo": (2, 5, 6), "Pechera": (4, 7, 5), "Casco": (4, 6, 3)}
PRECIO_DADO = 3
PUEDE_ESCUDO = {"guerrero-orco", "paladin"}
PUEDE_ARMA = {"guerrero-orco": {"Hacha corta", "Espada larga", "Maza", "Alabarda"},
              "paladin": {"Maza", "Espada corta"},
              "picaro": {"Daga", "Puñal", "Espada corta"},
              "sacerdote-enano": {"Maza", "Daga"},
              "druida": set()}       # Bastón y Libro no se venden
PRECIO_NIVEL = 5
def leer_cofres():
    """Lee public/tienda/js/secciones/cofres.js: rangos del d20 y botín de cada cofre (nivel 1-5) como filas de [categoría, cantidad]."""
    t = (RAIZ / "tienda/js/secciones/cofres.js").read_text(encoding="utf-8")
    rangos = json.loads(re.search(r"RANGOS_COFRE = (\[\[.*?\]\]);", t, re.S).group(1))
    cofres = {int(m.group(1)): json.loads(m.group(2)) for m in re.finditer(r'id: "chest-(\d)".*?botines: (\[.*?\])\s*\n\s*\}', t, re.S)}
    return rangos, cofres

try:
    RANGOS_COFRE, COFRES = leer_cofres()
except Exception as e:
    raise SystemExit(f"No se pudo leer public/tienda/js/secciones/cofres.js ({e}). El simulador necesita su formato de rangos y botines.")

PRIORIDAD_TANQUE = True    # al ir al tabernero, el grupo compra primero al tanque: escudo y nivel 2 (aportando monedas entre todos)
TAUNT_A_TODOS = True       # la provocación del tanque (Grito de guerra) obliga a TODAS las bestias vivas, no a una sola
SANADOR_PRIORIZA_TANQUE = True   # el sanador cura primero al tanque si está herido (si no, al más herido)
DESTREZA_INICIATIVA = True   # el dado de destreza (1d4) se suma a la tirada de iniciativa de quien lo lleve
DADO_DESTREZA_AL_TANQUE = True   # en la taberna el grupo le compra al tanque el dado de destreza (después del escudo y el nivel 2)
RUNA_REDUCCION = 3           # puntos de daño que quita la Runa de Resguardo del sacerdote a cada golpe (+ los del escudo del aliado, que se duplican)
ESCENARIOS = [(1, 2), (2, 3), (3, 4), (4, 5)]      # campaña: nivel mínimo y máximo de las bestias de cada mapa (mapas 1 a 4)

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
    def __init__(self, clase_id, pv_base, poder):
        d = CLASES[clase_id]
        self.clase = clase_id
        pj = next(c for c in d["cartas"] if c["tipo"] == "personaje")      # los dos personajes de una clase comparten raza y reglas
        self.nombre, self.raza = pj["nombre"], pj["raza"]
        self.opcion_poder = d["seleccion"][1]["opciones"][poder]
        self.racial = 1 if self.raza.startswith("Drac") else 0
        self.regen = self.opcion_poder.get("regeneracion", 0)          # vida que se cura al final de cada ronda de combate (Bastión del paladín: la luz que lo rodea)
        self.pvmax = self.opcion_poder.get("vida", pv_base) + self.racial      # el poder puede fijar la vida (tanque guerrero 30, tanque paladín 25)
        self.pv = self.pvmax
        self.poder_i = poder
        self.nivel_carta = 1
        self.cargar_carta()
        self.armas, self.armadura = [], None
        self.dado_ataque = self.dado_sanacion = self.dado_destreza = False
        self.vivo = True
        self.monedas = 0                      # cada héroe lleva lo suyo
        self.comida, self.bebida = Counter(), Counter()
        self.m_armas, self.m_armaduras = [], []
        self.borracho_pend = 0
        self.dano_hecho = self.dano_recibido = self.curado = 0
        self.reset_combate()

    def cargar_carta(self):
        """Lee la carta de poder del nivel actual: ataques, tabla de habilidad y rol."""
        d = CLASES[self.clase]
        sel = d["seleccion"][1]["opciones"][self.poder_i]
        carta = next(c for c in d["cartas"] if c["id"] in sel["cartas"] and c.get("nivel") == self.nivel_carta)
        self.poder = sel["etiqueta"]
        self.ataques = [{"r": rango(a["rango_d20"]), "valor": a["valor"]} for a in carta["ataques"]]
        self.habs = [{"r": rango(a["rango_d20"]), "valor": a["valor"]} for a in carta["tabla"]]
        self.tipo_hab = carta["tabla"][0]["subtitulo"]
        t = self.tipo_hab
        self.rol = ("tanque" if re.search("Provoca|protección", t) else
                    "soporte" if "Escudo de varias" in t else        # Sacerdote «Runas de Resguardo»: apoyo, no tanque
                    "sanador" if re.search("sanación|Cura en las", t) else
                    "ladron" if "Robo" in t else "dps")

    def subir_nivel(self):
        self.nivel_carta = 2
        self.cargar_carta()
        if "vida_nivel_2" in self.opcion_poder:                         # el tanque gana vida al subir (guerrero 30 → 40, paladín 25 → 35): máximo y vida actual
            nuevo = self.opcion_poder["vida_nivel_2"] + self.racial
            self.pv += nuevo - self.pvmax
            self.pvmax = nuevo

    def reset_combate(self):
        self.sangrado = self.quemadura = 0
        self.miedo = self.miedo_val = 0
        self.marca_enemiga = 0
        self.runa = 0
        self.manantial = self.manantial_val = 0
        self.primer_ataque = True
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
        self.pvmax = self.pv = nv["vida"][{4: 0, 5: 1, 6: 2}[jugadores]]   # la tabla del bestiario da la vida para 4, 5 y 6 jugadores
        self.basico, self.fuerte = nv["basico"], nv["fuerte"]
        sub = datos["ataques"][1]["subtitulo"].lower()
        desc = datos["habilidades"][0]["descripcion"].lower() if datos.get("habilidades") else ""
        self.efecto = next((e for e in ("sangrado", "veneno", "quemadura", "miedo", "marca") if e in sub or e in desc), None)
        if self.efecto == "veneno":
            self.efecto = "sangrado"                        # mismo comportamiento
        m = re.search(r"[−-](\d+) a sus tiradas", desc)
        self.miedo_val = int(m.group(1)) if m else 1
        self.provocado_por, self.provocado_turnos = None, 0
        self.cubierto_por, self.cubierto_turnos = None, 0       # Bastión Sagrado: el paladín recibe los golpes que esta bestia dirija a sus aliados
        self.marca_runa = False

# ---------------------------------------------------------------- partida
class Partida:
    def __init__(self, rng, args, composicion=None, jugadores=None):
        """composicion: lista de (clase, índice de carta de poder) de un equipo nuevo; jugadores: los héroes de un checkpoint."""
        self.rng, self.args = rng, args
        self.log = Counter()
        self.jug = jugadores if jugadores is not None else [Jugador(c, args.pv, poder) for c, poder in composicion]
        self.n_jug = len(self.jug)
        self.rondas_total = 0
        self.ronda = 0
        self.actuaron = set()

    def d20(self): return self.rng.randint(1, 20)
    def d4(self): return self.rng.randint(1, 4)
    def vivos(self): return [j for j in self.jug if j.vivo]
    def mas_herido(self): return min(self.vivos(), key=lambda x: x.pv / x.pvmax)

    def objetivo_cura(self, candidatos=None):
        """A quién cura un sanador: primero al tanque si le falta vida; si no, al más herido (por proporción de vida)."""
        vivos = candidatos if candidatos is not None else self.vivos()
        if SANADOR_PRIORIZA_TANQUE:
            tanques = [x for x in vivos if x.rol == "tanque" and x.pv < x.pvmax]
            if tanques:
                return min(tanques, key=lambda x: x.pv / x.pvmax)
        return min(vivos, key=lambda x: x.pv / x.pvmax)


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
            self.log["botin_monedas"] += n                      # total obtenido (bestias, robo y ojo de ladrón), aunque luego se gaste o el héroe muera
            return
        for _ in range(n):
            self.log["botin_items"] += 1
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

    # ---- comida (cada héroe come de su propia mochila)
    def valor_comida(self, tipo, nombre):
        if nombre == "Sushi magico":
            return self.rng.randint(1, 6)
        return (COMIDA if tipo == "comida" else BEBIDA)[nombre][2]

    def comer(self, j, tipo, nombre):
        getattr(j, tipo)[nombre] -= 1
        self.cura(j, self.valor_comida(tipo, nombre))

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
        for j in self.vivos():
            if j.raza == "Panda":
                self.cura(j, 1)
        # iniciativa: todos tiran 1d20; mayor a menor, empates al azar
        part = [("j", j) for j in self.jug] + [("e", e) for e in enemigos]
        tiradas = sorted(((self.d20() + (self.d4() if DESTREZA_INICIATIVA and k == "j" and x.dado_destreza else 0), self.rng.random(), k, x) for k, x in part), key=lambda t: (-t[0], t[1]))
        orden = [(k, x) for _, _, k, x in tiradas]
        self.ronda = 0
        while any(e.pv > 0 for e in enemigos) and self.vivos() and self.ronda < 60:
            self.ronda += 1
            self.rondas_total += 1
            self.actuaron = set()
            for j in self.jug:
                j.recibio_ronda = False
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
                if j.regen:
                    antes = j.pv
                    self.cura(j, j.regen)
                    self.log["regeneracion"] += j.pv - antes
        ganado = all(e.pv <= 0 for e in enemigos) and bool(self.vivos())
        if ganado:
            self.log["rondas_ganadas"] += self.ronda              # solo combates ganados: cuánto se tarda en derrotar un grupo
            for e in enemigos:
                self.tirar_botin(e.nivel)
                self.ojo_de_ladron()
                self.log["bestias"] += 1
        else:
            self.log["rondas_perdidas"] += self.ronda             # combate perdido: cuántas rondas aguanta el equipo hasta caer
            self.log["combates_perdidos"] += 1
        return ganado

    # ---- turno enemigo
    def turno_enemigo(self, e, enemigos):
        self.actuaron.add(e)
        if e.provocado_turnos > 0 and e.provocado_por and e.provocado_por.vivo:
            objetivo = e.provocado_por
        else:
            objetivo = self.rng.choice(self.vivos())
        t = self.d20()
        if t > 4:
            dano, fuerte = (e.fuerte if t >= 16 else e.basico), t >= 16
            paladin = e.cubierto_por
            if e.cubierto_turnos > 0 and paladin is not None and paladin.vivo and objetivo is not paladin:
                self.golpe_interceptado(paladin, dano, e, fuerte)             # el paladín se interpone: el aliado no sufre nada
            else:
                self.golpe_a_jugador(objetivo, dano, e, fuerte)
        if 0 < e.provocado_turnos < 900:
            e.provocado_turnos -= 1
        if e.cubierto_turnos > 0:
            e.cubierto_turnos -= 1
        for j in self.jug:
            j.runa = max(0, j.runa - 1)                  # la runa dura «rondas» de ataques enemigos: se cuenta por turno de bestia

    def golpe_interceptado(self, paladin, dano, e, fuerte):
        """Bastión Sagrado: el golpe iba contra un aliado y lo recibe el paladín: la mitad del daño (hacia abajo) y 1 punto más, sin armadura."""
        costo = dano // 2 + 1
        self.log["golpes_interceptados"] += 1
        self.log["dano_paladin_bastion"] += costo
        paladin.recibio_ronda = True
        self.dano_jugador(paladin, costo)
        if paladin.vivo and fuerte and e.efecto:
            self.efecto_golpe_fuerte(paladin, e)

    def efecto_golpe_fuerte(self, j, e):
        if e.efecto == "sangrado": j.sangrado = 2
        elif e.efecto == "quemadura" and not j.raza.startswith("Drac"): j.quemadura = 2
        elif e.efecto == "miedo": j.miedo, j.miedo_val = 2, e.miedo_val
        elif e.efecto == "marca": j.marca_enemiga = 2

    def golpe_a_jugador(self, j, dano, e, fuerte):
        if not j.vivo:
            return
        red = j.reduccion
        if j.armadura == "Escudo" and j.clase == "guerrero-orco" and not j.recibio_ronda:
            red += 1
        runa = (RUNA_REDUCCION + (ARMADURAS["Escudo"][2] if j.armadura == "Escudo" else 0)) if j.runa > 0 else 0       # Runa: cada golpe mientras dure; con escudo, sus puntos se duplican
        sin_extra = max(1, dano - red)
        final = max(1, dano - red - runa)
        self.log["mitigado_runa"] += sin_extra - final
        if j.marca_enemiga > 0:
            final += 1
        j.recibio_ronda = True
        self.dano_jugador(j, final)
        if j.vivo and fuerte and e.efecto:
            self.efecto_golpe_fuerte(j, e)

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
        if j.pv <= j.pvmax * 0.35 and self.comer_en_combate(j):
            return
        intencion = self.intencion(j)
        sanando = intencion == "especial" and j.rol == "sanador"          # tirada de su habilidad de sanar: usa el dado de sanación (solo los sanadores)
        mod = (self.d4() if (j.dado_sanacion if sanando else j.dado_ataque) else 0) - (j.miedo_val if j.miedo > 0 else 0)
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
        if e.marca_runa: dano += 1; e.marca_runa = False
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
            if TAUNT_A_TODOS:
                for x in vivos_e:                                    # todas las bestias solo pueden atacarle a él durante v turnos
                    x.provocado_por, x.provocado_turnos = j, v
            else:
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
            self.cura(self.objetivo_cura(), v)
        elif "protección" in tipo:
            for x in enemigos:                                               # durante v turnos de cada bestia, los golpes a los aliados los recibe el paladín
                if x.pv > 0:
                    x.cubierto_por, x.cubierto_turnos = j, v
        elif "que cura" in tipo:
            self.cura(j, self.golpear(j, e, v) // 2)
        elif "Robo" in tipo:
            self.robar(j, v, e)
        elif "marca" in tipo:
            self.golpear(j, e, v)
            e.marca_runa = True
        elif "Cura en las" in tipo:
            cand = [x for x in self.vivos() if x.manantial <= 0]
            obj = self.objetivo_cura(cand) if cand else None
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

# ---------------------------------------------------------------- taberna (al final de cada mapa)
def comprar_heroe(j, gastos):
    """Cada héroe con SUS monedas. Primero sube a nivel 2 (5 monedas; sin ellas no se sube). Luego: arma útil > armadura > dado > comida > bebida.
    Lo comprado se queda en el héroe (comida y bebida van a su mochila) y las monedas que sobran también."""
    dinero = j.monedas
    if j.nivel_carta == 1 and dinero >= PRECIO_NIVEL:
        dinero -= PRECIO_NIVEL; j.subir_nivel(); gastos["nivel 2"] += 1
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
            k = max(ops)[1]; dinero -= COMIDA[k][1]; j.comida[k] += 1; gastos[k] += 1; continue
        ops = [(v[2] / v[1], k) for k, v in BEBIDA.items() if v[1] <= dinero]
        if ops:
            k = max(ops)[1]; dinero -= BEBIDA[k][1]; j.bebida[k] += 1; gastos[k] += 1; continue
        break
    j.monedas = dinero
    return dinero

# ---------------------------------------------------------------- escenario
ENEMIGO_POR_ID = {e["id"]: e for e in ENEMIGOS["enemigos"]}

def rango_arg(txt):
    if isinstance(txt, tuple):
        return txt
    txt = str(txt)
    return tuple(int(x) for x in txt.split("-")) if "-" in txt else (int(txt),) * 2

POR_NIVEL = {nv: [e["id"] for e in ENEMIGOS["enemigos"] if e["nivel"] == nv] for nv in range(1, 8)}

def tipos_de_grupo(args, nv_min, nv_max):
    """Tipos de grupo de un mapa: 1-2 bestias, cada una de nivel nv_min..nv_max (con 2 niveles: N, M, N+N, N+M, M+M)."""
    lo, hi = rango_arg(args.bestias)
    return [tuple(c) for k in range(lo, hi + 1) for c in itertools.combinations_with_replacement(range(nv_min, nv_max + 1), k)]

def jugar_escenario(rng, args, p, nv_min, nv_max):
    """Un mapa: 4 grupos sorteados, todos obligatorios por defecto (si --obligatorios es menor, el resto se decide al azar); orden aleatorio. Pierde el mapa quien cae en un combate."""
    tipos = tipos_de_grupo(args, nv_min, nv_max)
    grupos = [rng.choice(tipos) for _ in range(args.grupos)]
    obligatorios = set(rng.sample(range(len(grupos)), args.obligatorios))
    orden = list(range(len(grupos)))
    rng.shuffle(orden)
    peleados = ganados = 0
    superado = True
    for idx in orden:
        if idx not in obligatorios and rng.random() >= args.p_opcional:
            continue
        peleados += 1
        if not p.combate([Enemigo(ENEMIGO_POR_ID[rng.choice(POR_NIVEL[nv])], p.n_jug) for nv in grupos[idx]]):
            superado = False
            break
        ganados += 1
        p.curar_fuera_combate()
    return {"grupos": [len(g) for g in grupos], "niveles": [nv for g in grupos for nv in g], "peleados": peleados, "ganados": ganados, "superado": superado}

def abrir_cofres(p, i, por_nivel):
    """Cofres fijos del mapa i: `por_nivel` del nivel mínimo y `por_nivel` del máximo. Se abren al superar el mapa: d20 (+1d4 con dado de destreza, tope 20)."""
    lo, hi = ESCENARIOS[i]
    m0, i0 = p.log["botin_monedas"], p.log["botin_items"]
    for nv in [lo] * por_nivel + [hi] * por_nivel:
        t = p.d20() + (p.d4() if any(j.dado_destreza for j in p.vivos()) else 0)
        fila = next(k for k, (a, b) in enumerate(RANGOS_COFRE) if a <= min(t, 20) <= b)
        for cat, *cant in COFRES[nv][fila]:
            if cat != "nada":
                p.dar(cat, cant[0] if cant else 1)
    p.log["cofre_monedas"] += p.log["botin_monedas"] - m0
    p.log["cofre_items"] += p.log["botin_items"] - i0

def aportar_al_tanque(p, tanque, precio):
    """Paga `precio` por el tanque: primero con sus monedas y, si no le llegan, los aliados ponen el resto (primero los que más llevan). Todo o nada."""
    aliados = sorted((j for j in p.jug if j is not tanque), key=lambda j: -j.monedas)
    if tanque.monedas + sum(j.monedas for j in aliados) < precio:
        return False
    falta = precio
    for j in [tanque] + aliados:
        pago = min(j.monedas, falta)
        j.monedas -= pago
        falta -= pago
        if not falta:
            break
    return True

def prioridad_tanque(p, gastos):
    """Antes de que cada uno compre lo suyo, el grupo le paga al tanque un escudo (si su clase lo usa y no tiene ya mejor armadura) y luego el nivel 2."""
    tanque = next((j for j in p.jug if j.rol == "tanque"), None)
    if not tanque:
        return
    _, precio, reduccion = ARMADURAS["Escudo"]
    if tanque.clase in PUEDE_ESCUDO and tanque.armadura != "Escudo" and tanque.reduccion <= reduccion and aportar_al_tanque(p, tanque, precio):
        tanque.armadura = "Escudo"; gastos["Escudo"] += 1
    if tanque.nivel_carta == 1 and aportar_al_tanque(p, tanque, PRECIO_NIVEL):
        tanque.subir_nivel(); gastos["nivel 2"] += 1
    if DADO_DESTREZA_AL_TANQUE and not tanque.dado_destreza and aportar_al_tanque(p, tanque, PRECIO_DADO):
        tanque.dado_destreza = True; gastos["dado destreza"] += 1

def entre_mapas(p, gastos):
    """Fin de un mapa superado: los caídos vuelven con 1 PV, cada héroe compra con SUS monedas (sube de nivel si puede) y come lo que le falte."""
    for j in p.jug:
        if not j.vivo:
            j.vivo, j.pv = True, 1
    if PRIORIDAD_TANQUE:
        prioridad_tanque(p, gastos)
    for j in p.jug:
        comprar_heroe(j, gastos)
    p.curar_fuera_combate()

# ---------------------------------------------------------------- campaña con checkpoints
import html, itertools, os, time
from multiprocessing import Pool
from types import SimpleNamespace

CORTO = {"guerrero-orco": "guerrero", "sacerdote-enano": "sacerdote"}
ROL_CORTO = {"tanque": "tank", "sanador": "healer", "dps": "dps", "ladron": "ladrón", "soporte": "soporte"}
nombre_clase = lambda c: CORTO.get(c, c)

def _opciones_por_clase():
    """clase -> [(índice de poder, rol)]"""
    return {c: [(i, Jugador(c, 10, i).rol) for i in range(len(CLASES[c]["seleccion"][1]["opciones"]))] for c in CLASES}

OPCIONES = _opciones_por_clase()
ROL_DE = {(c, i): r for c, lst in OPCIONES.items() for i, r in lst}

def composiciones():
    """Todas las composiciones de 4 o 5 héroes (clases distintas), con como mucho 1 tanque y 1 sanador."""
    res = []
    for tam in (4, 5):
        for sub in itertools.combinations(sorted(CLASES), tam):
            for combo in itertools.product(*[OPCIONES[c] for c in sub]):
                roles = [r for _, r in combo]
                if roles.count("tanque") <= 1 and roles.count("sanador") <= 1:
                    res.append(tuple((c, i) for c, (i, _) in zip(sub, combo)))
    return res

def etiqueta_comp(comp):
    return ", ".join(f"{nombre_clase(c)}-{ROL_CORTO[ROL_DE[(c, i)]]}" for c, i in comp)

def etiqueta_mapa(i):
    lo, hi = ESCENARIOS[i]
    return f"Mapa {i + 1} (bestias de nivel {lo}–{hi})"

def simular_equipo(tarea):
    """Juega la campaña de UN equipo con checkpoints y devuelve una lista de contadores planos (uno por mapa).
    Mapa 1: `n` ejecuciones desde cero. Los que lo superan (ya con la compra hecha) forman el checkpoint; el mapa 2 juega `n` ejecuciones
    sorteando un estado del checkpoint (copiado) como punto de partida, y así hasta el mapa 4."""
    comp, base, n, semilla = tarea
    ns = SimpleNamespace(**base)
    rng = random.Random(semilla)
    etapas, puntos = [], None
    for i, (lo, hi) in enumerate(ESCENARIOS):
        a = Counter()
        siguiente = []
        for _ in range(0 if (i > 0 and not puntos) else n):
            if i == 0:
                p = Partida(rng, ns, comp)
            else:
                p = Partida(rng, ns, jugadores=copy.deepcopy(rng.choice(puntos)))
                for j in p.jug:
                    j.dano_hecho = j.dano_recibido = j.curado = 0
            r = jugar_escenario(rng, ns, p, lo, hi)
            if r["superado"]:
                abrir_cofres(p, i, ns.cofres)
            v = p.vivos()
            a["n"] += 1; a["heroes"] += p.n_jug; a["vivos"] += len(v); a["todos"] += len(v) == p.n_jug; a["superado"] += r["superado"]
            a["grupos"] += len(r["grupos"]); a["bestias"] += sum(r["grupos"])
            a["peleados"] += r["peleados"]; a["ganados"] += r["ganados"]
            a["rondas"] += p.rondas_total
            a["nivel_sum"] += sum(r["niveles"]); a["nivel_n"] += len(r["niveles"])
            for j in p.jug:
                for k in (f"cl:{j.clase}", f"rol:{j.rol}"):
                    a[k + ":n"] += 1; a[k + ":vivo"] += j.vivo; a[k + ":dh"] += j.dano_hecho
                    a[k + ":dr"] += j.dano_recibido; a[k + ":cu"] += j.curado
            tanque = next((j for j in p.jug if j.rol == "tanque"), None)           # ¿están tanqueando? vida del tanque, daño del equipo que recibe y aliados vivos
            gt = f"{nombre_clase(tanque.clase)}-tank" if tanque else "sin"
            total_dano = sum(j.dano_recibido for j in p.jug) or 1
            a[f"tq:{gt}:n"] += 1
            if tanque:
                a[f"tq:{gt}:vivo"] += tanque.vivo; a[f"tq:{gt}:cuota"] += tanque.dano_recibido / total_dano; a[f"tq:{gt}:dano"] += tanque.dano_recibido
            for j in p.jug:
                if j is not tanque:
                    a[f"tq:{gt}:al_n"] += 1; a[f"tq:{gt}:al_vivo"] += j.vivo
            for k, x in p.log.items():
                a["log:" + k] += x
            if r["superado"]:
                a["mon_n"] += p.n_jug; a["mon_sum"] += sum(j.monedas for j in p.jug); a["mon_cero"] += sum(j.monedas == 0 for j in p.jug)
                a["mon_nivel"] += sum(j.nivel_carta == 1 and j.monedas >= PRECIO_NIVEL for j in p.jug)
                gastos = Counter()
                entre_mapas(p, gastos)
                for k, x in gastos.items():
                    a["compra:" + k] += x
                siguiente.append(p.jug)
        etapas.append(dict(a))
        puntos = siguiente
    return etapas

# ---- métricas de un equipo a partir de sus contadores por mapa
def sv_et(a): return a["vivos"] / a["heroes"] if a.get("n") else None          # héroes que terminan vivos en ese mapa
def sup_et(a): return a["superado"] / a["n"] if a.get("n") else 0.0            # ejecuciones que superan el mapa (entre las que llegan a él)
def completa(et):
    x = 1.0
    for a in et:
        x *= sup_et(a)                                                          # con checkpoints, cada mapa es condicional al anterior
    return x
def sv_equipo(et):
    h = sum(a.get("heroes", 0) for a in et)
    return sum(a.get("vivos", 0) for a in et) / h if h else 0.0
def rondas_grupo(a):                                                            # rondas medias para derrotar un grupo (solo combates ganados)
    return a.get("log:rondas_ganadas", 0) / a["ganados"] if a.get("ganados") else None
def rondas_perdidas(a):                                                         # rondas medias que dura un combate que el equipo PIERDE (hasta que cae)
    return a["log:rondas_perdidas"] / a["log:combates_perdidos"] if a.get("log:combates_perdidos") else None
def rondas_equipo(et):
    g = sum(a.get("ganados", 0) for a in et)
    return sum(a.get("log:rondas_ganadas", 0) for a in et) / g if g else None
def agrupar(ets):
    tot = [Counter() for _ in ESCENARIOS]
    for et in ets:
        for i, a in enumerate(et):
            tot[i].update(a)
    return tot
def media(xs):
    xs = list(xs)
    return sum(xs) / len(xs) if xs else 0.0

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
.pestanas{display:flex;gap:8px;margin:22px 0 4px;flex-wrap:wrap}.pestana{font:inherit;font-weight:600;padding:8px 16px;border:1px solid var(--line);border-radius:10px 10px 0 0;background:var(--card);color:var(--mut);cursor:pointer}
.pestana span{font-weight:400;font-size:12px}.pestana.activa{color:var(--fg);border-color:var(--acc);box-shadow:inset 0 -3px 0 var(--acc)}
.panel{display:none}.panel.activo{display:block}
"""

def pct(x): return f"{100 * x:.1f}%"

def tabla(cabeceras, filas, num=()):
    h = "".join(f'<th class="{"n" if i in num else ""}">{html.escape(c)}</th>' for i, c in enumerate(cabeceras))
    f = "".join("<tr>" + "".join(f'<td class="{"n" if i in num else ""}">{c}</td>' for i, c in enumerate(fila)) + "</tr>" for fila in filas)
    return f'<div class="tabla"><table><thead><tr>{h}</tr></thead><tbody>{f}</tbody></table></div>'

def roles_html(comp):
    return '<div class="roles">' + "".join(f"<span>{html.escape(nombre_clase(c))}-{ROL_CORTO[ROL_DE[(c, i)]]}</span>" for c, i in comp) + "</div>"

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
    ev = [(k, a["log:" + k] / n) for k in ("mitigado_runa", "golpes_interceptados", "dano_paladin_bastion", "bestias", "comidas_combate", "comidas_fuera", "objetos_robados", "ojo_ladron", "arma_inutil", "armadura_inutil", "muertes")]
    return (f'<div class="grid"><div><h3>Por clase</h3>{tabla(cab, cl, num=range(1, 6))}</div>'
            f'<div><h3>Por rol</h3>{tabla(cab, ro, num=range(1, 6))}</div></div>'
            f'<p class="nota">Encuentros: {a["peleados"] / n:.2f} peleados · {a["ganados"] / n:.2f} ganados · rondas por partida {a["rondas"] / n:.1f} · bestias {a["bestias"] / a["grupos"]:.2f} por grupo</p>'
            + (f'<p class="nota">Monedas por héroe al llegar al tabernero (solo mapas superados): media {a["mon_sum"] / mon:.1f} · sin monedas {pct(a["mon_cero"] / mon)} · pueden pagar subir a nivel 2 ({PRECIO_NIVEL} monedas) {pct(a["mon_nivel"] / mon)}</p>' if mon else '')
            + f'<p class="nota">Botín por partida: bestias {(a["log:botin_monedas"] - a["log:cofre_monedas"]) / n:.1f} monedas y {(a["log:botin_items"] - a["log:cofre_items"]) / n:.1f} ítems · cofres {a["log:cofre_monedas"] / n:.1f} monedas y {a["log:cofre_items"] / n:.1f} ítems (los cofres solo se abren al superar el mapa)</p>'
            + '<p class="nota">Compras tras el mapa, por partida superada (nivel 2 &gt; arma &gt; armadura &gt; dado &gt; comida &gt; bebida): '
            + (", ".join(f"{html.escape(k)} {v / max(1, a['superado']):.2f}" for k, v in compras[:8]) or "ninguna") + "</p>"
            + '<p class="nota">Eventos medios por partida: ' + ", ".join(f"{k.replace('_', ' ')} {v:.2f}" for k, v in ev) + '.</p>')

# ---------------------------------------------------------------- comprobación de datos y comparación con la corrida anterior
# El simulador lee los JSON de personajes y bestias en cada corrida, así que los cambios de números se reflejan solos.
# Lo que NO se refleja solo es lo que está programado o copiado a mano: esta comprobación avisa de ello.
HABILIDADES_CONOCIDAS = ("Provoca", "varios", "garras", "especial", "sanación", "protección", "que cura", "Robo", "marca", "Cura en las", "Escudo de varias")
RAZAS_CONOCIDAS = ("Taurent", "Drac", "Panda", "Tiefling", "Enan")       # con regla en el simulador (o sin efecto en combate, como los enanos)
EFECTOS_CONOCIDOS = ("sangrado", "veneno", "quemadura", "miedo", "marca")

def leer_tienda_js():
    """Lee public/tienda/js/datos/tienda.js: nombre -> (unidades, precio, valor, manos)."""
    texto = (RAIZ / "tienda/js/datos/tienda.js").read_text(encoding="utf-8")
    filas = {}
    patron = r'\[\s*(?:"([^"]*)"|\'([^\']*)\')\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*("[^"]*"|\d+)\s*(?:,\s*(\d+)\s*)?\]'
    for m in re.finditer(patron, texto):
        nombre = re.sub(r"<[^>]+>", "", m.group(1) or m.group(2)).strip()
        valor = int(m.group(5)) if m.group(5).isdigit() else None
        filas[nombre] = (int(m.group(3)), int(m.group(4)), valor, int(m.group(6)) if m.group(6) else None)
    return filas

def verificar_datos(nivel_min, nivel_max):
    """Devuelve una lista de avisos sobre cosas que el simulador no refleja (o refleja mal) con los datos actuales (bestias solo de los niveles simulados)."""
    av = []
    # 1) tienda copiada a mano frente a tienda.js
    try:
        js = leer_tienda_js()
        mios = {**{k: (v[0], v[1], v[2] or None, None) for k, v in COMIDA.items()}, **{k: (v[0], v[1], v[2], None) for k, v in BEBIDA.items()},
                **{k: (v[0], v[1], v[2], v[3]) for k, v in ARMAS.items()}, **{k: (v[0], v[1], v[2], None) for k, v in ARMADURAS.items()}}
        for nombre, (u, pr, val, man) in mios.items():
            if nombre not in js:
                av.append(f"Tienda: «{nombre}» ya no aparece en tienda.js (¿renombrado o eliminado?). Actualiza las tablas COMIDA/BEBIDA/ARMAS/ARMADURAS de simular.py.")
                continue
            ju, jp, jv, jm = js[nombre]
            if (u, pr) != (ju, jp) or (val is not None and jv is not None and val != jv) or (man is not None and jm is not None and man != jm):
                av.append(f"Tienda: «{nombre}» cambió en tienda.js (unidades/precio/valor/manos: {(u, pr, val, man)} en el simulador, {(ju, jp, jv, jm)} en la web). Actualiza simular.py.")
        for nombre in js:
            if nombre not in mios and not nombre.lower().startswith("dado"):
                av.append(f"Tienda: «{nombre}» es un objeto nuevo en tienda.js que el simulador no conoce. Añádelo a su tabla en simular.py.")
        for nombre, (u, pr, *_ ) in js.items():
            if nombre.lower().startswith("dado") and pr != PRECIO_DADO:
                av.append(f"Tienda: «{nombre}» ahora cuesta {pr} y el simulador usa PRECIO_DADO = {PRECIO_DADO}.")
    except Exception as e:                                    # la tienda es lo único que no se lee en vivo: si no se puede leer, mejor avisar
        av.append(f"No se pudo comprobar la tienda contra tienda.js ({e}).")
    # 2) clases: poderes y razas (los dones no se simulan)
    for c, d in CLASES.items():
        if c not in PUEDE_ARMA:
            av.append(f"Clase nueva «{c}»: añádela a PUEDE_ARMA (y a PUEDE_ESCUDO si puede llevar escudo) en simular.py.")
        raza = next((x["raza"] for x in d["cartas"] if x["tipo"] == "personaje"), "")
        if not raza.startswith(RAZAS_CONOCIDAS):
            av.append(f"Clase «{c}»: la raza «{raza}» tiene reglas que el simulador no conoce (solo Taurent, Dracónido, Panda, Tiefling y Enano del Bosque).")
        for o in d["seleccion"][1]["opciones"]:
            for cid in o["cartas"]:
                carta = next((x for x in d["cartas"] if x["id"] == cid), None)
                if carta and carta["tipo"] == "tabla" and not any(k in carta["tabla"][0]["subtitulo"] for k in HABILIDADES_CONOCIDAS):
                    av.append(f"Poder «{o['etiqueta']}» de {c}: el tipo de habilidad «{carta['tabla'][0]['subtitulo']}» no está programado; el simulador lo ignorará.")
            if not any(next((x for x in d["cartas"] if x["id"] == cid), {}).get("nivel") == 2 for cid in o["cartas"]):
                av.append(f"Poder «{o['etiqueta']}» de {c}: no tiene carta de nivel 2; el simulador falla al subir de nivel.")
    # 2b) cofres: categorías de botín que el simulador entiende y niveles que hacen falta
    conocidas = {"nada", "moneda", "comida", "bebida", "arma", "armadura", "dado"}
    for nv in range(nivel_min, nivel_max + 1):
        if nv not in COFRES or len(COFRES[nv]) != len(RANGOS_COFRE):
            av.append(f"Cofres: falta el cofre de nivel {nv} en cofres.js o no tiene una fila de botín por cada rango del d20.")
    for nv, filas in COFRES.items():
        for fila in filas:
            for cat, *_ in fila:
                if cat not in conocidas:
                    av.append(f"Cofres: el cofre de nivel {nv} tiene la categoría «{cat}» que el simulador no conoce; se ignorará.")
    # 3) bestias de los niveles en juego
    for e in ENEMIGOS["enemigos"]:
        if nivel_min <= e["nivel"] <= nivel_max and e.get("habilidades"):
            txt = (e["ataques"][1]["subtitulo"] + " " + e["habilidades"][0]["descripcion"]).lower()
            if not any(k in txt for k in EFECTOS_CONOCIDOS):
                av.append(f"Bestia «{e['nombre']}» (nivel {e['nivel']}): el efecto de su golpe fuerte no se reconoce (solo sangrado, veneno, quemadura, miedo, marca); se simulará como un golpe normal.")
    for nv in range(nivel_min, nivel_max + 1):
        if not POR_NIVEL[nv]:
            av.append(f"No hay bestias de nivel {nv} en el bestiario y la campaña las necesita.")
    return av

def resumen_corrida(comps, res, args):
    """Cifras clave de la corrida, para compararlas con la siguiente."""
    from datetime import datetime
    tot = agrupar(res)
    sv_eq = [sv_equipo(et) for et in res]
    co_eq = [completa(et) for et in res]
    def por(clave):
        d = defaultdict(list)
        for comp, x in zip(comps, sv_eq):
            for k in clave(comp):
                d[k].append(x)
        return {k: round(media(v), 4) for k, v in d.items()}
    sel = lambda n: [co_eq[k] for k, c in enumerate(comps) if len(c) == n]
    return {"formato": 2, "generado": datetime.now().strftime("%Y-%m-%d %H:%M"), "ejecuciones": args.ejecuciones, "equipos": len(comps),
            "completa": round(media(co_eq), 4), "completa_4": round(media(sel(4)), 4), "completa_5": round(media(sel(5)), 4),
            "superado": [round(sup_et(a), 4) for a in tot],
            "supervivencia": [round(a["vivos"] / a["heroes"], 4) if a["n"] else 0 for a in tot],
            "monedas": [round(a["log:botin_monedas"] / a["n"], 3) if a["n"] else 0 for a in tot],
            "items": [round(a["log:botin_items"] / a["n"], 3) if a["n"] else 0 for a in tot],
            "por_clase": por(lambda comp: [nombre_clase(c) for c, _ in comp]),
            "por_rol": por(lambda comp: {ROL_CORTO[ROL_DE[(c, i)]] for c, i in comp}),
            "por_heroe": por(lambda comp: [f"{nombre_clase(c)}-{ROL_CORTO[ROL_DE[(c, i)]]}" for c, i in comp])}

def cambios_html(actual, anterior):
    """Tabla de cambios entre la corrida actual y la anterior."""
    if not anterior:
        return '<p class="nota">Es la primera corrida guardada: la próxima mostrará aquí qué cambió respecto a esta.</p>'
    if anterior.get("formato") != 2:
        return '<p class="nota">La corrida anterior era de un solo escenario (formato antiguo) y no es comparable con la campaña de 4 mapas. La próxima corrida se comparará con esta.</p>'
    filas = []
    def fila(nombre, a, b, fmt, escala=100, unidad="puntos"):
        d = (a - b) * escala
        marca = "" if abs(d) < 0.05 else (" ▲" if d > 0 else " ▼")
        filas.append([html.escape(nombre), fmt(b), fmt(a), f"{d:+.1f} {unidad}{marca}"])
    p1 = lambda x: f"{100 * x:.1f}%"
    n1 = lambda x: f"{x:.2f}"
    for nombre, k in (("Completan los 4 mapas (todos los equipos)", "completa"), ("… equipos de 4", "completa_4"), ("… equipos de 5", "completa_5")):
        fila(nombre, actual[k], anterior[k], p1)
    for i in range(len(ESCENARIOS)):
        fila(f"Mapa {i + 1}: superan el mapa", actual["superado"][i], anterior["superado"][i], p1)
        fila(f"Mapa {i + 1}: héroes que terminan vivos", actual["supervivencia"][i], anterior["supervivencia"][i], p1)
        fila(f"Mapa {i + 1}: monedas por partida", actual["monedas"][i], anterior["monedas"][i], n1, 1, "monedas")
        fila(f"Mapa {i + 1}: ítems por partida", actual["items"][i], anterior["items"][i], n1, 1, "ítems")
    for grupo, titulo in (("por_clase", "Clase"), ("por_rol", "Rol"), ("por_heroe", "Héroe")):
        for k, v in sorted(actual[grupo].items()):
            if k in anterior.get(grupo, {}) and abs(v - anterior[grupo][k]) >= 0.0005:
                fila(f"{titulo}: {k} (supervivencia media)", v, anterior[grupo][k], p1)
    sub = f'Comparado con la corrida del {anterior["generado"]} ({anterior["equipos"]} equipos, {anterior["ejecuciones"]} ejecuciones); esta: {actual["generado"]}. De clase, rol y héroe solo se listan los que cambiaron.'
    return f'<p class="nota">{sub}</p>' + tabla(["", "Antes", "Ahora", "Cambio"], filas, num=(1, 2, 3))

def escribir_csv(ruta, comps, res, args):
    """Una fila por equipo y mapa con sus estadísticas, para analizarlo en una hoja de cálculo."""
    import csv
    with open(ruta, "w", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        w.writerow(["equipo", "n_heroes", "mapa", "niveles_bestias", "ejecuciones_que_llegan", "mapa_superado", "supervivencia", "grupo_completo_vivo",
                    "encuentros_que_pelean", "rondas_para_derrotar_un_grupo", "rondas_hasta_caer", "monedas_botin_media", "items_botin_media", "monedas_cofres_media", "items_cofres_media", "monedas_al_tabernero_por_heroe", "completa_los_4_mapas"])
        for comp, et in zip(comps, res):
            for i, a in enumerate(et):
                n = a.get("n", 0)
                lo, hi = ESCENARIOS[i]
                w.writerow([etiqueta_comp(comp), len(comp), i + 1, f"{lo}-{hi}", n, f"{sup_et(a):.4f}", f"{sv_et(a):.4f}" if n else "", f'{a["todos"] / n:.4f}' if n else "",
                            f'{a["peleados"] / n:.3f}' if n else "", f'{a.get("log:rondas_ganadas", 0) / max(1, a["ganados"]):.2f}' if n else "", f'{rondas_perdidas(a):.2f}' if n and rondas_perdidas(a) is not None else "", f'{a.get("log:botin_monedas", 0) / n:.3f}' if n else "", f'{a.get("log:botin_items", 0) / n:.3f}' if n else "", f'{a.get("log:cofre_monedas", 0) / n:.3f}' if n else "", f'{a.get("log:cofre_items", 0) / n:.3f}' if n else "",
                            f'{a["mon_sum"] / a["mon_n"]:.3f}' if a.get("mon_n") else "", f"{completa(et):.4f}"])

def bloque_panel(args, comps, res):
    """Secciones de resultados de UN tamaño de equipo (4 o 5 héroes): global, equipos, detalle por mapa y panorama."""
    ej, u = args.ejecuciones, args.umbral
    E, n_eq = len(ESCENARIOS), len(comps)
    tot = agrupar(res)
    sv_eq = [sv_equipo(et) for et in res]
    co_eq = [completa(et) for et in res]
    bar = lambda x: f'<div class="barra"><i style="width:{100 * x:.0f}%"></i></div>'
    q = lambda L, f: L[int(f * (len(L) - 1))]
    # ---- resultado global por mapa
    filas = []
    for i, a in enumerate(tot):
        n = a["n"]
        if not n:
            filas.append([etiqueta_mapa(i)] + ["—"] * 11)
            continue
        ok = sum((sv_et(et[i]) or 0) >= u for et in res)
        mon = a["mon_n"]
        filas.append([etiqueta_mapa(i), f"{n:,}", pct(sup_et(a)), pct(a["vivos"] / a["heroes"]), f"{ok} de {n_eq} ({pct(ok / n_eq)})",
                      f'{a.get("log:rondas_ganadas", 0) / max(1, a["ganados"]):.1f}', f'{a["rondas"] / n:.1f}',
                      f'{a["log:botin_monedas"] / n:.1f}', f'{a["log:botin_items"] / n:.1f}',
                      f'{a["mon_sum"] / mon:.1f}' if mon else "—", pct(a["mon_nivel"] / mon) if mon else "—",
                      f'{a.get("compra:nivel 2", 0) / max(1, a["superado"]):.2f}'])
    por_mapa = tabla(["Mapa", "Ejecuciones que llegan", "Superan el mapa", "Héroes que terminan vivos", f"Equipos con supervivencia ≥ {100 * u:.0f} %",
                      "Rondas para derrotar un grupo", "Rondas por mapa", "Monedas por partida (bestias + cofres)", "Ítems por partida (bestias + cofres)", "Monedas por héroe al tabernero", "Podrían pagar nivel 2", "Héroes que suben a nivel 2 (por partida superada)"],
                     filas, num=range(1, 12))
    def tabla_tanque(gt, extra=False):
        """¿Está tanqueando este tanque? Una fila por mapa, solo con los equipos que lo llevan; los héroes de equipos sin tanque van de referencia."""
        filas_t = []
        for i, a in enumerate(tot):
            n_t = a.get(f"tq:{gt}:n", 0)
            if not n_t:
                filas_t.append([etiqueta_mapa(i)] + ["—"] * (7 if extra else 5))
                continue
            fila_t = [etiqueta_mapa(i), f"{n_t:,}", pct(a[f"tq:{gt}:vivo"] / n_t), f'{a[f"tq:{gt}:dano"] / n_t:.1f}', pct(a[f"tq:{gt}:cuota"] / n_t),
                      pct(a[f"tq:{gt}:al_vivo"] / max(1, a[f"tq:{gt}:al_n"]))]
            if extra:
                fila_t += [f'{a.get("log:golpes_interceptados", 0) / n_t:.1f}', f'{a.get("log:regeneracion", 0) / n_t:.1f}']
            fila_t.append(pct(a["tq:sin:al_vivo"] / max(1, a["tq:sin:al_n"])) if a.get("tq:sin:n") else "—")
            filas_t.append(fila_t)
        cab = ["Mapa", "Ejecuciones con este tanque", "El tanque sigue vivo", "Daño medio que recibe", "% del daño del equipo que recibe", "Aliados vivos (sin contar al tanque)"]
        if extra:
            cab += ["Golpes interceptados por partida", "Vida que se cura por la luz"]
        cab.append("Referencia: héroes vivos en equipos sin tanque")
        return tabla(cab, filas_t, num=range(1, len(cab)))
    tabla_guerrero = tabla_tanque("guerrero-tank")
    tabla_paladin = tabla_tanque("paladin-tank", extra=True)
    campana = tabla(["", "Equipos"] + [f"Superan mapa {i + 1}" for i in range(E)] + ["Completan los 4 mapas"],
                    [[f"Equipos de {len(comps[0])} héroes", str(n_eq)] + [pct(sup_et(a)) for a in tot] + [f"<b>{pct(media(co_eq))}</b>"]], num=range(1, E + 3))
    # ---- equipos
    cab_eq = ["Equipo", "Nº"] + [f"Vivos mapa {i + 1}" for i in range(E)] + ["Supervivencia media", "Completa los 4 mapas", "Rondas por grupo si sobreviven (mapas 1 · 2 · 3 · 4)", "Rondas por grupo si mueren (mapas 1 · 2 · 3 · 4)"]
    fila_eq = lambda k: ([roles_html(comps[k]), str(len(comps[k]))] + [pct(sv_et(a)) if a.get("n") else "—" for a in res[k]]
                         + [f'<span class="sv">{pct(sv_eq[k])}</span>', pct(co_eq[k]), " · ".join("—" if rondas_grupo(a) is None else f"{rondas_grupo(a):.1f}" for a in res[k]),
                         " · ".join("—" if rondas_perdidas(a) is None else f"{rondas_perdidas(a):.1f}" for a in res[k])])
    num_eq = range(1, E + 6)
    top = args.top
    ord_f = sorted(range(n_eq), key=lambda k: (-sv_eq[k], -co_eq[k]))          # por supervivencia media; «completa los 4» solo desempata
    cerca = sorted(range(n_eq), key=lambda k: abs(sv_eq[k] - u))[:top]
    t_eq = lambda ks: tabla(cab_eq, [fila_eq(k) for k in ks], num=num_eq)
    # ---- panorama
    def sec(titulo, claves_de):
        d = defaultdict(list)
        for k, c in enumerate(comps):
            for x in claves_de(c):
                d[x].append(k)
        filas = [[html.escape(str(x)), pct(media(sv_eq[k] for k in ks)), pct(media(co_eq[k] for k in ks)), f"{media(rondas_equipo(res[k]) for k in ks if rondas_equipo(res[k]) is not None):.1f}", str(len(ks)), bar(media(sv_eq[k] for k in ks))]
                 for x, ks in sorted(d.items(), key=lambda kv: -media(sv_eq[k] for k in kv[1]))]
        return tabla([titulo, "Supervivencia media", "Completa los 4", "Rondas por grupo", "Equipos", ""], filas, num=(1, 2, 3, 4))
    firmas = [frozenset(c) for c in comps]
    pares = [(a_, b_) for a_ in range(n_eq) for b_ in range(a_ + 1, n_eq) if len(firmas[a_] - firmas[b_]) == 1]
    difs = sorted(abs(sv_eq[a_] - sv_eq[b_]) for a_, b_ in pares)
    detalles = "".join(f'<h3>{html.escape(etiqueta_mapa(i))}</h3><p class="sub">Todos los equipos de {len(comps[0])} héroes juntos · {a["n"]:,} ejecuciones</p>' + bloque_detalle(a)
                       for i, a in enumerate(tot) if a["n"])
    return f"""
<h2>Resultado global</h2>
{por_mapa}
<p class="nota">Cada mapa se juega {ej} veces por equipo. «Superan el mapa» = no caen en ningún combate. «Héroes que terminan vivos» se mide al acabar el mapa, antes de que los caídos vuelvan con 1 PV. Un equipo «pasa» un mapa si esa supervivencia es del {100 * u:.0f} % o más. «Rondas para derrotar un grupo» es la media solo de los combates ganados (una ronda = todos, héroes y bestias, actúan una vez); «Rondas por mapa» suma todos los combates peleados, ganados o perdidos. Monedas e ítems por partida: suma de lo que sueltan las bestias (más lo que roba el Pícaro) y lo de los 4 cofres del mapa, que solo se abren si el equipo supera el mapa. El desglose bestias / cofres está en «Detalle por mapa».</p>
<h3>¿Está tanqueando el guerrero?</h3>
{tabla_guerrero}
<h3>¿Está tanqueando el paladín?</h3>
{tabla_paladin}
<p class="nota">Solo equipos que llevan ese tanque. «El tanque sigue vivo» = termina el mapa en pie (el resto de las veces cae). «% del daño del equipo que recibe» = parte de todo el daño que recibe el grupo que va al tanque. «Aliados vivos» = el resto de héroes del equipo, sin contar al tanque, que terminan en pie; se comparan con los héroes de los equipos sin tanque. «Golpes interceptados» = golpes a aliados que recibe el paladín con el Bastión; «vida que se cura por la luz» = lo que recupera cada partida con su regeneración de 2 por ronda.</p>
<h3>Campaña completa</h3>
{campana}
<p class="nota">«Superan mapa N» = entre las ejecuciones que llegan a ese mapa (el checkpoint), las que lo superan. «Completan los 4 mapas» = producto de las cuatro tasas, porque cada mapa depende del checkpoint del anterior. Hay {sum(.4 <= sv <= .6 for sv in sv_eq)} equipos con supervivencia media entre 40 y 60 %, {sum(sv < .5 for sv in sv_eq)} por debajo del 50 % y {sum(sv >= .5 for sv in sv_eq)} por encima. Todos los equipos y mapas están además en <b>sets.csv</b>.</p>

<h2>Los {len(cerca)} equipos con supervivencia media más cercana al {100 * u:.0f} %</h2>
{t_eq(cerca)}
<h2>Los {top} equipos más fuertes (por supervivencia media)</h2>
{t_eq(ord_f[:top])}
<h2>Los {top} equipos más débiles (por supervivencia media)</h2>
{t_eq(ord_f[::-1][:top])}

<h2>Detalle por mapa</h2>
{detalles}

<h2>Panorama por equipo</h2>
<p class="nota">Supervivencia media de cada equipo en los {E} mapas (héroes vivos al final de cada mapa, sobre todas las ejecuciones que llegan a él). Mediana de los {n_eq} equipos: {pct(q(sorted(sv_eq), .5))}.</p>
<div class="grid">
<div><h3>Por clase presente</h3>{sec("Clase", lambda c: [nombre_clase(x) for x, _ in c])}</div>
<div><h3>Por rol presente</h3>{sec("Rol", lambda c: {ROL_CORTO[ROL_DE[(x, i)]] for x, i in c})}</div>
<div><h3>Por héroe concreto (clase y rol)</h3>{sec("Héroe", lambda c: [f"{nombre_clase(x)}-{ROL_CORTO[ROL_DE[(x, i)]]}" for x, i in c])}</div></div>

<h2>¿Cuánto cambia la supervivencia si cambias un héroe?</h2>
<p class="nota">Hay {len(pares)} pares de equipos que difieren en <b>un solo héroe</b>. Diferencia de supervivencia media: mediana <b>{100 * q(difs, .5):.1f}</b> puntos, percentil 90 <b>{100 * q(difs, .9):.1f}</b>, percentil 99 <b>{100 * q(difs, .99):.1f}</b>, máximo <b>{100 * difs[-1]:.1f}</b>.</p>
"""

# ---------------------------------------------------------------- comparación de reglas para la vida de las bestias
# Se calcula solo con --reglas-vida (tarda ~1 min) y se guarda en reglas_vida.json; el reporte lo muestra siempre que exista.
TABLA_A_MANO = {1: [10, 15, 17], 2: [15, 19, 22], 3: [23, 34, 37], 4: [31, 45, 50], 5: [41, 58, 66], 6: [74, 99, 114], 7: [100, 135, 155]}   # la tabla de antes de usar una regla
F5, F6 = 1.4, 1.6          # factor de ponderación: vida para 5 y 6 jugadores respecto a la de 4

def regla_potencia(p, a=10, b=100):
    """Vida para 4 jugadores: a + (b − a)·((nivel − 1)/6)^p   (p = 1 lineal; p > 1 sube despacio al principio y deprisa al final)."""
    return lambda n: a + (b - a) * ((n - 1) / 6) ** p

def tabla_regla(f):
    return {n: [round(f(n)), round(f(n) * F5), round(f(n) * F6)] for n in range(1, 8)}

def tabla_escalada(p, bases):
    """Regla en uso: vida(nivel) = vida_nivel_1 · (1 + 9·((nivel − 1)/6)^p), con una vida de nivel 1 distinta para 4, 5 y 6 jugadores."""
    f = lambda n: 1 + 9 * ((n - 1) / 6) ** p
    return {n: [round(b * f(n)) for b in bases] for n in range(1, 8)}

def comparar_reglas_vida(args, base, ruta):
    """Juega la campaña con varias reglas de vida de las bestias y guarda cuántos héroes sobreviven en cada mapa (equipos con tanque + sanador)."""
    candidatas = [("Tabla a mano (la de antes)", TABLA_A_MANO), ("Lineal (p = 1)", tabla_regla(regla_potencia(1))),
                  ("Potencia p = 1,5", tabla_regla(regla_potencia(1.5))), ("Potencia p = 2", tabla_regla(regla_potencia(2))),
                  ("Potencia p = 2,5", tabla_regla(regla_potencia(2.5))), ("Potencia p = 2,5 con nivel 1 = 8 / 12 / 14", tabla_escalada(2.5, (8, 12, 14))), ("Exponencial ×1,468 por nivel", tabla_regla(lambda n: 10 * (10 ** (1 / 6)) ** (n - 1)))]
    comps = [c for c in composiciones() if any(ROL_DE[x] == "tanque" for x in c) and any(ROL_DE[x] == "sanador" for x in c)]
    original = {n: list(NIVELES[n]["vida"]) for n in NIVELES}
    salida = []
    try:
        for nombre, tabla in candidatas:
            for n in range(1, 8):
                NIVELES[n]["vida"] = tabla[n]
            with Pool(args.procesos) as pool:
                res = pool.map(simular_equipo, [(c, base, args.ejecuciones, args.semilla * 1_000_003 + k) for k, c in enumerate(comps)], chunksize=2)
            fila = {"nombre": nombre, "vida4": [tabla[n][0] for n in range(1, 8)], "vida5": [tabla[n][1] for n in range(1, 8)], "vida6": [tabla[n][2] for n in range(1, 8)]}
            for tam in (4, 5):
                ag = agrupar(r for c, r in zip(comps, res) if len(c) == tam)
                fila[f"v{tam}"] = [round(a["vivos"] / a["heroes"], 4) if a.get("n") else None for a in ag]       # héroes vivos por mapa
                fila[f"s{tam}"] = [round(sup_et(a), 4) if a.get("n") else None for a in ag]                      # mapas superados
            salida.append(fila)
            print(f"  regla «{nombre}» lista", flush=True)
    finally:
        for n in range(1, 8):
            NIVELES[n]["vida"] = original[n]
    datos = {"equipos": len(comps), "ejecuciones": args.ejecuciones, "reglas": salida}
    ruta.write_text(json.dumps(datos, ensure_ascii=False, indent=1), encoding="utf-8")
    return datos

def seccion_reglas(datos):
    if not datos:
        return ""
    en_uso = [NIVELES[n]["vida"][0] for n in range(1, 8)]
    filas = []
    for r in datos["reglas"]:
        marca = " <b>← en uso</b>" if r["vida4"] == en_uso else ""
        fila = [html.escape(r["nombre"]) + marca, ", ".join(map(str, r["vida4"]))]
        for tam in (4, 5):
            fila += [pct(r[f"v{tam}"][m]) if r[f"v{tam}"][m] is not None else "—" for m in (1, 2, 3)]
        filas.append(fila)
    tabla_ = tabla(["Regla de la vida", "Vida con 4 jugadores (niveles 1 a 7)", "4 jug.: vivos mapa 2", "4 jug.: vivos mapa 3", "4 jug.: vivos mapa 4",
                    "5 jug.: vivos mapa 2", "5 jug.: vivos mapa 3", "5 jug.: vivos mapa 4"], filas, num=range(2, 8))
    return f"""
<h2>Reglas para la vida de las bestias</h2>
<p class="nota">Las reglas de potencia parten de 10 de vida en nivel 1 y 100 en nivel 7 (4 jugadores) y cambian solo la curva: <b>{html.escape("10 + 90·((nivel − 1)/6)^p")}</b>; para 5 y 6 jugadores la vida se multiplica por {F5} y {F6}. La regla en uso baja todo escalando desde un nivel 1 de 8 / 12 / 14 (4 / 5 / 6 jugadores): <b>{html.escape("vida_nivel_1 · (1 + 9·((nivel − 1)/6)^2,5)")}</b>. «Tabla a mano» es la que había antes de usar una regla. Se midió la campaña con los {datos["equipos"]} equipos que llevan <b>tanque y sanador</b> ({datos["ejecuciones"]} ejecuciones por mapa y equipo); la cifra es el % de héroes que terminan vivos en ese mapa. Cuanto más curva (p mayor), menos vida en los niveles del medio y mejor sobreviven los equipos, pero más grande es el salto de los niveles 5 a 7. Se recalcula con <b>--reglas-vida</b>.</p>
{tabla_}
"""

def generar_html(args, comps, res, seg, avisos=(), cambios="", reglas=None):
    ej = args.ejecuciones
    E, n_eq = len(ESCENARIOS), len(comps)
    avisos_html = ("<p class=\"nota\">Los datos de personajes, bestias y tienda coinciden con lo que el simulador tiene programado. ✔</p>" if not avisos else
                   "<p class=\"nota\"><b>Atención:</b> algo de lo que cambiaste no se refleja (o se refleja mal) en el simulador:</p><ul class=\"nota\">" + "".join(f"<li>{html.escape(a)}</li>" for a in avisos) + "</ul>")
    # un panel por tamaño de equipo: los resultados de 4 y de 5 héroes no se mezclan
    pestanas, paneles = "", ""
    for pos, tam in enumerate((4, 5)):
        ks = [k for k, c in enumerate(comps) if len(c) == tam]
        if not ks:
            continue
        pestanas += f'<button type="button" class="pestana{" activa" if pos == 0 else ""}" data-panel="panel-{tam}">{tam} jugadores <span>({len(ks)} equipos)</span></button>'
        paneles += f'<section class="panel{" activo" if pos == 0 else ""}" id="panel-{tam}">{bloque_panel(args, [comps[k] for k in ks], [res[k] for k in ks])}</section>'
    return f"""<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Balance de La Taberna</title><style>{CSS}</style></head><body><main>
<h1>Balance de La Taberna</h1>
<p class="sub">Campaña de {E} mapas seguidos · héroes de nivel 1 con {args.pv} de vida · {n_eq} equipos de 4 y 5 héroes · {ej} ejecuciones por mapa y equipo · generado en {seg:.0f} s</p>

<div class="pestanas" role="tablist">{pestanas}</div>
{paneles}
{seccion_reglas(reglas)}
<h2>Qué cambió desde la corrida anterior</h2>
{cambios}

<h2>Comprobación de datos</h2>
{avisos_html}

<h2>Cómo funciona la campaña</h2>
<p class="nota">El set es solo el <b>equipo</b> (4 o 5 héroes de clases distintas, cada uno con su carta de poder; como mucho 1 tanque y 1 sanador): {n_eq} equipos. Los resultados de 4 y de 5 jugadores están en pestañas separadas para que no se mezclen. Los mapas son fijos: mapa 1 con bestias de nivel 1–2, mapa 2 de 2–3, mapa 3 de 3–4 y mapa 4 de 4–5, cada uno con {args.grupos} grupos de 1 a 2 bestias que se sortean en cada ejecución y {2 * args.cofres} cofres fijos ({args.cofres} del nivel mínimo y {args.cofres} del máximo de las bestias del mapa).
<b>Checkpoints:</b> se juega el mapa 1 {ej} veces; los equipos que lo superan y compran al tabernero forman el checkpoint, que se toma como verdad absoluta. El mapa 2 arranca desde esos estados (sorteados, con sus monedas, objetos, nivel y vida) y los que lo superan forman el siguiente checkpoint, y así hasta el mapa 4. No se combinan mapas entre sí, así que el coste es el de un mapa por cuatro.</p>

<h2>Supuestos del simulador</h2>
<p class="nota">Héroes: 10 de vida (+1 los dracónidos; el tanque guerrero tiene 30 (40 en nivel 2) y el tanque paladín 25 (35 en nivel 2); el escudo reduce 6, según `vida` y `vida_nivel_2` de su poder), nivel 1, sin monedas ni objetos. Combate: iniciativa d20 para todos (+1d4 con dado de destreza); cada bestia ataca una vez por ronda. El Bastión del paladín intercepta los golpes dirigidos a sus aliados (los recibe él: la mitad del daño más 1, sin armadura) y el paladín tanque se cura 2 al final de cada ronda. La provocación del tanque (guerrero) obliga a todas las bestias vivas. El sanador cura primero al tanque si está herido. Antes de tirar el d20 cada héroe decide habilidad básica o especial (al azar; el sanador cura si algún aliado tiene menos de 5 de vida; el tanque con más de 3 de vida siempre tanquea); después tira y usa la mejor opción de esa tabla. Los dones no se simulan.
Botín: el de las bestias y el de los cofres (se abren al superar el mapa: d20 por cofre, +1d4 con dado de destreza); cada objeto va a un héroe vivo al azar, salvo lo que roba el Pícaro (Manos Ligeras). La vida solo se recupera con comida y bebida (o con las habilidades de sanación en combate); el sushi mágico cura 1d6.
Tras cada mapa superado (también el último): los caídos vuelven con 1 PV; el grupo compra primero al tanque (escudo, nivel 2 y dado de destreza, poniendo entre todos las monedas que falten) y después cada héroe compra con SUS monedas. Orden: subir a nivel 2 ({PRECIO_NIVEL} monedas, solo si las tiene) &gt; arma útil &gt; armadura &gt; dado &gt; comida &gt; bebida; después come lo que le falte. Monedas, objetos y nivel pasan al siguiente mapa.</p>
</main>
<script>
document.querySelectorAll(".pestana").forEach(function (b) {{
  b.addEventListener("click", function () {{
    document.querySelectorAll(".pestana").forEach(function (x) {{ x.classList.toggle("activa", x === b); }});
    document.querySelectorAll(".panel").forEach(function (p) {{ p.classList.toggle("activo", p.id === b.dataset.panel); }});
  }});
}});
</script>
</body></html>"""

def main():
    ap = argparse.ArgumentParser(description="Genera simulacion/reporte.html con el balance de La Taberna (campaña de 4 mapas con checkpoints, todos los equipos)")
    ap.add_argument("--ejecuciones", type=int, default=2000, help="veces que se juega cada mapa por equipo; solo cambian los dados y los sorteos")
    ap.add_argument("--top", type=int, default=8, help="filas de las tablas de equipos")
    ap.add_argument("--grupos", type=int, default=4, help="grupos de bestias de cada mapa")
    ap.add_argument("--obligatorios", type=int, default=4, help="grupos obligatorios (al azar en cada ejecución); por defecto los 4")
    ap.add_argument("--bestias", default="1-2", help="bestias por grupo (rango)")
    ap.add_argument("--cofres", type=int, default=2, help="cofres de cada uno de los dos niveles del mapa (2 → 4 cofres por mapa)")
    ap.add_argument("--p-opcional", type=float, default=0.5, help="prob. de que el equipo vaya por un grupo opcional")
    ap.add_argument("--pv", type=int, default=10, help="vida base de los héroes")
    ap.add_argument("--p-especial", type=float, default=0.5, help="prob. de elegir habilidad especial cuando la decisión es aleatoria")
    ap.add_argument("--umbral", type=float, default=0.5, help="supervivencia mínima para que un equipo «pase» un mapa")
    ap.add_argument("--semilla", type=int, default=1)
    ap.add_argument("--procesos", type=int, default=os.cpu_count())
    ap.add_argument("--rapido", action="store_true", help="prueba rápida con pocas ejecuciones")
    ap.add_argument("--reglas-vida", action="store_true", help="vuelve a calcular la comparación de reglas para la vida de las bestias (~1 min; se guarda en reglas_vida.json)")
    ap.add_argument("--salida", default=str(Path(__file__).resolve().parent / "reporte.html"))
    args = ap.parse_args()
    if args.rapido:
        args.ejecuciones = 200
    base = dict(p_opcional=args.p_opcional, pv=args.pv, p_especial=args.p_especial, grupos=args.grupos, obligatorios=args.obligatorios, bestias=args.bestias, cofres=args.cofres)
    t0 = time.time()
    avisos = verificar_datos(min(m[0] for m in ESCENARIOS), max(m[1] for m in ESCENARIOS))
    for a in avisos:
        print("AVISO:", a)
    print(f"comprobación de datos: {len(avisos)} aviso(s)" if avisos else "comprobación de datos: todo coincide con lo programado")
    comps = composiciones()
    print(f"{len(comps)} equipos x {len(ESCENARIOS)} mapas con checkpoints, {args.ejecuciones} ejecuciones por mapa...", flush=True)
    with Pool(args.procesos) as pool:
        res = pool.map(simular_equipo, [(c, base, args.ejecuciones, args.semilla * 1_000_003 + k) for k, c in enumerate(comps)], chunksize=4)
    # comparación con la corrida anterior (se guarda al lado del reporte; la anterior se conserva como resumen_anterior.json)
    ruta_res = Path(args.salida).with_name("resumen.json")
    actual = resumen_corrida(comps, res, args)
    anterior = json.loads(ruta_res.read_text(encoding="utf-8")) if ruta_res.exists() else None
    if anterior:
        ruta_res.replace(ruta_res.with_name("resumen_anterior.json"))
    ruta_res.write_text(json.dumps(actual, ensure_ascii=False, indent=1), encoding="utf-8")
    ruta_reglas = Path(args.salida).with_name("reglas_vida.json")
    if args.reglas_vida:
        print("comparando reglas de vida de las bestias...", flush=True)
        reglas = comparar_reglas_vida(args, base, ruta_reglas)
    else:
        reglas = json.loads(ruta_reglas.read_text(encoding="utf-8")) if ruta_reglas.exists() else None
    Path(args.salida).write_text(generar_html(args, comps, res, time.time() - t0, avisos, cambios_html(actual, anterior), reglas), encoding="utf-8")
    escribir_csv(Path(args.salida).with_name("sets.csv"), comps, res, args)
    print(f"\nReporte: {args.salida}  ({time.time() - t0:.0f} s)")
    tot = agrupar(res)
    for i, a in enumerate(tot):
        if a["n"]:
            print(f"  {etiqueta_mapa(i)}: llegan {a['n']:,} · superan {pct(sup_et(a))} · héroes vivos {pct(a['vivos'] / a['heroes'])}")
    print(f"  Completan los 4 mapas (media de equipos): {pct(actual['completa'])}")
    sv_eq = [sv_equipo(et) for et in res]
    for k in sorted(range(len(comps)), key=lambda k: (-completa(res[k]), -sv_eq[k]))[:5]:
        print(f"  top  completa {pct(completa(res[k]))}  superv. {pct(sv_eq[k])}  {etiqueta_comp(comps[k])}")

if __name__ == "__main__":
    main()
