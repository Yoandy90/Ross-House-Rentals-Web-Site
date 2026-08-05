#!/usr/bin/env python3
"""
Script para ejecutar análisis inicial de los 500+ clientes
Genera datos de entrenamiento y popula la memoria RAG
"""
import asyncio
import sys
import os
from dotenv import load_dotenv

# Cargar variables de entorno
load_dotenv()

# Agregar path
sys.path.insert(0, '/app/backend')

from motor.motor_asyncio import AsyncIOMotorClient
from data_analyzer import DataAnalyzer
from rag_memory_system import RAGMemorySystem
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

async def run_analysis():
    """Ejecuta análisis completo y genera datos iniciales"""
    try:
        # Conectar a MongoDB
        mongo_url = os.getenv('MONGO_URL', 'mongodb://localhost:27017')
        client = AsyncIOMotorClient(mongo_url)
        db = client.get_database('ross_tax')
        
        logger.info("=" * 60)
        logger.info("🚀 INICIANDO ANÁLISIS COMPLETO DE CLIENTES")
        logger.info("=" * 60)
        
        # Inicializar sistemas
        data_analyzer = DataAnalyzer(db)
        rag_memory = RAGMemorySystem(db)
        
        # PASO 1: Analizar clientes
        logger.info("\n📊 PASO 1: Analizando 500+ clientes...")
        analysis = await data_analyzer.analyze_all_clients()
        
        if 'error' not in analysis:
            logger.info(f"✅ Análisis completado:")
            logger.info(f"   - Total clientes: {analysis.get('total_clients', 0)}")
            logger.info(f"   - Clientes activos: {analysis.get('basic_stats', {}).get('active', 0)}")
            logger.info(f"   - Clientes inactivos: {analysis.get('basic_stats', {}).get('inactive', 0)}")
            logger.info(f"   - Con citas: {analysis.get('basic_stats', {}).get('with_appointments', 0)}")
            logger.info(f"   - Con documentos: {analysis.get('basic_stats', {}).get('with_documents', 0)}")
            
            # Mostrar segmentos
            segments = analysis.get('client_segments', {})
            logger.info(f"\n📊 Segmentación de clientes:")
            logger.info(f"   - Alto valor: {segments.get('high_value', 0)}")
            logger.info(f"   - Valor medio: {segments.get('medium_value', 0)}")
            logger.info(f"   - Bajo valor: {segments.get('low_value', 0)}")
            logger.info(f"   - En riesgo: {segments.get('at_risk', 0)}")
            logger.info(f"   - Nuevos: {segments.get('new', 0)}")
            
            # Patrones de comunicación
            comm = analysis.get('communication_patterns', {})
            email_stats = comm.get('email_stats', {})
            logger.info(f"\n📧 Patrones de comunicación:")
            logger.info(f"   - Emails enviados: {email_stats.get('total_sent', 0)}")
            logger.info(f"   - Tasa de apertura: {email_stats.get('open_rate', 0)}%")
            if email_stats.get('best_time'):
                logger.info(f"   - Mejor hora: {email_stats.get('best_time')}")
        
        # PASO 2: Generar datos de entrenamiento
        logger.info("\n🎓 PASO 2: Generando datos de entrenamiento...")
        training_data = await data_analyzer.generate_training_data()
        logger.info(f"✅ Generados {len(training_data)} ejemplos de entrenamiento")
        
        # PASO 3: Poblar memoria RAG con patrones exitosos
        logger.info("\n🧠 PASO 3: Poblando memoria RAG con patrones...")
        
        # Guardar patrones exitosos identificados
        success_patterns = analysis.get('success_patterns', {})
        for factor in success_patterns.get('high_conversion_factors', []):
            await rag_memory.remember_successful_strategy(
                strategy_type="conversion_factor",
                description=factor.get('description', ''),
                results={
                    "success_score": 0.9,
                    "count": factor.get('count', 0)
                }
            )
        
        # Guardar mejores prácticas
        for practice in success_patterns.get('best_practices', []):
            await rag_memory.remember_successful_strategy(
                strategy_type="best_practice",
                description=practice,
                results={"success_score": 0.85}
            )
        
        logger.info("✅ Memoria RAG poblada con patrones exitosos")
        
        # PASO 4: Generar insights
        logger.info("\n💡 PASO 4: Generando insights de memoria...")
        insights = await rag_memory.generate_insights()
        logger.info(f"✅ Insights generados:")
        logger.info(f"   - Total memorias: {insights.get('total_memories', 0)}")
        logger.info(f"   - Tipos de memoria: {list(insights.get('memory_breakdown', {}).keys())}")
        
        logger.info("\n" + "=" * 60)
        logger.info("🎉 ANÁLISIS COMPLETO FINALIZADO")
        logger.info("=" * 60)
        logger.info("\n✅ El sistema de IA ahora puede:")
        logger.info("   1. Aprender de interacciones pasadas")
        logger.info("   2. Buscar situaciones similares")
        logger.info("   3. Tomar decisiones basadas en experiencia")
        logger.info("   4. Mejorar continuamente con cada acción")
        logger.info("\n🚀 Sistema de IA inteligente ACTIVADO\n")
        
        # Cerrar conexión
        client.close()
        
    except Exception as e:
        logger.error(f"❌ Error en análisis: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(run_analysis())
