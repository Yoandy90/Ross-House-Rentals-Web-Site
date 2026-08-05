"""
Utility functions for Ross Tax / Ross Lending Platform
Extracted from server.py — Date formatting, common helpers.
"""
from datetime import datetime

# ================== SPANISH DATE FORMATTING ==================

MESES_ES = {
    1: 'enero', 2: 'febrero', 3: 'marzo', 4: 'abril',
    5: 'mayo', 6: 'junio', 7: 'julio', 8: 'agosto',
    9: 'septiembre', 10: 'octubre', 11: 'noviembre', 12: 'diciembre'
}


def format_date_spanish(dt: datetime, include_year: bool = True) -> str:
    """Format datetime to Spanish format: '12 de marzo del 2026'"""
    if not dt:
        return ''
    day = dt.day
    month = MESES_ES.get(dt.month, '')
    year = dt.year
    if include_year:
        return f"{day} de {month} del {year}"
    return f"{day} de {month}"


def format_date_spanish_short(dt: datetime) -> str:
    """Format datetime to Spanish short format: '12 de marzo, 2026'"""
    if not dt:
        return ''
    day = dt.day
    month = MESES_ES.get(dt.month, '')
    year = dt.year
    return f"{day} de {month}, {year}"
