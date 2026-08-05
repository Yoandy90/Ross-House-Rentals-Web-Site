# Ross Travel Agency — Architecture Blueprint
**Version 1.0** · **Status: Foundation Phase**

## 🎯 Vision
A world-class, futuristic travel platform that competes with Expedia + Booking + Kayak combined, but feels like Aman Resorts + Apple. Premium curation + AI-first UX + modular for any future provider (Viator, Sabre, Amadeus, CLIA, NDC, blockchain-based travel...).

## 🧩 Modular Provider System

Every external travel inventory provider lives in `/modules/connectors/<provider>/` and implements the same contract:

```typescript
interface TravelProvider {
  name: string;
  supportedProducts: ('flight' | 'hotel' | 'tour' | 'activity' | 'car' | 'cruise' | 'rail')[];
  authenticate(): Promise<AuthToken>;
  search(query: SearchQuery): Promise<Listing[]>;
  getDetail(id: string): Promise<ListingDetail>;
  checkAvailability(id: string, params: AvailParams): Promise<Availability>;
  book(payload: BookingPayload): Promise<BookingConfirmation>;
  cancel(bookingId: string): Promise<CancellationResult>;
  webhookHandler?(event: ProviderWebhook): Promise<void>;
}
```

**Active connectors today:**
- ✅ `viator` (tours/activities — already accredited)
- 🟡 `custom-tours` (in-house inventory)
- 🟡 `custom-hotels` (direct deals)

**Connectors prepared for activation (commented stubs from day 1):**
- 🔵 `sabre` (GDS — when IATA accreditation completes)
- 🔵 `amadeus` (alternate GDS, easier to activate than Sabre)
- 🔵 `booking` (hotels affiliate)
- 🔵 `expedia-ean` (hotels + flights affiliate)
- 🔵 `duffel` (modern NDC flights — works without IATA)
- 🔵 `hotelbeds` (B2B hotels)
- 🔵 `clia` (cruises — when CLIA accreditation)
- 🔵 `omio` (rail Europe)
- 🔵 `getyourguide` (alternative to Viator)

The `search-aggregator` service fans out a single user query to all enabled connectors in parallel via `Promise.allSettled`, normalizes results into the unified `Listing` schema, deduplicates, ranks by AI relevance + commission, and streams back to the UI.

## 🎨 Design System (Premium Spec)

### Brand Identity
- **Personality:** Sophisticated. Curated. Futuristic. Trustworthy. Warm.
- **Reference benchmarks:** Aman.com, Apple.com, fourseasons.com, kayak.com (UX speed), Booking.com (filter density)
- **Voice:** Elegant + concise. No marketing hype. Numbers > adjectives.

### Color Palette
```
Primary (Brand)
  --rt-gold:        #C9A567   (Royal gold — for premium accents)
  --rt-ocean:       #0A2540   (Deep ocean — primary text + nav bg)
  --rt-coral:       #FF6B6B   (Coral — promo CTAs only)

Surface
  --rt-cream:       #FAF7F2   (Warm cream — light bg)
  --rt-mist:        #F1ECE3   (Mist — alternate light bg)
  --rt-charcoal:    #1A1F2E   (Charcoal — dark mode bg)
  --rt-graphite:    #2A3142   (Graphite — dark mode surface)

Semantic
  --rt-success:     #00A36C   (Forest — confirmed bookings)
  --rt-warning:     #E8A33D   (Amber — price drops)
  --rt-danger:      #E63946   (Crimson — sold out)
  --rt-info:        #4A90E2   (Sky — informational)

Neutrals (8 stops)
  --rt-gray-50:     #FAFAFA
  --rt-gray-100:    #F5F5F5
  --rt-gray-200:    #E5E5E5
  --rt-gray-400:    #A3A3A3
  --rt-gray-600:    #525252
  --rt-gray-800:    #262626
  --rt-gray-900:    #171717
```

### Typography
```
Display (heroes, h1, oversized stats)
  Font:   Fraunces (variable, 100-900 + opsz)
  Weight: 300 light · 500 medium · 700 bold
  Style:  Modern serif with elegant terminals — Aman/Four Seasons vibe

Body (paragraphs, UI, forms)
  Font:   Inter (variable)
  Weight: 400 regular · 500 medium · 600 semibold · 700 bold

Mono (prices, codes, timestamps)
  Font:   JetBrains Mono
  Weight: 400 · 500

Type scale (golden ratio φ=1.618)
  Display XL    72/80     Hero h1
  Display L     56/64
  Display M     44/52
  Headline XL   36/44     Section titles
  Headline L    28/36
  Headline M    22/30
  Title         18/26
  Body L        17/26     Default paragraph
  Body M        15/24
  Caption       13/20
  Micro         11/16     Labels, badges
```

### Spacing — 4pt grid
`4 · 8 · 12 · 16 · 20 · 24 · 32 · 40 · 56 · 72 · 96 · 128 · 168 · 224`

### Motion
- Default easing: `cubic-bezier(0.22, 1, 0.36, 1)` (Apple-like ease-out-quint)
- Durations: 150 · 250 · 400 · 600ms
- Page transitions: View Transitions API (Chrome 111+, fallback to fade)
- Reduce motion: respect `prefers-reduced-motion`

### Border radii
`2 · 4 · 8 · 12 · 16 · 24 · 999 (pill)`

### Shadows (layered + colored)
```
shadow-xs:    0 1px 2px rgba(10,37,64,0.04)
shadow-sm:    0 1px 3px rgba(10,37,64,0.06), 0 1px 2px rgba(10,37,64,0.04)
shadow-md:    0 4px 12px rgba(10,37,64,0.08), 0 2px 4px rgba(10,37,64,0.04)
shadow-lg:    0 12px 32px rgba(10,37,64,0.10), 0 4px 8px rgba(10,37,64,0.06)
shadow-xl:    0 24px 64px rgba(10,37,64,0.12), 0 8px 16px rgba(10,37,64,0.08)
shadow-glow:  0 0 40px rgba(201,165,103,0.25)   // gold glow for premium CTAs
```

## 🚀 Tech Stack

### Frontend (Web)
- **Next.js 15** (App Router, Server Components, Server Actions, PPR)
- **React 19** (Suspense, useOptimistic)
- **TypeScript 5.6** strict
- **Tailwind CSS 4** + design tokens
- **shadcn/ui** + custom premium components
- **Framer Motion 12** + View Transitions API
- **Three.js + react-three-fiber** for 3D globe + AR previews
- **Mapbox GL JS** for maps
- **MDX** for blog/destination guides
- **next-intl** for i18n (ES/EN/PT/FR)

### Backend (API Gateway)
- **FastAPI** (Python 3.12) — async-first
- **MongoDB** (Motor async driver) — flexible for varied product schemas
- **Redis** — connector cache + rate limiting + Pub/Sub for live prices
- **Celery + Redis** — background jobs (price monitoring, email batches)
- **Stripe** — payments + Stripe Connect for tour operators
- **SendGrid** — transactional emails
- **WhatsApp Business API** — chat + booking confirmations
- **OpenTelemetry** + Datadog/Grafana — observability

### AI Layer
- **GPT-5.2** via Emergent LLM Key — itinerary builder, content generation
- **Gemini 3 Pro** — multimodal (analyze user-uploaded passport, ID, photos)
- **Vector DB (Pinecone or pgvector)** — semantic destination search
- **Whisper** — voice search ("encuentra vuelo barato a Cancún en julio")

### Mobile
- **Expo SDK 54** + **expo-router** (file-based)
- Shared types package with web
- **expo-image** for performant images
- **expo-notifications** for push (Emergent-managed)
- Native modules: camera (passport scan), location, calendar sync

### Hosting & Infra
- **Web/Admin:** Vercel Edge (global PoPs, sub-100ms TTFB)
- **API:** Railway/Fly.io (multi-region + autoscale)
- **MongoDB:** Atlas (M10+ for production)
- **Redis:** Upstash (serverless)
- **CDN:** Cloudflare R2 + Images (image transforms)
- **Analytics:** PostHog (product) + Plausible (privacy-friendly traffic)

## 📦 MVP Scope (v1.0 — first 4 weeks)

### Week 1: Foundation
- [x] Architecture blueprint (this doc)
- [ ] Monorepo setup (Turborepo)
- [ ] Design system + theme tokens
- [ ] i18n scaffolding (ES default + EN)
- [ ] Landing page hero + 3D globe

### Week 2: Content & Search
- [ ] Destinations page (10 hero destinations)
- [ ] Viator connector + tour search
- [ ] Tour detail page + booking flow
- [ ] Newsletter signup (SendGrid)
- [ ] WhatsApp floating widget

### Week 3: AI + Admin
- [ ] AI Itinerary Builder (chat UI)
- [ ] Admin panel scaffolding
- [ ] Custom tours CRUD
- [ ] Stripe Checkout integration
- [ ] Booking management

### Week 4: Polish + Launch
- [ ] SEO (sitemap, JSON-LD, OG images)
- [ ] Blog (3 seed destination guides)
- [ ] Reviews integration (Google Reviews API)
- [ ] Performance audit (LCP < 1.5s)
- [ ] Domain migration rosstravelagency.com

## 📦 v2.0 Roadmap
- Mobile app (iOS + Android via Expo build)
- Sabre/Amadeus GDS integration (after IATA)
- CLIA cruises
- Group/Corporate bookings portal
- AR destination previews (Apple Vision Pro)
- Crypto payments (USDC via Stripe Crypto)
- Loyalty program with NFT tickets
- White-label B2B portal (sell your platform to smaller agencies)

## 🌍 i18n Strategy
- **Default:** auto-detect via Accept-Language + IP geolocation
- **Supported v1:** Spanish, English
- **Roadmap v2:** Portuguese (Brazil), French
- **Translation method:** native ES/EN edits + DeepL API fallback for dynamic content
- **URL structure:** `/es/`, `/en/` (prefix-based routing)

## 💳 Payments Strategy
- **Booking deposit:** 20% via Stripe at checkout
- **Final payment:** 30 days before travel (auto-charge via Stripe saved card)
- **Cancellation:** Tiered refunds based on policy per provider
- **Currencies:** USD primary; auto-convert to local with Stripe FX
- **Future:** Stripe Connect to split commissions automatically with custom tour operators

## 🔐 Security & Compliance
- **PCI-DSS:** Stripe handles all card data; we never touch it
- **GDPR/CCPA:** cookie consent + data export endpoint
- **Seller of Travel:** display license # in footer (when granted)
- **CLIA:** display # in footer (when accredited)
- **IATA:** integrate IATA Pay (lower fees) once accredited
