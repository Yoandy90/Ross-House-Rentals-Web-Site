# 🚀 Ross Travel Agency — Setup Guide
**Para el agente del nuevo workspace**

## Contexto rápido
Este blueprint viene del workspace `ross-house-rentals` donde se diseñó la arquitectura y el design system.

## Estructura entregada
```
ross-travel/
├── docs/ARCHITECTURE.md       ← LEE ESTO PRIMERO
├── preview/index.html         ← Preview visual del diseño (aprobado por usuario)
├── apps/{web,admin,mobile,api}/  ← Carpetas vacías, listas para llenar
├── packages/{ui,i18n,types}/     ← Carpetas vacías
└── modules/
    ├── connectors/{viator,sabre,amadeus,booking,duffel}/
    └── services/{ai-itinerary,search-aggregator,payments,whatsapp}/
```

## Decisiones ya tomadas con el usuario

### Identidad
- **Nombre marca:** Ross Travel Agency
- **Tagline:** "Curated Journeys"
- **Voice:** Sofisticada · Curada · Futurista · Confiable · Cálida
- **Benchmark:** Aman Resorts + Four Seasons + Apple

### Branding
- **Paleta:** Gold `#C9A567` + Ocean `#0A2540` + Cream `#FAF7F2` + Coral `#FF6B6B` (CTAs)
- **Tipografía:** Fraunces (display serif) + Inter (UI) + JetBrains Mono (precios/códigos)
- **Logo:** Casa con sol naciente, oro sobre cream/ocean (el usuario tiene logo propio en alta resolución)

### Stack obligatorio
- **Web:** Next.js 15 + React 19 + TypeScript 5.6 strict + Tailwind 4 + shadcn/ui + Framer Motion 12
- **Backend:** FastAPI (Python 3.12) + Motor (Mongo async) + Redis
- **Mobile:** Expo SDK 54 + expo-router
- **i18n:** next-intl con auto-detect IP (ES default → EN)
- **AI:** GPT-5.2 (Emergent LLM Key) + Gemini 3 Pro multimodal
- **Pagos:** Stripe NUEVO (cuenta separada de Ross House Rentals)
- **Email:** SendGrid (misma cuenta que Ross House Rentals)
- **SMS/WhatsApp:** Twilio (misma cuenta que Ross House Rentals)

### Afiliados / Connectors
- ✅ **Viator** — usuario ya tiene cuenta de Partner aprobada (pedirle credenciales)
- 🟡 **Sabre/IATA** — usuario está en proceso de acreditación. Stub preparado.
- 🟡 **Amadeus** — alternativa más fácil mientras espera IATA. Stub preparado.
- 🟡 **Duffel** — NDC moderno para vuelos sin necesidad de IATA. Recomendado para v1.
- 🔵 **Booking.com Affiliate** — aplicar en paralelo
- 🔵 **CLIA Cruceros** — futuro

### Datos de contacto (footer + WhatsApp)
- Mismos datos que Ross House Rentals (el usuario los configurará en admin panel después)

### Sprint 1 (semana 1) — orden recomendado
1. Setup Turborepo + Next.js 15 en `apps/web`
2. Copiar design tokens del preview HTML a `packages/ui/theme.ts`
3. Implementar landing exacta al `preview/index.html` (Hero + Destinations + AI Planner + Footer)
4. i18n auto-detect (`packages/i18n` con next-intl)
5. Backend FastAPI básico en `apps/api` (`/api/health`)
6. Viator connector en `modules/connectors/viator/`
7. Deploy preview a Vercel

### Sprint 2 — orden recomendado
8. Páginas Tour/Hotel/Activity con datos reales Viator
9. Booking flow con Stripe Checkout
10. Newsletter signup con SendGrid
11. WhatsApp Business widget flotante
12. AI Itinerary Builder (chat UI + GPT-5.2)

### Sprint 3 — Admin panel
13. Login admin (mismo patrón que Ross House Rentals)
14. CRUD: Custom Tours / Custom Hotels / Bookings / Leads / Newsletter Subscribers
15. Settings panel para credenciales API

### Sprint 4 — Mobile + Launch
16. Expo app con mismo design system
17. SEO completo + Blog seed (3 artículos)
18. Migración dominio rosstravelagency.com → Vercel
19. Build iOS para TestFlight vía botón Publish

## Notas importantes para el agente
- ❌ **NO compartir código con Ross House Rentals** — son productos separados
- ✅ **SÍ reusar conocimiento de patterns** (admin auth, Stripe flow, SendGrid templates)
- ⚠️ **Usuario habla español** — todas las respuestas en español
- 💡 **Usuario es semi-técnico** — explicar decisiones, no asumir conocimiento profundo
- 🎨 **El diseño preview tiene la aprobación del usuario** — replicarlo fielmente en Next.js
