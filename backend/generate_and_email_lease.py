#!/usr/bin/env python3
"""
Script to generate the Texas Residential Lease Agreement PDF
with the new Addendum K (Photo and Identity Verification)
and email it to the specified recipient.
"""
import os
import sys
import asyncio
import base64
from datetime import datetime

# Add the backend directory to path
sys.path.insert(0, '/app/backend')
os.chdir('/app/backend')

from dotenv import load_dotenv
load_dotenv()

from rental_pdf_service import generate_rental_contract_pdf

# Import SendGrid
try:
    from sendgrid import SendGridAPIClient
    from sendgrid.helpers.mail import Mail, Attachment, FileContent, FileName, FileType, Disposition
except ImportError:
    print("❌ SendGrid not installed. Installing...")
    os.system("pip install sendgrid")
    from sendgrid import SendGridAPIClient
    from sendgrid.helpers.mail import Mail, Attachment, FileContent, FileName, FileType, Disposition


async def main():
    # Get SendGrid API key from environment or config
    sendgrid_api_key = os.getenv('SENDGRID_API_KEY')
    
    # Also try to get from MongoDB config
    if not sendgrid_api_key:
        try:
            from pymongo import MongoClient
            mongo_url = os.getenv('MONGO_URL', 'mongodb://localhost:27017')
            client = MongoClient(mongo_url)
            db = client['rentals_db']
            config = db['rental_config'].find_one({'type': 'admin_config'})
            if config:
                sendgrid_api_key = config.get('sendgrid_api_key')
        except Exception as e:
            print(f"⚠️ Could not get config from MongoDB: {e}")
    
    if not sendgrid_api_key:
        print("❌ SENDGRID_API_KEY not found. Cannot send email.")
        print("   PDF will be generated but not emailed.")
    
    # Generate the PDF
    print("📄 Generating Texas Residential Lease Agreement PDF...")
    print("   - Includes 61 Sections")
    print("   - Includes 13 Addenda (A-M)")
    print("   - VERSIÓN FINAL DEFINITIVA")
    print("")
    
    # Blank contract data - all fields fillable (for print version)
    contract_data = {
        "contract_number": "RHR-_____-______",  # Blank format
        "execution_date": "___________________",  # Blank
        "property_address": "",  # Fillable
        "bedrooms": "",  # Fillable
        "bathrooms": "",  # Fillable
        "garage": "",  # Fillable
        "sq_ft": "",  # Fillable
        "year_built": "",  # Fillable
        "tenant_name": "",  # Fillable
        "tenant_address": "",  # Fillable
        "tenant_phone": "",  # Fillable
        "tenant_email": "",  # Fillable
        "rent_amount": 0,  # Will show blank
        "deposit_amount": 0,  # Will show blank
        "payment_due_day": 1,
        "late_fee_amount": 50,
        "late_fee_grace_days": 5,
        "nsf_fee": 35,
        "late_fee_cap": 100,
        "start_date": "",  # Fillable
        "end_date": "",  # Fillable
        "addendums": {
            "pets": True,
            "lead_paint": False,
            "flood_zone": False,
        }
    }
    
    # Generate the PDF
    try:
        pdf_base64 = generate_rental_contract_pdf(contract_data)
        print("✅ PDF generated successfully!")
    except Exception as e:
        print(f"❌ Error generating PDF: {e}")
        raise e
    
    # Save a local copy
    pdf_bytes = base64.b64decode(pdf_base64)
    local_path = '/app/backend/Ross_House_Rentals_Texas_Lease_Agreement_FINAL_MASTER_PRINT.pdf'
    with open(local_path, 'wb') as f:
        f.write(pdf_bytes)
    print(f"💾 PDF saved locally: {local_path}")
    print(f"   Size: {len(pdf_bytes):,} bytes ({len(pdf_bytes)/1024:.1f} KB)")
    
    # Send email if SendGrid is configured
    if sendgrid_api_key:
        to_email = "yoandyross@gmail.com"
        # Use verified SendGrid sender
        from_email = "notifications@rosstaxpreparation.com"
        
        print(f"\n📧 Sending email to {to_email}...")
        
        html_content = """
        <html>
        <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background-color: #1E3A5F; padding: 20px; text-align: center;">
                <h1 style="color: white; margin: 0;">Ross House Rentals LLC</h1>
            </div>
            
            <div style="padding: 30px; background-color: #f8f9fa;">
                <h2 style="color: #1E3A5F;">📄 VERSIÓN PARA IMPRESIÓN - Contrato de Arrendamiento</h2>
                
                <div style="background: #fff3cd; border: 1px solid #ffc107; padding: 15px; margin: 20px 0; border-radius: 5px;">
                    <p style="margin: 0 0 10px 0; color: #856404;"><strong>🖨️ VERSIÓN 2: PDF PLANO PARA IMPRESIÓN</strong></p>
                    <ul style="margin: 0; padding-left: 20px;">
                        <li>Diseñado para impresión física</li>
                        <li>Líneas para rellenar a mano</li>
                        <li>Casillas para marcar con bolígrafo</li>
                        <li>Formato profesional para firma presencial</li>
                    </ul>
                </div>
                
                <div style="background: white; border-left: 4px solid #ED1B33; padding: 15px; margin: 20px 0;">
                    <p style="margin: 0 0 10px 0;"><strong>📋 Contenido del Documento:</strong></p>
                    <ul style="margin: 0; padding-left: 20px;">
                        <li><strong>61 Secciones</strong> bilingües (EN/ES)</li>
                        <li><strong>13 Addenda</strong> (A-M)</li>
                        <li>Texas Property Code Chapters 92 & 24</li>
                        <li>Fair Housing Act, ADA, SCRA compliant</li>
                    </ul>
                </div>
                
                <div style="background: #d4edda; border: 1px solid #28a745; padding: 15px; margin: 20px 0; border-radius: 5px;">
                    <p style="margin: 0 0 10px 0; color: #155724;"><strong>📧 TAMBIÉN ENVIADO:</strong></p>
                    <p style="margin: 0;">PDF Rellenable Interactivo (Ver email anterior)</p>
                </div>
                
                <p style="margin-top: 30px; color: #666; text-align: center;">
                    <strong>Ross House Rentals LLC - Texas Residential Lease Agreement</strong><br>
                    <strong>Final Master Version - Print Edition</strong>
                </p>
            </div>
            
            <div style="background-color: #231F20; color: white; padding: 15px; text-align: center; font-size: 12px;">
                <p style="margin: 5px 0;"><strong>Ross House Rentals LLC</strong></p>
                <p style="margin: 5px 0;">305 Bruce Ave, Dumas, TX 79029 | (806) 934-2018</p>
            </div>
        </body>
        </html>
        """
        
        message = Mail(
            from_email=from_email,
            to_emails=to_email,
            subject="📄 Ross House Rentals - VERSIÓN PARA IMPRESIÓN - Contrato de Arrendamiento (PDF Plano)",
            html_content=html_content
        )
        
        # Attach the PDF
        attachment = Attachment()
        attachment.file_content = FileContent(pdf_base64)
        attachment.file_type = FileType('application/pdf')
        attachment.file_name = FileName('Ross_House_Rentals_Texas_Lease_Agreement_FINAL_MASTER_PRINT.pdf')
        attachment.disposition = Disposition('attachment')
        message.attachment = attachment
        
        try:
            sg = SendGridAPIClient(sendgrid_api_key)
            response = sg.send(message)
            print(f"✅ Email sent successfully!")
            print(f"   Status code: {response.status_code}")
        except Exception as e:
            print(f"❌ Error sending email: {e}")
    else:
        print("\n⚠️ Email not sent (no SendGrid API key found)")
        print(f"   But the PDF is available at: {local_path}")
    
    print("\n" + "="*60)
    print("🎉 COMPLETED!")
    print("="*60)


if __name__ == "__main__":
    asyncio.run(main())
