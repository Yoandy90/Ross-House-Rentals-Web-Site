#!/usr/bin/env python3
"""
Script para enviar lista de terrenos en Dumas TX por email
"""
import os
import sys
from dotenv import load_dotenv
from sendgrid import SendGridAPIClient
from sendgrid.helpers.mail import Mail, Email, To, Content

load_dotenv('/app/backend/.env')

SENDGRID_API_KEY = os.getenv('SENDGRID_API_KEY')
FROM_EMAIL = os.getenv('SENDGRID_FROM_EMAIL', 'info@rosstaxpreparation.com')
TO_EMAIL = 'yoandyross@gmail.com'

html_content = """
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background-color:#f4f4f4;font-family:Arial,Helvetica,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f4;padding:20px 0;">
<tr><td align="center">
<table width="700" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:8px;overflow:hidden;">

<!-- HEADER -->
<tr>
<td style="background:linear-gradient(135deg,#0f766e,#14b8a6);padding:30px;text-align:center;">
  <h1 style="color:#ffffff;margin:0;font-size:26px;">&#127966; Terrenos en Venta - Dumas, Texas</h1>
  <p style="color:rgba(255,255,255,0.9);margin:10px 0 0;font-size:14px;">Moore County &bull; Listados activos + Métodos para encontrar terrenos NO listados</p>
</td>
</tr>

<!-- TERRENOS LISTADOS -->
<tr>
<td style="padding:24px;">
  <table width="100%" cellpadding="0" cellspacing="0" style="border:2px solid #14b8a6;border-radius:8px;overflow:hidden;">
    <tr><td style="background-color:#14b8a6;padding:10px 16px;">
      <span style="color:#ffffff;font-weight:bold;font-size:14px;">&#128204; TERRENOS LISTADOS ACTUALMENTE (Zillow, LandWatch, Redfin)</span>
    </td></tr>
    <tr><td style="padding:16px;">
      <table width="100%" cellpadding="8" cellspacing="0" style="border-collapse:collapse;">
        <tr style="background-color:#f0fdfa;">
          <th style="text-align:left;padding:8px 10px;color:#0f766e;font-size:11px;border-bottom:2px solid #14b8a6;">#</th>
          <th style="text-align:left;padding:8px 10px;color:#0f766e;font-size:11px;border-bottom:2px solid #14b8a6;">DIRECCIÓN</th>
          <th style="text-align:center;padding:8px 10px;color:#0f766e;font-size:11px;border-bottom:2px solid #14b8a6;">ACRES</th>
          <th style="text-align:right;padding:8px 10px;color:#0f766e;font-size:11px;border-bottom:2px solid #14b8a6;">PRECIO</th>
          <th style="text-align:right;padding:8px 10px;color:#0f766e;font-size:11px;border-bottom:2px solid #14b8a6;">$/ACRE</th>
          <th style="text-align:center;padding:8px 10px;color:#0f766e;font-size:11px;border-bottom:2px solid #14b8a6;">LINK</th>
        </tr>
        <tr>
          <td style="padding:8px 10px;border-bottom:1px solid #f0fdfa;color:#334155;">1</td>
          <td style="padding:8px 10px;border-bottom:1px solid #f0fdfa;color:#334155;font-weight:bold;">1600 Madison Ave</td>
          <td style="padding:8px 10px;border-bottom:1px solid #f0fdfa;color:#334155;text-align:center;">0.15</td>
          <td style="padding:8px 10px;border-bottom:1px solid #f0fdfa;color:#16a34a;font-weight:bold;text-align:right;">$31,500</td>
          <td style="padding:8px 10px;border-bottom:1px solid #f0fdfa;color:#64748b;text-align:right;">$210,000</td>
          <td style="padding:8px 10px;border-bottom:1px solid #f0fdfa;text-align:center;"><a href="https://www.zillow.com/homedetails/1600-Madison-Ave-Dumas-TX-79029/231867079_zpid/" style="color:#4f46e5;font-weight:bold;">Ver</a></td>
        </tr>
        <tr style="background-color:#fafffe;">
          <td style="padding:8px 10px;border-bottom:1px solid #f0fdfa;color:#334155;">2</td>
          <td style="padding:8px 10px;border-bottom:1px solid #f0fdfa;color:#334155;font-weight:bold;">10961 Peggy Ln</td>
          <td style="padding:8px 10px;border-bottom:1px solid #f0fdfa;color:#334155;text-align:center;">1.47</td>
          <td style="padding:8px 10px;border-bottom:1px solid #f0fdfa;color:#16a34a;font-weight:bold;text-align:right;">$53,525</td>
          <td style="padding:8px 10px;border-bottom:1px solid #f0fdfa;color:#64748b;text-align:right;">$36,411</td>
          <td style="padding:8px 10px;border-bottom:1px solid #f0fdfa;text-align:center;"><a href="https://www.zillow.com/homedetails/10961-Peggy-Ln-Dumas-TX-79029/2060277167_zpid/" style="color:#4f46e5;font-weight:bold;">Ver</a></td>
        </tr>
        <tr>
          <td style="padding:8px 10px;border-bottom:1px solid #f0fdfa;color:#334155;">3</td>
          <td style="padding:8px 10px;border-bottom:1px solid #f0fdfa;color:#334155;font-weight:bold;">120 Flint Acres Dr</td>
          <td style="padding:8px 10px;border-bottom:1px solid #f0fdfa;color:#334155;text-align:center;">1.00</td>
          <td style="padding:8px 10px;border-bottom:1px solid #f0fdfa;color:#16a34a;font-weight:bold;text-align:right;">$55,000</td>
          <td style="padding:8px 10px;border-bottom:1px solid #f0fdfa;color:#64748b;text-align:right;">$55,000</td>
          <td style="padding:8px 10px;border-bottom:1px solid #f0fdfa;text-align:center;"><a href="https://www.zillow.com/homedetails/120-Flint-Acres-Dr-Dumas-TX-79029/2053863684_zpid/" style="color:#4f46e5;font-weight:bold;">Ver</a></td>
        </tr>
        <tr style="background-color:#fafffe;">
          <td style="padding:8px 10px;border-bottom:1px solid #f0fdfa;color:#334155;">4</td>
          <td style="padding:8px 10px;border-bottom:1px solid #f0fdfa;color:#334155;font-weight:bold;">722 FM</td>
          <td style="padding:8px 10px;border-bottom:1px solid #f0fdfa;color:#334155;text-align:center;">10.00</td>
          <td style="padding:8px 10px;border-bottom:1px solid #f0fdfa;color:#16a34a;font-weight:bold;text-align:right;">$65,000</td>
          <td style="padding:8px 10px;border-bottom:1px solid #f0fdfa;color:#64748b;text-align:right;">$6,500</td>
          <td style="padding:8px 10px;border-bottom:1px solid #f0fdfa;text-align:center;"><a href="https://www.zillow.com/homedetails/722-Fm-Dumas-TX-79029/2054603982_zpid/" style="color:#4f46e5;font-weight:bold;">Ver</a></td>
        </tr>
        <tr>
          <td style="padding:8px 10px;border-bottom:1px solid #f0fdfa;color:#334155;">5</td>
          <td style="padding:8px 10px;border-bottom:1px solid #f0fdfa;color:#334155;font-weight:bold;">10861 Lena Ln</td>
          <td style="padding:8px 10px;border-bottom:1px solid #f0fdfa;color:#334155;text-align:center;">3.13</td>
          <td style="padding:8px 10px;border-bottom:1px solid #f0fdfa;color:#16a34a;font-weight:bold;text-align:right;">$65,975</td>
          <td style="padding:8px 10px;border-bottom:1px solid #f0fdfa;color:#64748b;text-align:right;">$21,080</td>
          <td style="padding:8px 10px;border-bottom:1px solid #f0fdfa;text-align:center;"><a href="https://www.zillow.com/homedetails/10861-Lena-Ln-Dumas-TX-79029/339407382_zpid/" style="color:#4f46e5;font-weight:bold;">Ver</a></td>
        </tr>
        <tr style="background-color:#fafffe;">
          <td style="padding:8px 10px;border-bottom:1px solid #f0fdfa;color:#334155;">6</td>
          <td style="padding:8px 10px;border-bottom:1px solid #f0fdfa;color:#334155;font-weight:bold;">Morton Elevator Rd</td>
          <td style="padding:8px 10px;border-bottom:1px solid #f0fdfa;color:#334155;text-align:center;">20.00</td>
          <td style="padding:8px 10px;border-bottom:1px solid #f0fdfa;color:#16a34a;font-weight:bold;text-align:right;">$80,000</td>
          <td style="padding:8px 10px;border-bottom:1px solid #f0fdfa;color:#ea580c;font-weight:bold;text-align:right;">$4,000 &#11088;</td>
          <td style="padding:8px 10px;border-bottom:1px solid #f0fdfa;text-align:center;"><a href="https://www.redfin.com/county/2810/TX/Moore-County/land" style="color:#4f46e5;font-weight:bold;">Ver</a></td>
        </tr>
        <tr>
          <td style="padding:8px 10px;border-bottom:1px solid #f0fdfa;color:#334155;">7</td>
          <td style="padding:8px 10px;border-bottom:1px solid #f0fdfa;color:#334155;font-weight:bold;">141 Flint Acres Dr</td>
          <td style="padding:8px 10px;border-bottom:1px solid #f0fdfa;color:#334155;text-align:center;">1.00</td>
          <td style="padding:8px 10px;border-bottom:1px solid #f0fdfa;color:#16a34a;font-weight:bold;text-align:right;">$80,000</td>
          <td style="padding:8px 10px;border-bottom:1px solid #f0fdfa;color:#64748b;text-align:right;">$80,000</td>
          <td style="padding:8px 10px;border-bottom:1px solid #f0fdfa;text-align:center;"><a href="https://www.zillow.com/homedetails/141-Flint-Acres-Dr-Dumas-TX-79029/2053868012_zpid/" style="color:#4f46e5;font-weight:bold;">Ver</a></td>
        </tr>
        <tr style="background-color:#fafffe;">
          <td style="padding:8px 10px;border-bottom:1px solid #f0fdfa;color:#334155;">8</td>
          <td style="padding:8px 10px;border-bottom:1px solid #f0fdfa;color:#334155;font-weight:bold;">W Road R (2 tracts)</td>
          <td style="padding:8px 10px;border-bottom:1px solid #f0fdfa;color:#334155;text-align:center;">20.72</td>
          <td style="padding:8px 10px;border-bottom:1px solid #f0fdfa;color:#16a34a;font-weight:bold;text-align:right;">$110,000</td>
          <td style="padding:8px 10px;border-bottom:1px solid #f0fdfa;color:#ea580c;font-weight:bold;text-align:right;">$5,309 &#11088;</td>
          <td style="padding:8px 10px;border-bottom:1px solid #f0fdfa;text-align:center;"><a href="https://www.zillow.com/homedetails/W-Road-R-Dumas-TX-79029/450622281_zpid/" style="color:#4f46e5;font-weight:bold;">Ver</a></td>
        </tr>
        <tr>
          <td style="padding:8px 10px;border-bottom:1px solid #f0fdfa;color:#334155;">9</td>
          <td style="padding:8px 10px;border-bottom:1px solid #f0fdfa;color:#334155;font-weight:bold;">TRACT 5 Highway 287</td>
          <td style="padding:8px 10px;border-bottom:1px solid #f0fdfa;color:#334155;text-align:center;">1.15</td>
          <td style="padding:8px 10px;border-bottom:1px solid #f0fdfa;color:#16a34a;font-weight:bold;text-align:right;">$150,282</td>
          <td style="padding:8px 10px;border-bottom:1px solid #f0fdfa;color:#64748b;text-align:right;">$130,680</td>
          <td style="padding:8px 10px;border-bottom:1px solid #f0fdfa;text-align:center;"><a href="https://www.zillow.com/homedetails/TRACT-5-Highway-287-Dumas-TX-79029/2054235383_zpid/" style="color:#4f46e5;font-weight:bold;">Ver</a></td>
        </tr>
        <tr style="background-color:#fafffe;">
          <td style="padding:8px 10px;border-bottom:1px solid #f0fdfa;color:#334155;">10</td>
          <td style="padding:8px 10px;border-bottom:1px solid #f0fdfa;color:#334155;font-weight:bold;">Burnett Rd</td>
          <td style="padding:8px 10px;border-bottom:1px solid #f0fdfa;color:#334155;text-align:center;">16.59</td>
          <td style="padding:8px 10px;border-bottom:1px solid #f0fdfa;color:#16a34a;font-weight:bold;text-align:right;">$165,900</td>
          <td style="padding:8px 10px;border-bottom:1px solid #f0fdfa;color:#64748b;text-align:right;">$9,999</td>
          <td style="padding:8px 10px;border-bottom:1px solid #f0fdfa;text-align:center;"><a href="https://www.landwatch.com/texas-land-for-sale/dumas" style="color:#4f46e5;font-weight:bold;">Ver</a></td>
        </tr>
      </table>
      <div style="background-color:#f0fdf4;border-radius:6px;padding:12px;margin-top:12px;">
        <p style="margin:0;font-size:13px;color:#166534;">&#11088; <strong>Mejor valor por acre:</strong> Morton Elevator Rd ($4,000/acre) y W Road R ($5,309/acre)</p>
        <p style="margin:4px 0 0;font-size:13px;color:#166534;">&#128176; <strong>Más barato total:</strong> 1600 Madison Ave ($31,500 - lote pequeño en ciudad)</p>
        <p style="margin:4px 0 0;font-size:13px;color:#166534;">&#127793; <strong>Más terreno por el dinero:</strong> W Road R - 20.72 acres por $110,000</p>
      </div>
    </td></tr>
  </table>
</td>
</tr>

<!-- RANCHOS GRANDES -->
<tr>
<td style="padding:0 24px 24px;">
  <table width="100%" cellpadding="0" cellspacing="0" style="border:2px solid #854d0e;border-radius:8px;overflow:hidden;">
    <tr><td style="background-color:#854d0e;padding:10px 16px;">
      <span style="color:#ffffff;font-weight:bold;font-size:14px;">&#127806; RANCHOS / TERRENOS GRANDES (100+ acres)</span>
    </td></tr>
    <tr><td style="padding:16px;">
      <table width="100%" cellpadding="8" cellspacing="0" style="border-collapse:collapse;">
        <tr style="background-color:#fefce8;">
          <th style="text-align:left;padding:8px 10px;color:#854d0e;font-size:11px;border-bottom:2px solid #854d0e;">PROPIEDAD</th>
          <th style="text-align:center;padding:8px 10px;color:#854d0e;font-size:11px;border-bottom:2px solid #854d0e;">ACRES</th>
          <th style="text-align:right;padding:8px 10px;color:#854d0e;font-size:11px;border-bottom:2px solid #854d0e;">PRECIO</th>
          <th style="text-align:right;padding:8px 10px;color:#854d0e;font-size:11px;border-bottom:2px solid #854d0e;">$/ACRE</th>
        </tr>
        <tr>
          <td style="padding:8px 10px;border-bottom:1px solid #fefce8;color:#334155;">320 acres - Moore County</td>
          <td style="padding:8px 10px;border-bottom:1px solid #fefce8;color:#334155;text-align:center;">320</td>
          <td style="padding:8px 10px;border-bottom:1px solid #fefce8;color:#16a34a;font-weight:bold;text-align:right;">$1,600,000</td>
          <td style="padding:8px 10px;border-bottom:1px solid #fefce8;color:#64748b;text-align:right;">$5,000</td>
        </tr>
        <tr style="background-color:#fffef5;">
          <td style="padding:8px 10px;border-bottom:1px solid #fefce8;color:#334155;">960 acres - Moore County</td>
          <td style="padding:8px 10px;border-bottom:1px solid #fefce8;color:#334155;text-align:center;">960</td>
          <td style="padding:8px 10px;border-bottom:1px solid #fefce8;color:#16a34a;font-weight:bold;text-align:right;">$3,696,000</td>
          <td style="padding:8px 10px;border-bottom:1px solid #fefce8;color:#64748b;text-align:right;">$3,850</td>
        </tr>
        <tr>
          <td style="padding:8px 10px;border-bottom:1px solid #fefce8;color:#334155;">2,945 acres - Moore County (Clift Land Brokers)</td>
          <td style="padding:8px 10px;border-bottom:1px solid #fefce8;color:#334155;text-align:center;">2,945</td>
          <td style="padding:8px 10px;border-bottom:1px solid #fefce8;color:#16a34a;font-weight:bold;text-align:right;">$4,950,000</td>
          <td style="padding:8px 10px;border-bottom:1px solid #fefce8;color:#64748b;text-align:right;">$1,680</td>
        </tr>
      </table>
      <div style="background-color:#fefce8;border-radius:6px;padding:12px;margin-top:12px;">
        <p style="margin:0;font-size:13px;color:#854d0e;">&#128205; <strong>Fuente ranchos:</strong> <a href="https://cliftlandbrokers.com/property/moore-county-auction/" style="color:#4f46e5;">Clift Land Brokers</a> &bull; <a href="https://www.land.com/Moore-County-TX/ranches/" style="color:#4f46e5;">Land.com</a></p>
      </div>
    </td></tr>
  </table>
</td>
</tr>

<!-- CÓMO ENCONTRAR NO LISTADOS -->
<tr>
<td style="padding:0 24px 24px;">
  <table width="100%" cellpadding="0" cellspacing="0" style="border:2px solid #dc2626;border-radius:8px;overflow:hidden;">
    <tr><td style="background-color:#dc2626;padding:10px 16px;">
      <span style="color:#ffffff;font-weight:bold;font-size:14px;">&#128269; CÓMO ENCONTRAR TERRENOS NO LISTADOS (El Secreto)</span>
    </td></tr>
    <tr><td style="padding:16px;">
      <table width="100%" cellpadding="8" cellspacing="0" style="border-collapse:collapse;">
        <tr style="background-color:#fef2f2;">
          <th style="text-align:left;padding:8px 10px;color:#991b1b;font-size:11px;border-bottom:2px solid #dc2626;">MÉTODO</th>
          <th style="text-align:left;padding:8px 10px;color:#991b1b;font-size:11px;border-bottom:2px solid #dc2626;">CÓMO HACERLO</th>
          <th style="text-align:left;padding:8px 10px;color:#991b1b;font-size:11px;border-bottom:2px solid #dc2626;">CONTACTO / LINK</th>
        </tr>
        <tr>
          <td style="padding:10px;border-bottom:1px solid #fef2f2;color:#334155;font-weight:bold;">1. Moore County CAD<br><span style="font-weight:normal;color:#64748b;font-size:12px;">(Buscar parcelas vacías)</span></td>
          <td style="padding:10px;border-bottom:1px solid #fef2f2;color:#334155;font-size:13px;">Ve a la página del CAD &rarr; Advanced Search &rarr; Filtra por "Vacant Lots" en Dumas. Esto muestra TODOS los lotes vacíos, incluyendo los que NO están en venta públicamente.</td>
          <td style="padding:10px;border-bottom:1px solid #fef2f2;"><a href="https://esearch.moorecad.org" style="color:#4f46e5;font-weight:bold;">esearch.moorecad.org</a></td>
        </tr>
        <tr style="background-color:#fff5f5;">
          <td style="padding:10px;border-bottom:1px solid #fef2f2;color:#334155;font-weight:bold;">2. Tax Delinquent Sales<br><span style="font-weight:normal;color:#64748b;font-size:12px;">(Los más baratos)</span></td>
          <td style="padding:10px;border-bottom:1px solid #fef2f2;color:#334155;font-size:13px;">Llama al Tax Office y pregunta: "Do you have any upcoming tax delinquent property sales?" Estos terrenos se venden por centavos del dólar en subasta.</td>
          <td style="padding:10px;border-bottom:1px solid #fef2f2;color:#334155;font-weight:bold;">&#128222; (806) 935-5588<br><a href="https://www.co.moore.tx.us/page/moore.county.assessor.collector" style="color:#4f46e5;">Web</a></td>
        </tr>
        <tr>
          <td style="padding:10px;border-bottom:1px solid #fef2f2;color:#334155;font-weight:bold;">3. Trustee / Foreclosure Sales<br><span style="font-weight:normal;color:#64748b;font-size:12px;">(Propiedades embargadas)</span></td>
          <td style="padding:10px;border-bottom:1px solid #fef2f2;color:#334155;font-size:13px;">Revisa las ventas de fideicomiso del condado. Son propiedades que los bancos o el condado necesitan vender rápido.</td>
          <td style="padding:10px;border-bottom:1px solid #fef2f2;"><a href="https://www.co.moore.tx.us/page/moore.trusteesale" style="color:#4f46e5;font-weight:bold;">Moore County Trustee Sales</a></td>
        </tr>
        <tr style="background-color:#fff5f5;">
          <td style="padding:10px;border-bottom:1px solid #fef2f2;color:#334155;font-weight:bold;">4. Cartas Directas a Dueños<br><span style="font-weight:normal;color:#64748b;font-size:12px;">(Estrategia profesional)</span></td>
          <td style="padding:10px;border-bottom:1px solid #fef2f2;color:#334155;font-size:13px;">Encuentra dueños de lotes vacíos en el CAD &rarr; Envíales una carta ofreciendo comprar. Muchos QUIEREN vender pero nunca lo listan. Es la técnica #1 de los inversionistas.</td>
          <td style="padding:10px;border-bottom:1px solid #fef2f2;color:#64748b;font-size:13px;">Usa datos del CAD para obtener nombre y dirección del dueño</td>
        </tr>
        <tr>
          <td style="padding:10px;border-bottom:1px solid #fef2f2;color:#334155;font-weight:bold;">5. Driving for Dollars<br><span style="font-weight:normal;color:#64748b;font-size:12px;">(Búsqueda en persona)</span></td>
          <td style="padding:10px;border-bottom:1px solid #fef2f2;color:#334155;font-size:13px;">Maneja por Dumas buscando lotes vacíos, abandonados o con hierba alta. Anota la dirección y busca al dueño en el CAD. Negocia directamente.</td>
          <td style="padding:10px;border-bottom:1px solid #fef2f2;color:#64748b;font-size:13px;">Gratis - solo tu tiempo y gasolina</td>
        </tr>
        <tr style="background-color:#fff5f5;">
          <td style="padding:10px;border-bottom:1px solid #fef2f2;color:#334155;font-weight:bold;">6. LienSuite<br><span style="font-weight:normal;color:#64748b;font-size:12px;">(Base de datos delinquentes)</span></td>
          <td style="padding:10px;border-bottom:1px solid #fef2f2;color:#334155;font-size:13px;">Base de datos de propiedades con impuestos atrasados en Moore County. Identifica terrenos que podrían ir a subasta pronto.</td>
          <td style="padding:10px;border-bottom:1px solid #fef2f2;"><a href="https://liensuite.com/tax-delinquent-property/moore-county-tx" style="color:#4f46e5;font-weight:bold;">LienSuite - Moore County</a></td>
        </tr>
      </table>
    </td></tr>
  </table>
</td>
</tr>

<!-- CONTACTOS CLAVE -->
<tr>
<td style="padding:0 24px 24px;">
  <table width="100%" cellpadding="0" cellspacing="0" style="border:2px solid #1e40af;border-radius:8px;overflow:hidden;">
    <tr><td style="background-color:#1e40af;padding:10px 16px;">
      <span style="color:#ffffff;font-weight:bold;font-size:14px;">&#127963; CONTACTOS CLAVE - MOORE COUNTY</span>
    </td></tr>
    <tr><td style="padding:16px;">
      <table width="100%" cellpadding="8" cellspacing="0" style="border-collapse:collapse;">
        <tr style="background-color:#eff6ff;">
          <th style="text-align:left;padding:8px 10px;color:#1e40af;font-size:11px;border-bottom:2px solid #1e40af;">OFICINA</th>
          <th style="text-align:left;padding:8px 10px;color:#1e40af;font-size:11px;border-bottom:2px solid #1e40af;">TELÉFONO</th>
          <th style="text-align:left;padding:8px 10px;color:#1e40af;font-size:11px;border-bottom:2px solid #1e40af;">PARA QUÉ</th>
        </tr>
        <tr>
          <td style="padding:10px;border-bottom:1px solid #eff6ff;color:#334155;font-weight:bold;">Moore County Tax Assessor</td>
          <td style="padding:10px;border-bottom:1px solid #eff6ff;color:#1e40af;font-weight:bold;font-size:16px;">&#128222; (806) 935-5588</td>
          <td style="padding:10px;border-bottom:1px solid #eff6ff;color:#334155;font-size:13px;">Terrenos con impuestos atrasados, subastas, tax sales</td>
        </tr>
        <tr style="background-color:#f8faff;">
          <td style="padding:10px;border-bottom:1px solid #eff6ff;color:#334155;font-weight:bold;">Moore County Appraisal District (CAD)</td>
          <td style="padding:10px;border-bottom:1px solid #eff6ff;color:#1e40af;font-weight:bold;font-size:16px;">&#128222; (806) 935-2593</td>
          <td style="padding:10px;border-bottom:1px solid #eff6ff;color:#334155;font-size:13px;">Buscar dueños de parcelas, valuaciones, datos de propiedad</td>
        </tr>
        <tr>
          <td style="padding:10px;border-bottom:1px solid #eff6ff;color:#334155;font-weight:bold;">Moore County Clerk</td>
          <td style="padding:10px;border-bottom:1px solid #eff6ff;color:#1e40af;font-weight:bold;font-size:16px;">&#128222; (806) 935-2009</td>
          <td style="padding:10px;border-bottom:1px solid #eff6ff;color:#334155;font-size:13px;">Verificar títulos, liens, historial de propiedad</td>
        </tr>
        <tr style="background-color:#f8faff;">
          <td style="padding:10px;border-bottom:1px solid #eff6ff;color:#334155;font-weight:bold;">City of Dumas</td>
          <td style="padding:10px;border-bottom:1px solid #eff6ff;color:#1e40af;font-weight:bold;font-size:16px;">&#128222; (806) 935-4107</td>
          <td style="padding:10px;border-bottom:1px solid #eff6ff;color:#334155;font-size:13px;">Zonificación, permisos de construcción, utilities</td>
        </tr>
      </table>
    </td></tr>
  </table>
</td>
</tr>

<!-- SITIOS WEB -->
<tr>
<td style="padding:0 24px 24px;">
  <table width="100%" cellpadding="0" cellspacing="0" style="border:2px solid #7c3aed;border-radius:8px;overflow:hidden;">
    <tr><td style="background-color:#7c3aed;padding:10px 16px;">
      <span style="color:#ffffff;font-weight:bold;font-size:14px;">&#127760; SITIOS WEB PARA BUSCAR MÁS TERRENOS</span>
    </td></tr>
    <tr><td style="padding:16px;">
      <table width="100%" cellpadding="8" cellspacing="0" style="border-collapse:collapse;">
        <tr>
          <td style="padding:8px 10px;border-bottom:1px solid #f5f3ff;color:#334155;font-weight:bold;">Zillow (75+ listings)</td>
          <td style="padding:8px 10px;border-bottom:1px solid #f5f3ff;"><a href="https://www.zillow.com/dumas-tx/land/" style="color:#4f46e5;">zillow.com/dumas-tx/land</a></td>
        </tr>
        <tr style="background-color:#faf8ff;">
          <td style="padding:8px 10px;border-bottom:1px solid #f5f3ff;color:#334155;font-weight:bold;">LandWatch (76 listings)</td>
          <td style="padding:8px 10px;border-bottom:1px solid #f5f3ff;"><a href="https://www.landwatch.com/texas-land-for-sale/dumas" style="color:#4f46e5;">landwatch.com/dumas</a></td>
        </tr>
        <tr>
          <td style="padding:8px 10px;border-bottom:1px solid #f5f3ff;color:#334155;font-weight:bold;">Realtor.com (84 listings)</td>
          <td style="padding:8px 10px;border-bottom:1px solid #f5f3ff;"><a href="https://www.realtor.com/realestateandhomes-search/Dumas_TX/type-land" style="color:#4f46e5;">realtor.com/dumas</a></td>
        </tr>
        <tr style="background-color:#faf8ff;">
          <td style="padding:8px 10px;border-bottom:1px solid #f5f3ff;color:#334155;font-weight:bold;">Land.com</td>
          <td style="padding:8px 10px;border-bottom:1px solid #f5f3ff;"><a href="https://www.land.com/Dumas-TX/all-land/" style="color:#4f46e5;">land.com/dumas</a></td>
        </tr>
        <tr>
          <td style="padding:8px 10px;border-bottom:1px solid #f5f3ff;color:#334155;font-weight:bold;">LandAndFarm</td>
          <td style="padding:8px 10px;border-bottom:1px solid #f5f3ff;"><a href="https://www.landandfarm.com/search/texas/dumas-land-for-sale/" style="color:#4f46e5;">landandfarm.com/dumas</a></td>
        </tr>
        <tr style="background-color:#faf8ff;">
          <td style="padding:8px 10px;border-bottom:1px solid #f5f3ff;color:#334155;font-weight:bold;">Trulia (86 listings)</td>
          <td style="padding:8px 10px;border-bottom:1px solid #f5f3ff;"><a href="https://www.trulia.com/TX/Dumas/79029/LOT%7CLAND_type/" style="color:#4f46e5;">trulia.com/dumas</a></td>
        </tr>
        <tr>
          <td style="padding:8px 10px;border-bottom:1px solid #f5f3ff;color:#334155;font-weight:bold;">Moore CAD (Registros oficiales)</td>
          <td style="padding:8px 10px;border-bottom:1px solid #f5f3ff;"><a href="https://esearch.moorecad.org" style="color:#4f46e5;">esearch.moorecad.org</a></td>
        </tr>
        <tr style="background-color:#faf8ff;">
          <td style="padding:8px 10px;border-bottom:1px solid #f5f3ff;color:#334155;font-weight:bold;">LienSuite (Tax delinquent)</td>
          <td style="padding:8px 10px;border-bottom:1px solid #f5f3ff;"><a href="https://liensuite.com/tax-delinquent-property/moore-county-tx" style="color:#4f46e5;">liensuite.com/moore-county</a></td>
        </tr>
      </table>
    </td></tr>
  </table>
</td>
</tr>

<!-- ESTRATEGIA -->
<tr>
<td style="padding:0 24px 24px;">
  <table width="100%" cellpadding="0" cellspacing="0" style="border:2px solid #059669;border-radius:8px;overflow:hidden;">
    <tr><td style="background-color:#059669;padding:10px 16px;">
      <span style="color:#ffffff;font-weight:bold;font-size:14px;">&#127919; ESTRATEGIA RECOMENDADA PASO A PASO</span>
    </td></tr>
    <tr><td style="padding:16px;">
      <div style="background-color:#f0fdf4;border-radius:6px;padding:16px;">
        <p style="margin:0 0 12px;font-size:14px;color:#166534;"><strong>Paso 1:</strong> Revisa los 10 terrenos listados de arriba. Los mejores valores son Morton Elevator Rd y W Road R.</p>
        <p style="margin:0 0 12px;font-size:14px;color:#166534;"><strong>Paso 2:</strong> Llama al Tax Office <strong>(806) 935-5588</strong> y pregunta por subastas de terrenos con impuestos atrasados.</p>
        <p style="margin:0 0 12px;font-size:14px;color:#166534;"><strong>Paso 3:</strong> Entra a <a href="https://esearch.moorecad.org" style="color:#4f46e5;">esearch.moorecad.org</a> y busca TODOS los lotes vacíos. Anota los que te interesen.</p>
        <p style="margin:0 0 12px;font-size:14px;color:#166534;"><strong>Paso 4:</strong> Para los lotes del CAD que no están en venta, busca al dueño y envíale una carta ofreciendo comprar.</p>
        <p style="margin:0;font-size:14px;color:#166534;"><strong>Paso 5:</strong> Revisa <a href="https://www.co.moore.tx.us/page/moore.trusteesale" style="color:#4f46e5;">Trustee Sales</a> para foreclosures activos.</p>
      </div>
    </td></tr>
  </table>
</td>
</tr>

<!-- CONTEXTO DE MERCADO -->
<tr>
<td style="padding:0 24px 24px;">
  <div style="background-color:#fffbeb;border:1px solid #f59e0b;border-radius:8px;padding:16px;">
    <p style="margin:0 0 8px;font-size:14px;color:#92400e;font-weight:bold;">&#128200; Contexto del Mercado - Dumas / Moore County:</p>
    <p style="margin:0 0 4px;font-size:13px;color:#92400e;">&bull; Precio promedio por propiedad: <strong>~$139,682</strong></p>
    <p style="margin:0 0 4px;font-size:13px;color:#92400e;">&bull; Precio promedio por acre: <strong>$3,850 - $7,197</strong> (varía por ubicación y uso)</p>
    <p style="margin:0 0 4px;font-size:13px;color:#92400e;">&bull; Terrenos grandes (agrícolas): <strong>$1,680 - $5,000/acre</strong></p>
    <p style="margin:0 0 4px;font-size:13px;color:#92400e;">&bull; Lotes residenciales: <strong>$31,500 - $150,000+</strong></p>
    <p style="margin:0;font-size:13px;color:#92400e;">&bull; Total de listings activos: <strong>75-90</strong> en las principales plataformas</p>
  </div>
</td>
</tr>

<!-- FOOTER -->
<tr>
<td style="padding:24px;text-align:center;color:#94a3b8;font-size:12px;">
  <p style="margin:0;">Investigación generada por tu AI Assistant &bull; Ross Tax &amp; Lending</p>
  <p style="margin:4px 0 0;">Precios y disponibilidad pueden cambiar. Verifica directamente con el vendedor o las oficinas del condado.</p>
  <p style="margin:4px 0 0;">Datos recopilados de: Zillow, LandWatch, Redfin, Realtor.com, Moore CAD, Land.com</p>
</td>
</tr>

</table>
</td></tr>
</table>
</body>
</html>
"""

def send_email():
    try:
        sg = SendGridAPIClient(SENDGRID_API_KEY)
        message = Mail(
            from_email=Email(FROM_EMAIL, "Ross AI Assistant"),
            to_emails=To(TO_EMAIL),
            subject="🏗️ Terrenos en Venta - Dumas, TX | 10 Listados + Métodos para No Listados + Contactos",
            html_content=Content("text/html", html_content)
        )
        response = sg.send(message)
        print(f"✅ Email enviado exitosamente! Status: {response.status_code}")
        return True
    except Exception as e:
        print(f"❌ Error: {e}")
        return False

if __name__ == "__main__":
    send_email()
