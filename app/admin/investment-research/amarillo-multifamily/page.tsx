'use client';

import React from 'react';
import { Printer, Download, TrendingUp, DollarSign, Building2, MapPin, Phone, ExternalLink, AlertTriangle, CheckCircle2, Target } from 'lucide-react';

export default function AmarilloMultifamilyAnalysis() {
  const printPDF = () => window.print();

  return (
    <div className="min-h-full bg-white text-slate-900 print:bg-white">
      {/* Toolbar (hidden on print) */}
      <div className="sticky top-0 z-10 bg-gradient-to-r from-slate-900 to-slate-800 text-white p-4 flex flex-wrap items-center justify-between gap-3 shadow-lg print:hidden">
        <div>
          <div className="text-xs text-blue-300 uppercase tracking-widest font-bold">Ross House Rentals · Investment Research</div>
          <h1 className="text-lg font-black">Análisis Multifamily · Amarillo TX 2026</h1>
        </div>
        <button onClick={printPDF} className="px-4 py-2 rounded-lg bg-gradient-to-r from-blue-500 to-violet-600 hover:brightness-110 text-sm font-bold flex items-center gap-2 shadow-lg">
          <Download className="w-4 h-4" /> Descargar PDF
        </button>
      </div>

      <div className="max-w-4xl mx-auto p-6 sm:p-10 print:p-8 print:max-w-none space-y-8">

        {/* Cover / Header */}
        <div className="border-b-4 border-red-600 pb-6 print:break-inside-avoid">
          <div className="flex items-start justify-between flex-wrap gap-4">
            <div>
              <div className="text-xs text-red-600 uppercase tracking-widest font-bold mb-1">Ross House Rentals LLC</div>
              <h1 className="text-3xl sm:text-4xl font-black text-slate-900 leading-tight">Análisis de Inversión Multifamily</h1>
              <h2 className="text-xl text-slate-600 font-semibold mt-1">Amarillo · Canyon · Dalhart · Texas Panhandle</h2>
              <div className="text-sm text-slate-500 mt-3">Reporte generado: {new Date().toLocaleDateString('es-US', { year: 'numeric', month: 'long', day: 'numeric' })}</div>
            </div>
            <div className="text-right text-xs text-slate-500">
              <div>Dumas, TX 79029</div>
              <div>(806) 934-2018</div>
              <div>rosshouserentals.com</div>
            </div>
          </div>
        </div>

        {/* Executive Summary */}
        <section className="print:break-inside-avoid">
          <SectionTitle icon={<Target className="w-5 h-5" />} title="Resumen Ejecutivo" />
          <div className="bg-slate-50 border-l-4 border-red-600 p-5 rounded-r-xl">
            <p className="text-slate-800 leading-relaxed mb-3">
              Amarillo TX presenta <b>3 oportunidades multifamily excepcionales</b> con cap rates de 8-10% (muy por encima del promedio nacional del 5-6%).
              El mercado se está calentando por el nuevo <b>Fermi America AI Data Center</b> que traerá demanda residencial.
              Como administradores locales en Dumas (45 min), Ross House Rentals está en posición ideal para expandirse a Amarillo con management propio.
            </p>
            <div className="grid grid-cols-3 gap-4 mt-4">
              <StatBox label="Cap Rate Máx." value="9.73%" color="emerald" />
              <StatBox label="Deals activos" value="6-10" color="blue" />
              <StatBox label="Distancia Dumas" value="45 min" color="violet" />
            </div>
          </div>
        </section>

        {/* Mercado */}
        <section className="print:break-inside-avoid">
          <SectionTitle icon={<TrendingUp className="w-5 h-5" />} title="Panorama del Mercado · Amarillo 2026" />
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="bg-slate-100 text-slate-700">
                <th className="border border-slate-200 px-3 py-2 text-left font-bold">Métrica</th>
                <th className="border border-slate-200 px-3 py-2 text-right font-bold">Valor</th>
              </tr>
            </thead>
            <tbody>
              {[
                ['Listings multifamily activos', '6-10 propiedades'],
                ['Rango de precios', '$252,500 - $9,280,000'],
                ['Precio promedio', '$1,251,250'],
                ['Precio por sqft promedio', '$170'],
                ['Cap rates típicos', '6.68% - 9.73% 🔥'],
                ['Sub-mercados hot', 'Downtown, SW Amarillo (Fermi Data Center)'],
                ['Distancia desde Dumas', '45 minutos por US-87'],
              ].map(([k, v], i) => (
                <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                  <td className="border border-slate-200 px-3 py-2 text-slate-700">{k}</td>
                  <td className="border border-slate-200 px-3 py-2 text-right font-semibold text-slate-900">{v}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        {/* Deal 1 · Patterson Place */}
        <section className="print:break-before-page">
          <SectionTitle icon={<Building2 className="w-5 h-5 text-yellow-500" />} title="🥇 DEAL #1 · Patterson Place Apartments" badge="RECOMENDADO" />

          <div className="bg-gradient-to-br from-yellow-50 to-amber-50 border-2 border-yellow-400 rounded-2xl p-5 mb-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <KpiBig label="Precio" value="$3,650,000" />
              <KpiBig label="Unidades" value="55" />
              <KpiBig label="Cap Rate" value="8.19%" highlight />
              <KpiBig label="Precio/Unidad" value="$66,363" />
            </div>
          </div>

          <PropertyDetail
            data={[
              ['Dirección', '3020 SW 27th Ave, Amarillo TX'],
              ['Tipo', 'Multifamily estabilizado con value-add potential'],
              ['NOI estabilizado', '~$298,988 / año'],
              ['Renta promedio implícita', '$550-650 / unidad / mes'],
              ['Ventaja estratégica', 'Cercano al Fermi America AI Data Center'],
              ['Broker', 'Kirk Chudej, CPM · FIMC Commercial Realty'],
              ['Teléfono broker', '(806) 358-7151'],
            ]}
          />

          <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-xl">
            <div className="font-bold text-blue-900 text-sm mb-2">🔗 Link directo:</div>
            <a href="https://www.fimcrealty.com/experience-portfolio/" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline text-sm break-all">
              https://www.fimcrealty.com/experience-portfolio/
            </a>
          </div>

          <FinancialAnalysis
            title="💰 Análisis Financiero · Patterson Place (55u)"
            purchasePrice={3650000}
            downPct={25}
            interestRate={7.5}
            years={30}
            noi={298988}
            managementSavings={40000}
          />
        </section>

        {/* Deal 2 · Portfolio */}
        <section className="print:break-before-page">
          <SectionTitle icon={<Building2 className="w-5 h-5 text-blue-500" />} title="🥈 DEAL #2 · Amarillo Portfolio (6 propiedades · 145 unidades)" />

          <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border-2 border-blue-400 rounded-2xl p-5 mb-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <KpiBig label="Precio total" value="$9,280,000" />
              <KpiBig label="Unidades" value="145" />
              <KpiBig label="Propiedades" value="6" />
              <KpiBig label="Precio/Unidad" value="$64,000" />
            </div>
          </div>

          <PropertyDetail
            data={[
              ['Ubicación', 'Amarillo + Canyon TX'],
              ['Amarillo Apartments', '2217 S Polk St (14,910 sqft, built 1926)'],
              ['Maddox Apartments', '1613 S Polk St (6,630 sqft, built 1951)'],
              ['Otras 4 propiedades', 'Detalles disponibles con broker'],
              ['Ventaja', 'Escala inmediata · Un solo cierre = 145 unidades'],
              ['Estrategia parcial', 'Puedes ofertar solo 2-3 buildings del portfolio'],
              ['Broker', 'Partners Real Estate'],
            ]}
          />

          <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-xl">
            <div className="font-bold text-blue-900 text-sm mb-2">🔗 Link directo:</div>
            <a href="https://www.loopnet.com/Listing/Amarillo-Portfolio/31468489/" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline text-sm break-all">
              https://www.loopnet.com/Listing/Amarillo-Portfolio/31468489/
            </a>
          </div>

          <FinancialAnalysis
            title="💰 Análisis Financiero · Portfolio (145u)"
            purchasePrice={9280000}
            downPct={30}
            interestRate={7.75}
            years={25}
            noi={780000}
            managementSavings={100000}
          />
        </section>

        {/* Deal 3 · Distressed */}
        <section className="print:break-before-page">
          <SectionTitle icon={<AlertTriangle className="w-5 h-5 text-red-500" />} title="🥉 DEAL #3 · 111 Units Distressed (Lender-Owned Potencial)" badge="ALTO RIESGO / ALTO RETORNO" />

          <div className="bg-gradient-to-br from-red-50 to-orange-50 border-2 border-red-400 rounded-2xl p-5 mb-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <KpiBig label="Unidades" value="111" />
              <KpiBig label="Ocupación actual" value="70%" />
              <KpiBig label="Ingresos actuales" value="$55K/mes" />
              <KpiBig label="Ingresos proforma" value="$75K/mes" highlight />
            </div>
          </div>

          <PropertyDetail
            data={[
              ['Ubicación', 'Amarillo TX (dirección específica no pública)'],
              ['Status', 'En venta · Posiblemente lender-owned (distressed)'],
              ['Ingresos anuales actuales', '$660,000/año'],
              ['Ingresos anuales proforma', '$900,000/año (con 95% occupancy)'],
              ['Upside potencial', '$240,000/año adicionales'],
              ['Cap rate potencial', '9-10% si se compra distressed'],
              ['Fuente', 'Facebook off-market post'],
            ]}
          />

          <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl">
              <div className="font-bold text-emerald-900 text-sm mb-1">✅ Upside</div>
              <ul className="text-xs text-emerald-800 space-y-1 list-disc list-inside">
                <li>Subir occupancy con Ross House Rentals SMS/Email campaigns</li>
                <li>Precio muy bajo por unidad (~$32K)</li>
                <li>Value-add clásico</li>
                <li>ROI 30%+ posible año 3-5</li>
              </ul>
            </div>
            <div className="p-4 bg-red-50 border border-red-200 rounded-xl">
              <div className="font-bold text-red-900 text-sm mb-1">⚠️ Riesgos</div>
              <ul className="text-xs text-red-800 space-y-1 list-disc list-inside">
                <li>Backlog de mantenimiento probable</li>
                <li>Tenant quality baja (evictions?)</li>
                <li>Requiere inspección física urgente</li>
                <li>Capital adicional para renovación</li>
              </ul>
            </div>
          </div>
        </section>

        {/* Roadmap 3 opciones */}
        <section className="print:break-before-page">
          <SectionTitle icon={<CheckCircle2 className="w-5 h-5" />} title="🎯 Estrategia Recomendada · 3 Opciones" />

          <div className="space-y-4">
            <RoadmapOption
              letter="A"
              title="Conservadora ⭐ RECOMENDADA"
              subtitle="Empieza con fourplex/8-plex en Amarillo ($400K-$900K)"
              color="emerald"
              bullets={[
                'Ubicación: SW Amarillo (Fermi Data Center) o Central (Polk St / SW 9th)',
                'Aprendes multi-unit management sin arriesgar mucho capital',
                'Financia con DSCR loan (no requiere income personal)',
                'Down payment: $100K-$225K · Cashflow año 1: $15K-$30K positivo',
                'Escala natural: después compras Patterson Place con confianza',
              ]}
            />
            <RoadmapOption
              letter="B"
              title="Agresiva"
              subtitle="Patterson Place (55u · $3.65M · 8.19% cap)"
              color="blue"
              bullets={[
                'Down payment ~25%: $912,500 cash',
                'Loan: $2,737,500 · Debt service anual: ~$230K',
                'Cashflow año 1 (con management propio): ~$110K positivo',
                'Cash-on-Cash Return: 12% · IRR 5 años: 18-22%',
                '8.19% cap rate es un STEAL en 2026 (raro encontrar)',
              ]}
            />
            <RoadmapOption
              letter="C"
              title="Aventurera"
              subtitle="111-unit distressed (negociar a $3.5M-$4M)"
              color="red"
              bullets={[
                'Precio/unidad target: $32K (super barato)',
                'Requiere capital reservado adicional: $500K-$1M para renovación',
                'Fix occupancy: usar AI Brain SMS campaigns → 70% → 95%',
                'NOI potencial: sube de $360K a $700K (2x en 3 años)',
                'ROI potencial 30%+ pero riesgo alto',
              ]}
            />
          </div>
        </section>

        {/* Paso a paso */}
        <section className="print:break-before-page">
          <SectionTitle icon={<Target className="w-5 h-5" />} title="📋 Paso a Paso · Próximos 60 Días" />
          <ol className="space-y-3 text-sm">
            <Step n={1} title="Elegir opción A, B o C" desc="Basado en cash disponible y tolerancia al riesgo. Recomendación: opción A si es primer multi-unit." />
            <Step n={2} title="Pre-aprobación de financiamiento" desc="Contactar 3 lenders para DSCR loan: (1) Kiavi, (2) Amerifirst, (3) local Amarillo bank (Herring National Bank). Meta: rate 7.25-8%, 25-30% down." />
            <Step n={3} title="Contactar broker principal" desc="Kirk Chudej (FIMC · 806-358-7151) para Patterson Place. Para portfolio 145u contactar Partners RE via LoopNet." />
            <Step n={4} title="Solicitar T-12 y Rent Roll" desc="Trailing 12 months profit & loss + current rent roll con cada tenant. NO firmar LOI sin estos documentos." />
            <Step n={5} title="Underwriting con Ross House Rentals data" desc="Analizar contra tu track record en Dumas. Ajustar por: management interno (-40% expenses), tu marketing SMS/email (+5% occupancy)." />
            <Step n={6} title="Property inspection física" desc="Volar/manejar 45 min a Amarillo. Ver TODAS las unidades (no solo el modelo). Contratar inspector estructural: $500-$1,500." />
            <Step n={7} title="LOI (Letter of Intent) no vinculante" desc="Ofertar ~10-15% bajo asking. Incluir: cierre 45 días, contingencia inspección + financiamiento + apraisal." />
            <Step n={8} title="Contract + Earnest Money" desc="Depósito típico: 1-2% del precio ($36K en Patterson). Tiempo de due diligence: 30 días." />
            <Step n={9} title="Due diligence exhaustivo" desc="Environmental (Phase 1 ESA), title, survey, appraisal, insurance quotes, property manager licensing (si aplica)." />
            <Step n={10} title="Closing + Take-over Day 1" desc="Notificar a tenants del cambio de owner. Rebrand como Ross House Rentals. Deploy AI Brain SMS system para retención." />
          </ol>
        </section>

        {/* Contactos */}
        <section className="print:break-inside-avoid">
          <SectionTitle icon={<Phone className="w-5 h-5" />} title="📞 Contactos Clave" />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <ContactCard name="Kirk Chudej, CPM" role="Broker · FIMC Commercial Realty" phone="(806) 358-7151" deal="Patterson Place · 55u" />
            <ContactCard name="Partners Real Estate" role="Broker · LoopNet Portfolio" phone="Ver LoopNet listing" deal="Amarillo Portfolio · 145u" />
            <ContactCard name="XIT Real Estate" role="Broker Dalhart" phone="(806) 249-4523" deal="Off-market Dalhart" />
            <ContactCard name="Front Gate Property Solutions" role="Broker Dalhart · Country Inn Apts" phone="(806) 244-8000" deal="Off-market Dalhart" />
          </div>
        </section>

        {/* Footer */}
        <div className="border-t-2 border-slate-200 pt-4 text-xs text-slate-500 text-center print:mt-8">
          <div className="font-bold text-slate-700">Ross House Rentals LLC · Investment Research Report</div>
          <div>Dumas, TX 79029 · rosshouserentals.com · (806) 934-2018</div>
          <div className="mt-1">Data compilada de: LoopNet · Crexi · FIMC Realty · XIT Real Estate · Facebook off-market posts</div>
          <div className="mt-1 italic">Este análisis es solo informativo. No constituye asesoría financiera. Consulta con CPA y abogado antes de invertir.</div>
        </div>

      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          @page { size: letter; margin: 0.5in; }
          body { print-color-adjust: exact; -webkit-print-color-adjust: exact; }
        }
      `}} />
    </div>
  );
}

// ─── Sub-components ──────────────────────────────────────────────

function SectionTitle({ icon, title, badge }: { icon: React.ReactNode; title: string; badge?: string }) {
  return (
    <div className="flex items-center gap-2 mb-3 print:mb-2">
      <div className="text-red-600">{icon}</div>
      <h2 className="text-xl font-black text-slate-900 flex-1">{title}</h2>
      {badge && <span className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest bg-red-600 text-white rounded-full">{badge}</span>}
    </div>
  );
}

function StatBox({ label, value, color }: { label: string; value: string; color: string }) {
  const map: Record<string, string> = {
    emerald: 'bg-emerald-100 border-emerald-300 text-emerald-900',
    blue: 'bg-blue-100 border-blue-300 text-blue-900',
    violet: 'bg-violet-100 border-violet-300 text-violet-900',
  };
  return (
    <div className={`p-3 rounded-xl border ${map[color]} text-center`}>
      <div className="text-[10px] uppercase font-bold tracking-widest opacity-70">{label}</div>
      <div className="text-lg font-black mt-1">{value}</div>
    </div>
  );
}

function KpiBig({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className={`p-3 rounded-lg ${highlight ? 'bg-red-600 text-white' : 'bg-white border border-slate-200'}`}>
      <div className={`text-[10px] uppercase font-bold tracking-widest ${highlight ? 'text-red-100' : 'text-slate-500'}`}>{label}</div>
      <div className={`text-xl font-black mt-0.5 ${highlight ? 'text-white' : 'text-slate-900'}`}>{value}</div>
    </div>
  );
}

function PropertyDetail({ data }: { data: string[][] }) {
  return (
    <table className="w-full border-collapse text-sm">
      <tbody>
        {data.map(([k, v], i) => (
          <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
            <td className="border border-slate-200 px-3 py-2 text-slate-600 font-semibold w-1/3">{k}</td>
            <td className="border border-slate-200 px-3 py-2 text-slate-900">{v}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function FinancialAnalysis({ title, purchasePrice, downPct, interestRate, years, noi, managementSavings }: {
  title: string;
  purchasePrice: number;
  downPct: number;
  interestRate: number;
  years: number;
  noi: number;
  managementSavings: number;
}) {
  const downPayment = purchasePrice * (downPct / 100);
  const loanAmount = purchasePrice - downPayment;
  const monthlyRate = interestRate / 100 / 12;
  const numPayments = years * 12;
  const monthlyPayment = (loanAmount * monthlyRate * Math.pow(1 + monthlyRate, numPayments)) / (Math.pow(1 + monthlyRate, numPayments) - 1);
  const annualDebtService = monthlyPayment * 12;
  const cashflowBase = noi - annualDebtService;
  const cashflowWithMgmt = cashflowBase + managementSavings;
  const capRate = (noi / purchasePrice) * 100;
  const cocReturn = (cashflowWithMgmt / downPayment) * 100;
  const fmt = (n: number) => n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });

  return (
    <div className="mt-4 bg-gradient-to-br from-slate-50 to-slate-100 border border-slate-200 rounded-xl p-4 print:break-inside-avoid">
      <div className="font-bold text-slate-900 mb-3 text-sm">{title}</div>
      <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
        <div className="text-slate-600">Precio de compra</div><div className="text-right font-semibold">{fmt(purchasePrice)}</div>
        <div className="text-slate-600">Down payment ({downPct}%)</div><div className="text-right font-semibold">{fmt(downPayment)}</div>
        <div className="text-slate-600">Loan amount</div><div className="text-right font-semibold">{fmt(loanAmount)}</div>
        <div className="text-slate-600">Interest rate</div><div className="text-right font-semibold">{interestRate}%</div>
        <div className="text-slate-600">Amortización</div><div className="text-right font-semibold">{years} años</div>
        <div className="text-slate-600">Pago mensual (P&I)</div><div className="text-right font-semibold">{fmt(monthlyPayment)}</div>
        <div className="text-slate-600">Debt service anual</div><div className="text-right font-semibold">{fmt(annualDebtService)}</div>
        <div className="col-span-2 border-t border-slate-300 my-2"></div>
        <div className="text-slate-600">NOI declarado</div><div className="text-right font-semibold">{fmt(noi)}</div>
        <div className="text-slate-600">Ahorro management interno</div><div className="text-right font-semibold text-emerald-600">+ {fmt(managementSavings)}</div>
        <div className="text-slate-600 font-bold">NOI ajustado (Ross House)</div><div className="text-right font-black text-emerald-700">{fmt(noi + managementSavings)}</div>
        <div className="col-span-2 border-t border-slate-300 my-2"></div>
        <div className="text-slate-900 font-bold text-sm">Cash flow anual</div><div className="text-right font-black text-lg text-emerald-700">{fmt(cashflowWithMgmt)}</div>
        <div className="text-slate-900 font-bold text-sm">Cap Rate</div><div className="text-right font-black text-lg text-blue-700">{capRate.toFixed(2)}%</div>
        <div className="text-slate-900 font-bold text-sm">Cash-on-Cash Return</div><div className="text-right font-black text-lg text-violet-700">{cocReturn.toFixed(2)}%</div>
      </div>
    </div>
  );
}

function RoadmapOption({ letter, title, subtitle, color, bullets }: { letter: string; title: string; subtitle: string; color: string; bullets: string[] }) {
  const map: Record<string, string> = {
    emerald: 'bg-emerald-50 border-emerald-400 [&_.opt]:bg-emerald-600',
    blue: 'bg-blue-50 border-blue-400 [&_.opt]:bg-blue-600',
    red: 'bg-red-50 border-red-400 [&_.opt]:bg-red-600',
  };
  return (
    <div className={`border-2 rounded-xl p-4 ${map[color]}`}>
      <div className="flex items-center gap-3 mb-2">
        <div className="opt w-10 h-10 rounded-lg flex items-center justify-center text-white font-black text-lg">{letter}</div>
        <div>
          <div className="font-black text-slate-900 text-base">{title}</div>
          <div className="text-xs text-slate-600">{subtitle}</div>
        </div>
      </div>
      <ul className="text-sm text-slate-700 space-y-1 mt-2">
        {bullets.map((b, i) => <li key={i} className="flex gap-2"><span className="text-slate-400">•</span>{b}</li>)}
      </ul>
    </div>
  );
}

function Step({ n, title, desc }: { n: number; title: string; desc: string }) {
  return (
    <li className="flex gap-3 pb-2 border-b border-slate-100 last:border-0">
      <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-red-500 to-red-700 text-white font-black flex items-center justify-center text-sm flex-shrink-0">{n}</div>
      <div className="flex-1">
        <div className="font-bold text-slate-900">{title}</div>
        <div className="text-xs text-slate-600 leading-relaxed">{desc}</div>
      </div>
    </li>
  );
}

function ContactCard({ name, role, phone, deal }: { name: string; role: string; phone: string; deal: string }) {
  return (
    <div className="border border-slate-200 rounded-xl p-3 bg-white">
      <div className="font-bold text-slate-900 text-sm">{name}</div>
      <div className="text-xs text-slate-500 mb-1.5">{role}</div>
      <div className="text-sm font-semibold text-red-600 flex items-center gap-1.5"><Phone className="w-3 h-3" /> {phone}</div>
      <div className="text-[10px] text-slate-500 mt-1 uppercase tracking-wider">Para: {deal}</div>
    </div>
  );
}
