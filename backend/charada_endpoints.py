"""
Endpoints para La Charada China y Libro de Sueños
"""

from fastapi import APIRouter, HTTPException
from charada_china import get_numero_info, buscar_por_sueno, get_all_numeros, CHARADA_CHINA

router = APIRouter()

@router.get('/charada')
async def get_charada_completa():
    """Obtener la charada china completa con todos los números"""
    try:
        numeros = get_all_numeros()
        return {
            "charada": numeros,
            "total": len(numeros),
            "descripcion": "La Charada China - 100 números tradicionales"
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get('/charada/{numero}')
async def get_numero_charada(numero: int):
    """Obtener información de un número específico"""
    if numero < 0 or numero > 99:
        raise HTTPException(status_code=400, detail="Número debe estar entre 0 y 99")
    
    info = get_numero_info(numero)
    if not info:
        raise HTTPException(status_code=404, detail="Número no encontrado")
    
    return info


@router.get('/libro-suenos/buscar')
async def buscar_sueno(palabra: str):
    """Buscar números relacionados con una palabra de sueño"""
    if not palabra or len(palabra) < 2:
        raise HTTPException(status_code=400, detail="Palabra debe tener al menos 2 caracteres")
    
    numeros = buscar_por_sueno(palabra)
    
    if not numeros:
        return {
            "palabra": palabra,
            "numeros": [],
            "mensaje": "No se encontraron números para esta palabra"
        }
    
    # Obtener info completa de cada número
    numeros_info = []
    for num in numeros:
        info = get_numero_info(num)
        if info:
            numeros_info.append(info)
    
    return {
        "palabra": palabra,
        "numeros": numeros_info,
        "total": len(numeros_info)
    }


@router.get('/libro-suenos/palabras')
async def get_palabras_suenos():
    """Obtener todas las palabras disponibles en el libro de sueños"""
    from charada_china import LIBRO_SUENOS
    
    palabras = sorted(LIBRO_SUENOS.keys())
    
    return {
        "palabras": palabras,
        "total": len(palabras),
        "descripcion": "Palabras disponibles para interpretar tus sueños"
    }


@router.get('/guia-bolita')
async def get_guia_bolita():
    """Obtener la guía completa de cómo jugar La Bolita Cubana"""
    return {
        "titulo": "La Bolita Cubana - Guía Completa",
        "historia": {
            "origen": "La Bolita es un juego tradicional cubano con raíces en la lotería china que llegó a Cuba en el siglo XIX con los inmigrantes chinos.",
            "tradicion": "Los jugadores eligen números basados en sus sueños, usando La Charada China como guía de interpretación.",
            "popularidad": "Es uno de los juegos más populares en la cultura cubana, presente en todas las comunidades."
        },
        "como_jugar": {
            "paso1": "Elige un número del 0 al 99",
            "paso2": "Consulta La Charada China para ver qué animal representa tu número",
            "paso3": "O usa el Libro de Sueños para interpretar tus sueños y encontrar tu número",
            "paso4": "Haz tu apuesta pagando con créditos",
            "paso5": "Espera el sorteo diario a las 8:00 PM",
            "paso6": "Si tu número sale, ¡ganas el premio!"
        },
        "tipos_apuesta": {
            "fijo": {
                "nombre": "Fijo",
                "descripcion": "Apuestas a un número exacto",
                "pago": "Si sale tu número, ganas el premio completo",
                "costo": "1 crédito"
            },
            "corrido": {
                "nombre": "Corrido",
                "descripcion": "Apuestas a varios números a la vez",
                "pago": "Si sale cualquiera de tus números, ganas",
                "costo": "1 crédito por número"
            },
            "parley": {
                "nombre": "Parley",
                "descripcion": "Combinas dos números (ejemplo: 12 y 21)",
                "pago": "Si sale cualquiera de los dos, ganas más",
                "costo": "2 créditos"
            }
        },
        "consejos": [
            "Los cubanos suelen jugar números de sus sueños",
            "Usa La Charada para interpretar símbolos",
            "El número 8 (Muerto) es muy jugado",
            "Muchos juegan fechas importantes (cumpleaños)",
            "Los números de santos también son populares"
        ],
        "charada": "Consulta La Charada China completa en /api/charada",
        "libro_suenos": "Busca interpretaciones en /api/libro-suenos/buscar?palabra=tu_sueno"
    }
