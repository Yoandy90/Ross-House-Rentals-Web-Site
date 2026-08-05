"""
Populate all legal documents for Ross Lending Solutions LLC.
Run: python3 populate_legal_docs.py
"""
import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
from datetime import datetime, timezone
import os
from dotenv import load_dotenv

load_dotenv()

MONGO_URL = os.getenv("MONGO_URL", "mongodb://localhost:27017")
DB_NAME = os.getenv("DB_NAME", "taxportal")

# ═══════════════════════════════════════════════════════════════════════════
# DOCUMENT 1: BUSINESS PLAN FINAL (COMBINED)
# ═══════════════════════════════════════════════════════════════════════════

BUSINESS_PLAN_ES = """
<h1 style="text-align:center; color:#059669;">ROSS LENDING SOLUTIONS LLC</h1>
<h2 style="text-align:center; color:#334155;">Plan de Negocio Integral — 2026-2028</h2>
<p style="text-align:center; color:#64748b; font-size:12px;">Versión Final Combinada | Mayo 2026 | CONFIDENCIAL</p>
<hr>

<h2>1. RESUMEN EJECUTIVO</h2>
<p>Ross Lending Solutions LLC es una empresa de préstamos regulada en el estado de Texas, operando bajo licencia OCCC (Office of Consumer Credit Commissioner) conforme al Texas Finance Code, Chapter 342. La empresa ofrece préstamos personales de corto y mediano plazo a la comunidad del Texas Panhandle, con enfoque en la comunidad hispana.</p>

<p><strong>Misión:</strong> Proveer acceso a crédito justo, transparente y regulado a familias trabajadoras que no califican para préstamos bancarios tradicionales.</p>

<p><strong>Diferenciador:</strong> Servicio completamente bilingüe (ES/EN), aprobación en 24 horas, sin cargos ocultos, tasas reguladas por el estado.</p>

<h2>2. MARCO REGULATORIO</h2>
<h3>2.1 Licencia OCCC — Texas Finance Code, Chapter 342</h3>
<p>Una sola licencia OCCC cubre AMBOS subcapítulos:</p>

<table border="1" cellpadding="8" cellspacing="0" style="width:100%; border-collapse:collapse; font-size:13px;">
<tr style="background:#059669; color:white;">
<th>Subcapítulo</th><th>Sección Legal</th><th>Tipo de Préstamo</th><th>Montos</th><th>Plazos</th><th>Tasas Máximas</th>
</tr>
<tr>
<td><strong>Subcapítulo F</strong></td>
<td>§342.251-§342.259</td>
<td>Corto plazo / Alta rotación</td>
<td>$100 - $1,500</td>
<td>1-3 meses</td>
<td>≤$270: 240% APR (20%/mes)<br>$271-$1,800: 180% APR (15%/mes)</td>
</tr>
<tr style="background:#f8fafc;">
<td><strong>Subcapítulo E</strong></td>
<td>§342.201-§342.214</td>
<td>Mediano/Largo plazo</td>
<td>$2,000 - $12,000</td>
<td>6-48 meses</td>
<td>≤$500: 30% APR<br>$501-$1,050: 24% APR<br>$1,051-$2,500: 18% APR<br>>$2,500: Techo Ch. 303</td>
</tr>
</table>

<h3>2.2 Cumplimiento Regulatorio</h3>
<ul>
<li><strong>Truth in Lending Act (TILA):</strong> Disclosure obligatorio de APR, cargos, calendario de pagos</li>
<li><strong>Regulation Z:</strong> Formato estándar de divulgación al consumidor</li>
<li><strong>FDCPA:</strong> Prácticas justas de cobro de deudas</li>
<li><strong>Texas Debt Collection Act:</strong> Regulaciones estatales de cobro</li>
<li><strong>Equal Credit Opportunity Act:</strong> No discriminación en otorgamiento de crédito</li>
</ul>

<h2>3. PRODUCTOS DE PRÉSTAMO</h2>

<h3>3.1 Producto 1: Préstamo Rápido (Subcapítulo F)</h3>
<p>Préstamos de corto plazo con alta rotación de capital. Principal generador de ingresos.</p>

<table border="1" cellpadding="8" cellspacing="0" style="width:100%; border-collapse:collapse; font-size:13px;">
<tr style="background:#f59e0b; color:white;">
<th>Monto</th><th>APR Legal Máx</th><th>Plazo</th><th>Interés/Cargo</th><th>Pago Total</th>
</tr>
<tr><td>$100</td><td>240%</td><td>1 mes</td><td>$15</td><td>$115</td></tr>
<tr style="background:#fffbeb;"><td>$200</td><td>240%</td><td>1 mes</td><td>$40</td><td>$240</td></tr>
<tr><td>$300</td><td>180%</td><td>1 mes</td><td>$45</td><td>$345</td></tr>
<tr style="background:#fffbeb;"><td>$500</td><td>180%</td><td>1 mes</td><td>$75</td><td>$575</td></tr>
<tr><td>$500</td><td>180%</td><td>2 meses</td><td>$110</td><td>$610</td></tr>
<tr style="background:#fffbeb;"><td>$1,000</td><td>180%</td><td>2 meses</td><td>$170</td><td>$1,170</td></tr>
<tr><td>$1,500</td><td>180%</td><td>3 meses</td><td>$240</td><td>$1,740</td></tr>
</table>

<h3>3.2 Producto 2: Préstamo A Plazos (Subcapítulo E)</h3>
<p>Préstamos de mediano y largo plazo con pagos fijos mensuales. Generan ingresos recurrentes estables.</p>

<table border="1" cellpadding="8" cellspacing="0" style="width:100%; border-collapse:collapse; font-size:13px;">
<tr style="background:#059669; color:white;">
<th>Monto</th><th>Tasa Blended</th><th>Plazo</th><th>Pago/Mes</th><th>Interés Total</th><th>Total</th>
</tr>
<tr><td>$2,000</td><td>~28%</td><td>12 meses</td><td>$130</td><td>$425</td><td>$2,425</td></tr>
<tr style="background:#f0fdf4;"><td>$3,000</td><td>~23%</td><td>12 meses</td><td>$195</td><td>$635</td><td>$3,635</td></tr>
<tr><td>$5,000</td><td>~21%</td><td>24 meses</td><td>$255</td><td>$1,245</td><td>$6,245</td></tr>
<tr style="background:#f0fdf4;"><td>$8,000</td><td>~20%</td><td>36 meses</td><td>$297</td><td>$2,825</td><td>$10,825</td></tr>
<tr><td>$12,000</td><td>~18%</td><td>48 meses</td><td>$353</td><td>$4,940</td><td>$16,940</td></tr>
</table>

<h3>3.3 Producto 3: Adelanto de Taxes</h3>
<p>Préstamo puente que se paga automáticamente del refund del IRS del cliente. Temporada: Enero-Abril.</p>
<table border="1" cellpadding="8" cellspacing="0" style="width:100%; border-collapse:collapse; font-size:13px;">
<tr style="background:#6366f1; color:white;">
<th>Monto</th><th>Plazo</th><th>Cargo</th><th>Pago del Refund</th>
</tr>
<tr><td>$200-$500</td><td>1-2 meses</td><td>Sub F rates</td><td>Se descuenta automáticamente</td></tr>
<tr style="background:#eef2ff;"><td>$500-$1,800</td><td>1-2 meses</td><td>Sub F rates</td><td>Se descuenta automáticamente</td></tr>
</table>

<h2>4. ESTRATEGIA DE CAPITAL</h2>

<h3>4.1 Opción A: 100% Corto Plazo (Máxima Ganancia)</h3>
<p>Capital inicial: $27,000 → 54 préstamos de $500/mes × $75 ganancia = <strong>$4,050/mes</strong></p>

<h3>4.2 Opción B: Híbrido (Recomendada)</h3>
<table border="1" cellpadding="8" cellspacing="0" style="width:100%; border-collapse:collapse; font-size:13px;">
<tr style="background:#334155; color:white;">
<th>Componente</th><th>Capital</th><th>Préstamos/Mes</th><th>Ganancia/Mes</th>
</tr>
<tr><td>Sub F — 70% ($18,900)</td><td>$18,900</td><td>~38</td><td>$2,850</td></tr>
<tr style="background:#f8fafc;"><td>Sub E — 30% ($8,100)</td><td>$8,100</td><td>~3</td><td>$160 (recurrente)</td></tr>
<tr style="background:#f0fdf4; font-weight:bold;"><td>TOTAL</td><td>$27,000</td><td>~41</td><td>$3,010+</td></tr>
</table>

<h3>4.3 Escalamiento con $80,000</h3>
<table border="1" cellpadding="8" cellspacing="0" style="width:100%; border-collapse:collapse; font-size:13px;">
<tr style="background:#334155; color:white;">
<th>Producto</th><th>Capital</th><th>Préstamos/Mes</th><th>Ganancia/Mes</th>
</tr>
<tr><td>Sub F $300 × 1m</td><td>$12,000</td><td>40</td><td>$1,920</td></tr>
<tr style="background:#f8fafc;"><td>Sub F $500 × 1m</td><td>$20,000</td><td>40</td><td>$3,000</td></tr>
<tr><td>Sub F $1,000 × 2m</td><td>$16,000</td><td>16</td><td>$2,768</td></tr>
<tr style="background:#f8fafc;"><td>Sub E $3,000 × 12m</td><td>$12,000</td><td>4</td><td>$212 (recurrente)</td></tr>
<tr><td>Sub E $5,000 × 24m</td><td>$12,000</td><td>2-3</td><td>$150 (recurrente)</td></tr>
<tr style="background:#f8fafc;"><td>Reserva emergencia</td><td>$8,000</td><td>—</td><td>Buffer</td></tr>
<tr style="background:#f0fdf4; font-weight:bold;"><td>TOTAL</td><td>$80,000</td><td>100+</td><td>$8,000+</td></tr>
</table>

<h2>5. MODELO DE INVERSIONISTAS</h2>
<h3>5.1 Estructura Legal</h3>
<p>Pagaré Privado (Note Agreement): El inversionista presta dinero a Ross Lending a tasa fija, y la empresa lo presta a tasas superiores.</p>

<h3>5.2 Niveles de Inversión</h3>
<table border="1" cellpadding="8" cellspacing="0" style="width:100%; border-collapse:collapse; font-size:13px;">
<tr style="background:#059669; color:white;">
<th>Tipo</th><th>Retorno Anual</th><th>Riesgo</th><th>Inversión Mínima</th>
</tr>
<tr><td>Pagaré Privado</td><td>8-10%</td><td>Bajo</td><td>$10,000</td></tr>
<tr style="background:#f0fdf4;"><td>Nota Participativa</td><td>10-12%</td><td>Moderado</td><td>$25,000</td></tr>
<tr><td>Participación en Ganancias</td><td>12-15%</td><td>Medio</td><td>$50,000</td></tr>
<tr style="background:#f0fdf4;"><td>Partnership</td><td>15-20%</td><td>Alto</td><td>$100,000</td></tr>
</table>

<h3>5.3 Exenciones SEC</h3>
<table border="1" cellpadding="8" cellspacing="0" style="width:100%; border-collapse:collapse; font-size:13px;">
<tr style="background:#334155; color:white;">
<th>Exención</th><th>Requisitos</th><th>Costo Legal</th><th>Fase</th>
</tr>
<tr><td>Texas §4005.012(a)(2)</td><td>Máx 15 inversionistas/12 meses, sofisticados, solo Texas</td><td>$0</td><td>Fase 1</td></tr>
<tr style="background:#f8fafc;"><td>Texas §4005.012(a)(1)</td><td>Máx 35 inversionistas, sin publicidad, solo Texas</td><td>$0</td><td>Fase 2</td></tr>
<tr><td>Federal Rule 506(b)</td><td>Máx 35 no-acreditados, PPM requerido, sin publicidad</td><td>$2,000-$5,000</td><td>Fase 2</td></tr>
<tr style="background:#f8fafc;"><td>Federal Rule 506(c)</td><td>Ilimitados acreditados, verificación de ingresos</td><td>$3,000-$8,000</td><td>Fase 3</td></tr>
</table>

<h2>6. PROYECCIÓN FINANCIERA A 12 MESES</h2>
<p><em>Escenario conservador: 70% reinversión, 8% default, gastos operativos incluidos.</em></p>

<table border="1" cellpadding="8" cellspacing="0" style="width:100%; border-collapse:collapse; font-size:13px;">
<tr style="background:#059669; color:white;">
<th>Mes</th><th>Capital ($27K)</th><th>Ganancia Acum.</th><th>Capital ($80K)</th><th>Ganancia Acum.</th>
</tr>
<tr><td>Mes 1</td><td>$27,000</td><td>$2,500</td><td>$80,000</td><td>$7,000</td></tr>
<tr style="background:#f0fdf4;"><td>Mes 3</td><td>$33,000</td><td>$8,500</td><td>$100,000</td><td>$25,000</td></tr>
<tr><td>Mes 6</td><td>$45,000</td><td>$22,000</td><td>$140,000</td><td>$65,000</td></tr>
<tr style="background:#f0fdf4;"><td>Mes 9</td><td>$60,000</td><td>$40,000</td><td>$190,000</td><td>$120,000</td></tr>
<tr><td>Mes 12</td><td>$80,000</td><td>$65,000</td><td>$250,000+</td><td>$190,000+</td></tr>
</table>

<h2>7. PLAN DE ACCIÓN — 90 DÍAS</h2>
<h3>Fase 1: Semanas 1-4 (Fundación)</h3>
<ul>
<li>Finalizar licencia OCCC (Cap. 342, Sub E y F)</li>
<li>Contratos legales: préstamos, TILA, ACH, pagarés</li>
<li>Cuenta bancaria empresarial + procesador de pagos</li>
<li>Sistemas: CRM, calculadora, portal de clientes</li>
<li>Primer préstamo de prueba con capital propio</li>
</ul>
<h3>Fase 2: Semanas 5-8 (Operación)</h3>
<ul>
<li>Lanzar 20-30 préstamos Sub F ($200-$500)</li>
<li>Activar sistema de cobros automatizados (ACH)</li>
<li>Marketing: comunidad local, referencias, redes sociales</li>
<li>Evaluar tasa de default real vs. proyectada</li>
</ul>
<h3>Fase 3: Semanas 9-12 (Escalamiento)</h3>
<ul>
<li>Introducir préstamos Sub E ($3,000+) para clientes recurrentes</li>
<li>Captar primer inversionista privado ($10,000-$25,000)</li>
<li>Evaluar resultados, ajustar estrategia</li>
<li>Documentar historial para futuras rondas de inversión</li>
</ul>

<h2>8. GESTIÓN DE RIESGOS</h2>
<table border="1" cellpadding="8" cellspacing="0" style="width:100%; border-collapse:collapse; font-size:13px;">
<tr style="background:#ef4444; color:white;">
<th>Riesgo</th><th>Probabilidad</th><th>Impacto</th><th>Mitigación</th>
</tr>
<tr><td>Default de clientes</td><td>15%</td><td>Alto</td><td>Diversificar en 50+ préstamos pequeños, verificación de ingresos, colateral en Sub E</td></tr>
<tr style="background:#fef2f2;"><td>Cambio regulatorio</td><td>5%</td><td>Alto</td><td>Operar estrictamente dentro de los límites OCCC, asesoría legal continua</td></tr>
<tr><td>Falta de capital</td><td>20%</td><td>Medio</td><td>Modelo de inversionistas, reinversión disciplinada, reserva de emergencia</td></tr>
<tr style="background:#fef2f2;"><td>Competencia</td><td>30%</td><td>Bajo</td><td>Servicio bilingüe diferenciado, aprobación rápida, relaciones comunitarias</td></tr>
</table>

<hr>
<p style="text-align:center; color:#64748b; font-size:11px;">
Ross Lending Solutions LLC | 305 Bruce Ave, Dumas, TX 79029 | (806) 934-2018 | info@rosslending.com<br>
Texas OCCC Regulated Lender License | Chapter 342, Subchapters E &amp; F<br>
EIN: [Pendiente] | NMLS: [Pendiente]<br>
© 2026 Ross Lending Solutions LLC — Todos los derechos reservados
</p>
"""

BUSINESS_PLAN_EN = """
<h1 style="text-align:center; color:#059669;">ROSS LENDING SOLUTIONS LLC</h1>
<h2 style="text-align:center; color:#334155;">Comprehensive Business Plan — 2026-2028</h2>
<p style="text-align:center; color:#64748b; font-size:12px;">Final Combined Version | May 2026 | CONFIDENTIAL</p>
<hr>

<h2>1. EXECUTIVE SUMMARY</h2>
<p>Ross Lending Solutions LLC is a Texas state-regulated lending company, operating under an OCCC (Office of Consumer Credit Commissioner) license pursuant to Texas Finance Code, Chapter 342. The company offers short and medium-term personal loans to the Texas Panhandle community, with a focus on the Hispanic community.</p>

<p><strong>Mission:</strong> Provide access to fair, transparent, and regulated credit to working families who don't qualify for traditional bank loans.</p>

<p><strong>Differentiator:</strong> Fully bilingual service (EN/ES), 24-hour approval, no hidden fees, state-regulated rates.</p>

<h2>2. REGULATORY FRAMEWORK</h2>
<h3>2.1 OCCC License — Texas Finance Code, Chapter 342</h3>
<p>A single OCCC license covers BOTH subchapters:</p>

<table border="1" cellpadding="8" cellspacing="0" style="width:100%; border-collapse:collapse; font-size:13px;">
<tr style="background:#059669; color:white;">
<th>Subchapter</th><th>Legal Section</th><th>Loan Type</th><th>Amounts</th><th>Terms</th><th>Maximum Rates</th>
</tr>
<tr>
<td><strong>Subchapter F</strong></td>
<td>§342.251-§342.259</td>
<td>Short-term / High rotation</td>
<td>$100 - $1,500</td>
<td>1-3 months</td>
<td>≤$270: 240% APR (20%/mo)<br>>$270: 180% APR (15%/mo)</td>
</tr>
<tr style="background:#f8fafc;">
<td><strong>Subchapter E</strong></td>
<td>§342.201-§342.214</td>
<td>Medium/Long-term</td>
<td>$2,000 - $12,000</td>
<td>6-48 months</td>
<td>≤$500: 30% APR<br>$501-$1,050: 24% APR<br>$1,051-$2,500: 18% APR<br>>$2,500: Ch. 303 ceiling</td>
</tr>
</table>

<h3>2.2 Regulatory Compliance</h3>
<ul>
<li><strong>Truth in Lending Act (TILA):</strong> Mandatory disclosure of APR, charges, payment schedule</li>
<li><strong>Regulation Z:</strong> Standard consumer disclosure format</li>
<li><strong>FDCPA:</strong> Fair debt collection practices</li>
<li><strong>Texas Debt Collection Act:</strong> State collection regulations</li>
<li><strong>Equal Credit Opportunity Act:</strong> Non-discrimination in credit granting</li>
</ul>

<h2>3. LOAN PRODUCTS</h2>

<h3>3.1 Product 1: Quick Loan (Subchapter F)</h3>
<table border="1" cellpadding="8" cellspacing="0" style="width:100%; border-collapse:collapse; font-size:13px;">
<tr style="background:#f59e0b; color:white;">
<th>Amount</th><th>Max Legal APR</th><th>Term</th><th>Interest/Charge</th><th>Total Payment</th>
</tr>
<tr><td>$100</td><td>240%</td><td>1 month</td><td>$15</td><td>$115</td></tr>
<tr style="background:#fffbeb;"><td>$200</td><td>240%</td><td>1 month</td><td>$40</td><td>$240</td></tr>
<tr><td>$300</td><td>180%</td><td>1 month</td><td>$45</td><td>$345</td></tr>
<tr style="background:#fffbeb;"><td>$500</td><td>180%</td><td>1 month</td><td>$75</td><td>$575</td></tr>
<tr><td>$500</td><td>180%</td><td>2 months</td><td>$110</td><td>$610</td></tr>
<tr style="background:#fffbeb;"><td>$1,000</td><td>180%</td><td>2 months</td><td>$170</td><td>$1,170</td></tr>
<tr><td>$1,500</td><td>180%</td><td>3 months</td><td>$240</td><td>$1,740</td></tr>
</table>

<h3>3.2 Product 2: Installment Loan (Subchapter E)</h3>
<table border="1" cellpadding="8" cellspacing="0" style="width:100%; border-collapse:collapse; font-size:13px;">
<tr style="background:#059669; color:white;">
<th>Amount</th><th>Blended Rate</th><th>Term</th><th>Monthly Payment</th><th>Total Interest</th><th>Total</th>
</tr>
<tr><td>$2,000</td><td>~28%</td><td>12 months</td><td>$130</td><td>$425</td><td>$2,425</td></tr>
<tr style="background:#f0fdf4;"><td>$3,000</td><td>~23%</td><td>12 months</td><td>$195</td><td>$635</td><td>$3,635</td></tr>
<tr><td>$5,000</td><td>~21%</td><td>24 months</td><td>$255</td><td>$1,245</td><td>$6,245</td></tr>
<tr style="background:#f0fdf4;"><td>$8,000</td><td>~20%</td><td>36 months</td><td>$297</td><td>$2,825</td><td>$10,825</td></tr>
<tr><td>$12,000</td><td>~18%</td><td>48 months</td><td>$353</td><td>$4,940</td><td>$16,940</td></tr>
</table>

<h3>3.3 Product 3: Tax Advance</h3>
<p>Bridge loan automatically repaid from client's IRS refund. Season: January-April.</p>

<h2>4. CAPITAL STRATEGY</h2>
<h3>4.1 Option A: 100% Short-Term (Maximum Profit)</h3>
<p>Starting capital: $27,000 → 54 loans of $500/mo × $75 profit = <strong>$4,050/month</strong></p>

<h3>4.2 Option B: Hybrid (Recommended)</h3>
<table border="1" cellpadding="8" cellspacing="0" style="width:100%; border-collapse:collapse; font-size:13px;">
<tr style="background:#334155; color:white;"><th>Component</th><th>Capital</th><th>Loans/Month</th><th>Profit/Month</th></tr>
<tr><td>Sub F — 70%</td><td>$18,900</td><td>~38</td><td>$2,850</td></tr>
<tr style="background:#f8fafc;"><td>Sub E — 30%</td><td>$8,100</td><td>~3</td><td>$160 (recurring)</td></tr>
<tr style="background:#f0fdf4; font-weight:bold;"><td>TOTAL</td><td>$27,000</td><td>~41</td><td>$3,010+</td></tr>
</table>

<h2>5. INVESTOR MODEL</h2>
<table border="1" cellpadding="8" cellspacing="0" style="width:100%; border-collapse:collapse; font-size:13px;">
<tr style="background:#059669; color:white;"><th>Type</th><th>Annual Return</th><th>Risk</th><th>Min Investment</th></tr>
<tr><td>Private Note</td><td>8-10%</td><td>Low</td><td>$10,000</td></tr>
<tr style="background:#f0fdf4;"><td>Participating Note</td><td>10-12%</td><td>Moderate</td><td>$25,000</td></tr>
<tr><td>Profit Sharing</td><td>12-15%</td><td>Medium</td><td>$50,000</td></tr>
<tr style="background:#f0fdf4;"><td>Partnership</td><td>15-20%</td><td>High</td><td>$100,000</td></tr>
</table>

<h3>5.1 SEC Exemptions</h3>
<table border="1" cellpadding="8" cellspacing="0" style="width:100%; border-collapse:collapse; font-size:13px;">
<tr style="background:#334155; color:white;"><th>Exemption</th><th>Requirements</th><th>Legal Cost</th><th>Phase</th></tr>
<tr><td>Texas §4005.012(a)(2)</td><td>Max 15 investors/12 months, sophisticated, Texas only</td><td>$0</td><td>Phase 1</td></tr>
<tr style="background:#f8fafc;"><td>Federal Rule 506(b)</td><td>Max 35 non-accredited, PPM required</td><td>$2,000-$5,000</td><td>Phase 2</td></tr>
<tr><td>Federal Rule 506(c)</td><td>Unlimited accredited, income verification</td><td>$3,000-$8,000</td><td>Phase 3</td></tr>
</table>

<h2>6. 12-MONTH FINANCIAL PROJECTION</h2>
<p><em>Conservative scenario: 70% reinvestment, 8% default, operating expenses included.</em></p>
<table border="1" cellpadding="8" cellspacing="0" style="width:100%; border-collapse:collapse; font-size:13px;">
<tr style="background:#059669; color:white;"><th>Month</th><th>Capital ($27K)</th><th>Accum. Profit</th><th>Capital ($80K)</th><th>Accum. Profit</th></tr>
<tr><td>Month 1</td><td>$27,000</td><td>$2,500</td><td>$80,000</td><td>$7,000</td></tr>
<tr style="background:#f0fdf4;"><td>Month 3</td><td>$33,000</td><td>$8,500</td><td>$100,000</td><td>$25,000</td></tr>
<tr><td>Month 6</td><td>$45,000</td><td>$22,000</td><td>$140,000</td><td>$65,000</td></tr>
<tr style="background:#f0fdf4;"><td>Month 9</td><td>$60,000</td><td>$40,000</td><td>$190,000</td><td>$120,000</td></tr>
<tr><td>Month 12</td><td>$80,000</td><td>$65,000</td><td>$250,000+</td><td>$190,000+</td></tr>
</table>

<h2>7. 90-DAY ACTION PLAN</h2>
<h3>Phase 1: Weeks 1-4 (Foundation)</h3>
<ul>
<li>Finalize OCCC license (Ch. 342, Sub E and F)</li>
<li>Legal contracts: loans, TILA, ACH, promissory notes</li>
<li>Business bank account + payment processor</li>
<li>Systems: CRM, calculator, client portal</li>
</ul>
<h3>Phase 2: Weeks 5-8 (Operations)</h3>
<ul>
<li>Launch 20-30 Sub F loans ($200-$500)</li>
<li>Activate automated collection system (ACH)</li>
<li>Marketing: local community, referrals, social media</li>
</ul>
<h3>Phase 3: Weeks 9-12 (Scaling)</h3>
<ul>
<li>Introduce Sub E loans ($3,000+) for returning clients</li>
<li>Secure first private investor ($10,000-$25,000)</li>
<li>Evaluate results, adjust strategy</li>
</ul>

<hr>
<p style="text-align:center; color:#64748b; font-size:11px;">
Ross Lending Solutions LLC | 305 Bruce Ave, Dumas, TX 79029 | (806) 934-2018<br>
Texas OCCC Regulated Lender License | Chapter 342, Subchapters E &amp; F<br>
© 2026 Ross Lending Solutions LLC — All rights reserved
</p>
"""

# ═══════════════════════════════════════════════════════════════════════════
# DOCUMENT 2: LOAN CONTRACT — SUBCHAPTER F (SHORT-TERM)
# ═══════════════════════════════════════════════════════════════════════════

CONTRACT_SUBF_ES = """
<h1 style="text-align:center;">CONTRATO DE PRÉSTAMO — SUBCAPÍTULO F</h1>
<h3 style="text-align:center; color:#64748b;">Texas Finance Code, Chapter 342, §342.251-§342.259</h3>
<hr>
<p><strong>PRESTAMISTA:</strong> Ross Lending Solutions LLC, 305 Bruce Ave, Dumas, TX 79029</p>
<p><strong>PRESTATARIO:</strong> ______________________________ Fecha: ___/___/______</p>
<p><strong>Dirección:</strong> ____________________________________________</p>
<p><strong>Teléfono:</strong> _________________ <strong>ID:</strong> _________________</p>
<hr>

<h3>TÉRMINOS DEL PRÉSTAMO</h3>
<table border="1" cellpadding="10" cellspacing="0" style="width:100%; border-collapse:collapse;">
<tr><td width="40%"><strong>Monto del Préstamo (Principal)</strong></td><td>$___________</td></tr>
<tr><td><strong>Cargo por Interés/Financiamiento</strong></td><td>$___________</td></tr>
<tr><td><strong>Tasa APR</strong></td><td>___________%</td></tr>
<tr><td><strong>Monto Total a Pagar</strong></td><td>$___________</td></tr>
<tr><td><strong>Número de Pagos</strong></td><td>___________</td></tr>
<tr><td><strong>Monto de Cada Pago</strong></td><td>$___________</td></tr>
<tr><td><strong>Fecha del Primer Pago</strong></td><td>___/___/______</td></tr>
<tr><td><strong>Fecha del Último Pago</strong></td><td>___/___/______</td></tr>
</table>

<h3>DIVULGACIÓN TILA (TRUTH IN LENDING)</h3>
<table border="1" cellpadding="10" cellspacing="0" style="width:100%; border-collapse:collapse;">
<tr style="background:#f8fafc;">
<td><strong>Annual Percentage Rate (APR)</strong><br>El costo de su crédito como tasa anual</td>
<td><strong>Finance Charge</strong><br>El monto en dólares que le costará el crédito</td>
<td><strong>Amount Financed</strong><br>El monto de crédito proporcionado</td>
<td><strong>Total of Payments</strong><br>Monto que habrá pagado al final</td>
</tr>
<tr style="text-align:center; font-size:18px; font-weight:bold;">
<td>___%</td><td>$_____</td><td>$_____</td><td>$_____</td>
</tr>
</table>

<h3>CONDICIONES</h3>
<ol>
<li><strong>Pago Anticipado:</strong> Puede pagar el total en cualquier momento sin penalidad por pago anticipado.</li>
<li><strong>Mora:</strong> Si un pago no se recibe dentro de 10 días después de la fecha de vencimiento, se cobrará un cargo por mora de $5.00 o 5% del pago, lo que sea menor.</li>
<li><strong>Incumplimiento:</strong> Si no realiza un pago durante 30 días, el préstamo se considerará en incumplimiento y el saldo total será exigible inmediatamente.</li>
<li><strong>Derechos del Prestatario:</strong> Usted tiene el derecho de recibir una copia de este contrato. Usted puede presentar quejas ante la OCCC al (800) 538-1579.</li>
<li><strong>Ley Aplicable:</strong> Este contrato se rige por las leyes del estado de Texas, específicamente el Texas Finance Code, Chapter 342, Subchapter F.</li>
</ol>

<h3>FIRMAS</h3>
<table style="width:100%;">
<tr>
<td style="width:50%; padding:20px;">
<p>_________________________________</p>
<p>Firma del Prestatario</p>
<p>Fecha: ___/___/______</p>
</td>
<td style="width:50%; padding:20px;">
<p>_________________________________</p>
<p>Ross Lending Solutions LLC</p>
<p>Fecha: ___/___/______</p>
</td>
</tr>
</table>
"""

CONTRACT_SUBF_EN = """
<h1 style="text-align:center;">LOAN AGREEMENT — SUBCHAPTER F</h1>
<h3 style="text-align:center; color:#64748b;">Texas Finance Code, Chapter 342, §342.251-§342.259</h3>
<hr>
<p><strong>LENDER:</strong> Ross Lending Solutions LLC, 305 Bruce Ave, Dumas, TX 79029</p>
<p><strong>BORROWER:</strong> ______________________________ Date: ___/___/______</p>
<p><strong>Address:</strong> ____________________________________________</p>
<p><strong>Phone:</strong> _________________ <strong>ID:</strong> _________________</p>
<hr>

<h3>LOAN TERMS</h3>
<table border="1" cellpadding="10" cellspacing="0" style="width:100%; border-collapse:collapse;">
<tr><td width="40%"><strong>Loan Amount (Principal)</strong></td><td>$___________</td></tr>
<tr><td><strong>Finance Charge</strong></td><td>$___________</td></tr>
<tr><td><strong>APR Rate</strong></td><td>___________%</td></tr>
<tr><td><strong>Total Amount to Pay</strong></td><td>$___________</td></tr>
<tr><td><strong>Number of Payments</strong></td><td>___________</td></tr>
<tr><td><strong>Amount of Each Payment</strong></td><td>$___________</td></tr>
<tr><td><strong>First Payment Date</strong></td><td>___/___/______</td></tr>
<tr><td><strong>Last Payment Date</strong></td><td>___/___/______</td></tr>
</table>

<h3>TRUTH IN LENDING DISCLOSURE (TILA)</h3>
<table border="1" cellpadding="10" cellspacing="0" style="width:100%; border-collapse:collapse;">
<tr style="background:#f8fafc;">
<td><strong>Annual Percentage Rate (APR)</strong><br>The cost of your credit as a yearly rate</td>
<td><strong>Finance Charge</strong><br>The dollar amount the credit will cost you</td>
<td><strong>Amount Financed</strong><br>The amount of credit provided to you</td>
<td><strong>Total of Payments</strong><br>Amount you will have paid after all payments</td>
</tr>
<tr style="text-align:center; font-size:18px; font-weight:bold;">
<td>___%</td><td>$_____</td><td>$_____</td><td>$_____</td>
</tr>
</table>

<h3>CONDITIONS</h3>
<ol>
<li><strong>Early Payment:</strong> You may pay the total balance at any time without prepayment penalty.</li>
<li><strong>Late Fee:</strong> If a payment is not received within 10 days after the due date, a late charge of $5.00 or 5% of the payment (whichever is less) will be assessed.</li>
<li><strong>Default:</strong> If you fail to make a payment for 30 days, the loan will be considered in default and the full balance will become immediately due.</li>
<li><strong>Borrower Rights:</strong> You have the right to receive a copy of this agreement. You may file complaints with the OCCC at (800) 538-1579.</li>
<li><strong>Governing Law:</strong> This agreement is governed by the laws of the State of Texas, specifically Texas Finance Code, Chapter 342, Subchapter F.</li>
</ol>

<h3>SIGNATURES</h3>
<table style="width:100%;"><tr>
<td style="width:50%; padding:20px;"><p>_________________________________</p><p>Borrower Signature</p><p>Date: ___/___/______</p></td>
<td style="width:50%; padding:20px;"><p>_________________________________</p><p>Ross Lending Solutions LLC</p><p>Date: ___/___/______</p></td>
</tr></table>
"""

# ═══════════════════════════════════════════════════════════════════════════
# DOCUMENT 3: LOAN CONTRACT — SUBCHAPTER E (INSTALLMENT)
# ═══════════════════════════════════════════════════════════════════════════

CONTRACT_SUBE_ES = """
<h1 style="text-align:center;">CONTRATO DE PRÉSTAMO A PLAZOS — SUBCAPÍTULO E</h1>
<h3 style="text-align:center; color:#64748b;">Texas Finance Code, Chapter 342, §342.201-§342.214</h3>
<hr>
<p><strong>PRESTAMISTA:</strong> Ross Lending Solutions LLC, 305 Bruce Ave, Dumas, TX 79029</p>
<p><strong>PRESTATARIO:</strong> ______________________________ Fecha: ___/___/______</p>
<p><strong>SSN (últimos 4):</strong> XXX-XX-______  <strong>ID:</strong> _________________</p>
<hr>

<h3>TÉRMINOS DEL PRÉSTAMO</h3>
<table border="1" cellpadding="10" cellspacing="0" style="width:100%; border-collapse:collapse;">
<tr><td><strong>Principal</strong></td><td>$___________</td></tr>
<tr><td><strong>APR (Tasa Anual)</strong></td><td>___________%</td></tr>
<tr><td><strong>Plazo</strong></td><td>___________ meses</td></tr>
<tr><td><strong>Pago Mensual Fijo</strong></td><td>$___________</td></tr>
<tr><td><strong>Total de Intereses</strong></td><td>$___________</td></tr>
<tr><td><strong>Total a Pagar</strong></td><td>$___________</td></tr>
<tr><td><strong>Garantía</strong></td><td>☐ Firma  ☐ Título de Auto  ☐ Otra: ____________</td></tr>
</table>

<h3>DIVULGACIÓN TILA</h3>
<table border="1" cellpadding="10" cellspacing="0" style="width:100%; border-collapse:collapse;">
<tr style="background:#f0fdf4; text-align:center;">
<td><strong>APR</strong><br>___%</td>
<td><strong>Finance Charge</strong><br>$_____</td>
<td><strong>Amount Financed</strong><br>$_____</td>
<td><strong>Total of Payments</strong><br>$_____</td>
</tr>
</table>

<h3>ESTRUCTURA DE TASAS ESCALONADAS (§342.201)</h3>
<table border="1" cellpadding="8" cellspacing="0" style="width:100%; border-collapse:collapse; font-size:12px;">
<tr style="background:#059669; color:white;"><th>Porción del Préstamo</th><th>Tasa APR Máxima</th></tr>
<tr><td>Primeros $500</td><td>30% APR</td></tr>
<tr><td>$500.01 - $1,050</td><td>24% APR</td></tr>
<tr><td>$1,050.01 - $2,500</td><td>18% APR</td></tr>
<tr><td>Más de $2,500</td><td>Techo Ch. 303</td></tr>
</table>

<h3>CALENDARIO DE PAGOS</h3>
<table border="1" cellpadding="6" cellspacing="0" style="width:100%; border-collapse:collapse; font-size:12px;">
<tr style="background:#f8fafc;"><th>#</th><th>Fecha</th><th>Pago</th><th>Principal</th><th>Interés</th><th>Balance</th></tr>
<tr><td>1</td><td>___/___/___</td><td>$_____</td><td>$_____</td><td>$_____</td><td>$_____</td></tr>
<tr><td>2</td><td>___/___/___</td><td>$_____</td><td>$_____</td><td>$_____</td><td>$_____</td></tr>
<tr><td colspan="6" style="text-align:center;">[Continuar según plazo]</td></tr>
</table>

<h3>CONDICIONES</h3>
<ol>
<li><strong>Pago Anticipado:</strong> Sin penalidad. El prestatario puede pagar el saldo total en cualquier momento.</li>
<li><strong>Mora:</strong> Cargo de $5.00 o 5% del pago (lo menor) si el pago se recibe más de 10 días después de la fecha de vencimiento.</li>
<li><strong>Colateral:</strong> Si aplica, el prestatario otorga al prestamista un derecho de garantía sobre el colateral descrito arriba.</li>
<li><strong>OCCC Complaints:</strong> Quejas: (800) 538-1579 | occc.texas.gov</li>
</ol>

<h3>FIRMAS</h3>
<table style="width:100%;"><tr>
<td style="width:50%; padding:20px;"><p>_________________________________</p><p>Firma del Prestatario</p><p>Fecha: ___/___/______</p></td>
<td style="width:50%; padding:20px;"><p>_________________________________</p><p>Ross Lending Solutions LLC</p><p>Fecha: ___/___/______</p></td>
</tr></table>
"""

CONTRACT_SUBE_EN = """
<h1 style="text-align:center;">INSTALLMENT LOAN AGREEMENT — SUBCHAPTER E</h1>
<h3 style="text-align:center; color:#64748b;">Texas Finance Code, Chapter 342, §342.201-§342.214</h3>
<hr>
<p><strong>LENDER:</strong> Ross Lending Solutions LLC, 305 Bruce Ave, Dumas, TX 79029</p>
<p><strong>BORROWER:</strong> ______________________________ Date: ___/___/______</p>
<p><strong>SSN (last 4):</strong> XXX-XX-______  <strong>ID:</strong> _________________</p>
<hr>

<h3>LOAN TERMS</h3>
<table border="1" cellpadding="10" cellspacing="0" style="width:100%; border-collapse:collapse;">
<tr><td><strong>Principal</strong></td><td>$___________</td></tr>
<tr><td><strong>APR (Annual Rate)</strong></td><td>___________%</td></tr>
<tr><td><strong>Term</strong></td><td>___________ months</td></tr>
<tr><td><strong>Fixed Monthly Payment</strong></td><td>$___________</td></tr>
<tr><td><strong>Total Interest</strong></td><td>$___________</td></tr>
<tr><td><strong>Total to Pay</strong></td><td>$___________</td></tr>
<tr><td><strong>Collateral</strong></td><td>☐ Signature  ☐ Vehicle Title  ☐ Other: ____________</td></tr>
</table>

<h3>TILA DISCLOSURE</h3>
<table border="1" cellpadding="10" cellspacing="0" style="width:100%; border-collapse:collapse;">
<tr style="background:#f0fdf4; text-align:center;">
<td><strong>APR</strong><br>___%</td><td><strong>Finance Charge</strong><br>$_____</td><td><strong>Amount Financed</strong><br>$_____</td><td><strong>Total of Payments</strong><br>$_____</td>
</tr>
</table>

<h3>TIERED RATE STRUCTURE (§342.201)</h3>
<table border="1" cellpadding="8" cellspacing="0" style="width:100%; border-collapse:collapse; font-size:12px;">
<tr style="background:#059669; color:white;"><th>Loan Portion</th><th>Maximum APR</th></tr>
<tr><td>First $500</td><td>30% APR</td></tr>
<tr><td>$500.01 - $1,050</td><td>24% APR</td></tr>
<tr><td>$1,050.01 - $2,500</td><td>18% APR</td></tr>
<tr><td>Over $2,500</td><td>Ch. 303 ceiling</td></tr>
</table>

<h3>CONDITIONS</h3>
<ol>
<li><strong>Prepayment:</strong> No penalty. Borrower may pay the full balance at any time.</li>
<li><strong>Late Fee:</strong> $5.00 or 5% of payment (whichever is less) if payment is received more than 10 days after due date.</li>
<li><strong>Collateral:</strong> If applicable, borrower grants lender a security interest in the collateral described above.</li>
<li><strong>OCCC Complaints:</strong> (800) 538-1579 | occc.texas.gov</li>
</ol>

<h3>SIGNATURES</h3>
<table style="width:100%;"><tr>
<td style="width:50%; padding:20px;"><p>_________________________________</p><p>Borrower Signature</p><p>Date: ___/___/______</p></td>
<td style="width:50%; padding:20px;"><p>_________________________________</p><p>Ross Lending Solutions LLC</p><p>Date: ___/___/______</p></td>
</tr></table>
"""

# ═══════════════════════════════════════════════════════════════════════════
# DOCUMENT 4: INVESTOR PROMISSORY NOTE
# ═══════════════════════════════════════════════════════════════════════════

INVESTOR_NOTE_ES = """
<h1 style="text-align:center;">PAGARÉ PRIVADO — NOTA DEL INVERSIONISTA</h1>
<h3 style="text-align:center; color:#64748b;">Exento de registro SEC bajo Texas Securities Act §4005.012</h3>
<hr>
<p><strong>EMISOR:</strong> Ross Lending Solutions LLC ("la Empresa")</p>
<p><strong>INVERSIONISTA:</strong> ______________________________ Fecha: ___/___/______</p>
<hr>

<h3>TÉRMINOS DE LA INVERSIÓN</h3>
<table border="1" cellpadding="10" cellspacing="0" style="width:100%; border-collapse:collapse;">
<tr><td><strong>Monto de Inversión</strong></td><td>$___________</td></tr>
<tr><td><strong>Tasa de Retorno Anual</strong></td><td>___________%</td></tr>
<tr><td><strong>Tipo de Nota</strong></td><td>☐ Pagaré Fijo (8-10%)  ☐ Participativa (10-12%)  ☐ Profit Share (12-15%)  ☐ Partnership (15-20%)</td></tr>
<tr><td><strong>Plazo</strong></td><td>___________ meses</td></tr>
<tr><td><strong>Pago de Intereses</strong></td><td>☐ Mensual  ☐ Trimestral  ☐ Al vencimiento</td></tr>
<tr><td><strong>Aviso de Retiro</strong></td><td>90 días de anticipación</td></tr>
</table>

<h3>DIVULGACIÓN DE RIESGOS</h3>
<p style="border:2px solid #ef4444; padding:15px; background:#fef2f2;">
<strong>⚠️ ADVERTENCIA DE INVERSIÓN:</strong> Esta inversión NO está asegurada por la FDIC ni por ninguna agencia gubernamental. Existe riesgo de pérdida parcial o total del capital invertido. Los rendimientos pasados no garantizan rendimientos futuros. El inversionista debe consultar con un asesor financiero independiente antes de invertir.
</p>

<h3>CONDICIONES</h3>
<ol>
<li>La Empresa utilizará los fondos exclusivamente para operaciones de préstamos regulados bajo licencia OCCC Texas.</li>
<li>El inversionista recibirá reportes mensuales del estado de su inversión.</li>
<li>Para retirar fondos antes del vencimiento, se requiere aviso por escrito con 90 días de anticipación.</li>
<li>En caso de liquidación, el inversionista tiene prioridad sobre los socios de la empresa.</li>
<li>Esta nota se emite bajo la exención Texas Securities Act §4005.012 y no requiere registro ante la SEC.</li>
</ol>

<h3>FIRMAS</h3>
<table style="width:100%;"><tr>
<td style="width:50%; padding:20px;"><p>_________________________________</p><p>Firma del Inversionista</p><p>Fecha: ___/___/______</p></td>
<td style="width:50%; padding:20px;"><p>_________________________________</p><p>Ross Lending Solutions LLC</p><p>Fecha: ___/___/______</p></td>
</tr></table>
"""

INVESTOR_NOTE_EN = """
<h1 style="text-align:center;">PRIVATE PROMISSORY NOTE — INVESTOR NOTE</h1>
<h3 style="text-align:center; color:#64748b;">Exempt from SEC registration under Texas Securities Act §4005.012</h3>
<hr>
<p><strong>ISSUER:</strong> Ross Lending Solutions LLC ("the Company")</p>
<p><strong>INVESTOR:</strong> ______________________________ Date: ___/___/______</p>
<hr>

<h3>INVESTMENT TERMS</h3>
<table border="1" cellpadding="10" cellspacing="0" style="width:100%; border-collapse:collapse;">
<tr><td><strong>Investment Amount</strong></td><td>$___________</td></tr>
<tr><td><strong>Annual Return Rate</strong></td><td>___________%</td></tr>
<tr><td><strong>Note Type</strong></td><td>☐ Fixed Note (8-10%)  ☐ Participating (10-12%)  ☐ Profit Share (12-15%)  ☐ Partnership (15-20%)</td></tr>
<tr><td><strong>Term</strong></td><td>___________ months</td></tr>
<tr><td><strong>Interest Payments</strong></td><td>☐ Monthly  ☐ Quarterly  ☐ At maturity</td></tr>
<tr><td><strong>Withdrawal Notice</strong></td><td>90 days advance notice</td></tr>
</table>

<h3>RISK DISCLOSURE</h3>
<p style="border:2px solid #ef4444; padding:15px; background:#fef2f2;">
<strong>⚠️ INVESTMENT WARNING:</strong> This investment is NOT insured by the FDIC or any government agency. There is risk of partial or total loss of invested capital. Past performance does not guarantee future returns. The investor should consult an independent financial advisor before investing.
</p>

<h3>CONDITIONS</h3>
<ol>
<li>The Company will use funds exclusively for regulated lending operations under Texas OCCC license.</li>
<li>The investor will receive monthly reports on their investment status.</li>
<li>To withdraw funds before maturity, 90 days written notice is required.</li>
<li>In case of liquidation, the investor has priority over company partners.</li>
<li>This note is issued under Texas Securities Act §4005.012 exemption and does not require SEC registration.</li>
</ol>

<h3>SIGNATURES</h3>
<table style="width:100%;"><tr>
<td style="width:50%; padding:20px;"><p>_________________________________</p><p>Investor Signature</p><p>Date: ___/___/______</p></td>
<td style="width:50%; padding:20px;"><p>_________________________________</p><p>Ross Lending Solutions LLC</p><p>Date: ___/___/______</p></td>
</tr></table>
"""

# ═══════════════════════════════════════════════════════════════════════════
# DOCUMENT 5: TILA DISCLOSURE FORM
# ═══════════════════════════════════════════════════════════════════════════

TILA_ES = """
<h1 style="text-align:center;">DIVULGACIÓN AL CONSUMIDOR</h1>
<h2 style="text-align:center; color:#64748b;">Truth in Lending Act (TILA) — Regulation Z</h2>
<hr>
<p><strong>Prestamista:</strong> Ross Lending Solutions LLC | OCCC License #[Pendiente]</p>
<p><strong>Prestatario:</strong> ______________________________ Fecha: ___/___/______</p>
<hr>

<h3 style="background:#059669; color:white; padding:10px;">DIVULGACIÓN FEDERAL REQUERIDA</h3>
<table border="2" cellpadding="12" cellspacing="0" style="width:100%; border-collapse:collapse;">
<tr>
<td style="width:25%; text-align:center; background:#f0fdf4;"><strong>ANNUAL PERCENTAGE RATE</strong><br><span style="font-size:11px;">El costo de su crédito como tasa anual</span><br><br><span style="font-size:24px; font-weight:bold;">___%</span></td>
<td style="width:25%; text-align:center; background:#fffbeb;"><strong>FINANCE CHARGE</strong><br><span style="font-size:11px;">El monto en dólares que le costará el crédito</span><br><br><span style="font-size:24px; font-weight:bold;">$_____</span></td>
<td style="width:25%; text-align:center; background:#f0fdf4;"><strong>AMOUNT FINANCED</strong><br><span style="font-size:11px;">El monto de crédito proporcionado a usted</span><br><br><span style="font-size:24px; font-weight:bold;">$_____</span></td>
<td style="width:25%; text-align:center; background:#fffbeb;"><strong>TOTAL OF PAYMENTS</strong><br><span style="font-size:11px;">El monto que habrá pagado al completar todos los pagos</span><br><br><span style="font-size:24px; font-weight:bold;">$_____</span></td>
</tr>
</table>

<h3>SUS DERECHOS COMO PRESTATARIO</h3>
<ul>
<li>Puede pagar anticipadamente sin penalidad en cualquier momento.</li>
<li>Tiene derecho a una copia de este documento y del contrato de préstamo.</li>
<li>Si cree que se ha violado alguna ley, puede presentar una queja ante la OCCC.</li>
<li>No se le puede discriminar por raza, color, religión, origen nacional, sexo, estado civil o edad.</li>
</ul>

<h3>CONTACTO PARA QUEJAS</h3>
<p><strong>Office of Consumer Credit Commissioner (OCCC)</strong><br>
Teléfono: (800) 538-1579 | Web: occc.texas.gov<br>
2601 N. Lamar Blvd, Austin, TX 78705</p>

<p style="text-align:center; margin-top:30px;">
<strong>Firma del Prestatario:</strong> _________________________________  Fecha: ___/___/______
</p>
"""

TILA_EN = """
<h1 style="text-align:center;">CONSUMER DISCLOSURE</h1>
<h2 style="text-align:center; color:#64748b;">Truth in Lending Act (TILA) — Regulation Z</h2>
<hr>
<p><strong>Lender:</strong> Ross Lending Solutions LLC | OCCC License #[Pending]</p>
<p><strong>Borrower:</strong> ______________________________ Date: ___/___/______</p>
<hr>

<h3 style="background:#059669; color:white; padding:10px;">REQUIRED FEDERAL DISCLOSURE</h3>
<table border="2" cellpadding="12" cellspacing="0" style="width:100%; border-collapse:collapse;">
<tr>
<td style="width:25%; text-align:center; background:#f0fdf4;"><strong>ANNUAL PERCENTAGE RATE</strong><br><span style="font-size:11px;">The cost of your credit as a yearly rate</span><br><br><span style="font-size:24px; font-weight:bold;">___%</span></td>
<td style="width:25%; text-align:center; background:#fffbeb;"><strong>FINANCE CHARGE</strong><br><span style="font-size:11px;">The dollar amount the credit will cost you</span><br><br><span style="font-size:24px; font-weight:bold;">$_____</span></td>
<td style="width:25%; text-align:center; background:#f0fdf4;"><strong>AMOUNT FINANCED</strong><br><span style="font-size:11px;">The amount of credit provided to you</span><br><br><span style="font-size:24px; font-weight:bold;">$_____</span></td>
<td style="width:25%; text-align:center; background:#fffbeb;"><strong>TOTAL OF PAYMENTS</strong><br><span style="font-size:11px;">The amount you will have paid when all payments are made</span><br><br><span style="font-size:24px; font-weight:bold;">$_____</span></td>
</tr>
</table>

<h3>YOUR BORROWER RIGHTS</h3>
<ul>
<li>You may prepay at any time without penalty.</li>
<li>You have the right to a copy of this document and your loan agreement.</li>
<li>If you believe any law has been violated, you may file a complaint with the OCCC.</li>
<li>You cannot be discriminated against based on race, color, religion, national origin, sex, marital status, or age.</li>
</ul>

<h3>COMPLAINT CONTACT</h3>
<p><strong>Office of Consumer Credit Commissioner (OCCC)</strong><br>
Phone: (800) 538-1579 | Web: occc.texas.gov<br>
2601 N. Lamar Blvd, Austin, TX 78705</p>

<p style="text-align:center; margin-top:30px;">
<strong>Borrower Signature:</strong> _________________________________  Date: ___/___/______
</p>
"""

# ═══════════════════════════════════════════════════════════════════════════
# DOCUMENT 6: ACH AUTHORIZATION
# ═══════════════════════════════════════════════════════════════════════════

ACH_ES = """
<h1 style="text-align:center;">AUTORIZACIÓN DE DÉBITO ACH</h1>
<h3 style="text-align:center; color:#64748b;">Autorización de Pago Electrónico</h3>
<hr>
<p>Yo, ______________________________, autorizo a <strong>Ross Lending Solutions LLC</strong> a debitar de mi cuenta bancaria los pagos de mi préstamo según los términos de mi contrato.</p>

<h3>INFORMACIÓN BANCARIA</h3>
<table border="1" cellpadding="10" cellspacing="0" style="width:100%; border-collapse:collapse;">
<tr><td><strong>Nombre del Banco</strong></td><td>____________________________</td></tr>
<tr><td><strong>Número de Ruta (Routing)</strong></td><td>____________________________</td></tr>
<tr><td><strong>Número de Cuenta</strong></td><td>____________________________</td></tr>
<tr><td><strong>Tipo de Cuenta</strong></td><td>☐ Checking (Corriente)  ☐ Savings (Ahorros)</td></tr>
</table>

<h3>TÉRMINOS</h3>
<ol>
<li>Esta autorización permanecerá vigente hasta que la cancele por escrito con 3 días de anticipación.</li>
<li>Los débitos se realizarán en las fechas de pago acordadas en el contrato de préstamo.</li>
<li>Si un débito es rechazado por fondos insuficientes, se podrá cobrar un cargo de $25.</li>
<li>Tiene el derecho de revocar esta autorización en cualquier momento notificando por escrito.</li>
<li>Ross Lending no compartirá su información bancaria con terceros.</li>
</ol>

<p style="border:1px solid #059669; padding:12px; background:#f0fdf4;">
<strong>NACHA Compliance:</strong> Este formulario cumple con las regulaciones de la National Automated Clearing House Association para autorizaciones de débito electrónico.
</p>

<h3>FIRMA</h3>
<p>Firma: _________________________________  Fecha: ___/___/______</p>
<p>Nombre impreso: ____________________________</p>
"""

ACH_EN = """
<h1 style="text-align:center;">ACH DEBIT AUTHORIZATION</h1>
<h3 style="text-align:center; color:#64748b;">Electronic Payment Authorization</h3>
<hr>
<p>I, ______________________________, authorize <strong>Ross Lending Solutions LLC</strong> to debit from my bank account the payments for my loan according to the terms of my agreement.</p>

<h3>BANKING INFORMATION</h3>
<table border="1" cellpadding="10" cellspacing="0" style="width:100%; border-collapse:collapse;">
<tr><td><strong>Bank Name</strong></td><td>____________________________</td></tr>
<tr><td><strong>Routing Number</strong></td><td>____________________________</td></tr>
<tr><td><strong>Account Number</strong></td><td>____________________________</td></tr>
<tr><td><strong>Account Type</strong></td><td>☐ Checking  ☐ Savings</td></tr>
</table>

<h3>TERMS</h3>
<ol>
<li>This authorization will remain in effect until cancelled in writing with 3 days advance notice.</li>
<li>Debits will be made on payment dates agreed in the loan contract.</li>
<li>If a debit is returned for insufficient funds, a fee of $25 may be charged.</li>
<li>You have the right to revoke this authorization at any time by providing written notice.</li>
<li>Ross Lending will not share your banking information with third parties.</li>
</ol>

<p style="border:1px solid #059669; padding:12px; background:#f0fdf4;">
<strong>NACHA Compliance:</strong> This form complies with the National Automated Clearing House Association regulations for electronic debit authorizations.
</p>

<h3>SIGNATURE</h3>
<p>Signature: _________________________________  Date: ___/___/______</p>
<p>Printed Name: ____________________________</p>
"""


# ═══════════════════════════════════════════════════════════════════════════
# POPULATE DATABASE
# ═══════════════════════════════════════════════════════════════════════════

ALL_DOCUMENTS = [
    {
        "title": "Plan de Negocio Integral 2026-2028",
        "title_en": "Comprehensive Business Plan 2026-2028",
        "category": "business_plan",
        "content_es": BUSINESS_PLAN_ES,
        "content_en": BUSINESS_PLAN_EN,
        "version": "1.0 Final",
    },
    {
        "title": "Contrato de Préstamo — Subcapítulo F (Corto Plazo)",
        "title_en": "Loan Agreement — Subchapter F (Short-Term)",
        "category": "contract",
        "content_es": CONTRACT_SUBF_ES,
        "content_en": CONTRACT_SUBF_EN,
        "version": "1.0",
    },
    {
        "title": "Contrato de Préstamo A Plazos — Subcapítulo E",
        "title_en": "Installment Loan Agreement — Subchapter E",
        "category": "contract",
        "content_es": CONTRACT_SUBE_ES,
        "content_en": CONTRACT_SUBE_EN,
        "version": "1.0",
    },
    {
        "title": "Pagaré Privado — Nota del Inversionista",
        "title_en": "Private Promissory Note — Investor Note",
        "category": "contract",
        "content_es": INVESTOR_NOTE_ES,
        "content_en": INVESTOR_NOTE_EN,
        "version": "1.0",
    },
    {
        "title": "Divulgación TILA — Truth in Lending",
        "title_en": "TILA Disclosure — Truth in Lending",
        "category": "disclosure",
        "content_es": TILA_ES,
        "content_en": TILA_EN,
        "version": "1.0",
    },
    {
        "title": "Autorización de Débito ACH",
        "title_en": "ACH Debit Authorization",
        "category": "authorization",
        "content_es": ACH_ES,
        "content_en": ACH_EN,
        "version": "1.0",
    },
]


async def main():
    client = AsyncIOMotorClient(MONGO_URL)
    db = client[DB_NAME]
    
    print(f"🔗 Connected to {DB_NAME}")
    
    for doc in ALL_DOCUMENTS:
        existing = await db.legal_documents.find_one({"title": doc["title"]})
        data = {
            **doc,
            "status": "active",
            "updated_at": datetime.now(timezone.utc),
        }
        if existing:
            await db.legal_documents.update_one({"_id": existing["_id"]}, {"$set": data})
            print(f"  ✅ Updated: {doc['title']}")
        else:
            data["created_at"] = datetime.now(timezone.utc)
            result = await db.legal_documents.insert_one(data)
            print(f"  ✅ Created: {doc['title']} ({result.inserted_id})")
    
    count = await db.legal_documents.count_documents({})
    print(f"\n📄 Total documents in database: {count}")
    
    client.close()

if __name__ == "__main__":
    asyncio.run(main())
