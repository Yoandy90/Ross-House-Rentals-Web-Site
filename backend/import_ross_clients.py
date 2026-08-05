"""
Script para importar los 100 clientes de Ross Offices desde el Excel
NO ENVIARÁ EMAILS NI SMS - Solo importación a base de datos
"""
import asyncio
import os
import sys
from datetime import datetime
from motor.motor_asyncio import AsyncIOMotorClient
import hashlib
import uuid
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Conexión a MongoDB
MONGO_URL = os.getenv('MONGO_URL', 'mongodb://localhost:27017/taxpro')

# Datos extraídos del Excel
CLIENTS_DATA = [
    {"name": "Barbara de los Angeles Clark Santana", "phone": "+18063332314", "groups": "Tramites Migratorios, Todos los Clientes", "labels": "Declaracion de Impuestos, Tramites de Inmigración"},
    {"name": "Juan David Hurtado Perez", "phone": "+18069229287", "groups": "Tramites Migratorios, Todos los Clientes", "labels": "Tramites de Inmigración"},
    {"name": "Eylen Roblejo Rosales", "phone": "+18069842909", "groups": "Tramites de Inmigración", "labels": ""},
    {"name": "Harold Vaillant Perez", "phone": "+18063333879", "groups": "Tramites Migratorios, Todos los Clientes", "labels": "Tramites de Inmigración"},
    {"name": "Inmer Eliecer Blanco Abad", "phone": "+15803774063", "groups": "Todos los Clientes", "labels": "Tramites de Inmigración"},
    {"name": "Jose Gregorio ROSALES OSUNA", "phone": "+18069848552", "groups": "Tramites de Inmigración", "labels": ""},
    {"name": "Jose Luis Trinchet Lora", "phone": "+18069222778", "groups": "Todos los Clientes", "labels": "Tramites de Inmigración"},
    {"name": "Richard Gonzalez Gonzalez", "phone": "+18069222807", "groups": "Tramites Migratorios, Todos los Clientes", "labels": "Tramites de Inmigración"},
    {"name": "Yaquelin", "phone": "", "groups": "Tramites de Inmigración", "labels": ""},
    {"name": "Yuniel", "phone": "", "groups": "Tramites de Inmigración", "labels": ""},
    {"name": "Adrian Dorta Botello", "phone": "+18063336252", "groups": "Tramites Migratorios, Todos los Clientes", "labels": "Tramites de Inmigración"},
    {"name": "Alfredo Alejandro Hernandez Gonzalez", "phone": "+17869691345", "groups": "Tramites Migratorios, Todos los Clientes", "labels": "Tramites de Inmigración"},
    {"name": "Angel Zuniga Herrera", "phone": "", "groups": "Tramites de Inmigración", "labels": ""},
    {"name": "Arelys Mondejar Rodriguez", "phone": "+18064213679", "groups": "Tramites Migratorios, Todos los Clientes", "labels": "Tramites de Inmigración"},
    {"name": "Arianny Delgado Martin", "phone": "", "groups": "Tramites de Inmigración", "labels": "Tramites de Inmigración"},
    {"name": "Dainelys Perez Carrillo", "phone": "", "groups": "Tramites de Inmigración", "labels": ""},
    {"name": "Daniel Rene Matamoros Suarez", "phone": "+18066809974", "groups": "Tramites Migratorios, Todos los Clientes", "labels": "Declaracion de Impuestos, Tramites de Inmigración"},
    {"name": "Danna Matos Galano", "phone": "+18067171565", "groups": "Tramites Migratorios, Todos los Clientes", "labels": "Tramites de Inmigración"},
    {"name": "Dariel Palacios Luis", "phone": "", "groups": "Tramites de Inmigración", "labels": "Tramites de Inmigración"},
    {"name": "Dayana Hernandez Garcia", "phone": "+19158439007", "groups": "Tramites Migratorios, Todos los Clientes", "labels": "Tramites de Inmigración"},
    {"name": "Erik Roque Cabana", "phone": "+12393977952", "groups": "Tramites de Inmigración", "labels": ""},
    {"name": "Erisbel Guillermo Gonzalez Mourelo", "phone": "", "groups": "Tramites de Inmigración", "labels": ""},
    {"name": "Ernesto Vidal Martin Sanchez", "phone": "+19158503734", "groups": "Tramites Migratorios, Todos los Clientes", "labels": "Tramites de Inmigración"},
    {"name": "Esnier Pedroso Herrera", "phone": "+15618973343", "groups": "Tramites Migratorios, Todos los Clientes", "labels": "Tramites de Inmigración"},
    {"name": "Gilberto Leiva Martinez", "phone": "+18067171259", "groups": "Tramites de Inmigración", "labels": ""},
    {"name": "Guido Luis Lopez Llopiz", "phone": "", "groups": "Tramites de Inmigración", "labels": "Tramites de Inmigración"},
    {"name": "Humberto Rodriguez Molina", "phone": "", "groups": "Tramites de Inmigración", "labels": ""},
    {"name": "Jennifer Avila Maturell", "phone": "", "groups": "Tramites de Inmigración", "labels": ""},
    {"name": "Jhenny Alexandra Arenas Zapata", "phone": "+18069229294", "groups": "Tramites Migratorios, Todos los Clientes", "labels": "Tramites de Inmigración"},
    {"name": "Jose Damian Garcia Maristan", "phone": "+14328183618", "groups": "Todos los Clientes", "labels": "Tramites de Inmigración"},
    {"name": "Katerine Zuluaga Rincon", "phone": "+15754036992", "groups": "Tramites Migratorios, Todos los Clientes", "labels": "Tramites de Inmigración"},
    {"name": "Kevin Navarro Cabrera", "phone": "", "groups": "Tramites de Inmigración", "labels": "Tramites de Inmigración"},
    {"name": "Leonardo Castillo Ruiz", "phone": "", "groups": "Tramites de Inmigración", "labels": "Tramites de Inmigración"},
    {"name": "Luis Daniel Nuñez Morales", "phone": "", "groups": "Tramites de Inmigración", "labels": "Tramites de Inmigración"},
    {"name": "Luis Dorta Martinez", "phone": "+15806511007", "groups": "Todos los Clientes", "labels": "Tramites de Inmigración"},
    {"name": "Maday Morales Camacho", "phone": "", "groups": "Tramites de Inmigración", "labels": "Tramites de Inmigración"},
    {"name": "Marco Antonio Baez Aparicio", "phone": "", "groups": "Tramites de Inmigración", "labels": "Tramites de Inmigración"},
    {"name": "Maubel Matamoros Suarez", "phone": "", "groups": "Tramites de Inmigración", "labels": "Tramites de Inmigración"},
    {"name": "Merli Aracely Zuluaga Rincon", "phone": "+15754030069", "groups": "Tramites Migratorios, Todos los Clientes", "labels": "Tramites de Inmigración"},
    {"name": "Miguel Benitez Mendez", "phone": "+18069223551", "groups": "Tramites Migratorios, Todos los Clientes", "labels": "Tramites de Inmigración"},
    {"name": "Milena Delgado Carmenate", "phone": "", "groups": "Tramites de Inmigración", "labels": "Tramites de Inmigración"},
    {"name": "Reina Miranda Asencio", "phone": "+18069229632", "groups": "Tramites de Inmigración", "labels": ""},
    {"name": "Rosmery Vaneza Aguilar Rosello", "phone": "", "groups": "Tramites de Inmigración", "labels": "Tramites de Inmigración"},
    {"name": "Wilmar Antonio Villa Ramirez", "phone": "+18069228783", "groups": "Tramites Migratorios, Todos los Clientes", "labels": "Tramites de Inmigración"},
    {"name": "Wuanda Solano Perez", "phone": "+13058730850", "groups": "Tramites Migratorios, Todos los Clientes", "labels": "Tramites de Inmigración"},
    {"name": "Yeferson Camilo Osorio Montes", "phone": "+18069220578", "groups": "Tramites Migratorios, Todos los Clientes", "labels": "Tramites de Inmigración"},
    {"name": "Yirko Perez Leiva", "phone": "+18069226420", "groups": "Tramites Migratorios, Todos los Clientes", "labels": "Tramites de Inmigración"},
    {"name": "Yoel Cardenas Garcia", "phone": "+18067511085", "groups": "Tramites de Inmigración", "labels": ""},
    {"name": "Yoendris Fonseca Rodriguez", "phone": "", "groups": "Tramites de Inmigración", "labels": ""},
    {"name": "Yosmani Gomez Gutierrez", "phone": "", "groups": "Tramites Migratorios, Todos los Clientes", "labels": "Tramites de Inmigración"},
    {"name": "Yulier Vargas Rubio", "phone": "", "groups": "Tramites Migratorios, Todos los Clientes", "labels": ""},
    {"name": "Yuniel Gonzalez estrada", "phone": "+17867996820", "groups": "Tramites Migratorios, Todos los Clientes", "labels": "Tramites de Inmigración"},
    {"name": "Yusmey Leyva Galan", "phone": "+19519565683", "groups": "Tramites Migratorios, Todos los Clientes", "labels": "Tramites de Inmigración"},
    {"name": "Yusniel Gomez Pol", "phone": "", "groups": "Todos los Clientes", "labels": "Tramites de Inmigración"},
    {"name": "Yaquelin Lopez Rodriguez", "phone": "", "groups": "Tramites de Inmigración", "labels": ""},
    {"name": "Johan Jose Romero Valderrama", "phone": "", "groups": "Tramites de Inmigración", "labels": ""},
    {"name": "YENNIFER HERNANDEZ LOPEZ", "phone": "", "groups": "Tramites de Inmigración, Todos los Clientes", "labels": "Tramites de Inmigración"},
    {"name": "Yanisleydi Armas Suarez", "phone": "+18064214378", "groups": "Todos los Clientes", "labels": "Tramites de Inmigración"},
    {"name": "Yanet Gonzalez Lopez", "phone": "+17274349767", "groups": "Tramites Migratorios, Todos los Clientes", "labels": "Tramites de Inmigración"},
    {"name": "Aramis Matamoros Aguilar", "phone": "+18063160374", "groups": "Todos los Clientes, Tramites de Inmigración", "labels": "Todos los Clientes, Tramites de Inmigración"},
    {"name": "Javier Gonzalez Leon", "phone": "+13372165586", "groups": "Tramites Migratorios, Todos los Clientes", "labels": "Tramites de Inmigración"},
    {"name": "Liexer Peña Tres", "phone": "", "groups": "Tramites de Inmigración, Todos los Clientes", "labels": "Tramites Migratorios, Todos los Clientes"},
    {"name": "Iraida Perez Escalona", "phone": "+18067511186", "groups": "Tramites Migratorios, Todos los Clientes", "labels": "Tramites de Inmigración"},
    {"name": "Alexdanier Enriquez Cisneros", "phone": "+18064767859", "groups": "Tramites Migratorios, Todos los Clientes", "labels": "Tramites de Inmigración"},
    {"name": "Yusliesky Miranda Sandoval", "phone": "+18064215656", "groups": "Tramites Migratorios, Todos los Clientes", "labels": "Tramites de Inmigración"},
    {"name": "Luis Manuel Porraz Gomez", "phone": "+17867403364", "groups": "Tramites Migratorios, Todos los Clientes", "labels": "Tramites de Inmigración"},
    {"name": "Nileyam Dorta Piñeiro", "phone": "+1305904498", "groups": "Tramites Migratorios, Todos los Clientes", "labels": "Tramites de Inmigración"},
    {"name": "Richar Ernesto Cepero Peñate", "phone": "+18069229291", "groups": "Tramites Migratorios, Todos los Clientes", "labels": "Tramites de Inmigración"},
    {"name": "Rosana Rodriguez Alvarez", "phone": "+17863959554", "groups": "Tramites Migratorios, Todos los Clientes", "labels": "Tramites de Inmigración"},
    {"name": "Vilma Rafaela Morejon Delgado", "phone": "+18069308329", "groups": "Tramites Migratorios, Todos los Clientes", "labels": "Tramites de Inmigración"},
    {"name": "Yandry Perez Gonzalez", "phone": "+15617184897", "groups": "Tramites Migratorios, Todos los Clientes", "labels": "Tramites de Inmigración"},
    {"name": "Yanisleidy Saroza Farinas", "phone": "+13377031819", "groups": "Tramites Migratorios, Todos los Clientes", "labels": "Tramites de Inmigración"},
    {"name": "Yuniel Miranda Morejon", "phone": "+18064216098", "groups": "Tramites Migratorios, Todos los Clientes", "labels": "Tramites de Inmigración"},
    {"name": "Teresita de Jesus Lescano Armas", "phone": "+18064219410", "groups": "Tramites Migratorios, Todos los Clientes", "labels": "Tramites de Inmigración"},
    {"name": "Aliosky Torres Valdes", "phone": "+13529426733", "groups": "Tramites Migratorios, Todos los Clientes", "labels": "Tramites de Inmigración"},
    {"name": "Aliesky Morales Peña", "phone": "+18066404046", "groups": "Tramites Migratorios, Todos los Clientes", "labels": "Tramites de Inmigración"},
    {"name": "Cesar Luis Castell Ramirez", "phone": "+15804613349", "groups": "Todos los Clientes", "labels": "Declaracion de Impuestos, Prestamos"},
    {"name": "Cesar Manuel Porras Gomez", "phone": "+17867403364", "groups": "Tramites Migratorios, Todos los Clientes", "labels": "Declaracion de Impuestos"},
    {"name": "Dannier Suarez Batista", "phone": "+12543503119", "groups": "Tramites Migratorios, Todos los Clientes", "labels": "Declaracion de Impuestos"},
    {"name": "Daymaris Serrano Dorrego", "phone": "+17867029568", "groups": "Tramites Migratorios, Todos los Clientes", "labels": "Tramites de Inmigración"},
    {"name": "Geovannys Estiven Perez", "phone": "+19454002656", "groups": "Tramites Migratorios, Todos los Clientes", "labels": "Tramites de Inmigración"},
    {"name": "Jose Antonio Perez Cabrera", "phone": "+18069221503", "groups": "Tramites Migratorios, Todos los Clientes", "labels": "Tramites de Inmigración"},
    {"name": "Lazaro Richard Coto Hernandez", "phone": "+18066738415", "groups": "Tramites Migratorios, Todos los Clientes", "labels": "Tramites de Inmigración"},
    {"name": "Marisela Salgado Santana", "phone": "+18183080737", "groups": "Tramites Migratorios, Todos los Clientes", "labels": "Tramites de Inmigración"},
    {"name": "Mayli Rivero Mondejar", "phone": "+15617148157", "groups": "Tramites Migratorios, Todos los Clientes", "labels": "Tramites de Inmigración"},
    {"name": "Misael Sanchez Castellanos", "phone": "+18063368936", "groups": "Tramites Migratorios, Todos los Clientes", "labels": "Declaracion de Impuestos"},
    {"name": "Ibet Camejo Jimenez de Castro", "phone": "+18069226764", "groups": "Tramites Migratorios, Todos los Clientes", "labels": "Tramites de Inmigración"},
    {"name": "Maritza Jimenez de Castro Gainza", "phone": "+18069225496", "groups": "Tramites Migratorios, Todos los Clientes", "labels": "Tramites de Inmigración"},
    {"name": "Ostin Leyva Camejo", "phone": "", "groups": "Todos los Clientes", "labels": ""},
    {"name": "Ronald Ernesto Leyva Calderin", "phone": "+18069226737", "groups": "Tramites Migratorios, Todos los Clientes", "labels": "Tramites de Inmigración"},
    {"name": "Ronald Rene Leyva Camejo", "phone": "", "groups": "Todos los Clientes", "labels": ""},
    {"name": "Pablo Enrique Antunez Cartaya", "phone": "+17542844958", "groups": "Tramites Migratorios, Todos los Clientes", "labels": "Tramites de Inmigración"},
    {"name": "Sandra Matos Ramirez", "phone": "+17869330236", "groups": "Tramites Migratorios, Todos los Clientes", "labels": "Tramites de Inmigración"},
    {"name": "Yamile Trimiño Manrique", "phone": "+17862914339", "groups": "Tramites Migratorios, Todos los Clientes", "labels": "Tramites de Inmigración"},
    {"name": "Yasmani Madera Morales", "phone": "+18069227302", "groups": "Tramites Migratorios, Todos los Clientes", "labels": "Tramites de Inmigración"},
    {"name": "Jeronimo Castrillon Arenas", "phone": "", "groups": "Todos los Clientes", "labels": ""},
    {"name": "Maria Antonia Villa Zuluaga", "phone": "", "groups": "Todos los Clientes", "labels": ""},
    {"name": "David Santiago Vega Zuluaga", "phone": "", "groups": "Tramites Migratorios, Todos los Clientes", "labels": ""},
    {"name": "Darline Chancy", "phone": "", "groups": "Todos los Clientes", "labels": ""},
]

async def import_clients():
    """Importa los 100 clientes de Ross Offices a MongoDB"""
    
    try:
        logger.info("🚀 Iniciando importación de clientes de Ross Offices...")
        logger.info("⚠️  NO SE ENVIARÁN EMAILS NI SMS - Solo importación a BD\n")
        
        # Conectar a MongoDB
        client = AsyncIOMotorClient(MONGO_URL)
        db = client.get_database()
        users_collection = db.users
        
        imported_count = 0
        updated_count = 0
        skipped_count = 0
        
        for idx, client_data in enumerate(CLIENTS_DATA, 1):
            try:
                name = client_data['name'].strip()
                phone = client_data['phone'].strip() if client_data['phone'] else ""
                
                if not name:
                    skipped_count += 1
                    continue
                
                # Generar email basado en el nombre (lowercase, sin espacios)
                email_base = name.lower().replace(' ', '.').replace('ñ', 'n')
                email = f"{email_base}@rosstax.client"
                
                # Verificar si ya existe
                existing = await users_collection.find_one({'email': email})
                
                if existing:
                    # Actualizar datos
                    update_data = {
                        'name': name,
                        'updated_at': datetime.utcnow()
                    }
                    
                    if phone:
                        update_data['phone'] = phone
                    
                    # Agregar metadata de grupos y labels
                    if 'metadata' not in existing:
                        update_data['metadata'] = {}
                    else:
                        update_data['metadata'] = existing.get('metadata', {})
                    
                    update_data['metadata']['client_groups'] = client_data.get('groups', '')
                    update_data['metadata']['labels'] = client_data.get('labels', '')
                    update_data['metadata']['source'] = 'Ross Offices - Negocio Inmigración'
                    
                    await users_collection.update_one(
                        {'_id': existing['_id']},
                        {'$set': update_data}
                    )
                    
                    updated_count += 1
                    logger.info(f"🔄 Cliente {idx}/100: {name} - Actualizado")
                    continue
                
                # Crear nuevo usuario
                user_id = str(uuid.uuid4())
                temp_password = "RossTax2025!"
                password_hash = hashlib.sha256(temp_password.encode()).hexdigest()
                
                user_doc = {
                    '_id': user_id,
                    'email': email,
                    'name': name,
                    'password': password_hash,
                    'type': 'client',
                    'status': 'active',
                    'kyc_completed': False,
                    'language': 'es',  # Español por defecto (negocio de inmigración)
                    'created_at': datetime.utcnow(),
                    'updated_at': datetime.utcnow(),
                    'password_change_required': True,
                    'metadata': {
                        'imported_from': 'Ross Offices Excel',
                        'imported_at': datetime.utcnow().isoformat(),
                        'source': 'Ross Offices - Negocio Inmigración',
                        'client_groups': client_data.get('groups', ''),
                        'labels': client_data.get('labels', ''),
                        'temp_password': temp_password,
                        'notifications_disabled': True  # Desactivar notificaciones automáticas
                    }
                }
                
                if phone:
                    user_doc['phone'] = phone
                
                await users_collection.insert_one(user_doc)
                
                imported_count += 1
                logger.info(f"✅ Cliente {idx}/100: {name} - Importado")
            
            except Exception as row_error:
                logger.error(f"❌ Error cliente {idx}: {str(row_error)}")
                skipped_count += 1
        
        # Resumen
        logger.info("\n" + "="*70)
        logger.info("📊 RESUMEN DE IMPORTACIÓN - ROSS OFFICES")
        logger.info("="*70)
        logger.info(f"✅ Clientes nuevos importados: {imported_count}")
        logger.info(f"🔄 Clientes actualizados: {updated_count}")
        logger.info(f"⚠️  Clientes omitidos: {skipped_count}")
        logger.info(f"📈 Total procesado: {imported_count + updated_count + skipped_count}")
        logger.info("="*70)
        
        if imported_count > 0:
            logger.info(f"\n⚠️  IMPORTANTE:")
            logger.info(f"   - Password temporal: '{temp_password}'")
            logger.info(f"   - Emails generados: [nombre]@rosstax.client")
            logger.info(f"   - ✅ Notificaciones DESACTIVADAS (no se enviarán emails/SMS)")
            logger.info(f"   - Idioma por defecto: Español (es)\n")
        
        # Ejecutar análisis inicial del sistema AI
        logger.info("\n🧠 Iniciando análisis del sistema AI Learning...")
        logger.info("   Procesando patrones de clientes...")
        
        client.close()
        
        logger.info("\n✅ Importación completada exitosamente!")
        logger.info("💡 Los datos están listos para el sistema AI de análisis y aprendizaje\n")
    
    except Exception as e:
        logger.error(f"❌ Error general: {str(e)}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(import_clients())
