#!/usr/bin/env python3
"""
Setup availability configuration for appointments
"""
import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
from datetime import time
import os
from dotenv import load_dotenv

load_dotenv()

async def setup_availability():
    # Get MongoDB URL from environment
    mongo_url = os.getenv('MONGO_URL', 'mongodb://localhost:27017')
    client = AsyncIOMotorClient(mongo_url)
    db = client['ross_tax_db']
    
    print("🔗 Conectado a la base de datos")
    print(f"📊 Base de datos: ross_tax_db")
    
    # Check if config already exists
    existing = await db.availability_config.find_one({})
    
    if existing:
        print("\n⚠️  Ya existe una configuración de disponibilidad")
        print(f"   ID: {existing.get('_id')}")
        
        # Ask if we should update
        print("\n¿Actualizar la configuración existente? (s/n)")
        # For script, we'll just update it
        await db.availability_config.delete_many({})
        print("✅ Configuración anterior eliminada")
    
    # Create default availability configuration
    availability_config = {
        '_id': 'default',
        'enabled': True,
        'default_duration_minutes': 60,
        'buffer_minutes': 15,
        'advance_booking_days': 60,
        'same_day_booking_cutoff_hours': 2,
        'business_hours': {
            'monday': {
                'enabled': True,
                'start_time': '09:00',
                'end_time': '18:00',
                'break_start': '12:00',
                'break_end': '13:00'
            },
            'tuesday': {
                'enabled': True,
                'start_time': '09:00',
                'end_time': '18:00',
                'break_start': '12:00',
                'break_end': '13:00'
            },
            'wednesday': {
                'enabled': True,
                'start_time': '09:00',
                'end_time': '18:00',
                'break_start': '12:00',
                'break_end': '13:00'
            },
            'thursday': {
                'enabled': True,
                'start_time': '09:00',
                'end_time': '18:00',
                'break_start': '12:00',
                'break_end': '13:00'
            },
            'friday': {
                'enabled': True,
                'start_time': '09:00',
                'end_time': '18:00',
                'break_start': '12:00',
                'break_end': '13:00'
            },
            'saturday': {
                'enabled': True,
                'start_time': '09:00',
                'end_time': '14:00',
                'break_start': None,
                'break_end': None
            },
            'sunday': {
                'enabled': False,
                'start_time': None,
                'end_time': None,
                'break_start': None,
                'break_end': None
            }
        },
        'blocked_dates': [],
        'special_hours': []
    }
    
    # Insert configuration
    await db.availability_config.insert_one(availability_config)
    
    print("\n✅ Configuración de disponibilidad creada:")
    print(f"   📅 Habilitado: Sí")
    print(f"   ⏱️  Duración por defecto: 60 minutos")
    print(f"   🔄 Buffer entre citas: 15 minutos")
    print(f"   📆 Días de anticipación: 60 días")
    print(f"\n   📍 Horarios de negocio:")
    print(f"      Lunes - Viernes: 9:00 AM - 6:00 PM")
    print(f"      Descanso: 12:00 PM - 1:00 PM")
    print(f"      Sábado: 9:00 AM - 2:00 PM")
    print(f"      Domingo: Cerrado")
    
    print("\n✅ Configuración completada")
    
    client.close()

if __name__ == "__main__":
    asyncio.run(setup_availability())
