"""
La Charada Cubana - 99 números con sus múltiples significados tradicionales
Actualizada con la versión completa de la charada cubana
"""

CHARADA_CHINA = {
    1: {"nombre": "El caballo", "significados": ["sol", "tintero", "camello", "pescado chico"], "emoji": "🐴"},
    2: {"nombre": "La mariposa", "significados": ["hombre", "cafetera", "caracol"], "emoji": "🦋"},
    3: {"nombre": "El marinero", "significados": ["luna", "taza", "ciempiés", "muerto"], "emoji": "⚓"},
    4: {"nombre": "El gato", "significados": ["boca", "soldado", "llave", "vela", "militar"], "emoji": "🐱"},
    5: {"nombre": "La monja", "significados": ["mar", "candado", "periódico", "fruta", "lombriz"], "emoji": "👼"},
    6: {"nombre": "La jicotea", "significados": ["carta", "reverbero", "botella"], "emoji": "🐢"},
    7: {"nombre": "El caracol", "significados": ["sueño", "mierda", "medias", "caballero"], "emoji": "🐌"},
    8: {"nombre": "El muerto", "significados": ["león", "calabaza", "mesa"], "emoji": "💀"},
    9: {"nombre": "El elefante", "significados": ["entierro", "lira", "cubo", "esqueleto", "buey"], "emoji": "🐘"},
    10: {"nombre": "El pescado grande", "significados": ["paseo", "malla", "cazuela", "dinero", "lancha"], "emoji": "🐟"},
    11: {"nombre": "El gallo", "significados": ["lluvia", "fósforo", "taller", "fábrica"], "emoji": "🐓"},
    12: {"nombre": "La mujer mala", "significados": ["viaje", "toallas", "cometa", "perro grande"], "emoji": "💃"},
    13: {"nombre": "El pavo real", "significados": ["niño", "anafe", "chulo"], "emoji": "🦚"},
    14: {"nombre": "El gato tigre", "significados": ["matrimonio", "sartén y cementerio"], "emoji": "🐈‍⬛"},
    15: {"nombre": "El perro", "significados": ["visita", "cuchara"], "emoji": "🐕"},
    16: {"nombre": "El toro", "significados": ["plancha", "vestido", "incendio", "funerales", "avispa"], "emoji": "🐂"},
    17: {"nombre": "La luna", "significados": ["mujer buena", "hule", "camisón", "armas", "opio"], "emoji": "🌙"},
    18: {"nombre": "El pescado chiquito", "significados": ["la iglesia", "sirena", "palma", "gato amarillo"], "emoji": "🐠"},
    19: {"nombre": "La lombriz", "significados": ["campesino", "tropa", "mesa grande", "armadura"], "emoji": "🪱"},
    20: {"nombre": "El gato fino", "significados": ["cañón", "camiseta", "tibor", "libro", "mujer"], "emoji": "🐱"},
    21: {"nombre": "El maiá", "significados": ["reloj de bolsillo", "cotorra"], "emoji": "🦚"},
    22: {"nombre": "El sapo", "significados": ["estrella", "chimenea"], "emoji": "🐸"},
    23: {"nombre": "El vapor", "significados": ["submarino", "escalera", "barco", "águila"], "emoji": "🚢"},
    24: {"nombre": "La paloma", "significados": ["música", "carpintero", "cocina"], "emoji": "🕊️"},
    25: {"nombre": "La piedra fina", "significados": ["casa", "sol"], "emoji": "💎"},
    26: {"nombre": "La anguila", "significados": ["calle", "médico"], "emoji": "🐍"},
    27: {"nombre": "La avispa", "significados": ["campana", "cuchara grande", "canario"], "emoji": "🐝"},
    28: {"nombre": "El chivo", "significados": ["bandera", "político", "uvas", "perro chico"], "emoji": "🐐"},
    29: {"nombre": "El ratón", "significados": ["nube", "venado"], "emoji": "🐭"},
    30: {"nombre": "El camarón", "significados": ["arco iris", "almanaque", "buey", "cangrejo"], "emoji": "🦐"},
    31: {"nombre": "El venado", "significados": ["escuela", "zapatos"], "emoji": "🦌"},
    32: {"nombre": "El cochino", "significados": ["enemigo", "mulo", "demonio"], "emoji": "🐖"},
    33: {"nombre": "La tiñosa", "significados": ["baraja", "santa", "Jesucristo", "bofetón"], "emoji": "🦅"},
    34: {"nombre": "El mono", "significados": ["familia", "negro", "capataz"], "emoji": "🐵"},
    35: {"nombre": "La araña", "significados": ["novia", "bombillos", "mosquito"], "emoji": "🕷️"},
    36: {"nombre": "La cachimba", "significados": ["teatro", "bodega", "coloso"], "emoji": "🎭"},
    37: {"nombre": "La gallina prieta", "significados": ["gitana", "hormiga", "carretera"], "emoji": "🐔"},
    38: {"nombre": "El dinero", "significados": ["carro", "goleta", "guantes", "barril"], "emoji": "💰"},
    39: {"nombre": "El conejo", "significados": ["culebra", "rayo", "baile", "tintorero"], "emoji": "🐰"},
    40: {"nombre": "El cura", "significados": ["sangre", "bombero", "cantina", "estatua"], "emoji": "👨‍⚕️"},
    41: {"nombre": "La lagartija", "significados": ["prisión", "pato chico", "jubo", "capuchino"], "emoji": "🦎"},
    42: {"nombre": "El pato", "significados": ["país lejano", "carnero", "abismo"], "emoji": "🦆"},
    43: {"nombre": "El alacrán", "significados": ["amigo", "vaca", "puerta", "presidiario y jorobado"], "emoji": "🦂"},
    44: {"nombre": "Año del cuero", "significados": ["infierno", "año malo", "temporal", "tormenta"], "emoji": "📅"},
    45: {"nombre": "El tiburón", "significados": ["presidente", "traje", "tranvía", "estrella"], "emoji": "🦈"},
    46: {"nombre": "La guagua", "significados": ["humo", "hambre", "hurón", "baile", "chino"], "emoji": "🚌"},
    47: {"nombre": "El pájaro", "significados": ["mala noticia", "mucha sangre", "escolta", "rosa"], "emoji": "🐦"},
    48: {"nombre": "La cucaracha", "significados": ["abanico", "barbería", "cubo"], "emoji": "🪳"},
    49: {"nombre": "El borracho", "significados": ["riqueza", "figurín", "percha", "tesoro", "fantasma"], "emoji": "🍺"},
    50: {"nombre": "El policía", "significados": ["alegría", "florero", "alcalde", "pícaro", "árbol"], "emoji": "👮"},
    51: {"nombre": "El soldado", "significados": ["sereno", "anteojos", "sed", "oro", "presillas"], "emoji": "🪖"},
    52: {"nombre": "La bicicleta", "significados": ["coche", "abogado", "libreta"], "emoji": "🚲"},
    53: {"nombre": "La luz eléctrica", "significados": ["prenda", "tragedia", "diamante", "beso", "alguacil"], "emoji": "💡"},
    54: {"nombre": "Flores", "significados": ["gallina blanca", "sueño", "timbre", "cañón"], "emoji": "🌸"},
    55: {"nombre": "El cangrejo", "significados": ["los Isleños", "caerse", "sellos"], "emoji": "🦀"},
    56: {"nombre": "La reina", "significados": ["merengue", "piedra"], "emoji": "👸"},
    57: {"nombre": "La cama", "significados": ["ángeles", "telegrama", "puerta"], "emoji": "🛏️"},
    58: {"nombre": "Un adulterio", "significados": ["retrato", "cuchillo", "ferretero"], "emoji": "💔"},
    59: {"nombre": "El loco", "significados": ["langosta", "anillo"], "emoji": "🤪"},
    60: {"nombre": "Sol Oscuro", "significados": ["payaso", "cósmico"], "emoji": "🌑"},
    61: {"nombre": "El cañonazo", "significados": ["revolver", "boticario"], "emoji": "💥"},
    62: {"nombre": "El matrimonio", "significados": ["nieve", "lámpara", "visión", "academia", "carretilla"], "emoji": "💍"},
    63: {"nombre": "El asesino", "significados": ["cuernos", "espada", "bandidos"], "emoji": "🔪"},
    64: {"nombre": "Un muerto grande", "significados": ["tiro de rifle", "maromero", "relajo"], "emoji": "⚰️"},
    65: {"nombre": "La cárcel", "significados": ["comida", "bruja", "ventana", "trueno"], "emoji": "🔒"},
    66: {"nombre": "El divorcio", "significados": ["los tarros", "la máscara", "el carnaval"], "emoji": "📄"},
    67: {"nombre": "La puñalada", "significados": ["autoridad", "fonda", "aborto", "zapato"], "emoji": "🗡️"},
    68: {"nombre": "Cementerio Grande", "significados": ["globo", "cuchillo grande", "templo", "bolos"], "emoji": "⚰️"},
    69: {"nombre": "El pozo", "significados": ["fiera", "la loma", "vagos", "polvorín"], "emoji": "🕳️"},
    70: {"nombre": "El teléfono", "significados": ["coco", "tiro", "barril", "bala"], "emoji": "📞"},
    71: {"nombre": "Río", "significados": ["sombrero", "perro mediano", "pantera y fusil"], "emoji": "🌊"},
    72: {"nombre": "El ferrocarril", "significados": ["buey viejo", "serrucho", "collar", "cetro", "relámpago"], "emoji": "🚂"},
    73: {"nombre": "Un parque", "significados": ["navaja", "manzanas", "maleta", "ajedrez", "cigarrillo"], "emoji": "🏞️"},
    74: {"nombre": "El papalote", "significados": ["coronel", "serpiente", "cólera", "tarima"], "emoji": "🪁"},
    75: {"nombre": "El cine", "significados": ["corbata", "viento", "guitarra"], "emoji": "🎬"},
    76: {"nombre": "La bailarina", "significados": ["el humo en cantidad", "la caja de hierro", "violín"], "emoji": "💃"},
    77: {"nombre": "Banderas", "significados": ["guerra", "colegio", "billetes de banco", "ánfora"], "emoji": "🚩"},
    78: {"nombre": "El obispo", "significados": ["sarcófago", "rey", "apetito", "lunares"], "emoji": "⛪"},
    79: {"nombre": "Coche de tren", "significados": ["dulces"], "emoji": "🚃"},
    80: {"nombre": "El médico", "significados": ["la buena noticia", "la luna llena", "paraguas", "barba", "trompo"], "emoji": "👨‍⚕️"},
    81: {"nombre": "El teatro", "significados": ["ingeniero", "cuerda", "actriz"], "emoji": "🎭"},
    82: {"nombre": "La madre", "significados": ["la batea", "pleito", "muelle"], "emoji": "👩"},
    83: {"nombre": "La tragedia", "significados": ["la procesión", "el limosnero", "el bastón", "la madera"], "emoji": "🎭"},
    84: {"nombre": "El ciego", "significados": ["sastre", "bohío", "banquero", "cofre", "la marcha atrás"], "emoji": "🦯"},
    85: {"nombre": "El reloj", "significados": ["espejo", "guano"], "emoji": "⏰"},
    86: {"nombre": "El convento", "significados": ["tijera", "desnudar", "manguera"], "emoji": "⛪"},
    87: {"nombre": "El baúl", "significados": ["fuego", "plátanos"], "emoji": "🧳"},
    88: {"nombre": "Los espejuelos", "significados": ["gusano", "vaso", "hojas"], "emoji": "👓"},
    89: {"nombre": "La lotería", "significados": ["agua", "la monja vieja", "melón"], "emoji": "🎰"},
    90: {"nombre": "El viejo", "significados": ["el espejo grande", "el caramelo"], "emoji": "👴"},
    91: {"nombre": "El tranvía", "significados": ["pájaro negro", "bolchevique"], "emoji": "🚋"},
    92: {"nombre": "Globo muy alto", "significados": ["suicidio", "Cuba"], "emoji": "🎈"},
    93: {"nombre": "Revolución", "significados": ["sortija", "general", "joyas", "libertad"], "emoji": "✊"},
    94: {"nombre": "El machete", "significados": ["la mariposa grande", "leontina"], "emoji": "🔪"},
    95: {"nombre": "La guerra", "significados": ["alacrán"], "emoji": "⚔️"},
    96: {"nombre": "El desafío", "significados": ["periódico", "pícaro", "zapatos nuevos"], "emoji": "🤺"},
    97: {"nombre": "El mosquito", "significados": ["mono grande", "sinsonte", "grillo grande"], "emoji": "🦟"},
    98: {"nombre": "El piano", "significados": ["entierro grande", "santo"], "emoji": "🎹"},
    99: {"nombre": "El serrucho", "significados": ["carbonero", "lluvia"], "emoji": "🪚"},
}

# Libro de sueños - interpretación tradicional
LIBRO_SUENOS = {
    "agua": [10, 18, 30],
    "muerte": [8, 64, 68],
    "dinero": [71, 88],
    "casa": [84],
    "caballo": [1, 34, 61],
    "perro": [15],
    "gato": [4, 14],
    "mujer": [12, 54, 78],
    "hombre": [51, 90],
    "niño": [74, 99],
    "policía": [50],
    "comida": [65],
    "boda": [62],
    "pelea": [82],
    "viaje": [53, 79],
    "sangre": [63],
    "fuego": [46, 60],
    "luna": [17],
    "mar": [10, 53],
    "pájaro": [13, 24, 47],
    "serpiente": [59, 76],
    "hospital": [66, 80],
    "iglesia": [84],
    "cementerio": [68],
    "sol": [46, 60],
    "lluvia": [83],
    "borracho": [49],
    "soldado": [51],
    "médico": [66, 80],
    "santo": [73],
    "fantasma": [85],
    "animal": [1, 4, 9, 15, 16, 20, 21],
}

def get_numero_info(numero: int) -> dict:
    """Obtener información de un número de la charada"""
    if numero in CHARADA_CHINA:
        return {
            "numero": numero,
            **CHARADA_CHINA[numero]
        }
    return None

def buscar_por_sueno(palabra: str) -> list:
    """Buscar números relacionados con una palabra de sueño o por número directo"""
    palabra_lower = palabra.lower().strip()
    
    # Si es un número, buscar ese número específico en la charada
    if palabra_lower.isdigit():
        numero = int(palabra_lower)
        if numero in CHARADA_CHINA:
            return [numero]
        else:
            return []
    
    # Buscar en el libro de sueños tradicional
    if palabra_lower in LIBRO_SUENOS:
        return LIBRO_SUENOS[palabra_lower]
    
    # Buscar en nombres y significados de la charada
    resultados = []
    for num, info in CHARADA_CHINA.items():
        # Buscar en el nombre principal
        if palabra_lower in info["nombre"].lower():
            resultados.append(num)
            continue
        
        # Buscar en los significados múltiples
        if "significados" in info:
            for significado in info["significados"]:
                if palabra_lower in significado.lower():
                    resultados.append(num)
                    break
    
    return resultados

def get_all_numeros() -> list:
    """Obtener todos los números de la charada"""
    return [
        {
            "numero": num,
            "nombre": info["nombre"],
            "emoji": info["emoji"]
        }
        for num, info in sorted(CHARADA_CHINA.items())
    ]
