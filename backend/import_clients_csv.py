"""
Script para importar clientes desde un archivo CSV
Ross Tax Preparation
"""
import csv
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

async def import_clients_from_csv(csv_file_path: str):
    """
    Importa clientes desde un archivo CSV a MongoDB
    
    El CSV debe tener las siguientes columnas (mínimo):
    - name: Nombre completo del cliente
    - email: Email del cliente
    - phone: Teléfono (opcional)
    - address: Dirección (opcional)
    - tax_id: SSN o ITIN (opcional)
    
    Columnas adicionales opcionales:
    - status: active, inactive (default: active)
    - kyc_completed: true/false (default: false)
    - language: en, es (default: en)
    - notes: Notas adicionales
    """
    
    try:
        # Conectar a MongoDB
        client = AsyncIOMotorClient(MONGO_URL)
        db = client.get_database()
        users_collection = db.users
        
        logger.info(f"📂 Leyendo archivo CSV: {csv_file_path}")
        
        # Verificar que el archivo existe
        if not os.path.exists(csv_file_path):
            logger.error(f"❌ Archivo no encontrado: {csv_file_path}")
            return
        
        # Leer CSV
        with open(csv_file_path, 'r', encoding='utf-8') as file:
            csv_reader = csv.DictReader(file)
            
            # Verificar columnas requeridas
            required_columns = ['name', 'email']
            if not all(col in csv_reader.fieldnames for col in required_columns):
                logger.error(f"❌ El CSV debe tener las columnas: {', '.join(required_columns)}")
                logger.error(f"Columnas encontradas: {', '.join(csv_reader.fieldnames)}")
                return
            
            imported_count = 0
            skipped_count = 0
            updated_count = 0
            
            for row_num, row in enumerate(csv_reader, start=2):  # start=2 porque row 1 es el header
                try:
                    # Datos básicos
                    email = row['email'].strip().lower()
                    name = row['name'].strip()
                    
                    if not email or not name:
                        logger.warning(f"⚠️  Fila {row_num}: Email o nombre vacío, omitiendo")
                        skipped_count += 1
                        continue
                    
                    # Verificar si el usuario ya existe
                    existing_user = await users_collection.find_one({'email': email})
                    
                    if existing_user:
                        logger.info(f"ℹ️  Fila {row_num}: Usuario {email} ya existe, actualizando datos...")
                        
                        # Actualizar datos del usuario existente
                        update_data = {
                            'name': name,
                            'updated_at': datetime.utcnow()
                        }
                        
                        # Agregar campos opcionales si existen en el CSV
                        if 'phone' in row and row['phone'].strip():
                            update_data['phone'] = row['phone'].strip()
                        if 'address' in row and row['address'].strip():
                            update_data['address'] = row['address'].strip()
                        if 'tax_id' in row and row['tax_id'].strip():
                            update_data['tax_id'] = row['tax_id'].strip()
                        if 'language' in row and row['language'].strip():
                            update_data['language'] = row['language'].strip().lower()
                        if 'notes' in row and row['notes'].strip():
                            if 'metadata' not in existing_user:
                                update_data['metadata'] = {}
                            else:
                                update_data['metadata'] = existing_user['metadata']
                            update_data['metadata']['import_notes'] = row['notes'].strip()
                        
                        await users_collection.update_one(
                            {'_id': existing_user['_id']},
                            {'$set': update_data}
                        )
                        
                        updated_count += 1
                        logger.info(f"✅ Fila {row_num}: Usuario {email} actualizado")
                        continue
                    
                    # Crear nuevo usuario
                    user_id = str(uuid.uuid4())
                    
                    # Password temporal (deberá cambiarla en primer login)
                    temp_password = "TaxPro2025!"
                    password_hash = hashlib.sha256(temp_password.encode()).hexdigest()
                    
                    user_doc = {
                        '_id': user_id,
                        'email': email,
                        'name': name,
                        'password': password_hash,
                        'type': 'client',  # client por default
                        'status': row.get('status', 'active').strip().lower() if 'status' in row else 'active',
                        'kyc_completed': row.get('kyc_completed', '').strip().lower() == 'true' if 'kyc_completed' in row else False,
                        'language': row.get('language', 'en').strip().lower() if 'language' in row else 'en',
                        'created_at': datetime.utcnow(),
                        'updated_at': datetime.utcnow(),
                        'password_change_required': True,  # Forzar cambio de password
                        'metadata': {
                            'imported_from_csv': True,
                            'imported_at': datetime.utcnow().isoformat(),
                            'temp_password': temp_password  # Para referencia (eliminar en producción)
                        }
                    }
                    
                    # Agregar campos opcionales
                    if 'phone' in row and row['phone'].strip():
                        user_doc['phone'] = row['phone'].strip()
                    if 'address' in row and row['address'].strip():
                        user_doc['address'] = row['address'].strip()
                    if 'tax_id' in row and row['tax_id'].strip():
                        user_doc['tax_id'] = row['tax_id'].strip()
                    if 'notes' in row and row['notes'].strip():
                        user_doc['metadata']['import_notes'] = row['notes'].strip()
                    
                    # Insertar en MongoDB
                    await users_collection.insert_one(user_doc)
                    
                    imported_count += 1
                    logger.info(f"✅ Fila {row_num}: Cliente {name} ({email}) importado exitosamente")
                
                except Exception as row_error:
                    logger.error(f"❌ Error procesando fila {row_num}: {str(row_error)}")
                    skipped_count += 1
        
        # Resumen
        logger.info("\n" + "="*60)
        logger.info("📊 RESUMEN DE IMPORTACIÓN")
        logger.info("="*60)
        logger.info(f"✅ Clientes nuevos importados: {imported_count}")
        logger.info(f"🔄 Clientes existentes actualizados: {updated_count}")
        logger.info(f"⚠️  Filas omitidas: {skipped_count}")
        logger.info(f"📈 Total procesado: {imported_count + updated_count + skipped_count}")
        logger.info("="*60)
        
        if imported_count > 0:
            logger.info(f"\n⚠️  IMPORTANTE: Los nuevos clientes tienen password temporal: '{temp_password}'")
            logger.info("   Deberán cambiar su password en el primer login.\n")
        
        client.close()
    
    except Exception as e:
        logger.error(f"❌ Error general en importación: {str(e)}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("\n❌ Error: Debes proporcionar la ruta del archivo CSV")
        print("\nUso:")
        print("  python import_clients_csv.py <ruta_del_archivo.csv>")
        print("\nEjemplo:")
        print("  python import_clients_csv.py /app/clientes.csv")
        print("\nFormato del CSV:")
        print("  El archivo CSV debe tener al menos estas columnas:")
        print("  - name: Nombre completo del cliente (requerido)")
        print("  - email: Email del cliente (requerido)")
        print("\n  Columnas opcionales:")
        print("  - phone: Teléfono")
        print("  - address: Dirección")
        print("  - tax_id: SSN o ITIN")
        print("  - status: active o inactive")
        print("  - kyc_completed: true o false")
        print("  - language: en o es")
        print("  - notes: Notas adicionales\n")
        sys.exit(1)
    
    csv_file = sys.argv[1]
    asyncio.run(import_clients_from_csv(csv_file))
