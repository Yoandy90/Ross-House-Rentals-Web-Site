"""
Lottery Game Guides - Rules and instructions for each lottery type
"""

LOTTERY_GUIDES = {
    'scratch_card': {
        'type': 'scratch_card',
        'title': 'Raspaditos - Juego Instantáneo',
        'description': '¡Raspa y gana al instante! Descubre si eres ganador inmediatamente al revelar tu boleto.',
        'how_to_play': [
            '1. Compra tu raspadito por el precio indicado en créditos',
            '2. Presiona "Revelar" para descubrir tu premio',
            '3. Si ganas, los créditos se acreditan automáticamente a tu cuenta',
            '4. Puedes comprar hasta el límite permitido por usuario',
        ],
        'prize_structure': {
            'Jackpot': 'Premio mayor - Gana créditos equivalentes al jackpot',
            '10x': 'Gana 10 veces tu apuesta',
            '5x': 'Gana 5 veces tu apuesta',
            '2x': 'Gana el doble de tu apuesta',
            'Sin Premio': 'Intenta de nuevo en el próximo raspadito',
        },
        'tips': [
            '💡 Es un juego de suerte instantáneo',
            '💡 Los premios son aleatorios pero justos',
            '💡 Juega responsablemente',
            '💡 Verifica tus créditos antes de jugar',
        ],
        'rules': [
            '• Resultado instantáneo al revelar',
            '• No hay fecha de sorteo',
            '• Premios limitados por disponibilidad',
            '• Una vez revelado, el resultado es final',
        ],
    },
    'bolita': {
        'type': 'bolita',
        'title': 'La Bolita Cubana',
        'description': 'El juego tradicional cubano. Elige tu número de la suerte del 0 al 99 y espera el sorteo.',
        'how_to_play': [
            '1. Elige UN número entre 0 y 99',
            '2. Confirma tu apuesta (precio en créditos)',
            '3. Espera el sorteo en la fecha programada',
            '4. Si tu número sale, ¡GANAS!',
            '5. Revisa los resultados después del sorteo',
        ],
        'prize_structure': {
            'Fijo': 'Tu número exacto sale sorteado - Premio completo',
            'Bolita Ganadora': 'El número que salió en el sorteo oficial',
        },
        'tips': [
            '💡 Algunos números son más populares (7, 11, 21)',
            '💡 Los números de fechas importantes son comunes',
            '💡 Elige el número que te haga sentir afortunado',
            '💡 Puedes jugar el mismo número varias veces',
        ],
        'rules': [
            '• Solo se elige 1 número por boleto',
            '• Números del 0 al 99 (100 opciones)',
            '• Sorteo en fecha/hora específica',
            '• Ganas si tu número coincide exactamente',
            '• Puede haber múltiples ganadores',
        ],
        'history': '🇨🇺 La Bolita es un juego tradicional cubano con más de 100 años de historia. Es parte de la cultura popular y se juega en toda Cuba.',
    },
    'traditional': {
        'type': 'traditional',
        'title': 'Lotería Tradicional',
        'description': 'Elige 6 números del 1 al 49 y gana según la cantidad de aciertos.',
        'how_to_play': [
            '1. Selecciona 6 números diferentes del 1 al 49',
            '2. Confirma tu selección y paga con créditos',
            '3. Espera el sorteo en la fecha programada',
            '4. Se sortean 6 números ganadores',
            '5. Ganas según cuántos números acertaste',
        ],
        'prize_structure': {
            '6 aciertos': '🏆 Premio Máximo - 100% del premio',
            '5 aciertos': '🥈 30% del premio',
            '4 aciertos': '🥉 10% del premio',
            '3 aciertos': '🎁 Premio consuelo - 10 créditos',
        },
        'tips': [
            '💡 Usa una mezcla de números altos y bajos',
            '💡 Evita patrones obvios (1,2,3,4,5,6)',
            '💡 Los números se sortean aleatoriamente',
            '💡 Puedes ganar con solo 3 aciertos',
        ],
        'rules': [
            '• Debes elegir exactamente 6 números',
            '• No se permiten números repetidos',
            '• Números válidos: 1 al 49',
            '• Múltiples ganadores comparten premios',
            '• Mínimo 3 aciertos para premio',
        ],
    },
}

def get_lottery_guide(lottery_type: str) -> dict:
    """Get game guide for a specific lottery type"""
    return LOTTERY_GUIDES.get(lottery_type, LOTTERY_GUIDES['traditional'])

def get_all_guides() -> list:
    """Get all lottery game guides"""
    return list(LOTTERY_GUIDES.values())
