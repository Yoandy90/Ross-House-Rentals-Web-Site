"""
═══════════════════════════════════════════════════════════════════════════════
 Metro 2 Format Generator — Ross Lending Solutions LLC
 CDIA-compliant fixed-width (426 chars) Metro 2 data furnishing generator.
 Generates Header, Base Segments, and Trailer for credit bureau submission.
═══════════════════════════════════════════════════════════════════════════════

Metro 2 Format Reference (CDIA Standard):
 - Header Record:  426 characters, Record Identifier = "HEADER"
 - Base Segment:   426 characters per account
 - J1 Segment:     200 characters (associated consumer - optional)
 - J2 Segment:     200 characters (secondary consumer - optional)
 - Trailer Record: 426 characters, Record Identifier = "TRAILER"

Note: This generates the standard ASCII fixed-width Metro 2 file
that can be submitted to Equifax, TransUnion, and Experian.
"""

import logging
from datetime import datetime
from typing import Optional

logger = logging.getLogger(__name__)

# ═══════════════════════════════════════════════════════════════════════════════
# CONSTANTS
# ═══════════════════════════════════════════════════════════════════════════════

RECORD_LENGTH = 426

# Furnisher Information (Ross Lending Solutions)
FURNISHER_NAME = "ROSS LENDING SOLUTIONS LLC"
FURNISHER_ADDRESS = "305 BRUCE AVE"
FURNISHER_CITY = "DUMAS"
FURNISHER_STATE = "TX"
FURNISHER_ZIP = "79029"
FURNISHER_PHONE = "8069342018"
PROGRAM_ID = ""  # Assigned by bureau upon enrollment
FURNISHER_ID = ""  # Assigned by bureau upon enrollment

# Account Status Codes (Metro 2 Standard)
ACCOUNT_STATUS = {
    "current":     "11",  # Current account
    "active":      "11",  # Current/Active
    "disbursed":   "11",  # Recently disbursed = current
    "late_30":     "71",  # 30 days past due
    "late_60":     "78",  # 60 days past due
    "late_90":     "80",  # 90 days past due
    "late_120":    "82",  # 120 days past due
    "late_150":    "83",  # 150 days past due
    "late_180":    "84",  # 180+ days past due
    "paid_off":    "13",  # Paid / zero balance
    "charged_off": "97",  # Charged off
    "collections": "93",  # Assigned to collections
    "cancelled":   "DA",  # Account closed
}

# Account Type Codes
ACCOUNT_TYPE = {
    "subchapter_e": "48",  # Installment (other)
    "subchapter_f": "18",  # Unsecured loan
    "personal":     "48",  # Personal installment
    "tax_advance":  "18",  # Short-term unsecured
}

# Payment Rating (0-6, L)
PAYMENT_RATING = {
    "current":  "0",
    "late_30":  "1",
    "late_60":  "2",
    "late_90":  "3",
    "late_120": "4",
    "late_150": "5",
    "late_180": "6",
}

# Portfolio Type
PORTFOLIO_TYPE = {
    "subchapter_e": "I",  # Installment
    "subchapter_f": "I",  # Installment
    "personal":     "I",  # Installment
    "tax_advance":  "I",  # Installment
}

# Terms Frequency
TERMS_FREQUENCY = "M"  # Monthly

# Interest Type
INTEREST_TYPE = "F"  # Fixed


# ═══════════════════════════════════════════════════════════════════════════════
# HELPER FUNCTIONS
# ═══════════════════════════════════════════════════════════════════════════════

def _ljust(value: str, length: int) -> str:
    """Left-justify and pad with spaces, truncate if needed."""
    return str(value or "").upper().ljust(length)[:length]


def _rjust_zero(value, length: int) -> str:
    """Right-justify and pad with zeros."""
    return str(int(float(value or 0))).zfill(length)[:length]


def _amount(value, length: int = 9) -> str:
    """Format monetary amount: right-justified, zero-filled, no decimals (cents)."""
    cents = int(round(float(value or 0) * 100))
    if cents < 0:
        cents = 0
    return str(cents).zfill(length)[:length]


def _date_mmddyyyy(date_str: str) -> str:
    """Convert ISO date to MMDDYYYY format."""
    if not date_str:
        return "0" * 8
    try:
        dt = datetime.fromisoformat(str(date_str).replace("Z", "").split("T")[0])
        return dt.strftime("%m%d%Y")
    except Exception:
        return "0" * 8


def _date_mmyyyy(date_str: str) -> str:
    """Convert ISO date to MMYYYY (6 chars)."""
    if not date_str:
        return "0" * 6
    try:
        dt = datetime.fromisoformat(str(date_str).replace("Z", "").split("T")[0])
        return dt.strftime("%m%Y")
    except Exception:
        return "0" * 6


def _clean_ssn(ssn: str) -> str:
    """Clean SSN to 9 digits only."""
    if not ssn:
        return "0" * 9
    digits = "".join(c for c in str(ssn) if c.isdigit())
    if len(digits) == 9:
        return digits
    return "0" * 9


def _clean_phone(phone: str) -> str:
    """Clean phone to 10 digits."""
    if not phone:
        return "0" * 10
    digits = "".join(c for c in str(phone) if c.isdigit())
    if len(digits) >= 10:
        return digits[-10:]
    return digits.ljust(10, "0")


def _parse_name(full_name: str) -> dict:
    """Parse full name into surname, first name, middle."""
    parts = str(full_name or "").strip().split()
    if len(parts) == 0:
        return {"surname": "", "first": "", "middle": "", "suffix": ""}
    elif len(parts) == 1:
        return {"surname": parts[0], "first": "", "middle": "", "suffix": ""}
    elif len(parts) == 2:
        return {"surname": parts[1], "first": parts[0], "middle": "", "suffix": ""}
    else:
        return {"surname": parts[-1], "first": parts[0], "middle": parts[1], "suffix": ""}


def get_metro2_status(loan: dict, days_overdue: int) -> dict:
    """Determine Metro 2 codes based on loan status and days overdue."""
    status = loan.get("status", "active")

    if status == "paid_off":
        return {
            "account_status": "13",
            "payment_rating": "0",
            "label": "Pagado",
            "special_comment": "",
        }
    elif status in ("active", "disbursed", "current"):
        return {
            "account_status": "11",
            "payment_rating": "0",
            "label": "Al Corriente",
            "special_comment": "",
        }
    elif status == "delinquent":
        if days_overdue <= 30:
            return {"account_status": "71", "payment_rating": "1", "label": "30 Días Mora", "special_comment": ""}
        elif days_overdue <= 60:
            return {"account_status": "78", "payment_rating": "2", "label": "60 Días Mora", "special_comment": ""}
        elif days_overdue <= 90:
            return {"account_status": "80", "payment_rating": "3", "label": "90 Días Mora", "special_comment": ""}
        elif days_overdue <= 120:
            return {"account_status": "82", "payment_rating": "4", "label": "120 Días Mora", "special_comment": ""}
        elif days_overdue <= 150:
            return {"account_status": "83", "payment_rating": "5", "label": "150 Días Mora", "special_comment": ""}
        else:
            return {"account_status": "84", "payment_rating": "6", "label": "180+ Días Mora", "special_comment": ""}
    elif status == "cancelled":
        return {"account_status": "DA", "payment_rating": "0", "label": "Cancelado", "special_comment": ""}

    return {"account_status": "11", "payment_rating": "0", "label": "Activo", "special_comment": ""}


def build_payment_history_profile(loan: dict, days_overdue: int) -> str:
    """
    Build 24-month payment history profile.
    Each position = one month, newest first.
    0=Current, 1=30 late, 2=60 late, 3=90 late, 4=120 late, 5=150 late, 6=180+
    B=No payment history, D=No data
    """
    status = loan.get("status", "active")

    if status == "paid_off":
        return "0" * 24

    if status in ("active", "disbursed", "current"):
        return "0" * 24

    if status == "delinquent":
        if days_overdue <= 30:
            profile = "1" + "0" * 23
        elif days_overdue <= 60:
            profile = "21" + "0" * 22
        elif days_overdue <= 90:
            profile = "321" + "0" * 21
        elif days_overdue <= 120:
            profile = "4321" + "0" * 20
        elif days_overdue <= 150:
            profile = "54321" + "0" * 19
        else:
            profile = "654321" + "0" * 18
        return profile[:24]

    return "0" * 24


# ═══════════════════════════════════════════════════════════════════════════════
# HEADER RECORD (426 chars)
# ═══════════════════════════════════════════════════════════════════════════════

def generate_header_record(
    furnisher_id: str = "",
    program_id: str = "",
    report_date: Optional[datetime] = None,
) -> str:
    """
    Generate Metro 2 Header Record (426 characters).
    Positions per CDIA Metro 2 Format specification.
    """
    now = report_date or datetime.utcnow()
    record = ""

    # Pos 1-4: Record Descriptor Word (length of record)
    record += "0426"
    # Pos 5-10: Processing Indicator + reserved
    record += "HEADER"
    # Pos 11-14: Activity Date (MMYY)
    record += now.strftime("%m%y")
    # Pos 15-28: Date Created (MMDDYYYYHHMM00)
    record += now.strftime("%m%d%Y%H%M") + "00"
    # Pos 29-36: Program Date (MMDDYYYY)
    record += now.strftime("%m%d%Y")
    # Pos 37-46: Program Revision Date
    record += now.strftime("%m%d%Y") + "  "
    # Pos 47-86: Reporter Name
    record += _ljust(FURNISHER_NAME, 40)
    # Pos 87-126: Reporter Address
    record += _ljust(FURNISHER_ADDRESS, 40)
    # Pos 127-152: Reporter City
    record += _ljust(FURNISHER_CITY, 26)
    # Pos 153-154: Reporter State
    record += _ljust(FURNISHER_STATE, 2)
    # Pos 155-163: Reporter Zip Code (5+4)
    record += _ljust(FURNISHER_ZIP, 9)
    # Pos 164-173: Reporter Phone
    record += _ljust(FURNISHER_PHONE, 10)
    # Pos 174-193: Software Vendor Name
    record += _ljust("ROSS LENDING SOLUTIONS", 20)
    # Pos 194-198: Software Version
    record += _ljust("01.00", 5)
    # Pos 199-200: MIC Code (Packing Format)
    record += "  "
    # Pos 201-210: Furnisher ID (assigned by bureau)
    record += _ljust(furnisher_id, 10)

    # Pad to 426
    record += " " * (RECORD_LENGTH - len(record))
    return record[:RECORD_LENGTH]


# ═══════════════════════════════════════════════════════════════════════════════
# BASE SEGMENT (426 chars)
# ═══════════════════════════════════════════════════════════════════════════════

def generate_base_segment(
    loan: dict,
    client_data: dict,
    days_overdue: int = 0,
    report_date: Optional[datetime] = None,
) -> str:
    """
    Generate Metro 2 Base Segment (426 characters) for one loan account.
    client_data should contain: ssn, dob, address, city, state, zip, phone
    """
    now = report_date or datetime.utcnow()
    metro2 = get_metro2_status(loan, days_overdue)
    name = _parse_name(loan.get("client_name", ""))
    loan_type = loan.get("loan_type", "personal")

    record = ""

    # Pos 1-4: Record Descriptor Word
    record += "0426"
    # Pos 5: Processing Indicator (1=single segment)
    record += "1"
    # Pos 6-19: Timestamp (MMDDYYYYHHMMSS)
    record += now.strftime("%m%d%Y%H%M%S")
    # Pos 20: Correction Indicator (blank=normal)
    record += " "
    # Pos 21-40: Identification Number (Furnisher's account #)
    record += _ljust(loan.get("loan_number", ""), 20)
    # Pos 41-42: Cycle Identifier (AA=not applicable)
    record += "AA"
    # Pos 43-72: Consumer Account Number
    record += _ljust(loan.get("loan_number", ""), 30)
    # Pos 73: Portfolio Type
    record += PORTFOLIO_TYPE.get(loan_type, "I")
    # Pos 74-75: Account Type
    record += ACCOUNT_TYPE.get(loan_type, "48")
    # Pos 76-83: Date Opened (MMDDYYYY)
    record += _date_mmddyyyy(loan.get("disbursement_date") or loan.get("created_at", ""))
    # Pos 84-92: Credit Limit/Original Amount (9 digits, cents)
    record += _amount(loan.get("amount", 0))
    # Pos 93-101: Highest Credit
    record += _amount(loan.get("total_to_pay", 0))
    # Pos 102-104: Terms Duration (months, 3 digits)
    record += _rjust_zero(loan.get("term_months", 0), 3)
    # Pos 105: Terms Frequency
    record += TERMS_FREQUENCY
    # Pos 106-114: Scheduled Monthly Payment Amount (cents)
    record += _amount(loan.get("monthly_payment", 0))
    # Pos 115-123: Actual Payment Amount (cents)
    last_payment = loan.get("last_payment_amount", loan.get("monthly_payment", 0))
    record += _amount(last_payment)
    # Pos 124-125: Account Status
    record += metro2["account_status"]
    # Pos 126: Payment Rating
    record += metro2["payment_rating"]
    # Pos 127-150: Payment History Profile (24 months)
    record += build_payment_history_profile(loan, days_overdue)
    # Pos 151-152: Special Comment Code
    record += _ljust(metro2["special_comment"], 2)
    # Pos 153-154: Compliance Condition Code (blank=in compliance)
    record += "  "
    # Pos 155-163: Current Balance (cents)
    record += _amount(loan.get("balance", 0))
    # Pos 164-172: Amount Past Due (cents)
    past_due = loan.get("balance", 0) if days_overdue > 0 else 0
    if days_overdue > 0:
        past_due = min(loan.get("monthly_payment", 0) * max(1, days_overdue // 30), loan.get("balance", 0))
    record += _amount(past_due)
    # Pos 173-181: Original Charge-off Amount
    record += "0" * 9
    # Pos 182-189: Date of Account Information (MMDDYYYY)
    record += now.strftime("%m%d%Y")
    # Pos 190-197: FCRA Compliance/Date of First Delinquency (MMDDYYYY)
    if days_overdue > 0 and loan.get("first_delinquency_date"):
        record += _date_mmddyyyy(loan["first_delinquency_date"])
    else:
        record += "0" * 8
    # Pos 198-205: Date Closed (MMDDYYYY)
    if loan.get("status") in ("paid_off", "cancelled"):
        record += _date_mmddyyyy(loan.get("closed_date", now.isoformat()))
    else:
        record += "0" * 8
    # Pos 206-213: Date of Last Payment (MMDDYYYY)
    record += _date_mmddyyyy(loan.get("last_payment_date", ""))
    # Pos 214: Interest Type Indicator
    record += INTEREST_TYPE
    # Pos 215-239: Consumer Surname (25 chars)
    record += _ljust(name["surname"], 25)
    # Pos 240-259: Consumer First Name (20 chars)
    record += _ljust(name["first"], 20)
    # Pos 260-279: Consumer Middle Name (20 chars)
    record += _ljust(name["middle"], 20)
    # Pos 280: Generation Code (blank)
    record += " "
    # Pos 281-289: Social Security Number (9 digits)
    ssn = client_data.get("ssn", "")
    record += _clean_ssn(ssn)
    # Pos 290-297: Date of Birth (MMDDYYYY)
    record += _date_mmddyyyy(client_data.get("dob", ""))
    # Pos 298-307: Telephone Number (10 digits)
    record += _clean_phone(loan.get("client_phone", "") or client_data.get("phone", ""))
    # Pos 308: ECOA Code (1=Individual)
    record += "1"
    # Pos 309: Consumer Information Indicator (blank)
    record += " "
    # Pos 310: Country Code (blank = US)
    record += " "
    # Pos 311-342: First Line of Address (32 chars)
    addr = client_data.get("address", "") or loan.get("client_address", "")
    record += _ljust(addr, 32)
    # Pos 343-374: Second Line of Address (32 chars)
    record += _ljust("", 32)
    # Pos 375-394: City (20 chars)
    record += _ljust(client_data.get("city", "") or loan.get("client_city", ""), 20)
    # Pos 395-396: State (2 chars)
    record += _ljust(client_data.get("state", "") or loan.get("client_state", "TX"), 2)
    # Pos 397-405: Zip Code (9 chars, 5+4)
    record += _ljust(client_data.get("zip", "") or loan.get("client_zip", ""), 9)
    # Pos 406: Address Indicator (C=Confirmed)
    record += "C"
    # Pos 407: Residence Code (blank)
    record += " "

    # Pad to 426
    record += " " * (RECORD_LENGTH - len(record))
    return record[:RECORD_LENGTH]


# ═══════════════════════════════════════════════════════════════════════════════
# TRAILER RECORD (426 chars)
# ═══════════════════════════════════════════════════════════════════════════════

def generate_trailer_record(
    total_base_segments: int,
    total_j1_segments: int = 0,
    total_j2_segments: int = 0,
    block_count: int = 0,
    status_counts: Optional[dict] = None,
    report_date: Optional[datetime] = None,
) -> str:
    """Generate Metro 2 Trailer Record (426 characters)."""
    now = report_date or datetime.utcnow()
    sc = status_counts or {}

    record = ""

    # Pos 1-4: Record Descriptor Word
    record += "0426"
    # Pos 5-11: Record Identifier
    record += "TRAILER"
    # Pos 12-20: Total Base Segment Count (9 digits)
    record += str(total_base_segments).zfill(9)
    # Pos 21-29: Total J1 Segment Count
    record += str(total_j1_segments).zfill(9)
    # Pos 30-38: Total J2 Segment Count
    record += str(total_j2_segments).zfill(9)
    # Pos 39-47: Block Count
    record += str(block_count).zfill(9)
    # Pos 48-56: Status DF (current, code 11)
    record += str(sc.get("current", 0)).zfill(9)
    # Pos 57-65: Status 71 (30 days)
    record += str(sc.get("late_30", 0)).zfill(9)
    # Pos 66-74: Status 78 (60 days)
    record += str(sc.get("late_60", 0)).zfill(9)
    # Pos 75-83: Status 80 (90 days)
    record += str(sc.get("late_90", 0)).zfill(9)
    # Pos 84-92: Status 82 (120 days)
    record += str(sc.get("late_120", 0)).zfill(9)
    # Pos 93-101: Status 83-84 (150-180+ days)
    record += str(sc.get("late_150_plus", 0)).zfill(9)
    # Pos 102-110: Status 13 (Paid/Closed)
    record += str(sc.get("paid_off", 0)).zfill(9)
    # Pos 111-119: Status 97 (Charged off)
    record += str(sc.get("charged_off", 0)).zfill(9)
    # Pos 120-128: Status DA (Deleted)
    record += str(sc.get("cancelled", 0)).zfill(9)
    # Pos 129-137: Status 93 (Collections)
    record += str(sc.get("collections", 0)).zfill(9)

    # Pad to 426
    record += " " * (RECORD_LENGTH - len(record))
    return record[:RECORD_LENGTH]


# ═══════════════════════════════════════════════════════════════════════════════
# FULL METRO 2 FILE GENERATOR
# ═══════════════════════════════════════════════════════════════════════════════

def generate_metro2_file(
    loans: list,
    client_data_map: dict,
    furnisher_id: str = "",
    program_id: str = "",
    report_date: Optional[datetime] = None,
) -> dict:
    """
    Generate a complete Metro 2 format file.

    Args:
        loans: List of loan dicts with status, amounts, etc.
        client_data_map: Dict mapping loan_id -> {ssn, dob, address, city, state, zip, phone}
        furnisher_id: Bureau-assigned furnisher ID
        program_id: Bureau-assigned program ID
        report_date: Date for the report (defaults to now)

    Returns:
        dict with 'content' (file string), 'stats', 'records_count', 'warnings'
    """
    now = report_date or datetime.utcnow()
    lines = []
    warnings = []
    status_counts = {
        "current": 0, "late_30": 0, "late_60": 0, "late_90": 0,
        "late_120": 0, "late_150_plus": 0, "paid_off": 0,
        "charged_off": 0, "cancelled": 0, "collections": 0,
    }

    # Header
    lines.append(generate_header_record(furnisher_id, program_id, now))

    # Base Segments
    valid_count = 0
    for loan in loans:
        loan_id = str(loan.get("_id", ""))
        client = client_data_map.get(loan_id, {})

        # Calculate days overdue
        days_overdue = loan.get("days_overdue", 0)
        if not days_overdue and loan.get("status") == "delinquent":
            npd = loan.get("next_payment_date", "")
            if npd:
                try:
                    days_overdue = max(0, (now - datetime.fromisoformat(str(npd).replace("Z", ""))).days)
                except Exception:
                    pass

        # Validate required fields
        ssn = client.get("ssn", "")
        ssn_digits = "".join(c for c in str(ssn) if c.isdigit())
        has_ssn = len(ssn_digits) == 9

        if not has_ssn:
            warnings.append({
                "loan_id": loan_id,
                "loan_number": loan.get("loan_number", ""),
                "client_name": loan.get("client_name", ""),
                "issue": "SSN faltante o inválido",
                "severity": "critical",
            })

        if not client.get("address"):
            warnings.append({
                "loan_id": loan_id,
                "loan_number": loan.get("loan_number", ""),
                "client_name": loan.get("client_name", ""),
                "issue": "Dirección faltante",
                "severity": "warning",
            })

        # Generate segment
        segment = generate_base_segment(loan, client, days_overdue, now)
        lines.append(segment)
        valid_count += 1

        # Count statuses
        metro2 = get_metro2_status(loan, days_overdue)
        code = metro2["account_status"]
        if code == "11":
            status_counts["current"] += 1
        elif code == "71":
            status_counts["late_30"] += 1
        elif code == "78":
            status_counts["late_60"] += 1
        elif code == "80":
            status_counts["late_90"] += 1
        elif code == "82":
            status_counts["late_120"] += 1
        elif code in ("83", "84"):
            status_counts["late_150_plus"] += 1
        elif code == "13":
            status_counts["paid_off"] += 1
        elif code == "97":
            status_counts["charged_off"] += 1
        elif code == "DA":
            status_counts["cancelled"] += 1
        elif code == "93":
            status_counts["collections"] += 1

    # Trailer
    lines.append(generate_trailer_record(
        total_base_segments=valid_count,
        status_counts=status_counts,
        report_date=now,
    ))

    # Join with newlines
    content = "\n".join(lines)

    # Stats
    critical_warnings = [w for w in warnings if w["severity"] == "critical"]
    ready_count = valid_count - len(set(w["loan_id"] for w in critical_warnings))

    return {
        "content": content,
        "records_count": valid_count,
        "ready_count": ready_count,
        "status_counts": status_counts,
        "warnings": warnings,
        "critical_count": len(critical_warnings),
        "warning_count": len(warnings) - len(critical_warnings),
        "report_date": now.isoformat(),
        "furnisher_name": FURNISHER_NAME,
        "format": "Metro 2 Fixed-Width (426 chars/record)",
    }
