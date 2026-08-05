# Baúl Seguro — Kit para replicar en otro proyecto

El documento completo con instrucciones + código adaptado (sin datos legacy, llaves nuevas independientes) fue entregado al usuario en el chat el 2026-06.

Archivos fuente originales de ESTE proyecto (referencia):
- vault_router_original.py (backend FastAPI)
- baul_page_original.tsx (Next.js /admin/baul)

Nota: el kit entregado elimina el soporte legacy (encrypted_number/nmi_vault_id de Ross Tax/Loans) y exige generar VAULT_ENCRYPTION_KEY y VAULT_JWT_SECRET nuevos en el proyecto destino para que NUNCA se comparta info de tarjetas entre proyectos.
