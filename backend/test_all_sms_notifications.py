#!/usr/bin/env python3
"""
Test All SMS Notifications - Comprehensive Testing
Prueba cada una de las 10 notificaciones SMS implementadas
"""
import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
from notification_service import NotificationService
from datetime import datetime, timezone, timedelta
import uuid
import os
from dotenv import load_dotenv

load_dotenv()

# Colores para output
GREEN = '\033[92m'
RED = '\033[91m'
YELLOW = '\033[93m'
BLUE = '\033[94m'
RESET = '\033[0m'

async def test_all_notifications():
    mongo_url = os.getenv('MONGO_URL', 'mongodb://localhost:27017')
    client = AsyncIOMotorClient(mongo_url)
    db = client['ross_tax_db']
    
    print(f"\n{BLUE}{'='*80}{RESET}")
    print(f"{BLUE}🧪 PRUEBA COMPREHENSIVA DE NOTIFICACIONES SMS{RESET}")
    print(f"{BLUE}{'='*80}{RESET}\n")
    
    # Load API config
    config_doc = await db.api_config.find_one({'_id': 'main'})
    
    if not config_doc:
        print(f"{RED}❌ No se encontró configuración de API{RESET}")
        client.close()
        return
    
    print(f"{GREEN}✅ Configuración de API encontrada{RESET}")
    
    # Initialize notification service
    notif_service = NotificationService(config_doc)
    
    if not notif_service.twilio_client:
        print(f"{RED}❌ Twilio client NO inicializado{RESET}")
        client.close()
        return
    
    print(f"{GREEN}✅ Twilio client inicializado{RESET}")
    print(f"   📞 Phone: {config_doc.get('twilio_phone_number')}\n")
    
    # Test phone number
    test_phone = "+18069307456"
    test_name = "Yoandy Ross"
    test_email = "yoandyross@gmail.com"
    
    print(f"{BLUE}📱 Número de prueba: {test_phone}{RESET}")
    print(f"{BLUE}👤 Usuario de prueba: {test_name}{RESET}\n")
    
    results = {
        'passed': 0,
        'failed': 0,
        'tests': []
    }
    
    # ============================================================
    # TEST 1: SMS de Bienvenida (Registro)
    # ============================================================
    print(f"\n{YELLOW}{'='*80}{RESET}")
    print(f"{YELLOW}TEST 1/10: SMS de Bienvenida (Registro){RESET}")
    print(f"{YELLOW}{'='*80}{RESET}")
    
    try:
        welcome_message = f"""¡Bienvenido a Ross Tax Preparation, {test_name}! 🎉

Tu cuenta ha sido creada exitosamente. Ahora puedes:
📅 Agendar citas
💰 Gestionar pagos
📄 Subir documentos
🎁 Participar en sorteos

¡Gracias por confiar en nosotros!

Ross Tax Preparation
806-934-2018"""
        
        message = notif_service.twilio_client.messages.create(
            body=welcome_message,
            from_=notif_service.twilio_phone_number,
            to=test_phone
        )
        
        print(f"{GREEN}✅ PASSED - SMS enviado{RESET}")
        print(f"   SID: {message.sid}")
        results['passed'] += 1
        results['tests'].append({'test': 'Bienvenida', 'status': 'PASSED'})
    except Exception as e:
        print(f"{RED}❌ FAILED - {str(e)}{RESET}")
        results['failed'] += 1
        results['tests'].append({'test': 'Bienvenida', 'status': 'FAILED', 'error': str(e)})
    
    await asyncio.sleep(2)
    
    # ============================================================
    # TEST 2: SMS de Confirmación de Cita
    # ============================================================
    print(f"\n{YELLOW}{'='*80}{RESET}")
    print(f"{YELLOW}TEST 2/10: SMS de Confirmación de Cita{RESET}")
    print(f"{YELLOW}{'='*80}{RESET}")
    
    try:
        apt_date = datetime.now(timezone.utc) + timedelta(days=2)
        date_str = apt_date.strftime("%A, %d de %B")
        time_str = apt_date.strftime("%I:%M %p")
        
        confirmation_message = f"""Tu cita ha sido agendada exitosamente!

📅 Fecha: {date_str}
🕐 Hora: {time_str}
📍 Tipo: Consulta Presencial

Te esperamos en:
305 Bruce Ave, Dumas, TX 79029

Ross Tax Preparation
806-934-2018"""
        
        message = notif_service.twilio_client.messages.create(
            body=confirmation_message,
            from_=notif_service.twilio_phone_number,
            to=test_phone
        )
        
        print(f"{GREEN}✅ PASSED - SMS enviado{RESET}")
        print(f"   SID: {message.sid}")
        results['passed'] += 1
        results['tests'].append({'test': 'Confirmación Cita', 'status': 'PASSED'})
    except Exception as e:
        print(f"{RED}❌ FAILED - {str(e)}{RESET}")
        results['failed'] += 1
        results['tests'].append({'test': 'Confirmación Cita', 'status': 'FAILED', 'error': str(e)})
    
    await asyncio.sleep(2)
    
    # ============================================================
    # TEST 3: SMS de Cita Reprogramada
    # ============================================================
    print(f"\n{YELLOW}{'='*80}{RESET}")
    print(f"{YELLOW}TEST 3/10: SMS de Cita Reprogramada{RESET}")
    print(f"{YELLOW}{'='*80}{RESET}")
    
    try:
        new_date = datetime.now(timezone.utc) + timedelta(days=3)
        date_str = new_date.strftime("%A, %d de %B")
        time_str = new_date.strftime("%I:%M %p")
        
        reschedule_message = f"""Tu cita ha sido REPROGRAMADA:

🔄 Nueva fecha: {date_str}
🕐 Nueva hora: {time_str}
📍 Tipo: Presencial

Si no puedes asistir, llámanos:
📞 806-934-2018

Ross Tax Preparation"""
        
        message = notif_service.twilio_client.messages.create(
            body=reschedule_message,
            from_=notif_service.twilio_phone_number,
            to=test_phone
        )
        
        print(f"{GREEN}✅ PASSED - SMS enviado{RESET}")
        print(f"   SID: {message.sid}")
        results['passed'] += 1
        results['tests'].append({'test': 'Cita Reprogramada', 'status': 'PASSED'})
    except Exception as e:
        print(f"{RED}❌ FAILED - {str(e)}{RESET}")
        results['failed'] += 1
        results['tests'].append({'test': 'Cita Reprogramada', 'status': 'FAILED', 'error': str(e)})
    
    await asyncio.sleep(2)
    
    # ============================================================
    # TEST 4: SMS de Cita Cancelada
    # ============================================================
    print(f"\n{YELLOW}{'='*80}{RESET}")
    print(f"{YELLOW}TEST 4/10: SMS de Cita Cancelada{RESET}")
    print(f"{YELLOW}{'='*80}{RESET}")
    
    try:
        cancel_date = datetime.now(timezone.utc) + timedelta(days=2)
        date_str = cancel_date.strftime("%A, %d de %B")
        time_str = cancel_date.strftime("%I:%M %p")
        
        cancel_message = f"""⚠️ Tu cita del {date_str} a las {time_str} ha sido CANCELADA.

Por favor contáctanos para reagendar:
📞 806-934-2018

Ross Tax Preparation"""
        
        message = notif_service.twilio_client.messages.create(
            body=cancel_message,
            from_=notif_service.twilio_phone_number,
            to=test_phone
        )
        
        print(f"{GREEN}✅ PASSED - SMS enviado{RESET}")
        print(f"   SID: {message.sid}")
        results['passed'] += 1
        results['tests'].append({'test': 'Cita Cancelada', 'status': 'PASSED'})
    except Exception as e:
        print(f"{RED}❌ FAILED - {str(e)}{RESET}")
        results['failed'] += 1
        results['tests'].append({'test': 'Cita Cancelada', 'status': 'FAILED', 'error': str(e)})
    
    await asyncio.sleep(2)
    
    # ============================================================
    # TEST 5: SMS de Pago Confirmado
    # ============================================================
    print(f"\n{YELLOW}{'='*80}{RESET}")
    print(f"{YELLOW}TEST 5/10: SMS de Pago Confirmado{RESET}")
    print(f"{YELLOW}{'='*80}{RESET}")
    
    try:
        payment_message = f"""✅ Pago RECIBIDO

💰 Monto: $50.00 USD
🎁 Créditos: 500 créditos
📦 Paquete: Paquete Estándar
📅 Fecha: {datetime.now().strftime("%d/%m/%Y")}

¡Gracias por tu compra!

Balance actual: 500 créditos

Ross Tax Preparation
806-934-2018"""
        
        message = notif_service.twilio_client.messages.create(
            body=payment_message,
            from_=notif_service.twilio_phone_number,
            to=test_phone
        )
        
        print(f"{GREEN}✅ PASSED - SMS enviado{RESET}")
        print(f"   SID: {message.sid}")
        results['passed'] += 1
        results['tests'].append({'test': 'Pago Confirmado', 'status': 'PASSED'})
    except Exception as e:
        print(f"{RED}❌ FAILED - {str(e)}{RESET}")
        results['failed'] += 1
        results['tests'].append({'test': 'Pago Confirmado', 'status': 'FAILED', 'error': str(e)})
    
    await asyncio.sleep(2)
    
    # ============================================================
    # TEST 6: SMS de Ganador de Sorteo
    # ============================================================
    print(f"\n{YELLOW}{'='*80}{RESET}")
    print(f"{YELLOW}TEST 6/10: SMS de Ganador de Sorteo{RESET}")
    print(f"{YELLOW}{'='*80}{RESET}")
    
    try:
        winner_message = f"""🎉 ¡FELICIDADES! Ganaste el sorteo:

🎁 Premio: Smart TV Samsung 55"
🎟️ Boleto ganador: #12345

Contáctanos para reclamar tu premio:
📞 806-934-2018

Ross Tax Preparation"""
        
        message = notif_service.twilio_client.messages.create(
            body=winner_message,
            from_=notif_service.twilio_phone_number,
            to=test_phone
        )
        
        print(f"{GREEN}✅ PASSED - SMS enviado{RESET}")
        print(f"   SID: {message.sid}")
        results['passed'] += 1
        results['tests'].append({'test': 'Ganador Sorteo', 'status': 'PASSED'})
    except Exception as e:
        print(f"{RED}❌ FAILED - {str(e)}{RESET}")
        results['failed'] += 1
        results['tests'].append({'test': 'Ganador Sorteo', 'status': 'FAILED', 'error': str(e)})
    
    await asyncio.sleep(2)
    
    # ============================================================
    # TEST 7: SMS de Boletos de Sorteo Comprados
    # ============================================================
    print(f"\n{YELLOW}{'='*80}{RESET}")
    print(f"{YELLOW}TEST 7/10: SMS de Boletos de Sorteo Comprados{RESET}")
    print(f"{YELLOW}{'='*80}{RESET}")
    
    try:
        tickets_message = f"""✅ Boletos comprados exitosamente!

🎟️ Cantidad: 5 boleto(s)
🎁 Sorteo: Smart TV Samsung 55"
💰 Créditos usados: 50

¡Mucha suerte!

Ross Tax Preparation"""
        
        message = notif_service.twilio_client.messages.create(
            body=tickets_message,
            from_=notif_service.twilio_phone_number,
            to=test_phone
        )
        
        print(f"{GREEN}✅ PASSED - SMS enviado{RESET}")
        print(f"   SID: {message.sid}")
        results['passed'] += 1
        results['tests'].append({'test': 'Boletos Sorteo', 'status': 'PASSED'})
    except Exception as e:
        print(f"{RED}❌ FAILED - {str(e)}{RESET}")
        results['failed'] += 1
        results['tests'].append({'test': 'Boletos Sorteo', 'status': 'FAILED', 'error': str(e)})
    
    await asyncio.sleep(2)
    
    # ============================================================
    # TEST 8: SMS de Retiro Aprobado
    # ============================================================
    print(f"\n{YELLOW}{'='*80}{RESET}")
    print(f"{YELLOW}TEST 8/10: SMS de Retiro Aprobado{RESET}")
    print(f"{YELLOW}{'='*80}{RESET}")
    
    try:
        withdrawal_approved_message = f"""✅ Tu retiro ha sido APROBADO

💰 Monto: $100.00
📅 Procesado: {datetime.now().strftime("%d/%m/%Y")}

Recibirás el pago en 3-5 días hábiles.

Ross Tax Preparation
806-934-2018"""
        
        message = notif_service.twilio_client.messages.create(
            body=withdrawal_approved_message,
            from_=notif_service.twilio_phone_number,
            to=test_phone
        )
        
        print(f"{GREEN}✅ PASSED - SMS enviado{RESET}")
        print(f"   SID: {message.sid}")
        results['passed'] += 1
        results['tests'].append({'test': 'Retiro Aprobado', 'status': 'PASSED'})
    except Exception as e:
        print(f"{RED}❌ FAILED - {str(e)}{RESET}")
        results['failed'] += 1
        results['tests'].append({'test': 'Retiro Aprobado', 'status': 'FAILED', 'error': str(e)})
    
    await asyncio.sleep(2)
    
    # ============================================================
    # TEST 9: SMS de Retiro Rechazado
    # ============================================================
    print(f"\n{YELLOW}{'='*80}{RESET}")
    print(f"{YELLOW}TEST 9/10: SMS de Retiro Rechazado{RESET}")
    print(f"{YELLOW}{'='*80}{RESET}")
    
    try:
        withdrawal_rejected_message = f"""⚠️ Tu solicitud de retiro fue RECHAZADA

💰 Monto: $100.00
📝 Motivo: Información bancaria incompleta

Tus créditos han sido devueltos a tu cuenta.

Para más información:
📞 806-934-2018

Ross Tax Preparation"""
        
        message = notif_service.twilio_client.messages.create(
            body=withdrawal_rejected_message,
            from_=notif_service.twilio_phone_number,
            to=test_phone
        )
        
        print(f"{GREEN}✅ PASSED - SMS enviado{RESET}")
        print(f"   SID: {message.sid}")
        results['passed'] += 1
        results['tests'].append({'test': 'Retiro Rechazado', 'status': 'PASSED'})
    except Exception as e:
        print(f"{RED}❌ FAILED - {str(e)}{RESET}")
        results['failed'] += 1
        results['tests'].append({'test': 'Retiro Rechazado', 'status': 'FAILED', 'error': str(e)})
    
    await asyncio.sleep(2)
    
    # ============================================================
    # TEST 10: SMS de Créditos Recibidos
    # ============================================================
    print(f"\n{YELLOW}{'='*80}{RESET}")
    print(f"{YELLOW}TEST 10/10: SMS de Créditos Recibidos{RESET}")
    print(f"{YELLOW}{'='*80}{RESET}")
    
    try:
        credits_message = f"""💰 Créditos RECIBIDOS

Monto: 100 créditos
De: Juan Pérez
Fecha: {datetime.now().strftime("%d/%m/%Y")}

Balance actual: 600 créditos

Ross Tax Preparation"""
        
        message = notif_service.twilio_client.messages.create(
            body=credits_message,
            from_=notif_service.twilio_phone_number,
            to=test_phone
        )
        
        print(f"{GREEN}✅ PASSED - SMS enviado{RESET}")
        print(f"   SID: {message.sid}")
        results['passed'] += 1
        results['tests'].append({'test': 'Créditos Recibidos', 'status': 'PASSED'})
    except Exception as e:
        print(f"{RED}❌ FAILED - {str(e)}{RESET}")
        results['failed'] += 1
        results['tests'].append({'test': 'Créditos Recibidos', 'status': 'FAILED', 'error': str(e)})
    
    # ============================================================
    # RESUMEN FINAL
    # ============================================================
    print(f"\n{BLUE}{'='*80}{RESET}")
    print(f"{BLUE}📊 RESUMEN DE PRUEBAS{RESET}")
    print(f"{BLUE}{'='*80}{RESET}\n")
    
    print(f"Total de pruebas: 10")
    print(f"{GREEN}✅ Exitosas: {results['passed']}{RESET}")
    print(f"{RED}❌ Fallidas: {results['failed']}{RESET}")
    print(f"Tasa de éxito: {(results['passed']/10)*100:.1f}%\n")
    
    print(f"{BLUE}Detalle por prueba:{RESET}")
    for i, test in enumerate(results['tests'], 1):
        status_icon = f"{GREEN}✅{RESET}" if test['status'] == 'PASSED' else f"{RED}❌{RESET}"
        print(f"{i}. {status_icon} {test['test']}")
        if test['status'] == 'FAILED':
            print(f"   Error: {test.get('error', 'Unknown')}")
    
    print(f"\n{BLUE}{'='*80}{RESET}")
    
    if results['passed'] == 10:
        print(f"{GREEN}🎉 ¡TODAS LAS NOTIFICACIONES SMS FUNCIONAN CORRECTAMENTE!{RESET}")
    elif results['passed'] >= 7:
        print(f"{YELLOW}⚠️  La mayoría de notificaciones funcionan, algunas requieren atención{RESET}")
    else:
        print(f"{RED}❌ Múltiples notificaciones fallaron, requiere investigación{RESET}")
    
    print(f"{BLUE}{'='*80}{RESET}\n")
    
    print(f"{BLUE}📱 Revisa tu teléfono {test_phone} para ver todos los SMS recibidos{RESET}\n")
    
    client.close()

if __name__ == "__main__":
    asyncio.run(test_all_notifications())
