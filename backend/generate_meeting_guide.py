"""
Script to generate PDF guide for FileYourTaxes.com meeting and send via email
"""
import os
import sys
sys.path.insert(0, '/app/backend')

from fpdf import FPDF
from sendgrid import SendGridAPIClient
from sendgrid.helpers.mail import Mail, Attachment, FileContent, FileName, FileType, Disposition
import base64
from dotenv import load_dotenv

load_dotenv('/app/backend/.env')

class MeetingGuidePDF(FPDF):
    def __init__(self, lang='es'):
        super().__init__()
        self.lang = lang
    
    def header(self):
        self.set_font('Helvetica', 'B', 10)
        self.set_text_color(0, 102, 204)
        self.cell(0, 8, 'Ross Tax Preparation LLC - Confidential', 0, 1, 'R')
        self.set_draw_color(0, 102, 204)
        self.line(10, self.get_y(), 200, self.get_y())
        self.ln(4)
    
    def footer(self):
        self.set_y(-15)
        self.set_font('Helvetica', 'I', 8)
        self.set_text_color(128, 128, 128)
        self.cell(0, 10, f'Page {self.page_no()}/{{nb}}', 0, 0, 'C')

    def section_title(self, title, emoji=''):
        self.set_font('Helvetica', 'B', 14)
        self.set_text_color(0, 51, 102)
        self.set_fill_color(230, 240, 255)
        self.cell(0, 10, f'  {emoji} {title}', 0, 1, 'L', True)
        self.ln(3)
    
    def sub_title(self, title):
        self.set_font('Helvetica', 'B', 11)
        self.set_text_color(0, 76, 153)
        self.cell(0, 7, f'  {title}', 0, 1, 'L')
        self.ln(1)
    
    def body_text(self, text, bold=False):
        self.set_font('Helvetica', 'B' if bold else '', 10)
        self.set_text_color(40, 40, 40)
        self.multi_cell(0, 6, text)
        self.ln(1)
    
    def bullet(self, text, indent=10):
        self.set_font('Helvetica', '', 10)
        self.set_text_color(40, 40, 40)
        x = self.get_x()
        self.set_x(x + indent)
        self.cell(5, 6, '-', 0, 0)
        self.multi_cell(0, 6, f' {text}')
        self.ln(0.5)
    
    def check_bullet(self, text, indent=10):
        self.set_font('Helvetica', '', 10)
        self.set_text_color(40, 40, 40)
        x = self.get_x()
        self.set_x(x + indent)
        self.set_text_color(0, 153, 0)
        self.cell(5, 6, '[OK]', 0, 0)
        self.set_text_color(40, 40, 40)
        self.multi_cell(0, 6, f' {text}')
        self.ln(0.5)

    def warning_bullet(self, text, indent=10):
        self.set_font('Helvetica', '', 10)
        self.set_text_color(40, 40, 40)
        x = self.get_x()
        self.set_x(x + indent)
        self.set_text_color(204, 0, 0)
        self.cell(5, 6, '[!]', 0, 0)
        self.set_text_color(40, 40, 40)
        self.multi_cell(0, 6, f' {text}')
        self.ln(0.5)

    def table_row(self, col1, col2, header=False):
        self.set_font('Helvetica', 'B' if header else '', 10)
        if header:
            self.set_fill_color(0, 76, 153)
            self.set_text_color(255, 255, 255)
        else:
            self.set_fill_color(245, 248, 255)
            self.set_text_color(40, 40, 40)
        self.cell(70, 8, f'  {col1}', 1, 0, 'L', True)
        self.set_font('Helvetica', '' if not header else 'B', 10)
        self.cell(0, 8, f'  {col2}', 1, 1, 'L', True)

    def quote_box(self, text):
        self.set_fill_color(245, 250, 255)
        self.set_draw_color(0, 102, 204)
        x = self.get_x()
        y = self.get_y()
        self.set_font('Helvetica', 'I', 10)
        self.set_text_color(40, 40, 40)
        # Draw left border
        self.set_x(x + 5)
        self.multi_cell(180, 6, text, 0, 'L')
        end_y = self.get_y()
        self.line(x + 3, y, x + 3, end_y)
        self.ln(3)


def generate_pdf():
    pdf = MeetingGuidePDF()
    pdf.alias_nb_pages()
    pdf.set_auto_page_break(auto=True, margin=20)
    
    # ===== PAGE 1: Cover =====
    pdf.add_page()
    pdf.ln(30)
    pdf.set_font('Helvetica', 'B', 28)
    pdf.set_text_color(0, 51, 102)
    pdf.cell(0, 15, 'MEETING GUIDE', 0, 1, 'C')
    pdf.set_font('Helvetica', 'B', 22)
    pdf.set_text_color(0, 102, 204)
    pdf.cell(0, 12, 'FileYourTaxes.com', 0, 1, 'C')
    pdf.set_font('Helvetica', '', 14)
    pdf.set_text_color(100, 100, 100)
    pdf.cell(0, 10, 'API Integration Demo', 0, 1, 'C')
    pdf.ln(10)
    pdf.set_draw_color(0, 102, 204)
    pdf.line(60, pdf.get_y(), 150, pdf.get_y())
    pdf.ln(10)
    pdf.set_font('Helvetica', '', 12)
    pdf.set_text_color(60, 60, 60)
    pdf.cell(0, 8, 'Prepared for: Ross Tax Preparation LLC', 0, 1, 'C')
    pdf.cell(0, 8, 'Contact: yoandyross@gmail.com', 0, 1, 'C')
    pdf.ln(20)
    pdf.set_font('Helvetica', 'I', 10)
    pdf.set_text_color(150, 150, 150)
    pdf.cell(0, 8, 'Confidential document - For internal use only', 0, 1, 'C')

    # ===== PAGE 2: Objective & Presentation =====
    pdf.add_page()
    pdf.section_title('MAIN OBJECTIVE')
    pdf.body_text('Obtain access to the FileYourTaxes.com API to integrate e-filing directly into our existing platform (web + mobile app), without using their interface.')
    pdf.ln(5)
    
    pdf.section_title('PRESENT YOUR PLATFORM (2-3 min)')
    pdf.sub_title('Suggested script:')
    pdf.quote_box('"We have a complete tax preparation platform with a mobile app (iOS/Android) and an administrative web portal. Clients complete their information through a guided wizard, our preparers review it, and then we need to electronically transmit to the IRS. We are looking for an API that handles official calculations and transmission."')
    pdf.ln(3)
    
    pdf.sub_title('Key strengths to mention:')
    pdf.check_bullet('Active EFIN (Electronic Return Originator)')
    pdf.check_bullet('Active IRS credentials (TCC, IRIS for 1099s)')
    pdf.check_bullet('Own integrated payment system (NMI/Merchant One)')
    pdf.check_bullet('Dedicated technical team with proprietary platform')
    pdf.check_bullet('iOS/Android mobile app + Web Portal already live')
    pdf.check_bullet('Guided Tax Wizard for client data collection')

    # ===== PAGE 3: Technical Questions =====
    pdf.add_page()
    pdf.section_title('KEY TECHNICAL QUESTIONS')
    
    pdf.sub_title('About the API:')
    pdf.bullet('Is the API REST or SOAP? Do you have documentation/Swagger?')
    pdf.bullet('Do you have a sandbox/testing environment for development?')
    pdf.bullet('What data format do you accept? (JSON, XML)')
    pdf.bullet('What is the flow: send data -> receive calculations -> confirm -> transmit to IRS?')
    pdf.bullet('Do you have webhooks for status updates (accepted/rejected)?')
    pdf.bullet('What is the API rate limit?')
    pdf.bullet('Do you have SDKs or libraries for Python?')
    pdf.ln(3)
    
    pdf.sub_title('Supported forms:')
    pdf.bullet('1040, 1040-SR, 1040-NR (individual returns)')
    pdf.bullet('W-2, 1099 (all types: NEC, MISC, INT, DIV)')
    pdf.bullet('1120, 1120S, 1065 (corporations/LLC)')
    pdf.bullet('941, 940 (payroll)')
    pdf.bullet('All states? Which ones specifically?')
    pdf.bullet('Schedules? (Schedule C, SE, EIC, A, D)')
    pdf.ln(3)
    
    pdf.sub_title('About e-filing:')
    pdf.bullet('Is the IRS transmission direct or through an intermediary?')
    pdf.bullet('How long does it take to process an e-file?')
    pdf.bullet('Do I receive IRS acceptance/rejection confirmation via API?')
    pdf.bullet('Can I check refund status via API?')
    pdf.bullet('What happens if the IRS rejects a return? Can I resubmit via API?')

    # ===== PAGE 4: Business Questions =====
    pdf.add_page()
    pdf.section_title('BUSINESS / PRICING QUESTIONS')
    
    pdf.bullet('Do you charge per return, monthly subscription, or annually?')
    pdf.bullet('Is there a minimum volume requirement?')
    pdf.bullet('What is the cost per return for e-filing?')
    pdf.bullet('Are there additional costs per state?')
    pdf.bullet('Is sandbox access free during development?')
    pdf.bullet('How long does a typical integration take?')
    pdf.bullet('Do you offer technical support during integration? Is there a cost?')
    pdf.bullet('Are there volume discounts?')
    pdf.ln(5)

    pdf.section_title('NEGOTIATION POINTS')
    pdf.table_row('Point', 'What you want', header=True)
    pdf.table_row('Sandbox access', 'Free and immediate to start developing')
    pdf.table_row('Price per return', 'As low as possible, ideally < $5-10/return')
    pdf.table_row('Minimum volume', 'No minimum, or low minimum first year')
    pdf.table_row('Technical support', 'Included during integration')
    pdf.table_row('Contract', 'Monthly or annual with no cancellation penalty')
    pdf.table_row('White-label', 'Client NEVER sees the FileYourTaxes brand')
    pdf.table_row('Documentation', 'Access before signing contract')

    # ===== PAGE 5: Timeline & Red Flags =====
    pdf.add_page()
    pdf.section_title('TIMELINE QUESTIONS')
    pdf.bullet('When can I have sandbox access?')
    pdf.bullet('Is the API ready for the 2025-2026 tax season?')
    pdf.bullet('How long is the typical integration time for a technical team?')
    pdf.bullet('Is there a certification/approval process before transmitting in production?')
    pdf.bullet('Do you have any deadline for onboarding new integrators?')
    pdf.ln(5)
    
    pdf.section_title('RED FLAGS - WATCH OUT IF...')
    pdf.warning_bullet('They do not have a sandbox/testing environment')
    pdf.warning_bullet('They only offer iframe/widget, not a real API')
    pdf.warning_bullet('They do not support webhooks for status updates')
    pdf.warning_bullet('They force you to use their interface for any step')
    pdf.warning_bullet('Long mandatory contract (2+ years)')
    pdf.warning_bullet('They cannot provide technical documentation before signing')
    pdf.warning_bullet('They do not support the forms you need (1120, 1065)')
    pdf.warning_bullet('E-filing goes through an additional third-party intermediary')
    
    # ===== PAGE 6: Results Checklist =====
    pdf.add_page()
    pdf.section_title('WHAT YOU MUST GET FROM THE MEETING')
    pdf.ln(3)
    pdf.check_bullet('API documentation (or access to it)')
    pdf.check_bullet('Sandbox credentials to start testing')
    pdf.check_bullet('Clear pricing per return / annual')
    pdf.check_bullet('Integration timeline')
    pdf.check_bullet('Direct technical contact for when you start integrating')
    pdf.check_bullet('Complete list of supported forms')
    pdf.check_bullet('Example API request/response')
    pdf.ln(10)

    pdf.section_title('MEETING NOTES')
    # Add lined space for notes
    for i in range(15):
        y = pdf.get_y()
        pdf.set_draw_color(200, 200, 200)
        pdf.line(15, y, 195, y)
        pdf.ln(10)

    # ===== PAGE 7: Contact Info =====
    pdf.add_page()
    pdf.section_title('CONTACT INFORMATION')
    pdf.ln(3)
    
    pdf.sub_title('FileYourTaxes.com')
    pdf.bullet('Sales: Sales@ProTaxPro.com')
    pdf.bullet('Phone: (805) 256-1791 (Mon-Fri, 8:30am-5:00pm PST)')
    pdf.bullet('API Info: taxman@FileYourTaxes.com')
    pdf.bullet('General Phone: (805) 256-1788')
    pdf.bullet('Web APIs: https://www.fileyourtaxes.com/apis')
    pdf.bullet('Private Label: https://www.fileyourtaxes.com/private-label')
    pdf.ln(10)
    
    pdf.sub_title('Your Platform')
    pdf.bullet('Web: rosstaxpreparation.com')
    pdf.bullet('App: Ross Tax (iOS/Android - App Store & Google Play)')
    pdf.bullet('Backend: FastAPI + MongoDB')
    pdf.bullet('Payments: NMI Customer Vault')
    pdf.bullet('IRS: Active EFIN, TCC, IRIS credentials')
    
    # Save
    output_path = '/app/memory/Meeting_Guide_FileYourTaxes_EN.pdf'
    pdf.output(output_path)
    print(f"PDF generated: {output_path}")
    return output_path


def send_email(pdf_path):
    sg = SendGridAPIClient(os.getenv('SENDGRID_API_KEY'))
    
    with open(pdf_path, 'rb') as f:
        pdf_data = f.read()
    
    encoded_pdf = base64.b64encode(pdf_data).decode()
    
    message = Mail(
        from_email=os.getenv('SENDGRID_FROM_EMAIL', 'info@rosstaxpreparation.com'),
        to_emails='yoandyross@gmail.com',
        subject='Meeting Guide - FileYourTaxes.com API Demo (English Version)',
        html_content="""
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background: linear-gradient(135deg, #003366, #0066cc); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
                <h1 style="color: white; margin: 0;">Meeting Guide</h1>
                <p style="color: #cce0ff; margin: 5px 0 0;">FileYourTaxes.com - API Demo (English Version)</p>
            </div>
            <div style="padding: 25px; background: #f8f9fa; border: 1px solid #e0e0e0;">
                <p>Hi Yoandy,</p>
                <p>Attached is the complete English version of the meeting guide for FileYourTaxes.com. It includes:</p>
                <ul>
                    <li><strong>Platform presentation script</strong></li>
                    <li><strong>Technical questions</strong> about the API</li>
                    <li><strong>Business & pricing questions</strong></li>
                    <li><strong>Negotiation points</strong></li>
                    <li><strong>Red flags</strong> to watch for</li>
                    <li><strong>Checklist</strong> of what to obtain</li>
                    <li><strong>Notes space</strong> for during the meeting</li>
                </ul>
                <p>Print it out and take it to the meeting!</p>
                <p style="color: #666; font-size: 12px; margin-top: 20px;">- Ross Tax Platform</p>
            </div>
        </div>
        """
    )
    
    attachment = Attachment(
        FileContent(encoded_pdf),
        FileName('Guia_Reunion_FileYourTaxes.pdf'),
        FileType('application/pdf'),
        Disposition('attachment')
    )
    message.attachment = attachment
    
    response = sg.send(message)
    print(f"Email enviado! Status: {response.status_code}")
    return response.status_code


if __name__ == '__main__':
    pdf_path = generate_pdf()
    status = send_email(pdf_path)
    print(f"Completado! Status: {status}")
