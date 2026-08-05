#!/usr/bin/env python3
"""
Script para enviar lista de bancos que financian terrenos en Dumas TX
"""
import os
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
<td style="background:linear-gradient(135deg,#1e40af,#3b82f6);padding:30px;text-align:center;">
  <h1 style="color:#ffffff;margin:0;font-size:26px;">&#127974; Bancos que Financian Terrenos</h1>
  <p style="color:rgba(255,255,255,0.9);margin:10px 0 0;font-size:14px;">Dumas, TX &bull; Moore County &bull; Texas Panhandle</p>
</td>
</tr>

<!-- ========== BANCOS LOCALES EN DUMAS ========== -->
<tr>
<td style="padding:24px;">
  <table width="100%" cellpadding="0" cellspacing="0" style="border:2px solid #16a34a;border-radius:8px;overflow:hidden;">
    <tr><td style="background-color:#16a34a;padding:10px 16px;">
      <span style="color:#ffffff;font-weight:bold;font-size:14px;">&#127969; BANCOS LOCALES EN DUMAS (Los más accesibles)</span>
    </td></tr>
    <tr><td style="padding:4px;">

      <!-- BANCO 1: AgTexas -->
      <table width="100%" cellpadding="0" cellspacing="0" style="margin:12px 0;">
        <tr>
          <td style="padding:12px 16px;border-bottom:1px solid #f0fdf4;">
            <h3 style="margin:0 0 6px;color:#1e293b;font-size:18px;">1. AgTexas Farm Credit Services</h3>
            <p style="margin:0 0 4px;color:#16a34a;font-weight:bold;font-size:14px;">&#11088; RECOMENDADO - Oficina en Dumas</p>
            <table width="100%" cellpadding="4" cellspacing="0" style="margin-top:8px;">
              <tr>
                <td width="120" style="color:#64748b;font-size:13px;vertical-align:top;">&#128222; Teléfono:</td>
                <td style="color:#1e293b;font-size:15px;font-weight:bold;">(806) 935-6851</td>
              </tr>
              <tr>
                <td style="color:#64748b;font-size:13px;vertical-align:top;">&#128205; Dirección:</td>
                <td style="color:#1e293b;font-size:13px;">1315 E 1st St, Dumas, TX 79029</td>
              </tr>
              <tr>
                <td style="color:#64748b;font-size:13px;vertical-align:top;">&#127760; Web:</td>
                <td><a href="https://agtexas.com/find-an-office/dumas/" style="color:#4f46e5;font-size:13px;">agtexas.com/dumas</a></td>
              </tr>
              <tr>
                <td style="color:#64748b;font-size:13px;vertical-align:top;">&#128176; Financian:</td>
                <td style="color:#1e293b;font-size:13px;">Terrenos agrícolas, ranchos, lotes rurales, casas rurales, propiedad recreativa</td>
              </tr>
              <tr>
                <td style="color:#64748b;font-size:13px;vertical-align:top;">&#128205; Ventaja:</td>
                <td style="color:#166534;font-size:13px;font-weight:bold;">Están EN Dumas. Conocen el mercado local mejor que nadie.</td>
              </tr>
            </table>
          </td>
        </tr>
      </table>

      <!-- BANCO 2: Happy State Bank -->
      <table width="100%" cellpadding="0" cellspacing="0" style="margin:0;">
        <tr>
          <td style="padding:12px 16px;border-bottom:1px solid #f0fdf4;background-color:#fafffe;">
            <h3 style="margin:0 0 6px;color:#1e293b;font-size:18px;">2. Happy State Bank</h3>
            <p style="margin:0 0 4px;color:#059669;font-size:13px;">Banco regional con sucursal en Dumas</p>
            <table width="100%" cellpadding="4" cellspacing="0" style="margin-top:8px;">
              <tr>
                <td width="120" style="color:#64748b;font-size:13px;vertical-align:top;">&#128222; Teléfono:</td>
                <td style="color:#1e293b;font-size:15px;font-weight:bold;">(806) 934-2265</td>
              </tr>
              <tr>
                <td style="color:#64748b;font-size:13px;vertical-align:top;">&#128222; Toll-free:</td>
                <td style="color:#1e293b;font-size:13px;">800-447-2265</td>
              </tr>
              <tr>
                <td style="color:#64748b;font-size:13px;vertical-align:top;">&#128205; Dirección:</td>
                <td style="color:#1e293b;font-size:13px;">800 S Dumas Ave, Dumas, TX 79029</td>
              </tr>
              <tr>
                <td style="color:#64748b;font-size:13px;vertical-align:top;">&#127760; Web:</td>
                <td><a href="https://happybank.com/business/business-lending/construction-land-development/" style="color:#4f46e5;font-size:13px;">happybank.com - Land Development</a></td>
              </tr>
              <tr>
                <td style="color:#64748b;font-size:13px;vertical-align:top;">&#128176; Financian:</td>
                <td style="color:#1e293b;font-size:13px;">Terrenos agrícolas, construcción, desarrollo de lotes, real estate comercial</td>
              </tr>
            </table>
          </td>
        </tr>
      </table>

      <!-- BANCO 3: Panhandle First Bank -->
      <table width="100%" cellpadding="0" cellspacing="0" style="margin:0;">
        <tr>
          <td style="padding:12px 16px;border-bottom:1px solid #f0fdf4;">
            <h3 style="margin:0 0 6px;color:#1e293b;font-size:18px;">3. Panhandle First Bank</h3>
            <p style="margin:0 0 4px;color:#059669;font-size:13px;">Banco local con préstamos agrícolas y de real estate</p>
            <table width="100%" cellpadding="4" cellspacing="0" style="margin-top:8px;">
              <tr>
                <td width="120" style="color:#64748b;font-size:13px;vertical-align:top;">&#128222; Teléfono:</td>
                <td style="color:#1e293b;font-size:15px;font-weight:bold;">(806) 935-5544</td>
              </tr>
              <tr>
                <td style="color:#64748b;font-size:13px;vertical-align:top;">&#128205; Dirección:</td>
                <td style="color:#1e293b;font-size:13px;">1201 E 1st St, Dumas, TX 79029</td>
              </tr>
              <tr>
                <td style="color:#64748b;font-size:13px;vertical-align:top;">&#127760; Web:</td>
                <td><a href="https://www.mypfb.bank/loans/business-loans/agriculture-real-estate-loans" style="color:#4f46e5;font-size:13px;">mypfb.bank - Ag Real Estate</a></td>
              </tr>
              <tr>
                <td style="color:#64748b;font-size:13px;vertical-align:top;">&#128176; Financian:</td>
                <td style="color:#1e293b;font-size:13px;">Agriculture real estate, lotes, terrenos, préstamos personalizados</td>
              </tr>
            </table>
          </td>
        </tr>
      </table>

    </td></tr>
  </table>
</td>
</tr>

<!-- ========== FARM CREDIT (ESPECIALIZADOS EN TERRENOS) ========== -->
<tr>
<td style="padding:0 24px 24px;">
  <table width="100%" cellpadding="0" cellspacing="0" style="border:2px solid #854d0e;border-radius:8px;overflow:hidden;">
    <tr><td style="background-color:#854d0e;padding:10px 16px;">
      <span style="color:#ffffff;font-weight:bold;font-size:14px;">&#127806; FARM CREDIT (Especializados en financiar terrenos)</span>
    </td></tr>
    <tr><td style="padding:4px;">

      <!-- Plains Land Bank -->
      <table width="100%" cellpadding="0" cellspacing="0" style="margin:12px 0;">
        <tr>
          <td style="padding:12px 16px;border-bottom:1px solid #fefce8;">
            <h3 style="margin:0 0 6px;color:#1e293b;font-size:18px;">4. Plains Land Bank</h3>
            <p style="margin:0 0 4px;color:#854d0e;font-weight:bold;font-size:13px;">Especialista en terrenos del Panhandle - Sin restricción de acres</p>
            <table width="100%" cellpadding="4" cellspacing="0" style="margin-top:8px;">
              <tr>
                <td width="120" style="color:#64748b;font-size:13px;vertical-align:top;">&#128222; Teléfono:</td>
                <td style="color:#1e293b;font-size:15px;font-weight:bold;">(806) 353-6688</td>
              </tr>
              <tr>
                <td style="color:#64748b;font-size:13px;vertical-align:top;">&#128205; Dirección:</td>
                <td style="color:#1e293b;font-size:13px;">5625 Fulton Dr, Amarillo, TX 79109</td>
              </tr>
              <tr>
                <td style="color:#64748b;font-size:13px;vertical-align:top;">&#127760; Web:</td>
                <td><a href="https://plainslandbank.com/loan-programs/" style="color:#4f46e5;font-size:13px;">plainslandbank.com/loan-programs</a></td>
              </tr>
              <tr>
                <td style="color:#64748b;font-size:13px;vertical-align:top;">&#128176; Financian:</td>
                <td style="color:#1e293b;font-size:13px;">Cualquier terreno en el Panhandle: granjas, ranchos, lotes rurales, casas rurales. SIN restricción de acres mínimos.</td>
              </tr>
              <tr>
                <td style="color:#64748b;font-size:13px;vertical-align:top;">&#128205; Ventaja:</td>
                <td style="color:#854d0e;font-size:13px;font-weight:bold;">No requieren mínimo de acres. Financian terreno crudo.</td>
              </tr>
            </table>
          </td>
        </tr>
      </table>

      <!-- Texas Farm Credit -->
      <table width="100%" cellpadding="0" cellspacing="0" style="margin:0;">
        <tr>
          <td style="padding:12px 16px;border-bottom:1px solid #fefce8;background-color:#fffef5;">
            <h3 style="margin:0 0 6px;color:#1e293b;font-size:18px;">5. Texas Farm Credit</h3>
            <p style="margin:0 0 4px;color:#854d0e;font-size:13px;">Excelentes términos para lotes y terrenos rurales</p>
            <table width="100%" cellpadding="4" cellspacing="0" style="margin-top:8px;">
              <tr>
                <td width="120" style="color:#64748b;font-size:13px;vertical-align:top;">&#128222; Teléfono:</td>
                <td style="color:#1e293b;font-size:15px;font-weight:bold;">(800) 950-8563</td>
              </tr>
              <tr>
                <td style="color:#64748b;font-size:13px;vertical-align:top;">&#127760; Web:</td>
                <td><a href="https://texasfarmcredit.com/products-services/land-loans/" style="color:#4f46e5;font-size:13px;">texasfarmcredit.com/land-loans</a></td>
              </tr>
              <tr>
                <td style="color:#64748b;font-size:13px;vertical-align:top;">&#128176; Términos:</td>
                <td style="color:#1e293b;font-size:13px;">
                  &bull; 15 años con <strong>15% de enganche</strong><br>
                  &bull; 20 años con <strong>20% de enganche</strong><br>
                  &bull; 25 años con <strong>25% de enganche</strong><br>
                  &bull; Tasa fija, SIN balloon payment
                </td>
              </tr>
              <tr>
                <td style="color:#64748b;font-size:13px;vertical-align:top;">&#128205; Ventaja:</td>
                <td style="color:#854d0e;font-size:13px;font-weight:bold;">Enganche desde solo 15%. Términos hasta 25 años. Sin balloon.</td>
              </tr>
            </table>
          </td>
        </tr>
      </table>

      <!-- Capital Farm Credit -->
      <table width="100%" cellpadding="0" cellspacing="0" style="margin:0;">
        <tr>
          <td style="padding:12px 16px;">
            <h3 style="margin:0 0 6px;color:#1e293b;font-size:18px;">6. Capital Farm Credit</h3>
            <p style="margin:0 0 4px;color:#854d0e;font-size:13px;">La cooperativa de crédito agrícola más grande de Texas</p>
            <table width="100%" cellpadding="4" cellspacing="0" style="margin-top:8px;">
              <tr>
                <td width="120" style="color:#64748b;font-size:13px;vertical-align:top;">&#128222; Teléfono:</td>
                <td style="color:#1e293b;font-size:15px;font-weight:bold;">(877) 944-5500</td>
              </tr>
              <tr>
                <td style="color:#64748b;font-size:13px;vertical-align:top;">&#127760; Web:</td>
                <td><a href="https://www.capitalfarmcredit.com/loans/land-loans/" style="color:#4f46e5;font-size:13px;">capitalfarmcredit.com/land-loans</a></td>
              </tr>
              <tr>
                <td style="color:#64748b;font-size:13px;vertical-align:top;">&#128176; Financian:</td>
                <td style="color:#1e293b;font-size:13px;">Compra de terrenos, mejoras, refinanciamiento, ranchos, propiedad rural</td>
              </tr>
            </table>
          </td>
        </tr>
      </table>

    </td></tr>
  </table>
</td>
</tr>

<!-- ========== BANCO REGIONAL ========== -->
<tr>
<td style="padding:0 24px 24px;">
  <table width="100%" cellpadding="0" cellspacing="0" style="border:2px solid #7c3aed;border-radius:8px;overflow:hidden;">
    <tr><td style="background-color:#7c3aed;padding:10px 16px;">
      <span style="color:#ffffff;font-weight:bold;font-size:14px;">&#127963; BANCOS REGIONALES</span>
    </td></tr>
    <tr><td style="padding:4px;">

      <!-- FirstBank Southwest -->
      <table width="100%" cellpadding="0" cellspacing="0" style="margin:12px 0;">
        <tr>
          <td style="padding:12px 16px;border-bottom:1px solid #f5f3ff;">
            <h3 style="margin:0 0 6px;color:#1e293b;font-size:18px;">7. FirstBank Southwest</h3>
            <table width="100%" cellpadding="4" cellspacing="0" style="margin-top:8px;">
              <tr>
                <td width="120" style="color:#64748b;font-size:13px;">&#128222; Teléfono:</td>
                <td style="color:#1e293b;font-size:15px;font-weight:bold;">(806) 355-9661</td>
              </tr>
              <tr>
                <td style="color:#64748b;font-size:13px;">&#128222; Hipotecas:</td>
                <td style="color:#1e293b;font-size:13px;">(806) 322-0738</td>
              </tr>
              <tr>
                <td style="color:#64748b;font-size:13px;">&#128205; Dirección:</td>
                <td style="color:#1e293b;font-size:13px;">5701 SW 34th Ave, Amarillo, TX 79109</td>
              </tr>
              <tr>
                <td style="color:#64748b;font-size:13px;">&#127760; Web:</td>
                <td><a href="https://fbsw.com/business-banking/real-estate/" style="color:#4f46e5;font-size:13px;">fbsw.com/real-estate</a></td>
              </tr>
            </table>
          </td>
        </tr>
      </table>

      <!-- Texas Regional Bank -->
      <table width="100%" cellpadding="0" cellspacing="0" style="margin:0;">
        <tr>
          <td style="padding:12px 16px;background-color:#faf8ff;">
            <h3 style="margin:0 0 6px;color:#1e293b;font-size:18px;">8. Texas Regional Bank (TRB)</h3>
            <table width="100%" cellpadding="4" cellspacing="0" style="margin-top:8px;">
              <tr>
                <td width="120" style="color:#64748b;font-size:13px;">&#127760; Web:</td>
                <td><a href="https://trb.bank/aglending/agricultural-land-loans-farm-ranch-and-timber-financing/" style="color:#4f46e5;font-size:13px;">trb.bank/ag-land-loans</a></td>
              </tr>
              <tr>
                <td style="color:#64748b;font-size:13px;">&#128176; Nota:</td>
                <td style="color:#92400e;font-size:13px;">Requiere <strong>mínimo 25 acres</strong> para préstamos de terreno agrícola</td>
              </tr>
            </table>
          </td>
        </tr>
      </table>

    </td></tr>
  </table>
</td>
</tr>

<!-- ========== PROGRAMAS DEL GOBIERNO ========== -->
<tr>
<td style="padding:0 24px 24px;">
  <table width="100%" cellpadding="0" cellspacing="0" style="border:2px solid #dc2626;border-radius:8px;overflow:hidden;">
    <tr><td style="background-color:#dc2626;padding:10px 16px;">
      <span style="color:#ffffff;font-weight:bold;font-size:14px;">&#127482;&#127480; PROGRAMAS DEL GOBIERNO (Tasas más bajas)</span>
    </td></tr>
    <tr><td style="padding:4px;">

      <!-- VLB -->
      <table width="100%" cellpadding="0" cellspacing="0" style="margin:12px 0;">
        <tr>
          <td style="padding:12px 16px;border-bottom:1px solid #fef2f2;">
            <h3 style="margin:0 0 6px;color:#1e293b;font-size:18px;">9. Texas Veterans Land Board (VLB)</h3>
            <p style="margin:0 0 4px;color:#dc2626;font-weight:bold;font-size:13px;">&#11088; SOLO PARA VETERANOS - Mejor deal posible</p>
            <table width="100%" cellpadding="4" cellspacing="0" style="margin-top:8px;">
              <tr>
                <td width="120" style="color:#64748b;font-size:13px;">&#128222; Teléfono:</td>
                <td style="color:#1e293b;font-size:15px;font-weight:bold;">(800) 252-8387</td>
              </tr>
              <tr>
                <td style="color:#64748b;font-size:13px;">&#127760; Web:</td>
                <td><a href="https://www.glo.texas.gov/veterans/land-sale/land-loans" style="color:#4f46e5;font-size:13px;">glo.texas.gov/veterans/land-loans</a></td>
              </tr>
              <tr>
                <td style="color:#64748b;font-size:13px;">&#128176; Tasa:</td>
                <td style="color:#dc2626;font-size:15px;font-weight:bold;">7.25% fija</td>
              </tr>
              <tr>
                <td style="color:#64748b;font-size:13px;">&#128181; Enganche:</td>
                <td style="color:#166534;font-size:15px;font-weight:bold;">Solo 5% de enganche</td>
              </tr>
              <tr>
                <td style="color:#64748b;font-size:13px;">&#128197; Plazo:</td>
                <td style="color:#1e293b;font-size:13px;">Hasta 30 años</td>
              </tr>
              <tr>
                <td style="color:#64748b;font-size:13px;">&#9989; Requisitos:</td>
                <td style="color:#1e293b;font-size:13px;">
                  &bull; Veterano, militar activo, o Guardia Nacional de TX<br>
                  &bull; Residente de Texas<br>
                  &bull; Terreno mínimo 1 acre<br>
                  &bull; Terreno dentro de Texas<br>
                  &bull; Acceso legal a carretera pública
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>

      <!-- USDA -->
      <table width="100%" cellpadding="0" cellspacing="0" style="margin:0;">
        <tr>
          <td style="padding:12px 16px;border-bottom:1px solid #fef2f2;background-color:#fff5f5;">
            <h3 style="margin:0 0 6px;color:#1e293b;font-size:18px;">10. USDA Rural Development</h3>
            <p style="margin:0 0 4px;color:#991b1b;font-size:13px;">Préstamos para áreas rurales con tasas competitivas</p>
            <table width="100%" cellpadding="4" cellspacing="0" style="margin-top:8px;">
              <tr>
                <td width="120" style="color:#64748b;font-size:13px;">&#128222; Teléfono:</td>
                <td style="color:#1e293b;font-size:15px;font-weight:bold;">(800) 414-1226</td>
              </tr>
              <tr>
                <td style="color:#64748b;font-size:13px;">&#128222; TX Office:</td>
                <td style="color:#1e293b;font-size:13px;">(254) 742-9700</td>
              </tr>
              <tr>
                <td style="color:#64748b;font-size:13px;">&#127760; Web:</td>
                <td><a href="https://www.rd.usda.gov" style="color:#4f46e5;font-size:13px;">rd.usda.gov</a></td>
              </tr>
              <tr>
                <td style="color:#64748b;font-size:13px;">&#128176; Nota:</td>
                <td style="color:#1e293b;font-size:13px;">Tasas desde 5.75%. Dumas califica como área rural. Requiere que sea para vivienda principal.</td>
              </tr>
            </table>
          </td>
        </tr>
      </table>

      <!-- USDA FSA -->
      <table width="100%" cellpadding="0" cellspacing="0" style="margin:0;">
        <tr>
          <td style="padding:12px 16px;">
            <h3 style="margin:0 0 6px;color:#1e293b;font-size:18px;">11. USDA Farm Service Agency (FSA)</h3>
            <p style="margin:0 0 4px;color:#991b1b;font-size:13px;">Préstamos directos para compra de terreno agrícola</p>
            <table width="100%" cellpadding="4" cellspacing="0" style="margin-top:8px;">
              <tr>
                <td width="120" style="color:#64748b;font-size:13px;">&#128222; Teléfono:</td>
                <td style="color:#1e293b;font-size:15px;font-weight:bold;">(866) 632-9992</td>
              </tr>
              <tr>
                <td style="color:#64748b;font-size:13px;">&#127760; Web:</td>
                <td><a href="https://www.farmers.gov/loans" style="color:#4f46e5;font-size:13px;">farmers.gov/loans</a></td>
              </tr>
              <tr>
                <td style="color:#64748b;font-size:13px;">&#128176; Tasas:</td>
                <td style="color:#1e293b;font-size:13px;">
                  &bull; Farm Ownership Direct: <strong>5.750%</strong><br>
                  &bull; Down Payment Program: <strong>1.750%</strong> (solo para principiantes)
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>

    </td></tr>
  </table>
</td>
</tr>

<!-- ========== TABLA COMPARATIVA ========== -->
<tr>
<td style="padding:0 24px 24px;">
  <table width="100%" cellpadding="0" cellspacing="0" style="border:2px solid #334155;border-radius:8px;overflow:hidden;">
    <tr><td style="background-color:#1e293b;padding:10px 16px;">
      <span style="color:#ffffff;font-weight:bold;font-size:14px;">&#128202; TABLA COMPARATIVA - ¿Cuál te conviene?</span>
    </td></tr>
    <tr><td style="padding:16px;">
      <table width="100%" cellpadding="8" cellspacing="0" style="border-collapse:collapse;">
        <tr style="background-color:#f1f5f9;">
          <th style="text-align:left;padding:8px 6px;color:#475569;font-size:10px;border-bottom:2px solid #334155;">BANCO</th>
          <th style="text-align:center;padding:8px 6px;color:#475569;font-size:10px;border-bottom:2px solid #334155;">ENGANCHE</th>
          <th style="text-align:center;padding:8px 6px;color:#475569;font-size:10px;border-bottom:2px solid #334155;">PLAZO</th>
          <th style="text-align:center;padding:8px 6px;color:#475569;font-size:10px;border-bottom:2px solid #334155;">ACRES MIN</th>
          <th style="text-align:center;padding:8px 6px;color:#475569;font-size:10px;border-bottom:2px solid #334155;">TERRENO CRUDO</th>
          <th style="text-align:center;padding:8px 6px;color:#475569;font-size:10px;border-bottom:2px solid #334155;">EN DUMAS</th>
        </tr>
        <tr>
          <td style="padding:6px;border-bottom:1px solid #f1f5f9;color:#334155;font-size:12px;font-weight:bold;">AgTexas</td>
          <td style="padding:6px;border-bottom:1px solid #f1f5f9;color:#334155;font-size:12px;text-align:center;">Variable</td>
          <td style="padding:6px;border-bottom:1px solid #f1f5f9;color:#334155;font-size:12px;text-align:center;">Flexible</td>
          <td style="padding:6px;border-bottom:1px solid #f1f5f9;color:#334155;font-size:12px;text-align:center;">Ninguno</td>
          <td style="padding:6px;border-bottom:1px solid #f1f5f9;color:#16a34a;font-size:14px;text-align:center;font-weight:bold;">&#9989;</td>
          <td style="padding:6px;border-bottom:1px solid #f1f5f9;color:#16a34a;font-size:14px;text-align:center;font-weight:bold;">&#9989;</td>
        </tr>
        <tr style="background-color:#fafafa;">
          <td style="padding:6px;border-bottom:1px solid #f1f5f9;color:#334155;font-size:12px;font-weight:bold;">Plains Land Bank</td>
          <td style="padding:6px;border-bottom:1px solid #f1f5f9;color:#334155;font-size:12px;text-align:center;">Variable</td>
          <td style="padding:6px;border-bottom:1px solid #f1f5f9;color:#334155;font-size:12px;text-align:center;">Flexible</td>
          <td style="padding:6px;border-bottom:1px solid #f1f5f9;color:#16a34a;font-size:12px;text-align:center;font-weight:bold;">NINGUNO</td>
          <td style="padding:6px;border-bottom:1px solid #f1f5f9;color:#16a34a;font-size:14px;text-align:center;font-weight:bold;">&#9989;</td>
          <td style="padding:6px;border-bottom:1px solid #f1f5f9;color:#64748b;font-size:12px;text-align:center;">Amarillo</td>
        </tr>
        <tr>
          <td style="padding:6px;border-bottom:1px solid #f1f5f9;color:#334155;font-size:12px;font-weight:bold;">TX Farm Credit</td>
          <td style="padding:6px;border-bottom:1px solid #f1f5f9;color:#16a34a;font-size:12px;text-align:center;font-weight:bold;">15%</td>
          <td style="padding:6px;border-bottom:1px solid #f1f5f9;color:#334155;font-size:12px;text-align:center;">15-25 años</td>
          <td style="padding:6px;border-bottom:1px solid #f1f5f9;color:#334155;font-size:12px;text-align:center;">Ninguno</td>
          <td style="padding:6px;border-bottom:1px solid #f1f5f9;color:#16a34a;font-size:14px;text-align:center;font-weight:bold;">&#9989;</td>
          <td style="padding:6px;border-bottom:1px solid #f1f5f9;color:#64748b;font-size:12px;text-align:center;">Remoto</td>
        </tr>
        <tr style="background-color:#fafafa;">
          <td style="padding:6px;border-bottom:1px solid #f1f5f9;color:#334155;font-size:12px;font-weight:bold;">Happy State</td>
          <td style="padding:6px;border-bottom:1px solid #f1f5f9;color:#334155;font-size:12px;text-align:center;">20-25%</td>
          <td style="padding:6px;border-bottom:1px solid #f1f5f9;color:#334155;font-size:12px;text-align:center;">Variable</td>
          <td style="padding:6px;border-bottom:1px solid #f1f5f9;color:#334155;font-size:12px;text-align:center;">Variable</td>
          <td style="padding:6px;border-bottom:1px solid #f1f5f9;color:#16a34a;font-size:14px;text-align:center;font-weight:bold;">&#9989;</td>
          <td style="padding:6px;border-bottom:1px solid #f1f5f9;color:#16a34a;font-size:14px;text-align:center;font-weight:bold;">&#9989;</td>
        </tr>
        <tr>
          <td style="padding:6px;border-bottom:1px solid #f1f5f9;color:#334155;font-size:12px;font-weight:bold;">VLB (Veteranos)</td>
          <td style="padding:6px;border-bottom:1px solid #f1f5f9;color:#dc2626;font-size:12px;text-align:center;font-weight:bold;">SOLO 5%</td>
          <td style="padding:6px;border-bottom:1px solid #f1f5f9;color:#334155;font-size:12px;text-align:center;">30 años</td>
          <td style="padding:6px;border-bottom:1px solid #f1f5f9;color:#334155;font-size:12px;text-align:center;">1 acre</td>
          <td style="padding:6px;border-bottom:1px solid #f1f5f9;color:#16a34a;font-size:14px;text-align:center;font-weight:bold;">&#9989;</td>
          <td style="padding:6px;border-bottom:1px solid #f1f5f9;color:#16a34a;font-size:14px;text-align:center;font-weight:bold;">&#9989;</td>
        </tr>
        <tr style="background-color:#fafafa;">
          <td style="padding:6px;border-bottom:1px solid #f1f5f9;color:#334155;font-size:12px;font-weight:bold;">USDA FSA</td>
          <td style="padding:6px;border-bottom:1px solid #f1f5f9;color:#334155;font-size:12px;text-align:center;">Variable</td>
          <td style="padding:6px;border-bottom:1px solid #f1f5f9;color:#334155;font-size:12px;text-align:center;">40 años</td>
          <td style="padding:6px;border-bottom:1px solid #f1f5f9;color:#334155;font-size:12px;text-align:center;">Variable</td>
          <td style="padding:6px;border-bottom:1px solid #f1f5f9;color:#16a34a;font-size:14px;text-align:center;font-weight:bold;">&#9989;</td>
          <td style="padding:6px;border-bottom:1px solid #f1f5f9;color:#16a34a;font-size:14px;text-align:center;font-weight:bold;">&#9989;</td>
        </tr>
      </table>
    </td></tr>
  </table>
</td>
</tr>

<!-- ========== EJEMPLO DE PAGO ========== -->
<tr>
<td style="padding:0 24px 24px;">
  <table width="100%" cellpadding="0" cellspacing="0" style="border:2px solid #059669;border-radius:8px;overflow:hidden;">
    <tr><td style="background-color:#059669;padding:10px 16px;">
      <span style="color:#ffffff;font-weight:bold;font-size:14px;">&#128176; EJEMPLO: ¿Cuánto pagarías mensual?</span>
    </td></tr>
    <tr><td style="padding:16px;">
      <p style="margin:0 0 12px;color:#64748b;font-size:13px;">Ejemplo: Terreno de <strong>$80,000</strong> (Morton Elevator Rd, 20 acres)</p>
      <table width="100%" cellpadding="8" cellspacing="0" style="border-collapse:collapse;">
        <tr style="background-color:#f0fdf4;">
          <th style="text-align:left;padding:8px 10px;color:#166534;font-size:11px;border-bottom:2px solid #059669;">ESCENARIO</th>
          <th style="text-align:center;padding:8px 10px;color:#166534;font-size:11px;border-bottom:2px solid #059669;">ENGANCHE</th>
          <th style="text-align:center;padding:8px 10px;color:#166534;font-size:11px;border-bottom:2px solid #059669;">PRÉSTAMO</th>
          <th style="text-align:center;padding:8px 10px;color:#166534;font-size:11px;border-bottom:2px solid #059669;">PLAZO</th>
          <th style="text-align:center;padding:8px 10px;color:#166534;font-size:11px;border-bottom:2px solid #059669;">PAGO/MES*</th>
        </tr>
        <tr>
          <td style="padding:8px 10px;border-bottom:1px solid #f0fdf4;color:#334155;font-size:13px;">VLB (Veterano)</td>
          <td style="padding:8px 10px;border-bottom:1px solid #f0fdf4;color:#334155;font-size:13px;text-align:center;">$4,000 (5%)</td>
          <td style="padding:8px 10px;border-bottom:1px solid #f0fdf4;color:#334155;font-size:13px;text-align:center;">$76,000</td>
          <td style="padding:8px 10px;border-bottom:1px solid #f0fdf4;color:#334155;font-size:13px;text-align:center;">30 años</td>
          <td style="padding:8px 10px;border-bottom:1px solid #f0fdf4;color:#16a34a;font-size:15px;text-align:center;font-weight:bold;">~$519</td>
        </tr>
        <tr style="background-color:#fafffe;">
          <td style="padding:8px 10px;border-bottom:1px solid #f0fdf4;color:#334155;font-size:13px;">TX Farm Credit</td>
          <td style="padding:8px 10px;border-bottom:1px solid #f0fdf4;color:#334155;font-size:13px;text-align:center;">$12,000 (15%)</td>
          <td style="padding:8px 10px;border-bottom:1px solid #f0fdf4;color:#334155;font-size:13px;text-align:center;">$68,000</td>
          <td style="padding:8px 10px;border-bottom:1px solid #f0fdf4;color:#334155;font-size:13px;text-align:center;">20 años</td>
          <td style="padding:8px 10px;border-bottom:1px solid #f0fdf4;color:#16a34a;font-size:15px;text-align:center;font-weight:bold;">~$530</td>
        </tr>
        <tr>
          <td style="padding:8px 10px;border-bottom:1px solid #f0fdf4;color:#334155;font-size:13px;">Banco local (20%)</td>
          <td style="padding:8px 10px;border-bottom:1px solid #f0fdf4;color:#334155;font-size:13px;text-align:center;">$16,000 (20%)</td>
          <td style="padding:8px 10px;border-bottom:1px solid #f0fdf4;color:#334155;font-size:13px;text-align:center;">$64,000</td>
          <td style="padding:8px 10px;border-bottom:1px solid #f0fdf4;color:#334155;font-size:13px;text-align:center;">15 años</td>
          <td style="padding:8px 10px;border-bottom:1px solid #f0fdf4;color:#16a34a;font-size:15px;text-align:center;font-weight:bold;">~$575</td>
        </tr>
      </table>
      <p style="margin:12px 0 0;color:#94a3b8;font-size:11px;">*Pagos estimados con tasa de ~7-8%. La tasa real depende de tu crédito y el banco.</p>
    </td></tr>
  </table>
</td>
</tr>

<!-- ========== RECOMENDACIÓN ========== -->
<tr>
<td style="padding:0 24px 24px;">
  <table width="100%" cellpadding="0" cellspacing="0" style="border:2px solid #4f46e5;border-radius:8px;overflow:hidden;">
    <tr><td style="background-color:#4f46e5;padding:10px 16px;">
      <span style="color:#ffffff;font-weight:bold;font-size:14px;">&#127919; MI RECOMENDACIÓN</span>
    </td></tr>
    <tr><td style="padding:16px;">
      <div style="background-color:#eef2ff;border-radius:6px;padding:16px;">
        <p style="margin:0 0 10px;font-size:14px;color:#3730a3;"><strong>Paso 1:</strong> Llama a <strong>AgTexas (806-935-6851)</strong> primero - están en Dumas y conocen el mercado local.</p>
        <p style="margin:0 0 10px;font-size:14px;color:#3730a3;"><strong>Paso 2:</strong> Llama a <strong>Plains Land Bank (806-353-6688)</strong> para comparar - no tienen mínimo de acres.</p>
        <p style="margin:0 0 10px;font-size:14px;color:#3730a3;"><strong>Paso 3:</strong> Si eres veterano o conoces uno, <strong>VLB (800-252-8387)</strong> tiene el mejor deal: 5% de enganche y 30 años.</p>
        <p style="margin:0;font-size:14px;color:#3730a3;"><strong>Paso 4:</strong> Compara las 3 ofertas y elige la que tenga mejor tasa y términos para tu situación.</p>
      </div>
    </td></tr>
  </table>
</td>
</tr>

<!-- FOOTER -->
<tr>
<td style="padding:24px;text-align:center;color:#94a3b8;font-size:12px;">
  <p style="margin:0;">Investigación generada por tu AI Assistant &bull; Ross Tax &amp; Lending</p>
  <p style="margin:4px 0 0;">Las tasas y términos pueden cambiar. Verifica directamente con cada institución.</p>
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
            subject="🏦 Bancos que Financian Terrenos en Dumas TX | 11 Opciones + Contactos + Tabla Comparativa",
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
