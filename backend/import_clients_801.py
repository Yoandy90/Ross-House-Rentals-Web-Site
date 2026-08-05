"""
Client Import Script - Import clients from 801-list XLS file
Parses the tab-separated file and:
1. Creates new client records in users collection (if not existing)
2. Updates existing clients with missing data (birthdate, address, SSN)
3. Creates tax return records with e-filed dates
4. Creates appointment attendance records from e-filed dates
"""
import asyncio
import os
import sys
import uuid
import re
import logging
from datetime import datetime, timezone, timedelta

# Add backend to path
sys.path.insert(0, '/app/backend')

from dotenv import load_dotenv
load_dotenv('/app/backend/.env')

import motor.motor_asyncio
from bson import ObjectId

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

MONGO_URL = os.getenv('MONGO_URL')


def parse_date(date_str):
    """Parse various date formats"""
    if not date_str or date_str.strip() == '-' or date_str.strip() == '':
        return None
    date_str = date_str.strip()
    
    # Format: "Mar 1 2026 3:07PM"
    for fmt in [
        '%b %d %Y %I:%M%p',
        '%b %d %Y %I:%M %p', 
        '%b %d %Y',
        '%m/%d/%Y',
        '%m / %d / %Y',
    ]:
        try:
            return datetime.strptime(date_str, fmt)
        except ValueError:
            continue
    return None


def parse_birthdate(dob_str):
    """Parse birthdate in format '11 / 21 / 1990' or 'MM / DD / YYYY'"""
    if not dob_str or dob_str.strip() == '-' or dob_str.strip() == '':
        return None
    dob_str = dob_str.strip()
    
    # Remove extra spaces: "11 / 21 / 1990" -> "11/21/1990"
    cleaned = re.sub(r'\s*/\s*', '/', dob_str)
    
    for fmt in ['%m/%d/%Y', '%m/%d/%y', '%Y-%m-%d']:
        try:
            return datetime.strptime(cleaned, fmt)
        except ValueError:
            continue
    return None


def normalize_phone(phone_str):
    """Normalize phone number to digits only"""
    if not phone_str:
        return None, None
    digits = ''.join(filter(str.isdigit, phone_str))
    if len(digits) >= 10:
        last10 = digits[-10:]
        formatted = f"+1{last10}"
        return last10, formatted
    return None, phone_str


def normalize_ssn(ssn_str):
    """Get SSN last 4 digits"""
    if not ssn_str or ssn_str.strip() == '-':
        return None, None
    digits = ''.join(filter(str.isdigit, ssn_str))
    if len(digits) >= 4:
        return digits[-4:], digits
    return None, None


async def run_import():
    logger.info("🚀 Starting client import from 801-list file...")
    
    client = motor.motor_asyncio.AsyncIOMotorClient(MONGO_URL)
    db = client.get_database()
    
    # Parse the file
    with open('/app/client_list.xls', 'r', encoding='utf-8', errors='replace') as f:
        content = f.read()
    
    all_lines = content.split('\n')
    
    # Find header line
    header_idx = None
    for i, line in enumerate(all_lines):
        if 'SSN/EIN' in line and 'FIRST NAME' in line:
            header_idx = i
            break
    
    if header_idx is None:
        logger.error("❌ Header not found in file")
        return
    
    header = all_lines[header_idx].strip().split('\t')
    logger.info(f"📋 Header columns ({len(header)}): {header}")
    
    # Parse all data rows
    rows = []
    for line in all_lines[header_idx + 1:]:
        stripped = line.strip()
        if stripped and '\t' in stripped and not stripped.startswith('Custom') and not stripped.startswith(' Custom'):
            cols = stripped.split('\t')
            if len(cols) >= 6:  # At least SSN, first, last, DOB, phone, email
                rows.append(cols)
    
    logger.info(f"📊 Total data rows to process: {len(rows)}")
    
    # Get existing clients for duplicate detection
    existing_users = await db.users.find({'role': 'client'}).to_list(10000)
    
    existing_by_email = {}
    existing_by_phone = {}
    existing_by_ssn = {}
    
    for u in existing_users:
        email = (u.get('email') or '').lower().strip()
        if email and not email.startswith('import_') and '@placeholder' not in email:
            existing_by_email[email] = u
        
        phone = u.get('phone', '')
        if phone:
            digits = ''.join(filter(str.isdigit, phone))
            if len(digits) >= 10:
                existing_by_phone[digits[-10:]] = u
        
        ssn4 = u.get('ssn_last4', '')
        if ssn4:
            existing_by_ssn[ssn4] = u
    
    logger.info(f"📂 Existing clients: {len(existing_users)} total, {len(existing_by_email)} with email, {len(existing_by_phone)} with phone")
    
    # Process rows
    stats = {
        'created': 0,
        'updated': 0, 
        'skipped': 0,
        'tax_returns_created': 0,
        'appointments_created': 0,
        'errors': 0,
    }
    
    # Get current invoice count for numbering
    invoice_count = await db.invoices.count_documents({})
    
    for idx, cols in enumerate(rows):
        try:
            ssn_raw = cols[0].strip() if len(cols) > 0 else ''
            first_name = cols[1].strip().title() if len(cols) > 1 else ''
            last_name = cols[2].strip().title() if len(cols) > 2 else ''
            birthdate_raw = cols[3].strip() if len(cols) > 3 else ''
            phone_raw = cols[4].strip() if len(cols) > 4 else ''
            email_raw = cols[5].strip().lower() if len(cols) > 5 else ''
            efiled_date_raw = cols[6].strip() if len(cols) > 6 else ''
            efiled_flag = cols[7].strip().upper() if len(cols) > 7 else ''
            paper_date_raw = cols[8].strip() if len(cols) > 8 else ''
            paper_flag = cols[9].strip().upper() if len(cols) > 9 else ''
            street_address = cols[10].strip() if len(cols) > 10 else ''
            apt = cols[11].strip() if len(cols) > 11 else ''
            city = cols[12].strip() if len(cols) > 12 else ''
            state = cols[13].strip().upper() if len(cols) > 13 else ''
            zip_code = cols[14].strip() if len(cols) > 14 else ''
            age_raw = cols[15].strip() if len(cols) > 15 else ''
            
            if not first_name:
                stats['errors'] += 1
                continue
            
            full_name = f"{first_name} {last_name}".strip()
            ssn_last4, ssn_full = normalize_ssn(ssn_raw)
            phone_normalized, phone_formatted = normalize_phone(phone_raw)
            birthdate = parse_birthdate(birthdate_raw)
            efiled_date = parse_date(efiled_date_raw)
            paper_date = parse_date(paper_date_raw)
            
            # Build full address
            full_address = street_address
            if apt and apt != '-':
                full_address += f" Apt {apt}"
            if city:
                full_address += f", {city}"
            if state:
                full_address += f", {state}"
            if zip_code:
                full_address += f" {zip_code}"
            
            # Check for existing client
            existing = None
            matched_by = None
            
            if email_raw and email_raw in existing_by_email:
                existing = existing_by_email[email_raw]
                matched_by = 'email'
            elif phone_normalized and phone_normalized in existing_by_phone:
                existing = existing_by_phone[phone_normalized]
                matched_by = 'phone'
            elif ssn_last4 and ssn_last4 in existing_by_ssn:
                existing = existing_by_ssn[ssn_last4]
                matched_by = 'ssn'
            
            user_id = None
            
            if existing:
                user_id = existing.get('id') or str(existing.get('_id'))
                # Update with any missing fields
                update_data = {'updated_at': datetime.utcnow()}
                
                if birthdate and not existing.get('birthdate'):
                    update_data['birthdate'] = birthdate.strftime('%m/%d/%Y')
                
                if ssn_last4 and not existing.get('ssn_last4'):
                    update_data['ssn_last4'] = ssn_last4
                
                if full_address and not existing.get('address'):
                    update_data['address'] = full_address
                
                if city and not existing.get('city'):
                    update_data['city'] = city
                
                if state and not existing.get('state'):
                    update_data['state'] = state
                
                if zip_code and not existing.get('zip_code'):
                    update_data['zip_code'] = zip_code
                
                if phone_formatted and not existing.get('phone'):
                    update_data['phone'] = phone_formatted
                
                if not existing.get('first_name'):
                    update_data['first_name'] = first_name
                    update_data['last_name'] = last_name
                    update_data['full_name'] = full_name
                
                # Update declaration status if e-filed
                if efiled_flag == 'YES':
                    update_data['declaration_status'] = 'filed'
                    update_data['declaration_history'] = existing.get('declaration_history', {})
                    update_data['declaration_history']['2025'] = {
                        'status': 'filed',
                        'method': 'e-file',
                        'date': efiled_date.isoformat() if efiled_date else None,
                        'updated_at': datetime.utcnow()
                    }
                elif paper_flag == 'YES':
                    update_data['declaration_status'] = 'filed'
                    update_data['declaration_history'] = existing.get('declaration_history', {})
                    update_data['declaration_history']['2025'] = {
                        'status': 'filed',
                        'method': 'paper',
                        'date': paper_date.isoformat() if paper_date else None,
                        'updated_at': datetime.utcnow()
                    }
                
                if len(update_data) > 1:  # More than just updated_at
                    await db.users.update_one(
                        {'_id': existing['_id']},
                        {'$set': update_data}
                    )
                    stats['updated'] += 1
                else:
                    stats['skipped'] += 1
            else:
                # Create new client
                new_user_id = str(uuid.uuid4())
                user_id = new_user_id
                
                filing_status = 'filed' if efiled_flag == 'YES' or paper_flag == 'YES' else 'pending'
                filing_method = 'e-file' if efiled_flag == 'YES' else ('paper' if paper_flag == 'YES' else None)
                filing_date = efiled_date or paper_date
                
                new_client = {
                    'id': new_user_id,
                    'email': email_raw if email_raw else f"import_{uuid.uuid4().hex[:8]}@placeholder.rosstax.com",
                    'first_name': first_name,
                    'last_name': last_name,
                    'full_name': full_name,
                    'name': full_name,
                    'phone': phone_formatted or '',
                    'address': full_address,
                    'city': city,
                    'state': state,
                    'zip_code': zip_code,
                    'birthdate': birthdate.strftime('%m/%d/%Y') if birthdate else '',
                    'ssn_last4': ssn_last4 or '',
                    'role': 'client',
                    'is_active': True,
                    'declaration_status': filing_status,
                    'declaration_history': {
                        '2025': {
                            'status': filing_status,
                            'method': filing_method,
                            'date': filing_date.isoformat() if filing_date else None,
                            'updated_at': datetime.utcnow()
                        }
                    },
                    'current_tax_year': '2025',
                    'created_at': datetime.utcnow(),
                    'updated_at': datetime.utcnow(),
                    'source': 'xls_import_801',
                    'password': '$2b$12$placeholder.hash.for.import.users'
                }
                
                result = await db.users.insert_one(new_client)
                new_client['_id'] = result.inserted_id
                stats['created'] += 1
                
                # Add to lookup dicts
                if email_raw:
                    existing_by_email[email_raw] = new_client
                if phone_normalized:
                    existing_by_phone[phone_normalized] = new_client
                if ssn_last4:
                    existing_by_ssn[ssn_last4] = new_client
            
            # Create tax return record if e-filed or paper filed
            if efiled_flag == 'YES' or paper_flag == 'YES':
                filing_date_val = efiled_date or paper_date
                method = 'e-file' if efiled_flag == 'YES' else 'paper'
                
                # Check if tax return already exists for this user/year
                existing_tr = await db.tax_returns.find_one({
                    '$or': [
                        {'user_id': user_id},
                        {'client_name': full_name}
                    ],
                    'tax_year': '2025'
                })
                
                if not existing_tr:
                    tax_return = {
                        'user_id': user_id,
                        'client_name': full_name,
                        'client_email': email_raw,
                        'client_phone': phone_formatted or '',
                        'tax_year': '2025',
                        'filing_method': method,
                        'filing_date': filing_date_val,
                        'status': 'filed',
                        'ssn_last4': ssn_last4 or '',
                        'created_at': filing_date_val or datetime.utcnow(),
                        'updated_at': datetime.utcnow(),
                        'source': 'xls_import_801'
                    }
                    await db.tax_returns.insert_one(tax_return)
                    stats['tax_returns_created'] += 1
            
            # Create appointment attendance record from e-filed date
            if efiled_date:
                # Check if appointment already exists for this date/user
                appt_date_str = efiled_date.strftime('%Y-%m-%d')
                existing_appt = await db.appointments.find_one({
                    '$or': [
                        {'user_id': user_id},
                        {'user_name': full_name}
                    ],
                    'date': appt_date_str
                })
                
                if not existing_appt:
                    appointment = {
                        'id': str(uuid.uuid4()),
                        'user_id': user_id,
                        'user_name': full_name,
                        'user_email': email_raw,
                        'user_phone': phone_formatted or '',
                        'title': 'Tax Preparation - E-File',
                        'service_name': 'Declaración de Impuestos',
                        'description': f'Tax filing for {full_name} - E-Filed',
                        'scheduled_at': efiled_date,
                        'date': appt_date_str,
                        'time': efiled_date.strftime('%H:%M'),
                        'duration_minutes': 60,
                        'status': 'completed',
                        'appointment_type': 'in_person',
                        'checked_in_at': efiled_date,
                        'completed_at': efiled_date,
                        'created_at': efiled_date,
                        'updated_at': datetime.utcnow(),
                        'source': 'xls_import_801',
                        'quantity': 1,
                        'attendees': [{
                            'name': full_name,
                            'phone': phone_formatted or '',
                            'email': email_raw,
                            'relationship': 'self'
                        }]
                    }
                    await db.appointments.insert_one(appointment)
                    stats['appointments_created'] += 1
            
        except Exception as e:
            stats['errors'] += 1
            if stats['errors'] <= 5:
                logger.error(f"❌ Error processing row {idx+1}: {e}")
    
    logger.info(f"""
╔══════════════════════════════════════════════╗
║       IMPORT COMPLETED SUCCESSFULLY          ║
╠══════════════════════════════════════════════╣
║  ✅ New clients created:      {stats['created']:>4}           ║
║  🔄 Existing clients updated: {stats['updated']:>4}           ║
║  ⏭️  Skipped (no changes):    {stats['skipped']:>4}           ║
║  📄 Tax returns created:      {stats['tax_returns_created']:>4}           ║
║  📅 Appointments created:     {stats['appointments_created']:>4}           ║
║  ❌ Errors:                   {stats['errors']:>4}           ║
╚══════════════════════════════════════════════╝
""")
    
    client.close()
    return stats


if __name__ == '__main__':
    asyncio.run(run_import())
