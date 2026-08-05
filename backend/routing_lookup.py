"""
Routing Number Lookup Service
Consulta información de bancos por número de ruta ABA
"""

import os
import httpx
from typing import Optional, Dict, Any
from datetime import datetime

# Cache para evitar consultas repetidas
routing_cache: Dict[str, Dict[str, Any]] = {}

# Base de datos local de los bancos más comunes (fallback)
COMMON_BANKS = {
    "021000021": {"name": "JPMorgan Chase Bank", "city": "New York", "state": "NY"},
    "026009593": {"name": "Bank of America", "city": "Richmond", "state": "VA"},
    "021000089": {"name": "Citibank", "city": "New York", "state": "NY"},
    "071000013": {"name": "JPMorgan Chase (Illinois)", "city": "Chicago", "state": "IL"},
    "091000019": {"name": "Wells Fargo Bank", "city": "Minneapolis", "state": "MN"},
    "121000248": {"name": "Wells Fargo Bank (California)", "city": "San Francisco", "state": "CA"},
    "111000025": {"name": "Bank of America (Texas)", "city": "Dallas", "state": "TX"},
    "061000052": {"name": "Bank of America (Georgia)", "city": "Atlanta", "state": "GA"},
    "122105155": {"name": "US Bank", "city": "Los Angeles", "state": "CA"},
    "091101011": {"name": "Bremer Bank", "city": "St. Paul", "state": "MN"},
    "091000022": {"name": "US Bank (Minnesota)", "city": "Minneapolis", "state": "MN"},
    "091408501": {"name": "Frandsen Bank & Trust", "city": "Lonsdale", "state": "MN"},
    "091300010": {"name": "Western National Bank", "city": "Phoenix", "state": "AZ"},
    "011000138": {"name": "Citizens Bank", "city": "Providence", "state": "RI"},
    "011401533": {"name": "TD Bank", "city": "Lewiston", "state": "ME"},
    "031101279": {"name": "PNC Bank", "city": "Pittsburgh", "state": "PA"},
    "021202337": {"name": "TD Bank (New York)", "city": "New York", "state": "NY"},
    "044000037": {"name": "Huntington Bank", "city": "Columbus", "state": "OH"},
    "053000196": {"name": "Wells Fargo (North Carolina)", "city": "Charlotte", "state": "NC"},
    "063107513": {"name": "Regions Bank", "city": "Birmingham", "state": "AL"},
    "071000288": {"name": "Harris Bank", "city": "Chicago", "state": "IL"},
    "081000032": {"name": "US Bank (Missouri)", "city": "St. Louis", "state": "MO"},
    "101000019": {"name": "UMB Bank", "city": "Kansas City", "state": "MO"},
    "111900659": {"name": "Frost Bank", "city": "San Antonio", "state": "TX"},
    "113010547": {"name": "Capital One (Texas)", "city": "Houston", "state": "TX"},
    "122000247": {"name": "Bank of the West", "city": "San Francisco", "state": "CA"},
    "322271627": {"name": "Navy Federal Credit Union", "city": "Vienna", "state": "VA"},
}

async def lookup_routing_number(routing: str) -> Dict[str, Any]:
    """
    Busca información del banco por routing number
    """
    
    # Limpiar el routing
    routing = routing.strip().replace(" ", "").replace("-", "")
    
    # Validar formato básico
    if not routing.isdigit() or len(routing) != 9:
        return {
            "success": False,
            "error": "El routing number debe tener exactamente 9 dígitos",
            "routing": routing
        }
    
    # Verificar cache
    if routing in routing_cache:
        cached = routing_cache[routing]
        cached["from_cache"] = True
        return cached
    
    # Validar checksum ABA
    digits = [int(d) for d in routing]
    checksum = (
        3 * (digits[0] + digits[3] + digits[6]) +
        7 * (digits[1] + digits[4] + digits[7]) +
        (digits[2] + digits[5] + digits[8])
    ) % 10
    
    if checksum != 0:
        return {
            "success": False,
            "error": "Routing number inválido (checksum ABA incorrecto)",
            "routing": routing,
            "checksum_valid": False
        }
    
    # Primero buscar en la base de datos local
    if routing in COMMON_BANKS:
        bank = COMMON_BANKS[routing]
        result = {
            "success": True,
            "routing": routing,
            "checksum_valid": True,
            "bank_name": bank["name"],
            "city": bank["city"],
            "state": bank["state"],
            "from_cache": False,
            "source": "local_database",
            "queried_at": datetime.utcnow().isoformat()
        }
        routing_cache[routing] = result
        return result
    
    # Si no está en la base local, intentar API externa
    try:
        async with httpx.AsyncClient(timeout=10.0, follow_redirects=True) as client:
            # Intentar con una API alternativa
            response = await client.get(
                f"https://www.routingnumbers.info/api/data.json?rn={routing}",
                headers={"User-Agent": "Mozilla/5.0"}
            )
            
            if response.status_code == 200:
                data = response.json()
                
                if data.get("message") == "OK":
                    result = {
                        "success": True,
                        "routing": routing,
                        "checksum_valid": True,
                        "bank_name": data.get("customer_name", "Desconocido"),
                        "address": data.get("address", ""),
                        "city": data.get("city", ""),
                        "state": data.get("state", ""),
                        "zip": data.get("zip", ""),
                        "phone": data.get("telephone", ""),
                        "from_cache": False,
                        "source": "api",
                        "queried_at": datetime.utcnow().isoformat()
                    }
                    routing_cache[routing] = result
                    return result
    except Exception as e:
        pass  # Fallback to checksum-only validation
    
    # Si no encontramos el banco pero el checksum es válido
    return {
        "success": True,
        "routing": routing,
        "checksum_valid": True,
        "bank_name": "Banco no identificado (checksum válido)",
        "city": "",
        "state": "",
        "from_cache": False,
        "source": "checksum_only",
        "note": "El routing tiene checksum ABA válido pero no está en nuestra base de datos",
        "queried_at": datetime.utcnow().isoformat()
    }


async def validate_routing_with_bank(routing: str) -> Dict[str, Any]:
    """
    Valida un routing number y devuelve información del banco
    """
    result = await lookup_routing_number(routing)
    
    if result.get("success"):
        return {
            "valid": True,
            "routing": routing,
            "bank_name": result.get("bank_name"),
            "bank_location": f"{result.get('city', '')}, {result.get('state', '')}".strip(", "),
            "checksum_valid": True
        }
    else:
        return {
            "valid": result.get("checksum_valid", False),
            "routing": routing,
            "bank_name": None,
            "error": result.get("error")
        }
