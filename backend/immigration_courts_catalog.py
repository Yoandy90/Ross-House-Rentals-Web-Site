"""
Immigration Courts Catalog
List of all U.S. Immigration Courts with addresses
"""

# List of U.S. Immigration Courts with complete addresses
# Source: Executive Office for Immigration Review (EOIR)

IMMIGRATION_COURTS = [
    # TEXAS
    {
        "id": "dallas-tx",
        "name": "Dallas Immigration Court",
        "city": "Dallas",
        "state": "TX",
        "address": "1100 Commerce Street, Room 1060",
        "zip": "75242",
        "phone": "(214) 767-1814",
        "region": "Southwest"
    },
    {
        "id": "houston-tx",
        "name": "Houston Immigration Court",
        "city": "Houston",
        "state": "TX",
        "address": "126 Northpoint Drive",
        "zip": "77060",
        "phone": "(281) 931-0801",
        "region": "Southwest"
    },
    {
        "id": "houston-detained-tx",
        "name": "Houston Immigration Court (Detained)",
        "city": "Houston",
        "state": "TX",
        "address": "419 Emancipation Avenue",
        "zip": "77002",
        "phone": "(713) 718-3014",
        "region": "Southwest"
    },
    {
        "id": "san-antonio-tx",
        "name": "San Antonio Immigration Court",
        "city": "San Antonio",
        "state": "TX",
        "address": "800 Dolorosa Street, Suite 300",
        "zip": "78207",
        "phone": "(210) 472-6637",
        "region": "Southwest"
    },
    {
        "id": "harlingen-tx",
        "name": "Harlingen Immigration Court",
        "city": "Harlingen",
        "state": "TX",
        "address": "2009 W. Jefferson Avenue",
        "zip": "78550",
        "phone": "(956) 427-8580",
        "region": "Southwest"
    },
    {
        "id": "el-paso-tx",
        "name": "El Paso Immigration Court",
        "city": "El Paso",
        "state": "TX",
        "address": "700 E. San Antonio Street, Suite 550",
        "zip": "79901",
        "phone": "(915) 534-6100",
        "region": "Southwest"
    },
    {
        "id": "pearsall-tx",
        "name": "Pearsall Immigration Court",
        "city": "Pearsall",
        "state": "TX",
        "address": "566 Veterans Drive",
        "zip": "78061",
        "phone": "(830) 334-8780",
        "region": "Southwest"
    },
    {
        "id": "port-isabel-tx",
        "name": "Port Isabel Immigration Court",
        "city": "Los Fresnos",
        "state": "TX",
        "address": "27991 Buena Vista Boulevard",
        "zip": "78566",
        "phone": "(956) 547-1703",
        "region": "Southwest"
    },
    {
        "id": "conroe-tx",
        "name": "Conroe Immigration Court",
        "city": "Conroe",
        "state": "TX",
        "address": "806 Old Montgomery Road",
        "zip": "77301",
        "phone": "(936) 538-8100",
        "region": "Southwest"
    },
    
    # CALIFORNIA
    {
        "id": "los-angeles-ca",
        "name": "Los Angeles Immigration Court",
        "city": "Los Angeles",
        "state": "CA",
        "address": "606 S. Olive Street, 15th Floor",
        "zip": "90014",
        "phone": "(213) 894-2811",
        "region": "West"
    },
    {
        "id": "san-francisco-ca",
        "name": "San Francisco Immigration Court",
        "city": "San Francisco",
        "state": "CA",
        "address": "100 Montgomery Street, Suite 800",
        "zip": "94104",
        "phone": "(415) 705-4415",
        "region": "West"
    },
    {
        "id": "san-diego-ca",
        "name": "San Diego Immigration Court",
        "city": "San Diego",
        "state": "CA",
        "address": "401 W. A Street, Suite 800",
        "zip": "92101",
        "phone": "(619) 557-6049",
        "region": "West"
    },
    {
        "id": "imperial-ca",
        "name": "Imperial Immigration Court",
        "city": "Imperial",
        "state": "CA",
        "address": "1115 N. Imperial Avenue",
        "zip": "92251",
        "phone": "(760) 335-3520",
        "region": "West"
    },
    {
        "id": "adelanto-ca",
        "name": "Adelanto Immigration Court",
        "city": "Adelanto",
        "state": "CA",
        "address": "10250 Rancho Road",
        "zip": "92301",
        "phone": "(760) 530-2051",
        "region": "West"
    },
    {
        "id": "san-jose-ca",
        "name": "San Jose Immigration Court",
        "city": "San Jose",
        "state": "CA",
        "address": "280 S. 1st Street, Room 2020",
        "zip": "95113",
        "phone": "(408) 535-5120",
        "region": "West"
    },
    
    # FLORIDA
    {
        "id": "miami-fl",
        "name": "Miami Immigration Court",
        "city": "Miami",
        "state": "FL",
        "address": "333 S. Miami Avenue, Suite 300",
        "zip": "33130",
        "phone": "(305) 530-7657",
        "region": "Southeast"
    },
    {
        "id": "orlando-fl",
        "name": "Orlando Immigration Court",
        "city": "Orlando",
        "state": "FL",
        "address": "3535 Lawton Road, Suite 100",
        "zip": "32803",
        "phone": "(407) 599-4831",
        "region": "Southeast"
    },
    {
        "id": "krome-fl",
        "name": "Krome Immigration Court",
        "city": "Miami",
        "state": "FL",
        "address": "18201 SW 12th Street",
        "zip": "33194",
        "phone": "(305) 207-2080",
        "region": "Southeast"
    },
    
    # NEW YORK
    {
        "id": "new-york-ny",
        "name": "New York Immigration Court",
        "city": "New York",
        "state": "NY",
        "address": "26 Federal Plaza, Room 1237",
        "zip": "10278",
        "phone": "(212) 264-0623",
        "region": "Northeast"
    },
    {
        "id": "buffalo-ny",
        "name": "Buffalo Immigration Court",
        "city": "Buffalo",
        "state": "NY",
        "address": "300 Pearl Street, Suite 100",
        "zip": "14202",
        "phone": "(716) 551-4090",
        "region": "Northeast"
    },
    {
        "id": "batavia-ny",
        "name": "Batavia Immigration Court",
        "city": "Batavia",
        "state": "NY",
        "address": "4250 Federal Drive",
        "zip": "14020",
        "phone": "(585) 344-6950",
        "region": "Northeast"
    },
    
    # NEW JERSEY
    {
        "id": "newark-nj",
        "name": "Newark Immigration Court",
        "city": "Newark",
        "state": "NJ",
        "address": "970 Broad Street, Room 1100",
        "zip": "07102",
        "phone": "(973) 645-2298",
        "region": "Northeast"
    },
    {
        "id": "elizabeth-nj",
        "name": "Elizabeth Immigration Court",
        "city": "Elizabeth",
        "state": "NJ",
        "address": "625 Evans Street",
        "zip": "07206",
        "phone": "(908) 787-1150",
        "region": "Northeast"
    },
    
    # ARIZONA
    {
        "id": "phoenix-az",
        "name": "Phoenix Immigration Court",
        "city": "Phoenix",
        "state": "AZ",
        "address": "2035 N. Central Avenue",
        "zip": "85004",
        "phone": "(602) 640-2385",
        "region": "Southwest"
    },
    {
        "id": "tucson-az",
        "name": "Tucson Immigration Court",
        "city": "Tucson",
        "state": "AZ",
        "address": "405 W. Congress Street, Suite 1500",
        "zip": "85701",
        "phone": "(520) 620-7930",
        "region": "Southwest"
    },
    {
        "id": "eloy-az",
        "name": "Eloy Immigration Court",
        "city": "Eloy",
        "state": "AZ",
        "address": "1705 E. Hanna Road",
        "zip": "85131",
        "phone": "(520) 464-8300",
        "region": "Southwest"
    },
    {
        "id": "florence-az",
        "name": "Florence Immigration Court",
        "city": "Florence",
        "state": "AZ",
        "address": "3250 N. Main Street",
        "zip": "85132",
        "phone": "(520) 866-8100",
        "region": "Southwest"
    },
    
    # GEORGIA
    {
        "id": "atlanta-ga",
        "name": "Atlanta Immigration Court",
        "city": "Atlanta",
        "state": "GA",
        "address": "180 Ted Turner Drive SW, Suite 332",
        "zip": "30303",
        "phone": "(404) 331-5033",
        "region": "Southeast"
    },
    {
        "id": "stewart-ga",
        "name": "Stewart Immigration Court",
        "city": "Lumpkin",
        "state": "GA",
        "address": "146 CCA Road",
        "zip": "31815",
        "phone": "(229) 838-5080",
        "region": "Southeast"
    },
    
    # ILLINOIS
    {
        "id": "chicago-il",
        "name": "Chicago Immigration Court",
        "city": "Chicago",
        "state": "IL",
        "address": "525 W. Van Buren Street, Suite 500",
        "zip": "60607",
        "phone": "(312) 697-5800",
        "region": "Midwest"
    },
    
    # COLORADO
    {
        "id": "denver-co",
        "name": "Denver Immigration Court",
        "city": "Denver",
        "state": "CO",
        "address": "1961 Stout Street, Suite 300",
        "zip": "80294",
        "phone": "(303) 844-5015",
        "region": "West"
    },
    {
        "id": "aurora-co",
        "name": "Aurora Immigration Court",
        "city": "Aurora",
        "state": "CO",
        "address": "3130 N. Oakland Street",
        "zip": "80010",
        "phone": "(303) 361-1711",
        "region": "West"
    },
    
    # LOUISIANA
    {
        "id": "new-orleans-la",
        "name": "New Orleans Immigration Court",
        "city": "New Orleans",
        "state": "LA",
        "address": "701 Loyola Avenue, Room T-8011",
        "zip": "70113",
        "phone": "(504) 589-2804",
        "region": "South"
    },
    {
        "id": "oakdale-la",
        "name": "Oakdale Immigration Court",
        "city": "Oakdale",
        "state": "LA",
        "address": "1099 South Oaks Road",
        "zip": "71463",
        "phone": "(318) 335-0863",
        "region": "South"
    },
    
    # PENNSYLVANIA
    {
        "id": "philadelphia-pa",
        "name": "Philadelphia Immigration Court",
        "city": "Philadelphia",
        "state": "PA",
        "address": "900 Market Street, Suite 408",
        "zip": "19107",
        "phone": "(215) 656-7000",
        "region": "Northeast"
    },
    {
        "id": "york-pa",
        "name": "York Immigration Court",
        "city": "York",
        "state": "PA",
        "address": "3400 Industrial Road",
        "zip": "17402",
        "phone": "(717) 718-5740",
        "region": "Northeast"
    },
    
    # MASSACHUSETTS
    {
        "id": "boston-ma",
        "name": "Boston Immigration Court",
        "city": "Boston",
        "state": "MA",
        "address": "JFK Federal Building, Room 320",
        "zip": "02203",
        "phone": "(617) onal565-3080",
        "region": "Northeast"
    },
    
    # MARYLAND
    {
        "id": "baltimore-md",
        "name": "Baltimore Immigration Court",
        "city": "Baltimore",
        "state": "MD",
        "address": "31 Hopkins Plaza, Room 1100",
        "zip": "21201",
        "phone": "(410) 962-7687",
        "region": "Northeast"
    },
    
    # VIRGINIA
    {
        "id": "arlington-va",
        "name": "Arlington Immigration Court",
        "city": "Arlington",
        "state": "VA",
        "address": "1901 S. Bell Street, Suite 200",
        "zip": "22202",
        "phone": "(703) 305-0864",
        "region": "Northeast"
    },
    
    # WASHINGTON
    {
        "id": "seattle-wa",
        "name": "Seattle Immigration Court",
        "city": "Seattle",
        "state": "WA",
        "address": "1000 Second Avenue, Suite 2500",
        "zip": "98104",
        "phone": "(206) 553-1988",
        "region": "West"
    },
    {
        "id": "tacoma-wa",
        "name": "Tacoma Immigration Court",
        "city": "Tacoma",
        "state": "WA",
        "address": "1623 E. J Street",
        "zip": "98421",
        "phone": "(253) 779-6010",
        "region": "West"
    },
    
    # MICHIGAN
    {
        "id": "detroit-mi",
        "name": "Detroit Immigration Court",
        "city": "Detroit",
        "state": "MI",
        "address": "333 Mt. Elliott Street",
        "zip": "48207",
        "phone": "(313) 226-2050",
        "region": "Midwest"
    },
    
    # MINNESOTA
    {
        "id": "bloomington-mn",
        "name": "Bloomington Immigration Court",
        "city": "Bloomington",
        "state": "MN",
        "address": "1 Federal Drive, Suite 800",
        "zip": "55111",
        "phone": "(612) 725-3738",
        "region": "Midwest"
    },
    
    # MISSOURI
    {
        "id": "kansas-city-mo",
        "name": "Kansas City Immigration Court",
        "city": "Kansas City",
        "state": "MO",
        "address": "400 State Avenue, Suite 300",
        "zip": "66101",
        "phone": "(913) 551-6740",
        "region": "Midwest"
    },
    
    # NORTH CAROLINA
    {
        "id": "charlotte-nc",
        "name": "Charlotte Immigration Court",
        "city": "Charlotte",
        "state": "NC",
        "address": "210 E. Woodlawn Road, Suite 100",
        "zip": "28217",
        "phone": "(704) 676-6300",
        "region": "Southeast"
    },
    
    # TENNESSEE
    {
        "id": "memphis-tn",
        "name": "Memphis Immigration Court",
        "city": "Memphis",
        "state": "TN",
        "address": "80 Monroe Avenue, Suite 300",
        "zip": "38103",
        "phone": "(901) 544-0041",
        "region": "South"
    },
    
    # OHIO
    {
        "id": "cleveland-oh",
        "name": "Cleveland Immigration Court",
        "city": "Cleveland",
        "state": "OH",
        "address": "1240 E. 9th Street, Room 2101",
        "zip": "44199",
        "phone": "(216) 522-2858",
        "region": "Midwest"
    },
    
    # NEBRASKA
    {
        "id": "omaha-ne",
        "name": "Omaha Immigration Court",
        "city": "Omaha",
        "state": "NE",
        "address": "111 S. 18th Plaza, Suite 1101",
        "zip": "68102",
        "phone": "(402) 341-4691",
        "region": "Midwest"
    },
    
    # HAWAII
    {
        "id": "honolulu-hi",
        "name": "Honolulu Immigration Court",
        "city": "Honolulu",
        "state": "HI",
        "address": "595 Ala Moana Boulevard",
        "zip": "96813",
        "phone": "(808) 532-3400",
        "region": "West"
    },
    
    # PUERTO RICO
    {
        "id": "san-juan-pr",
        "name": "San Juan Immigration Court",
        "city": "San Juan",
        "state": "PR",
        "address": "651 Federal Drive, Suite 200",
        "zip": "00936",
        "phone": "(787) 706-2380",
        "region": "Caribbean"
    },
    
    # NEW MEXICO
    {
        "id": "el-paso-nm",
        "name": "El Paso Immigration Court - New Mexico",
        "city": "El Paso",
        "state": "TX",
        "address": "700 E. San Antonio Street",
        "zip": "79901",
        "phone": "(915) 534-6100",
        "region": "Southwest",
        "note": "Serves New Mexico cases"
    },
    
    # OKLAHOMA
    {
        "id": "oklahoma-city-ok",
        "name": "Oklahoma City Immigration Court",
        "city": "Oklahoma City",
        "state": "OK",
        "address": "4149 Highline Boulevard, Suite 300",
        "zip": "73108",
        "phone": "(405) 231-5831",
        "region": "Southwest"
    },
]

# Helper functions
def get_all_courts():
    """Get all immigration courts"""
    return IMMIGRATION_COURTS

def get_courts_by_state(state: str):
    """Get courts filtered by state"""
    return [c for c in IMMIGRATION_COURTS if c["state"].upper() == state.upper()]

def get_courts_by_region(region: str):
    """Get courts filtered by region"""
    return [c for c in IMMIGRATION_COURTS if c["region"].lower() == region.lower()]

def get_court_by_id(court_id: str):
    """Get a specific court by ID"""
    for court in IMMIGRATION_COURTS:
        if court["id"] == court_id:
            return court
    return None

def format_court_address(court: dict) -> str:
    """Format court address for documents"""
    return f"{court['name']}\n{court['address']}\n{court['city']}, {court['state']} {court['zip']}"

def format_court_address_english(court: dict) -> str:
    """Format court address in English for official documents"""
    return f"{court['name']}\n{court['address']}\n{court['city']}, {court['state']} {court['zip']}\nUnited States of America"

# States with immigration courts
STATES_WITH_COURTS = sorted(list(set(c["state"] for c in IMMIGRATION_COURTS)))

# Regions
REGIONS = ["Southwest", "West", "Southeast", "Northeast", "Midwest", "South", "Caribbean"]
