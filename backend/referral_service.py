"""
Servicio para manejar lógica de referidos - Sistema basado en citas completadas
"""
import random
import string
import qrcode
import io
import base64
from datetime import datetime
from motor.motor_asyncio import AsyncIOMotorDatabase


class ReferralService:
    def __init__(self, db: AsyncIOMotorDatabase):
        self.db = db
        self.base_domain = "https://rosstaxpreparation.com"
    
    def generate_unique_code(self, user_name: str) -> str:
        """Genera código único tipo ROSS-ABC123"""
        # Tomar primeras 3 letras del nombre o usar ROS si no hay suficiente
        name_part = ''.join(filter(str.isalpha, user_name.upper()))[:3] or 'ROS'
        # Generar parte alfanumérica aleatoria
        random_part = ''.join(random.choices(string.ascii_uppercase + string.digits, k=5))
        return f"{name_part}-{random_part}"
    
    def generate_qr_code(self, link: str) -> str:
        """Genera código QR en base64 para el link de referido"""
        qr = qrcode.QRCode(version=1, box_size=10, border=5)
        qr.add_data(link)
        qr.make(fit=True)
        
        img = qr.make_image(fill_color="black", back_color="white")
        buffer = io.BytesIO()
        img.save(buffer, format='PNG')
        buffer.seek(0)
        
        return base64.b64encode(buffer.getvalue()).decode('utf-8')
    
    async def create_referral_code(self, user_id: str, user_name: str) -> dict:
        """Crea código de referido y link único para un usuario"""
        # Verificar si ya tiene código
        existing = await self.db.referral_codes.find_one({'user_id': user_id})
        
        # Si existe pero le faltan los campos nuevos (QR, link), actualizarlo
        if existing:
            needs_update = False
            updates = {}
            
            if not existing.get('referral_link'):
                referral_link = f"{self.base_domain}/ref/{existing['code']}"
                updates['referral_link'] = referral_link
                needs_update = True
            else:
                referral_link = existing['referral_link']
            
            if not existing.get('qr_code_data'):
                qr_code_data = self.generate_qr_code(referral_link)
                updates['qr_code_data'] = qr_code_data
                needs_update = True
            
            # Actualizar en base de datos si hace falta
            if needs_update:
                await self.db.referral_codes.update_one(
                    {'user_id': user_id},
                    {'$set': updates}
                )
                # Actualizar objeto existente
                existing.update(updates)
            
            return existing
        
        # Generar código único
        code = self.generate_unique_code(user_name)
        
        # Asegurar que el código sea único
        while await self.db.referral_codes.find_one({'code': code}):
            code = self.generate_unique_code(user_name)
        
        # Generar link de referido (deep link para la app)
        # Formato: rosstax://ref/CODE - esto abrirá la app directamente
        referral_link = f"rosstax://ref/{code}"
        
        # Generar QR code con el deep link
        qr_code_data = self.generate_qr_code(referral_link)
        
        # Crear código
        referral_code = {
            'user_id': user_id,
            'code': code,
            'referral_link': referral_link,
            'qr_code_data': qr_code_data,
            'created_at': datetime.utcnow(),
            'is_active': True,
            'total_referrals': 0,
            'completed_referrals': 0,
            'pending_referrals': 0,
            'total_earned_usd': 0.0
        }
        
        result = await self.db.referral_codes.insert_one(referral_code)
        referral_code['_id'] = result.inserted_id
        
        return referral_code
    
    async def validate_referral_code(self, code: str) -> dict:
        """Valida si un código de referido existe y está activo"""
        referral_code = await self.db.referral_codes.find_one({
            'code': code.upper(),
            'is_active': True
        })
        
        return referral_code
    
    async def create_referral_from_appointment(
        self, 
        referral_code: str,
        name: str,
        email: str,
        phone: str,
        appointment_id: str
    ) -> dict:
        """
        Crea relación de referido cuando se agenda una cita desde link de referido
        IMPORTANTE: Solo clientes NUEVOS califican como referidos
        """
        # Validar código
        code_data = await self.validate_referral_code(referral_code)
        if not code_data:
            return None
        
        referrer_user_id = code_data['user_id']
        
        # ============================================
        # VALIDACIÓN: Solo clientes NUEVOS califican
        # ============================================
        
        # Verificar si el email ya existe en la base de datos
        existing_by_email = None
        if email:
            existing_by_email = await self.db.users.find_one({
                'email': {'$regex': f'^{email}$', '$options': 'i'}
            })
        
        # Verificar si el teléfono ya existe en la base de datos
        existing_by_phone = None
        if phone:
            # Limpiar número de teléfono para comparar
            phone_digits = ''.join(filter(str.isdigit, phone))
            if len(phone_digits) >= 10:
                existing_by_phone = await self.db.users.find_one({
                    'phone': {'$regex': phone_digits[-10:]}
                })
        
        # Si el cliente ya existe, NO califica como referido
        if existing_by_email or existing_by_phone:
            existing_user = existing_by_email or existing_by_phone
            # Log para auditoría
            import logging
            logging.warning(f"⚠️ Referido rechazado: {name} ({email or phone}) ya es cliente existente (ID: {existing_user.get('_id')})")
            return None
        
        # Verificar si ya fue referido anteriormente (por email o teléfono)
        existing_referral = await self.db.referrals.find_one({
            '$or': [
                {'referred_email': {'$regex': f'^{email}$', '$options': 'i'}} if email else {'_id': None},
                {'referred_phone': phone} if phone else {'_id': None}
            ]
        })
        
        if existing_referral:
            import logging
            logging.warning(f"⚠️ Referido rechazado: {name} ya fue referido anteriormente")
            return None
        
        # ============================================
        # Cliente es NUEVO - Crear referido
        # ============================================
        
        referral = {
            'referrer_user_id': referrer_user_id,
            'referred_user_id': None,  # Se llenará cuando se registre
            'referred_name': name,
            'referred_email': email,
            'referred_phone': phone,
            'referral_code_used': referral_code.upper(),
            'appointment_id': appointment_id,
            'status': 'pending',
            'created_at': datetime.utcnow(),
            'completed_at': None,
            'reward_given': False,
            'reward_amount_usd': 0.0,
            'discount_applied_usd': 5.0,
            'is_new_client': True  # Marcador de cliente nuevo
        }
        
        result = await self.db.referrals.insert_one(referral)
        referral['_id'] = result.inserted_id
        
        # Auto-sync to Rise CRM (non-blocking)
        try:
            from rise_crm_sync_service import rise_sync_service
            if rise_sync_service and rise_sync_service.rise_service.sync_enabled:
                import asyncio
                asyncio.create_task(rise_sync_service.sync_referral_to_rise(referral['id']))
                logger.info(f"🔄 Auto-sync triggered for referral: {referral['id']}")
        except Exception as e:
            logger.warning(f"⚠️ Auto-sync failed (non-critical): {str(e)}")
        
        # Incrementar contadores
        await self.db.referral_codes.update_one(
            {'code': referral_code.upper()},
            {
                '$inc': {
                    'total_referrals': 1,
                    'pending_referrals': 1
                }
            }
        )
        
        return referral
    
    async def get_reward_amount_for_user(self, user_id: str) -> float:
        """
        Calcula la recompensa en USD basada en el nivel de referidos completados
        Sistema escalonado: 1-10=$10, 11-20=$15, etc.
        """
        # Obtener contador de referidos completados
        code_data = await self.db.referral_codes.find_one({'user_id': user_id})
        if not code_data:
            return 10.0  # Default para primer referido
        
        completed_count = code_data.get('completed_referrals', 0)
        
        # Obtener niveles de recompensa configurados (ordenados por min_referrals)
        reward_tiers = await self.db.referral_reward_tiers.find({
            'is_active': True
        }).sort('min_referrals', 1).to_list(100)
        
        # Si no hay niveles configurados, usar default
        if not reward_tiers:
            return 10.0
        
        # Encontrar el nivel correspondiente
        for tier in reward_tiers:
            if tier['min_referrals'] <= completed_count + 1 <= tier['max_referrals']:
                return tier['reward_amount_usd']
        
        # Si supera todos los niveles, usar el último
        return reward_tiers[-1]['reward_amount_usd'] if reward_tiers else 10.0
    
    async def complete_referral(self, referral_id: str, appointment_id: str) -> dict:
        """
        Marca referido como completado cuando admin completa la cita
        Otorga recompensa en USD al referidor
        """
        # Buscar referido
        referral = await self.db.referrals.find_one({'_id': referral_id})
        if not referral:
            return {'success': False, 'message': 'Referido no encontrado'}
        
        if referral['status'] == 'completed':
            return {'success': False, 'message': 'Este referido ya fue completado'}
        
        # Verificar que la cita esté completada
        appointment = await self.db.appointments.find_one({'id': appointment_id})
        if not appointment or appointment['status'] != 'completed':
            return {'success': False, 'message': 'La cita debe estar completada primero'}
        
        # Calcular recompensa según nivel
        reward_amount = await self.get_reward_amount_for_user(referral['referrer_user_id'])
        
        # Actualizar referido
        await self.db.referrals.update_one(
            {'_id': referral_id},
            {
                '$set': {
                    'status': 'completed',
                    'completed_at': datetime.utcnow(),
                    'reward_given': True,
                    'reward_amount_usd': reward_amount
                }
            }
        )
        
        # Actualizar contadores del código de referido
        await self.db.referral_codes.update_one(
            {'code': referral['referral_code_used']},
            {
                '$inc': {
                    'completed_referrals': 1,
                    'pending_referrals': -1,
                    'total_earned_usd': reward_amount
                }
            }
        )
        
        # Registrar transacción de pago (para tracking)
        await self.db.referral_payments.insert_one({
            'referrer_user_id': referral['referrer_user_id'],
            'referral_id': referral_id,
            'amount_usd': reward_amount,
            'status': 'pending_payout',  # El admin deberá pagarlo manualmente
            'created_at': datetime.utcnow(),
            'paid_at': None
        })
        
        return {
            'success': True,
            'message': f'Referido completado. ${reward_amount:.2f} USD ganados.',
            'reward_amount': reward_amount,
            'referrer_user_id': referral['referrer_user_id']
        }
    
    async def get_user_referrals(self, user_id: str) -> dict:
        """Obtiene estadísticas y lista de referidos de un usuario"""
        # Obtener código del usuario
        referral_code = await self.db.referral_codes.find_one({'user_id': user_id})
        
        if not referral_code:
            return {
                'code': None,
                'referral_link': None,
                'qr_code_data': None,
                'total_referrals': 0,
                'completed_referrals': 0,
                'pending_referrals': 0,
                'total_earned_usd': 0.0,
                'referrals': []
            }
        
        # Obtener lista de referidos
        referrals = await self.db.referrals.find({
            'referrer_user_id': user_id
        }).to_list(100)
        
        # Enriquecer con datos
        enriched_referrals = []
        for ref in referrals:
            enriched_referrals.append({
                'id': str(ref['_id']),
                'referred_name': ref.get('referred_name', 'Usuario'),
                'referred_email': ref.get('referred_email', ''),
                'referred_phone': ref.get('referred_phone', ''),
                'status': ref['status'],
                'created_at': ref['created_at'].isoformat(),
                'completed_at': ref['completed_at'].isoformat() if ref.get('completed_at') else None,
                'reward_amount_usd': ref.get('reward_amount_usd', 0),
                'appointment_id': ref.get('appointment_id')
            })
        
        return {
            'code': referral_code['code'],
            'referral_link': referral_code['referral_link'],
            'qr_code_data': referral_code['qr_code_data'],
            'total_referrals': referral_code['total_referrals'],
            'completed_referrals': referral_code['completed_referrals'],
            'pending_referrals': referral_code['pending_referrals'],
            'total_earned_usd': referral_code.get('total_earned_usd', 0.0),
            'referrals': enriched_referrals
        }
    
    async def get_referral_by_appointment(self, appointment_id: str) -> dict:
        """Busca referido por ID de cita"""
        return await self.db.referrals.find_one({'appointment_id': appointment_id})
    
    # ========== ADMIN: Gestión de niveles de recompensa ==========
    
    async def create_reward_tier(self, min_referrals: int, max_referrals: int, reward_amount_usd: float) -> dict:
        """Crea un nuevo nivel de recompensa"""
        tier = {
            'min_referrals': min_referrals,
            'max_referrals': max_referrals,
            'reward_amount_usd': reward_amount_usd,
            'is_active': True,
            'created_at': datetime.utcnow()
        }
        
        result = await self.db.referral_reward_tiers.insert_one(tier)
        tier['_id'] = result.inserted_id
        
        return tier
    
    async def get_reward_tiers(self) -> list:
        """Obtiene todos los niveles de recompensa"""
        tiers = await self.db.referral_reward_tiers.find().sort('min_referrals', 1).to_list(100)
        return tiers
    
    async def update_reward_tier(self, tier_id: str, updates: dict) -> bool:
        """Actualiza un nivel de recompensa"""
        result = await self.db.referral_reward_tiers.update_one(
            {'_id': tier_id},
            {'$set': updates}
        )
        return result.modified_count > 0
    
    async def delete_reward_tier(self, tier_id: str) -> bool:
        """Elimina un nivel de recompensa"""
        result = await self.db.referral_reward_tiers.delete_one({'_id': tier_id})
        return result.deleted_count > 0
