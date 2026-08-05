#!/usr/bin/env python3
"""
Script para enviar las listas de compras de PC para AI - VERSION 2 (Email Compatible)
Usa inline styles y tema claro para máxima compatibilidad con clientes de email
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
<td style="background:linear-gradient(135deg,#4f46e5,#7c3aed);padding:30px;text-align:center;">
  <h1 style="color:#ffffff;margin:0;font-size:26px;">&#129504; Guía Completa: PC para AI Local</h1>
  <p style="color:rgba(255,255,255,0.9);margin:10px 0 0;font-size:14px;">5 Opciones de compra con links de Amazon &bull; Software gratuito incluido</p>
</td>
</tr>

<!-- UPGRADE PC ACTUAL -->
<tr>
<td style="padding:24px;">
  <table width="100%" cellpadding="0" cellspacing="0" style="border:2px solid #3b82f6;border-radius:8px;overflow:hidden;">
    <tr><td style="background-color:#3b82f6;padding:10px 16px;">
      <span style="color:#ffffff;font-weight:bold;font-size:14px;">&#128295; UPGRADE DE TU PC ACTUAL</span>
    </td></tr>
    <tr><td style="padding:16px;">
      <h2 style="margin:0 0 4px;color:#1e293b;font-size:20px;">ViprTech Reaper 1.0 → Opción 2</h2>
      <p style="margin:0 0 16px;color:#64748b;font-size:13px;">Aprovecha tu Ryzen 7 8700F y plataforma AM5 existente</p>
      <table width="100%" cellpadding="8" cellspacing="0" style="border-collapse:collapse;">
        <tr style="background-color:#f1f5f9;">
          <th style="text-align:left;padding:8px 12px;color:#475569;font-size:12px;border-bottom:1px solid #e2e8f0;">COMPONENTE</th>
          <th style="text-align:left;padding:8px 12px;color:#475569;font-size:12px;border-bottom:1px solid #e2e8f0;">PRODUCTO</th>
          <th style="text-align:left;padding:8px 12px;color:#475569;font-size:12px;border-bottom:1px solid #e2e8f0;">PRECIO</th>
          <th style="text-align:left;padding:8px 12px;color:#475569;font-size:12px;border-bottom:1px solid #e2e8f0;">LINK</th>
        </tr>
        <tr>
          <td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;color:#334155;">GPU</td>
          <td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;color:#334155;">RTX 4090 24GB (reemplaza 5060 Ti 8GB)</td>
          <td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;color:#16a34a;font-weight:bold;">~$2,300</td>
          <td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;"><a href="https://www.amazon.com/dp/B0BGT61797" style="color:#4f46e5;">Amazon</a></td>
        </tr>
        <tr>
          <td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;color:#334155;">RAM</td>
          <td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;color:#334155;">64GB DDR5 (2x32GB)</td>
          <td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;color:#16a34a;font-weight:bold;">~$150</td>
          <td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;"><a href="https://www.amazon.com/s?k=64GB+DDR5+2x32GB+5600" style="color:#4f46e5;">Amazon</a></td>
        </tr>
        <tr>
          <td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;color:#334155;">PSU</td>
          <td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;color:#334155;">Corsair RM1000e 1000W 80+ Gold</td>
          <td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;color:#16a34a;font-weight:bold;">~$170</td>
          <td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;"><a href="https://www.amazon.com/s?k=Corsair+RM1000e+1000W" style="color:#4f46e5;">Amazon</a></td>
        </tr>
        <tr>
          <td colspan="2" style="padding:10px 12px;border-top:2px solid #4f46e5;font-weight:bold;color:#1e293b;font-size:16px;">TOTAL UPGRADE</td>
          <td colspan="2" style="padding:10px 12px;border-top:2px solid #4f46e5;font-weight:bold;color:#ea580c;font-size:18px;">~$2,620</td>
        </tr>
      </table>
      <div style="background-color:#f0fdf4;border-radius:6px;padding:12px;margin-top:12px;">
        <p style="margin:0;font-size:13px;color:#166534;">&#128202; <strong>Resultado:</strong> 24GB VRAM &bull; Corre Llama 3 70B, Qwen 72B, Mixtral (Q4)</p>
        <p style="margin:4px 0 0;font-size:13px;color:#92400e;">&#9888;&#65039; <strong>Límite:</strong> microATX = máximo 1 GPU. No escalable a dual GPU.</p>
      </div>
    </td></tr>
  </table>
</td>
</tr>

<!-- OPCIÓN 1 -->
<tr>
<td style="padding:0 24px 24px;">
  <table width="100%" cellpadding="0" cellspacing="0" style="border:2px solid #22c55e;border-radius:8px;overflow:hidden;">
    <tr><td style="background-color:#22c55e;padding:10px 16px;">
      <span style="color:#ffffff;font-weight:bold;font-size:14px;">OPCIÓN 1 &bull; ENTRY LEVEL</span>
    </td></tr>
    <tr><td style="padding:16px;">
      <h2 style="margin:0 0 4px;color:#1e293b;font-size:20px;">PC AI Básica - Build Dedicada</h2>
      <p style="margin:0 0 16px;color:#64748b;font-size:13px;">Para experimentar con modelos pequeños y medianos</p>
      <table width="100%" cellpadding="8" cellspacing="0" style="border-collapse:collapse;">
        <tr style="background-color:#f1f5f9;">
          <th style="text-align:left;padding:8px 12px;color:#475569;font-size:12px;border-bottom:1px solid #e2e8f0;">COMPONENTE</th>
          <th style="text-align:left;padding:8px 12px;color:#475569;font-size:12px;border-bottom:1px solid #e2e8f0;">PRODUCTO</th>
          <th style="text-align:left;padding:8px 12px;color:#475569;font-size:12px;border-bottom:1px solid #e2e8f0;">PRECIO</th>
          <th style="text-align:left;padding:8px 12px;color:#475569;font-size:12px;border-bottom:1px solid #e2e8f0;">LINK</th>
        </tr>
        <tr>
          <td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;color:#334155;">CPU</td>
          <td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;color:#334155;">AMD Ryzen 7 7700X (8 cores, AM5)</td>
          <td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;color:#16a34a;font-weight:bold;">~$220</td>
          <td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;"><a href="https://www.amazon.com/s?k=AMD+Ryzen+7+7700X" style="color:#4f46e5;">Amazon</a></td>
        </tr>
        <tr>
          <td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;color:#334155;">Motherboard</td>
          <td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;color:#334155;">ASUS TUF Gaming B650-PLUS (ATX)</td>
          <td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;color:#16a34a;font-weight:bold;">~$180</td>
          <td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;"><a href="https://www.amazon.com/s?k=ASUS+TUF+B650-PLUS+WiFi" style="color:#4f46e5;">Amazon</a></td>
        </tr>
        <tr>
          <td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;color:#334155;">GPU</td>
          <td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;color:#334155;">RTX 4060 Ti 16GB</td>
          <td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;color:#16a34a;font-weight:bold;">~$450</td>
          <td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;"><a href="https://www.amazon.com/s?k=RTX+4060+Ti+16GB" style="color:#4f46e5;">Amazon</a></td>
        </tr>
        <tr>
          <td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;color:#334155;">RAM</td>
          <td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;color:#334155;">32GB DDR5 (2x16GB)</td>
          <td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;color:#16a34a;font-weight:bold;">~$80</td>
          <td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;"><a href="https://www.amazon.com/s?k=32GB+DDR5+2x16GB+5600" style="color:#4f46e5;">Amazon</a></td>
        </tr>
        <tr>
          <td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;color:#334155;">PSU</td>
          <td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;color:#334155;">Corsair RM750e 750W 80+ Gold</td>
          <td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;color:#16a34a;font-weight:bold;">~$100</td>
          <td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;"><a href="https://www.amazon.com/s?k=Corsair+RM750e+750W" style="color:#4f46e5;">Amazon</a></td>
        </tr>
        <tr>
          <td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;color:#334155;">SSD</td>
          <td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;color:#334155;">Samsung 990 Pro 1TB NVMe</td>
          <td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;color:#16a34a;font-weight:bold;">~$90</td>
          <td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;"><a href="https://www.amazon.com/s?k=Samsung+990+Pro+1TB" style="color:#4f46e5;">Amazon</a></td>
        </tr>
        <tr>
          <td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;color:#334155;">Case</td>
          <td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;color:#334155;">Fractal Design Pop Air (Mid-Tower)</td>
          <td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;color:#16a34a;font-weight:bold;">~$95</td>
          <td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;"><a href="https://www.amazon.com/s?k=Fractal+Design+Pop+Air+ATX" style="color:#4f46e5;">Amazon</a></td>
        </tr>
        <tr>
          <td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;color:#334155;">Cooler</td>
          <td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;color:#334155;">Noctua NH-D15S</td>
          <td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;color:#16a34a;font-weight:bold;">~$100</td>
          <td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;"><a href="https://www.amazon.com/s?k=Noctua+NH-D15S" style="color:#4f46e5;">Amazon</a></td>
        </tr>
        <tr>
          <td colspan="2" style="padding:10px 12px;border-top:2px solid #22c55e;font-weight:bold;color:#1e293b;font-size:16px;">TOTAL OPCIÓN 1</td>
          <td colspan="2" style="padding:10px 12px;border-top:2px solid #22c55e;font-weight:bold;color:#ea580c;font-size:18px;">~$1,315</td>
        </tr>
      </table>
      <div style="background-color:#f0fdf4;border-radius:6px;padding:12px;margin-top:12px;">
        <p style="margin:0;font-size:13px;color:#166534;">&#128202; <strong>Capacidad:</strong> 16GB VRAM &bull; Modelos 7B-14B fluido, 20B cuantizados</p>
        <p style="margin:4px 0 0;font-size:13px;color:#166534;">&#129302; <strong>Ideal para:</strong> Chatbot básico, extracción de PDFs, asistente personal</p>
      </div>
    </td></tr>
  </table>
</td>
</tr>

<!-- OPCIÓN 2 -->
<tr>
<td style="padding:0 24px 24px;">
  <table width="100%" cellpadding="0" cellspacing="0" style="border:2px solid #eab308;border-radius:8px;overflow:hidden;">
    <tr><td style="background-color:#eab308;padding:10px 16px;">
      <span style="color:#ffffff;font-weight:bold;font-size:14px;">OPCIÓN 2 &bull; RECOMENDADA &#11088;</span>
    </td></tr>
    <tr><td style="padding:16px;">
      <h2 style="margin:0 0 4px;color:#1e293b;font-size:20px;">Single GPU Potente - Build Dedicada</h2>
      <p style="margin:0 0 16px;color:#64748b;font-size:13px;">Mejor relación precio/rendimiento</p>
      <table width="100%" cellpadding="8" cellspacing="0" style="border-collapse:collapse;">
        <tr style="background-color:#f1f5f9;">
          <th style="text-align:left;padding:8px 12px;color:#475569;font-size:12px;border-bottom:1px solid #e2e8f0;">COMPONENTE</th>
          <th style="text-align:left;padding:8px 12px;color:#475569;font-size:12px;border-bottom:1px solid #e2e8f0;">PRODUCTO</th>
          <th style="text-align:left;padding:8px 12px;color:#475569;font-size:12px;border-bottom:1px solid #e2e8f0;">PRECIO</th>
          <th style="text-align:left;padding:8px 12px;color:#475569;font-size:12px;border-bottom:1px solid #e2e8f0;">LINK</th>
        </tr>
        <tr>
          <td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;color:#334155;">CPU</td>
          <td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;color:#334155;">AMD Ryzen 9 7900X (12 cores)</td>
          <td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;color:#16a34a;font-weight:bold;">~$350</td>
          <td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;"><a href="https://www.amazon.com/s?k=AMD+Ryzen+9+7900X" style="color:#4f46e5;">Amazon</a></td>
        </tr>
        <tr>
          <td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;color:#334155;">Motherboard</td>
          <td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;color:#334155;">ASUS ProArt X670E-Creator (ATX)</td>
          <td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;color:#16a34a;font-weight:bold;">~$450</td>
          <td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;"><a href="https://www.amazon.com/s?k=ASUS+ProArt+X670E-Creator" style="color:#4f46e5;">Amazon</a></td>
        </tr>
        <tr>
          <td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;color:#334155;">GPU</td>
          <td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;color:#334155;">ASUS ROG Strix RTX 4090 OC 24GB</td>
          <td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;color:#16a34a;font-weight:bold;">~$2,300</td>
          <td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;"><a href="https://www.amazon.com/dp/B0BGT61797" style="color:#4f46e5;">Amazon</a></td>
        </tr>
        <tr>
          <td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;color:#334155;">RAM</td>
          <td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;color:#334155;">64GB DDR5 (2x32GB) 5600MHz</td>
          <td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;color:#16a34a;font-weight:bold;">~$150</td>
          <td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;"><a href="https://www.amazon.com/s?k=64GB+DDR5+2x32GB+5600" style="color:#4f46e5;">Amazon</a></td>
        </tr>
        <tr>
          <td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;color:#334155;">PSU</td>
          <td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;color:#334155;">Corsair RM1000e 1000W 80+ Gold</td>
          <td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;color:#16a34a;font-weight:bold;">~$170</td>
          <td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;"><a href="https://www.amazon.com/s?k=Corsair+RM1000e+1000W" style="color:#4f46e5;">Amazon</a></td>
        </tr>
        <tr>
          <td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;color:#334155;">SSD</td>
          <td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;color:#334155;">Samsung 990 Pro 2TB NVMe</td>
          <td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;color:#16a34a;font-weight:bold;">~$150</td>
          <td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;"><a href="https://www.amazon.com/dp/B0BHJJ9Y77" style="color:#4f46e5;">Amazon</a></td>
        </tr>
        <tr>
          <td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;color:#334155;">Case</td>
          <td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;color:#334155;">Fractal Design Torrent (Full Tower)</td>
          <td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;color:#16a34a;font-weight:bold;">~$190</td>
          <td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;"><a href="https://www.amazon.com/s?k=Fractal+Design+Torrent+Full+Tower" style="color:#4f46e5;">Amazon</a></td>
        </tr>
        <tr>
          <td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;color:#334155;">Cooler</td>
          <td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;color:#334155;">Noctua NH-D15 chromax.black</td>
          <td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;color:#16a34a;font-weight:bold;">~$120</td>
          <td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;"><a href="https://www.amazon.com/s?k=Noctua+NH-D15+chromax+black" style="color:#4f46e5;">Amazon</a></td>
        </tr>
        <tr>
          <td colspan="2" style="padding:10px 12px;border-top:2px solid #eab308;font-weight:bold;color:#1e293b;font-size:16px;">TOTAL OPCIÓN 2</td>
          <td colspan="2" style="padding:10px 12px;border-top:2px solid #eab308;font-weight:bold;color:#ea580c;font-size:18px;">~$3,880</td>
        </tr>
      </table>
      <div style="background-color:#fefce8;border-radius:6px;padding:12px;margin-top:12px;">
        <p style="margin:0;font-size:13px;color:#854d0e;">&#128202; <strong>Capacidad:</strong> 24GB VRAM &bull; Llama 3 70B, Qwen 72B, Mixtral 8x7B</p>
        <p style="margin:4px 0 0;font-size:13px;color:#854d0e;">&#129302; <strong>Ideal para:</strong> Chatbot avanzado, WhatsApp bot, email automation, procesamiento de docs</p>
        <p style="margin:4px 0 0;font-size:13px;color:#854d0e;">&#128200; <strong>Escalable:</strong> Puedes agregar 1 GPU más en el futuro</p>
      </div>
    </td></tr>
  </table>
</td>
</tr>

<!-- OPCIÓN 3 -->
<tr>
<td style="padding:0 24px 24px;">
  <table width="100%" cellpadding="0" cellspacing="0" style="border:2px solid #ec4899;border-radius:8px;overflow:hidden;">
    <tr><td style="background-color:#ec4899;padding:10px 16px;">
      <span style="color:#ffffff;font-weight:bold;font-size:14px;">OPCIÓN 3 &bull; PROFESIONAL</span>
    </td></tr>
    <tr><td style="padding:16px;">
      <h2 style="margin:0 0 4px;color:#1e293b;font-size:20px;">Dual GPU Threadripper Workstation</h2>
      <p style="margin:0 0 16px;color:#64748b;font-size:13px;">Escalable a 4-6 GPUs en el futuro &bull; 7 slots PCIe</p>
      <table width="100%" cellpadding="8" cellspacing="0" style="border-collapse:collapse;">
        <tr style="background-color:#f1f5f9;">
          <th style="text-align:left;padding:8px 12px;color:#475569;font-size:12px;border-bottom:1px solid #e2e8f0;">COMPONENTE</th>
          <th style="text-align:left;padding:8px 12px;color:#475569;font-size:12px;border-bottom:1px solid #e2e8f0;">PRODUCTO</th>
          <th style="text-align:left;padding:8px 12px;color:#475569;font-size:12px;border-bottom:1px solid #e2e8f0;">PRECIO</th>
          <th style="text-align:left;padding:8px 12px;color:#475569;font-size:12px;border-bottom:1px solid #e2e8f0;">LINK</th>
        </tr>
        <tr>
          <td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;color:#334155;">CPU</td>
          <td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;color:#334155;">AMD Threadripper PRO 7965WX (24 cores)</td>
          <td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;color:#16a34a;font-weight:bold;">~$2,500</td>
          <td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;"><a href="https://www.amazon.com/dp/B0CK2T1HSS" style="color:#4f46e5;">Amazon</a></td>
        </tr>
        <tr>
          <td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;color:#334155;">Motherboard</td>
          <td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;color:#334155;">ASUS Pro WS WRX90E-SAGE SE (7x PCIe 5.0)</td>
          <td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;color:#16a34a;font-weight:bold;">~$1,400</td>
          <td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;"><a href="https://www.amazon.com/s?k=ASUS+Pro+WS+WRX90E-SAGE+SE" style="color:#4f46e5;">Amazon</a></td>
        </tr>
        <tr>
          <td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;color:#334155;">GPU x2</td>
          <td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;color:#334155;">2x ASUS ROG Strix RTX 4090 OC 24GB</td>
          <td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;color:#16a34a;font-weight:bold;">~$4,600</td>
          <td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;"><a href="https://www.amazon.com/dp/B0BGT61797" style="color:#4f46e5;">Amazon</a></td>
        </tr>
        <tr>
          <td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;color:#334155;">RAM</td>
          <td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;color:#334155;">128GB DDR5 ECC RDIMM (4x32GB)</td>
          <td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;color:#16a34a;font-weight:bold;">~$400</td>
          <td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;"><a href="https://www.amazon.com/s?k=128GB+DDR5+ECC+RDIMM+5600" style="color:#4f46e5;">Amazon</a></td>
        </tr>
        <tr>
          <td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;color:#334155;">PSU</td>
          <td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;color:#334155;">Corsair AX1600i 1600W 80+ Titanium</td>
          <td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;color:#16a34a;font-weight:bold;">~$500</td>
          <td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;"><a href="https://www.amazon.com/s?k=Corsair+AX1600i+1600W" style="color:#4f46e5;">Amazon</a></td>
        </tr>
        <tr>
          <td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;color:#334155;">Cooler CPU</td>
          <td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;color:#334155;">Noctua NH-U14S TR5-SP6</td>
          <td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;color:#16a34a;font-weight:bold;">~$130</td>
          <td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;"><a href="https://www.amazon.com/s?k=Noctua+NH-U14S+TR5-SP6" style="color:#4f46e5;">Amazon</a></td>
        </tr>
        <tr>
          <td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;color:#334155;">SSD</td>
          <td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;color:#334155;">Samsung 990 Pro 2TB NVMe</td>
          <td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;color:#16a34a;font-weight:bold;">~$150</td>
          <td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;"><a href="https://www.amazon.com/dp/B0BHJJ9Y77" style="color:#4f46e5;">Amazon</a></td>
        </tr>
        <tr>
          <td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;color:#334155;">Case 4U</td>
          <td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;color:#334155;">Rosewill RSV-L4500U (4U Rackmount)</td>
          <td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;color:#16a34a;font-weight:bold;">~$120</td>
          <td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;"><a href="https://www.amazon.com/dp/B0091IZ1ZG" style="color:#4f46e5;">Amazon</a></td>
        </tr>
        <tr>
          <td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;color:#334155;">Rack 12U</td>
          <td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;color:#334155;">VIVO CART-SR12U (ruedas, ajustable)</td>
          <td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;color:#16a34a;font-weight:bold;">~$160</td>
          <td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;"><a href="https://www.amazon.com/s?k=VIVO+12U+open+frame+server+rack+wheels" style="color:#4f46e5;">Amazon</a></td>
        </tr>
        <tr>
          <td colspan="2" style="padding:10px 12px;border-top:2px solid #ec4899;font-weight:bold;color:#1e293b;font-size:16px;">TOTAL OPCIÓN 3</td>
          <td colspan="2" style="padding:10px 12px;border-top:2px solid #ec4899;font-weight:bold;color:#ea580c;font-size:18px;">~$9,960</td>
        </tr>
      </table>
      <div style="background-color:#fdf2f8;border-radius:6px;padding:12px;margin-top:12px;">
        <p style="margin:0;font-size:13px;color:#9d174d;">&#128202; <strong>Capacidad:</strong> 48GB VRAM (2x24GB) &bull; Llama 3 70B full, modelos 100B+ cuantizados</p>
        <p style="margin:4px 0 0;font-size:13px;color:#9d174d;">&#129302; <strong>Ideal para:</strong> Multi-agente AI, WhatsApp + Email + SMS simultáneo</p>
      </div>
      <div style="background-color:#f0fdf4;border-left:3px solid #22c55e;padding:12px;margin-top:12px;border-radius:0 6px 6px 0;">
        <p style="margin:0;font-size:13px;color:#166534;"><strong>&#128200; Escalabilidad (7 slots PCIe):</strong></p>
        <p style="margin:4px 0 0;font-size:13px;color:#166534;">&bull; Fase 2: 4x RTX 4090 (96GB VRAM) = +$4,600</p>
        <p style="margin:4px 0 0;font-size:13px;color:#166534;">&bull; Fase 3: 6x RTX 4090 (144GB VRAM) = +$4,600 + PSU dual</p>
        <p style="margin:4px 0 0;font-size:13px;color:#166534;font-weight:bold;">&bull; Total máximo: ~$20,000 por 144GB VRAM</p>
      </div>
    </td></tr>
  </table>
</td>
</tr>

<!-- OPCIÓN 4 -->
<tr>
<td style="padding:0 24px 24px;">
  <table width="100%" cellpadding="0" cellspacing="0" style="border:2px solid #a855f7;border-radius:8px;overflow:hidden;">
    <tr><td style="background-color:#a855f7;padding:10px 16px;">
      <span style="color:#ffffff;font-weight:bold;font-size:14px;">OPCIÓN 4 &bull; ENTERPRISE</span>
    </td></tr>
    <tr><td style="padding:16px;">
      <h2 style="margin:0 0 4px;color:#1e293b;font-size:20px;">Multi-GPU Enterprise (4 GPUs desde día 1)</h2>
      <p style="margin:0 0 16px;color:#64748b;font-size:13px;">Corre CUALQUIER modelo open-source sin limitaciones</p>
      <table width="100%" cellpadding="8" cellspacing="0" style="border-collapse:collapse;">
        <tr style="background-color:#f1f5f9;">
          <th style="text-align:left;padding:8px 12px;color:#475569;font-size:12px;border-bottom:1px solid #e2e8f0;">COMPONENTE</th>
          <th style="text-align:left;padding:8px 12px;color:#475569;font-size:12px;border-bottom:1px solid #e2e8f0;">PRODUCTO</th>
          <th style="text-align:left;padding:8px 12px;color:#475569;font-size:12px;border-bottom:1px solid #e2e8f0;">PRECIO</th>
          <th style="text-align:left;padding:8px 12px;color:#475569;font-size:12px;border-bottom:1px solid #e2e8f0;">LINK</th>
        </tr>
        <tr>
          <td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;color:#334155;">CPU</td>
          <td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;color:#334155;">AMD Threadripper PRO 7975WX (32 cores)</td>
          <td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;color:#16a34a;font-weight:bold;">~$3,500</td>
          <td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;"><a href="https://www.amazon.com/s?k=AMD+Threadripper+PRO+7975WX" style="color:#4f46e5;">Amazon</a></td>
        </tr>
        <tr>
          <td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;color:#334155;">Motherboard</td>
          <td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;color:#334155;">ASUS Pro WS WRX90E-SAGE SE</td>
          <td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;color:#16a34a;font-weight:bold;">~$1,400</td>
          <td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;"><a href="https://www.amazon.com/s?k=ASUS+Pro+WS+WRX90E-SAGE+SE" style="color:#4f46e5;">Amazon</a></td>
        </tr>
        <tr>
          <td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;color:#334155;">GPU x4</td>
          <td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;color:#334155;">4x ASUS ROG Strix RTX 4090 OC 24GB</td>
          <td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;color:#16a34a;font-weight:bold;">~$9,200</td>
          <td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;"><a href="https://www.amazon.com/dp/B0BGT61797" style="color:#4f46e5;">Amazon</a></td>
        </tr>
        <tr>
          <td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;color:#334155;">RAM</td>
          <td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;color:#334155;">256GB DDR5 ECC RDIMM (8x32GB)</td>
          <td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;color:#16a34a;font-weight:bold;">~$800</td>
          <td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;"><a href="https://www.amazon.com/s?k=256GB+DDR5+ECC+RDIMM" style="color:#4f46e5;">Amazon</a></td>
        </tr>
        <tr>
          <td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;color:#334155;">PSU x2</td>
          <td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;color:#334155;">2x Corsair AX1600i 1600W (dual PSU)</td>
          <td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;color:#16a34a;font-weight:bold;">~$1,000</td>
          <td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;"><a href="https://www.amazon.com/s?k=Corsair+AX1600i+1600W" style="color:#4f46e5;">Amazon</a></td>
        </tr>
        <tr>
          <td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;color:#334155;">Dual PSU Adapter</td>
          <td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;color:#334155;">Add2PSU Dual Power Supply Adapter</td>
          <td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;color:#16a34a;font-weight:bold;">~$30</td>
          <td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;"><a href="https://www.amazon.com/s?k=Add2PSU+dual+power+supply+adapter" style="color:#4f46e5;">Amazon</a></td>
        </tr>
        <tr>
          <td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;color:#334155;">Cooler CPU</td>
          <td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;color:#334155;">Noctua NH-U14S TR5-SP6</td>
          <td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;color:#16a34a;font-weight:bold;">~$130</td>
          <td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;"><a href="https://www.amazon.com/s?k=Noctua+NH-U14S+TR5-SP6" style="color:#4f46e5;">Amazon</a></td>
        </tr>
        <tr>
          <td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;color:#334155;">SSD</td>
          <td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;color:#334155;">Samsung 990 Pro 4TB NVMe</td>
          <td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;color:#16a34a;font-weight:bold;">~$300</td>
          <td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;"><a href="https://www.amazon.com/s?k=Samsung+990+Pro+4TB" style="color:#4f46e5;">Amazon</a></td>
        </tr>
        <tr>
          <td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;color:#334155;">Case 4U</td>
          <td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;color:#334155;">Rosewill RSV-L4500U (4U Rackmount)</td>
          <td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;color:#16a34a;font-weight:bold;">~$120</td>
          <td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;"><a href="https://www.amazon.com/dp/B0091IZ1ZG" style="color:#4f46e5;">Amazon</a></td>
        </tr>
        <tr>
          <td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;color:#334155;">Rack 12U</td>
          <td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;color:#334155;">RackPath 12U Open Frame (600kg, ruedas)</td>
          <td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;color:#16a34a;font-weight:bold;">~$220</td>
          <td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;"><a href="https://www.amazon.com/s?k=12U+open+frame+server+rack+4+post+wheels" style="color:#4f46e5;">Amazon</a></td>
        </tr>
        <tr>
          <td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;color:#334155;">UPS</td>
          <td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;color:#334155;">CyberPower PR3000LCDRTXL2U (3000VA)</td>
          <td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;color:#16a34a;font-weight:bold;">~$600</td>
          <td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;"><a href="https://www.amazon.com/s?k=CyberPower+PR3000+rackmount+UPS" style="color:#4f46e5;">Amazon</a></td>
        </tr>
        <tr>
          <td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;color:#334155;">Eléctrico</td>
          <td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;color:#334155;">Circuito dedicado 240V/30A</td>
          <td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;color:#16a34a;font-weight:bold;">~$300</td>
          <td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;color:#94a3b8;">Electricista local</td>
        </tr>
        <tr>
          <td colspan="2" style="padding:10px 12px;border-top:2px solid #a855f7;font-weight:bold;color:#1e293b;font-size:16px;">TOTAL OPCIÓN 4</td>
          <td colspan="2" style="padding:10px 12px;border-top:2px solid #a855f7;font-weight:bold;color:#ea580c;font-size:18px;">~$17,600</td>
        </tr>
      </table>
      <div style="background-color:#faf5ff;border-radius:6px;padding:12px;margin-top:12px;">
        <p style="margin:0;font-size:13px;color:#6b21a8;">&#128202; <strong>Capacidad:</strong> 96GB VRAM (4x24GB) &bull; Corre Llama 3 405B, CUALQUIER modelo open-source</p>
        <p style="margin:4px 0 0;font-size:13px;color:#6b21a8;">&#129302; <strong>Ideal para:</strong> AI Agency completa, múltiples agentes simultáneos, fine-tuning</p>
        <p style="margin:4px 0 0;font-size:13px;color:#6b21a8;">&#128200; <strong>Escalable a:</strong> 6x RTX 4090 (144GB VRAM) = +$4,600</p>
      </div>
    </td></tr>
  </table>
</td>
</tr>

<!-- SOFTWARE -->
<tr>
<td style="padding:0 24px 24px;">
  <table width="100%" cellpadding="0" cellspacing="0" style="border:2px solid #06b6d4;border-radius:8px;overflow:hidden;">
    <tr><td style="background-color:#06b6d4;padding:10px 16px;">
      <span style="color:#ffffff;font-weight:bold;font-size:14px;">&#128187; SOFTWARE AI (100% GRATIS)</span>
    </td></tr>
    <tr><td style="padding:16px;">
      <h2 style="margin:0 0 4px;color:#1e293b;font-size:20px;">Herramientas para tu servidor AI</h2>
      <p style="margin:0 0 16px;color:#64748b;font-size:13px;">Todo open-source &bull; Instalar después de armar el hardware</p>
      <table width="100%" cellpadding="8" cellspacing="0" style="border-collapse:collapse;">
        <tr style="background-color:#f1f5f9;">
          <th style="text-align:left;padding:8px 12px;color:#475569;font-size:12px;border-bottom:1px solid #e2e8f0;">#</th>
          <th style="text-align:left;padding:8px 12px;color:#475569;font-size:12px;border-bottom:1px solid #e2e8f0;">HERRAMIENTA</th>
          <th style="text-align:left;padding:8px 12px;color:#475569;font-size:12px;border-bottom:1px solid #e2e8f0;">PARA QUÉ SIRVE</th>
          <th style="text-align:left;padding:8px 12px;color:#475569;font-size:12px;border-bottom:1px solid #e2e8f0;">LINK</th>
        </tr>
        <tr>
          <td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;color:#334155;">1</td>
          <td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;color:#334155;font-weight:bold;">Ubuntu Server 24.04</td>
          <td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;color:#334155;">Sistema operativo del servidor</td>
          <td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;"><a href="https://ubuntu.com/download/server" style="color:#4f46e5;">Descargar</a></td>
        </tr>
        <tr>
          <td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;color:#334155;">2</td>
          <td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;color:#334155;font-weight:bold;">NVIDIA CUDA Toolkit</td>
          <td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;color:#334155;">Drivers GPU para AI</td>
          <td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;"><a href="https://developer.nvidia.com/cuda-downloads" style="color:#4f46e5;">NVIDIA</a></td>
        </tr>
        <tr>
          <td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;color:#334155;">3</td>
          <td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;color:#334155;font-weight:bold;">Ollama</td>
          <td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;color:#334155;">Motor para correr LLMs (Llama, Qwen, Mistral)</td>
          <td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;"><a href="https://ollama.ai" style="color:#4f46e5;">ollama.ai</a></td>
        </tr>
        <tr>
          <td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;color:#334155;">4</td>
          <td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;color:#334155;font-weight:bold;">Open WebUI</td>
          <td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;color:#334155;">Interface tipo ChatGPT local</td>
          <td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;"><a href="https://github.com/open-webui/open-webui" style="color:#4f46e5;">GitHub</a></td>
        </tr>
        <tr>
          <td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;color:#334155;">5</td>
          <td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;color:#334155;font-weight:bold;">Aider</td>
          <td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;color:#334155;">Asistente AI que programa y edita código</td>
          <td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;"><a href="https://aider.chat" style="color:#4f46e5;">aider.chat</a></td>
        </tr>
        <tr>
          <td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;color:#334155;">6</td>
          <td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;color:#334155;font-weight:bold;">Continue.dev</td>
          <td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;color:#334155;">Plugin VS Code - autocomplete AI en tu editor</td>
          <td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;"><a href="https://continue.dev" style="color:#4f46e5;">continue.dev</a></td>
        </tr>
        <tr>
          <td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;color:#334155;">7</td>
          <td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;color:#334155;font-weight:bold;">ChromaDB</td>
          <td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;color:#334155;">Base vectorial - la AI "aprende" tus documentos</td>
          <td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;"><a href="https://www.trychroma.com" style="color:#4f46e5;">ChromaDB</a></td>
        </tr>
        <tr>
          <td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;color:#334155;">8</td>
          <td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;color:#334155;font-weight:bold;">LangChain</td>
          <td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;color:#334155;">Conecta AI con WhatsApp, Email, bases de datos</td>
          <td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;"><a href="https://python.langchain.com" style="color:#4f46e5;">LangChain</a></td>
        </tr>
        <tr>
          <td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;color:#334155;">9</td>
          <td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;color:#334155;font-weight:bold;">n8n (Self-hosted)</td>
          <td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;color:#334155;">Automatización visual: AI + WhatsApp + Email sin código</td>
          <td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;"><a href="https://n8n.io" style="color:#4f46e5;">n8n.io</a></td>
        </tr>
        <tr>
          <td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;color:#334155;">10</td>
          <td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;color:#334155;font-weight:bold;">Flowise</td>
          <td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;color:#334155;">Constructor visual de chatbots y agentes AI</td>
          <td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;"><a href="https://flowiseai.com" style="color:#4f46e5;">flowiseai.com</a></td>
        </tr>
        <tr>
          <td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;color:#334155;">11</td>
          <td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;color:#334155;font-weight:bold;">Open Interpreter</td>
          <td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;color:#334155;">Agente AI que ejecuta código y crea archivos</td>
          <td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;"><a href="https://github.com/OpenInterpreter/open-interpreter" style="color:#4f46e5;">GitHub</a></td>
        </tr>
        <tr>
          <td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;color:#334155;">12</td>
          <td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;color:#334155;font-weight:bold;">Uptime Kuma</td>
          <td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;color:#334155;">Monitor 24/7 - avisa si algo se cae</td>
          <td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;"><a href="https://github.com/louislam/uptime-kuma" style="color:#4f46e5;">GitHub</a></td>
        </tr>
        <tr>
          <td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;color:#334155;">13</td>
          <td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;color:#334155;font-weight:bold;">Tailscale VPN</td>
          <td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;color:#334155;">Accede a tu servidor desde cualquier lugar (gratis)</td>
          <td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;"><a href="https://tailscale.com" style="color:#4f46e5;">tailscale.com</a></td>
        </tr>
      </table>
      <div style="background-color:#ecfdf5;border-radius:6px;padding:12px;margin-top:12px;">
        <p style="margin:0;font-size:13px;color:#166534;">&#128176; <strong>Costo total del software:</strong> $0 (todo es open-source)</p>
        <p style="margin:4px 0 0;font-size:13px;color:#166534;">&#9200; <strong>Tiempo de setup:</strong> 2-4 horas para instalar todo</p>
      </div>
    </td></tr>
  </table>
</td>
</tr>

<!-- TABLA COMPARATIVA -->
<tr>
<td style="padding:0 24px 24px;">
  <table width="100%" cellpadding="0" cellspacing="0" style="border:2px solid #334155;border-radius:8px;overflow:hidden;">
    <tr><td style="background-color:#1e293b;padding:10px 16px;">
      <span style="color:#ffffff;font-weight:bold;font-size:14px;">&#128202; TABLA COMPARATIVA FINAL</span>
    </td></tr>
    <tr><td style="padding:16px;">
      <table width="100%" cellpadding="8" cellspacing="0" style="border-collapse:collapse;">
        <tr style="background-color:#f1f5f9;">
          <th style="text-align:left;padding:8px 12px;color:#475569;font-size:12px;border-bottom:1px solid #e2e8f0;">OPCIÓN</th>
          <th style="text-align:left;padding:8px 12px;color:#475569;font-size:12px;border-bottom:1px solid #e2e8f0;">VRAM</th>
          <th style="text-align:left;padding:8px 12px;color:#475569;font-size:12px;border-bottom:1px solid #e2e8f0;">MODELOS AI</th>
          <th style="text-align:left;padding:8px 12px;color:#475569;font-size:12px;border-bottom:1px solid #e2e8f0;">PRECIO</th>
        </tr>
        <tr>
          <td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;color:#334155;">&#128295; Upgrade PC actual</td>
          <td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;color:#334155;">24GB</td>
          <td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;color:#334155;">Hasta 70B (Q4)</td>
          <td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;color:#16a34a;font-weight:bold;">~$2,620</td>
        </tr>
        <tr style="background-color:#fafafa;">
          <td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;color:#334155;">1&#65039;&#8419; Entry Level</td>
          <td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;color:#334155;">16GB</td>
          <td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;color:#334155;">Hasta 14B fluido</td>
          <td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;color:#16a34a;font-weight:bold;">~$1,315</td>
        </tr>
        <tr>
          <td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;color:#334155;">2&#65039;&#8419; Recomendada</td>
          <td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;color:#334155;">24GB</td>
          <td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;color:#334155;">Hasta 70B (Q4)</td>
          <td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;color:#16a34a;font-weight:bold;">~$3,880</td>
        </tr>
        <tr style="background-color:#fafafa;">
          <td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;color:#334155;">3&#65039;&#8419; Profesional</td>
          <td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;color:#334155;">48GB → 144GB</td>
          <td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;color:#334155;">70B full → Todo</td>
          <td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;color:#16a34a;font-weight:bold;">~$9,960</td>
        </tr>
        <tr>
          <td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;color:#334155;">4&#65039;&#8419; Enterprise</td>
          <td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;color:#334155;">96GB → 144GB</td>
          <td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;color:#334155;">405B → Todo</td>
          <td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;color:#16a34a;font-weight:bold;">~$17,600</td>
        </tr>
      </table>
    </td></tr>
  </table>
</td>
</tr>

<!-- RECOMENDACIÓN -->
<tr>
<td style="padding:0 24px 24px;">
  <table width="100%" cellpadding="0" cellspacing="0" style="border:2px solid #4f46e5;border-radius:8px;overflow:hidden;">
    <tr><td style="background-color:#4f46e5;padding:10px 16px;">
      <span style="color:#ffffff;font-weight:bold;font-size:14px;">&#127919; MI RECOMENDACIÓN</span>
    </td></tr>
    <tr><td style="padding:16px;">
      <div style="background-color:#eef2ff;border-radius:6px;padding:16px;">
        <p style="margin:0 0 8px;font-size:14px;color:#3730a3;"><strong>Paso 1 (AHORA):</strong> Upgrade de tu PC actual (+$2,620). Te da 24GB VRAM para empezar.</p>
        <p style="margin:0 0 8px;font-size:14px;color:#3730a3;"><strong>Paso 2 (3-6 meses):</strong> Compra la Opción 3 (~$9,960). Escalable hasta 6 GPUs.</p>
        <p style="margin:0;font-size:14px;color:#3730a3;"><strong>Tu ViprTech:</strong> Se convierte en PC de gaming/oficina. La workstation es 100% dedicada a AI.</p>
      </div>
    </td></tr>
  </table>
</td>
</tr>

<!-- FOOTER -->
<tr>
<td style="padding:24px;text-align:center;color:#94a3b8;font-size:12px;">
  <p style="margin:0;">Generado por tu AI Assistant &bull; Ross Tax &amp; Lending Platform</p>
  <p style="margin:4px 0 0;">Los precios son aproximados y pueden variar. Verifica disponibilidad en Amazon antes de comprar.</p>
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
            subject="🧠 Guía Completa: PC para AI Local - Opciones 1-4 + Links Amazon + Software Gratis",
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
