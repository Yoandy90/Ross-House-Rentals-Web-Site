# Jasmine Apartments — Documentación del Proyecto

**Estado:** 🟡 Pre-LOI · Investigación + Contacto preliminar
**Última actualización:** Junio 2026
**Owner del proyecto:** Yoandy Ross (Ross House Rentals LLC)

---

## 📍 1. Identificación del activo

| Campo | Valor |
|-------|-------|
| **Nombre** | Jasmine Apartments |
| **Dirección principal** | 1301 S Maddox Ave, Dumas, TX 79029 *(también referenciada como 1310 S Maddox)* |
| **Tipo** | Portafolio multifamiliar (5 propiedades agrupadas) |
| **Total de unidades** | 142 unidades |
| **Mercado** | Dumas, Texas Panhandle (mismo mercado donde ya opera Ross House Rentals) |
| **Management actual** | Yardi 360 (in-house) — Asset Mgr + Resident Mgr + Secretary + Maintenance Crew |

---

## 👤 2. Propietario actual / Vendedor

| Campo | Valor |
|-------|-------|
| **Nombre** | Joe Kuruvila |
| **Empresa** | Kuruvila Realty Associates |
| **Email** | `joe3359@gmail.com` *(personal Gmail — confirmado vía Facebook posts oficiales)* |
| **Teléfono primario (FL)** | (954) 478-5071 |
| **Teléfono local (TX)** | (806) 922-7222 |
| **Facebook** | https://www.facebook.com/kuruvilarealty/ · https://www.facebook.com/jasmineapartments/ |
| **Listing público** | Publicado en LoopNet / Showcase (PDF flyer disponible) |

---

## 💰 3. Análisis financiero preliminar (datos de scripts existentes)

| Métrica | Valor estimado |
|---------|----------------|
| **Precio objetivo de compra** | USD $7,500,000 |
| **Precio inicialmente listado** | ~USD $9.94M (a confirmar en NDA / T-12 real) |
| **Estructura de financiamiento propuesta** | 75% Agency Loan (Fannie/Freddie) + 10% Seller Financing + 15% Sponsor + LP Equity |
| **NOI estimado** | A confirmar con T-12 |
| **Cap rate implícito @ $7.5M** | Calcular con NOI real |
| **Cash needed at close** | ~$825K (down + closing + reserves + Day-1 CapEx) |
| **Y5 sale price target** | NOI * 1.03^5 / 0.065 |

---

## 🏗️ 4. Plan técnico de integración (cuando se cierre la compra)

### Modelo de datos multi-unidad (NOT YET IMPLEMENTED — backlog P2)

**Estado actual del backend:**
- Schema actual `properties` es **single-unit** (1 propiedad = 1 unidad rentable)
- No soporta complejos multifamiliares con N unidades hijas

**Plan de extensión cuando se confirme la compra:**

```text
properties {
  _id, name, type: 'multifamily' | 'single_family',
  parent_property_id: null,  // para edificios padre
  total_units: int,          // 142 para Jasmine
  ...
}

units {  // NUEVA colección
  _id, property_id, unit_number, beds, baths, sqft,
  monthly_rent, status: 'occupied' | 'vacant' | 'maintenance',
  current_tenant_id, lease_start, lease_end, ...
}

rental_contracts {
  ...
  unit_id  // NUEVO campo — referencia específica a la unidad
}
```

**Endpoints nuevos requeridos:**
- `GET/POST /api/admin/properties/:id/units` — listar/crear unidades
- `PATCH /api/admin/units/:id` — editar unidad
- Migración: cada propiedad single-family existente se convierte en `total_units: 1` con una unidad implícita

**Frontend nuevo:**
- Vista "Property → Units grid" con ocupación visual estilo damero
- Filtros: por edificio, por status, por bed count
- Bulk operations (subir rent rolls Excel, marcar múltiples unidades, etc.)

---

## 📨 5. Estrategia de outreach (estado actual)

### ✅ Materiales ya generados (en `ross-house-backend/scripts/`):
- `send_jasmine_investor_pitchdeck.py` — Pitch para LP investors (8 páginas)
- `send_jasmine_investigation_pdf.py` — Análisis inicial del portafolio
- `send_jasmine_v2_final.py` — Final con strategy DSCR refi
- `send_jasmine_financing_toolkit.py` — Toolkit financiero
- `send_jasmine_owner_letter.py` (`/tmp/`) — Carta formal $7.5M (versión "agresiva", lista pero retenida)
- `send_jasmine_soft_inquiry.py` (`/tmp/`) — **Soft inquiry email** (versión con pedir llamada de 15-20 min)
- `send_jasmine_email_only_inquiry.py` (`/tmp/`) — **Email-Only Inquiry** ✅ ENVIADO Jun 2026 — 10 preguntas concretas, sin pedir llamada (recomendado para vendedores que prefieren responder por escrito)

### 🎯 Plan de aproximación recomendado

**Fase 1 — Soft Inquiry (AHORA, antes de tener prestamistas confirmados):**
- Mandar email informal a `joe3359@gmail.com` expresando interés
- Pedir: precio actual, T-12, rent roll, condición física, motivación de venta
- NO mencionar precio aún (regla M&A: quien menciona precio primero pierde)

**Fase 2 — Después de recibir números reales (1-2 semanas):**
- Hablar con prestamistas (Centennial Bank, Happy State Bank, DSCR lenders) con T-12 en mano
- Validar capital LP de inversionistas (soft commits)
- Recalcular cap rate y validar oferta máxima

**Fase 3 — Carta formal con número (cuando capital esté confirmado):**
- Usar `Jasmine_Owner_Letter_Ross_House.pdf` ya generado
- Ajustar precio según T-12 real
- Solicitar reunión presencial

**Fase 4 — LOI no vinculante:**
- Borrador de 1 página con términos clave
- Período de exclusividad 30-60 días

**Fase 5 — Due Diligence (30-45 días):**
- Inspección física, T-12 audit, Phase I environmental, title, rent roll

**Fase 6 — Cierre (Day 60-90):**
- Wire funds, take possession, transición de mgmt

---

## ⚠️ 6. Bloqueadores actuales

1. **Financiamiento NO confirmado todavía** — Yoandy debe conversar con prestamistas (DSCR cash-out refi en 2 SFR + agency loan para Jasmine). Sin prueba de fondos, ofertas formales son arriesgadas.
2. **Sin NDA firmada con seller** — no tenemos acceso a T-12 real ni rent roll completo.
3. **Backend multi-unit no implementado** — implementar SOLO cuando deal esté firme (no antes).

---

## 📋 7. Próximos pasos inmediatos

- [x] **Enviar email "soft inquiry"** a `joe3359@gmail.com` ✅ **ENVIADO 30-Jun-2026 16:39 UTC** (versión email-only con 10 preguntas concretas, BCC a yoandyross@gmail.com, status `delivered` confirmado por SendGrid)
- [x] **Resultado inquiry #1:** entregado + abierto 2 veces (30-Jun 18:09 UTC = apertura humana probable) · 0 clicks · **0 respuestas en 34 días**
- [x] **Follow-up #1 enviado** ✅ **04-Ago-2026 05:22 UTC** — corto, 3 preguntas decisivas: (1) ¿portafolio completo o venta separada por propiedad/fase? (2) ¿precio actual (paquete o por propiedad)? (3) ¿sigue en venta? · Tracker `jasmine_kuruvila_followup_2026_08_04` activo (cron 30 min)
- [ ] **Recomendado: LLAMAR a Joe** — (954) 478-5071 / (806) 922-7222 (email leído e ignorado → el teléfono es el canal correcto para deal de $7.5M)
- [ ] **Esperar respuesta del seller** (típicamente 3-7 días)
- [ ] **Conversar con prestamistas** (Centennial, Happy State, brokers DSCR + agency) — hacer en paralelo mientras se espera respuesta
- [ ] **Validar capital LP** (15 soft commits objetivo)
- [ ] Si responde, **firmar NDA** y solicitar T-12 + rent roll
- [ ] **Re-calcular oferta** con datos reales
- [ ] Solo entonces, **enviar LOI formal**
- [ ] Si NO responde en 7-10 días → enviar follow-up corto (script `send_jasmine_followup.py` pendiente de crear)

---

## 📎 8. Archivos relacionados

- `/app/ross-house-backend/scripts/send_jasmine_*.py` — Scripts de generación
- `/tmp/Jasmine_Owner_Letter.pdf` — Carta formal $7.5M (NO enviar todavía)
- `/tmp/Jasmine_Soft_Inquiry.pdf` — **Soft inquiry (RECOMENDADO enviar primero)**

---

*Documento generado automáticamente. Actualizar tras cada interacción con el seller o cambio de status.*
