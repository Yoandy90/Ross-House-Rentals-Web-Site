"""Season Import Endpoints - Import historical tax season data"""
from fastapi import APIRouter, HTTPException, UploadFile, File, Body
from typing import Dict, Any, List, Optional
from datetime import datetime
import logging
import json
import pandas as pd
import io

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/imported-seasons", tags=["Season Import"])

# Will be initialized with db
db = None

def init_season_endpoints(database):
    """Initialize season endpoints with database"""
    global db
    db = database
    return router

@router.get("/list")
async def list_seasons():
    """List all imported seasons"""
    try:
        seasons = await db.imported_tax_seasons.find().sort("tax_year", -1).to_list(100)
        for s in seasons:
            s["_id"] = str(s["_id"])
        return {"seasons": seasons}
    except Exception as e:
        logger.error(f"Error listing seasons: {e}")
        return {"seasons": []}

@router.get("/{tax_year}")
async def get_season(tax_year: int):
    """Get season data for a specific tax year"""
    try:
        season = await db.imported_tax_seasons.find_one({"tax_year": tax_year})
        if not season:
            return {"error": "Season not found", "tax_year": tax_year}
        
        season["_id"] = str(season["_id"])
        
        # Get clients for this season
        clients = await db.season_clients.find({"tax_year": tax_year}).to_list(2000)
        for c in clients:
            c["_id"] = str(c["_id"])
        
        season["clients"] = clients
        season["total_clients"] = len(clients)
        season["efiled_count"] = len([c for c in clients if c.get("efiled") == "YES"])
        
        return season
    except Exception as e:
        logger.error(f"Error getting season {tax_year}: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/import")
async def import_season_data(
    tax_year: int = Body(...),
    clients: List[Dict[str, Any]] = Body(...),
    season_name: Optional[str] = Body(None)
):
    """Import season data from JSON"""
    try:
        # Create or update season record
        season_data = {
            "tax_year": tax_year,
            "name": season_name or f"Temporada Fiscal {tax_year}",
            "total_clients": len(clients),
            "efiled_count": len([c for c in clients if c.get("efiled") == "YES"]),
            "pending_count": len([c for c in clients if c.get("efiled") != "YES"]),
            "imported_at": datetime.utcnow(),
            "updated_at": datetime.utcnow()
        }
        
        # Calculate monthly distribution
        monthly_data = {}
        for client in clients:
            if client.get("efiled_date"):
                try:
                    date = pd.to_datetime(client["efiled_date"])
                    month_key = date.strftime("%Y-%m")
                    if month_key not in monthly_data:
                        monthly_data[month_key] = 0
                    monthly_data[month_key] += 1
                except:
                    pass
        
        season_data["monthly_distribution"] = monthly_data
        
        # Upsert season
        await db.imported_tax_seasons.update_one(
            {"tax_year": tax_year},
            {"$set": season_data},
            upsert=True
        )
        
        # Delete existing clients for this season
        await db.season_clients.delete_many({"tax_year": tax_year})
        
        # Insert all clients
        if clients:
            for client in clients:
                client["tax_year"] = tax_year
                client["imported_at"] = datetime.utcnow()
            
            await db.season_clients.insert_many(clients)
        
        logger.info(f"✅ Imported {len(clients)} clients for tax year {tax_year}")
        
        return {
            "success": True,
            "message": f"Importados {len(clients)} clientes para temporada {tax_year}",
            "season": season_data
        }
        
    except Exception as e:
        logger.error(f"Error importing season data: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/upload")
async def upload_season_file(
    file: UploadFile = File(...),
    tax_year: int = 2024
):
    """Upload and parse season file (XLS/CSV)"""
    try:
        content = await file.read()
        
        # Try to read as TSV (common from web exports)
        try:
            df = pd.read_csv(io.BytesIO(content), sep='\t', skiprows=5, encoding='utf-8', on_bad_lines='skip')
        except:
            # Try as regular CSV
            df = pd.read_csv(io.BytesIO(content), encoding='utf-8')
        
        # Clean column names
        df.columns = [c.strip() for c in df.columns]
        
        # Remove empty rows
        df = df.dropna(how='all')
        
        # Find name column
        name_col = None
        for col in ['FIRST NAME', 'First Name', 'first_name', 'Name', 'NOMBRE']:
            if col in df.columns:
                name_col = col
                break
        
        if name_col:
            df = df[df[name_col].notna() & (df[name_col] != '')]
        
        # Convert to list of dicts
        clients = df.to_dict('records')
        
        return {
            "success": True,
            "total_rows": len(clients),
            "columns": df.columns.tolist(),
            "preview": clients[:10],
            "message": f"Archivo procesado: {len(clients)} registros encontrados"
        }
        
    except Exception as e:
        logger.error(f"Error uploading file: {e}")
        raise HTTPException(status_code=400, detail=f"Error procesando archivo: {str(e)}")

@router.get("/compare/{year1}/{year2}")
async def compare_seasons(year1: int, year2: int):
    """Compare two tax seasons"""
    try:
        season1 = await db.imported_tax_seasons.find_one({"tax_year": year1})
        season2 = await db.imported_tax_seasons.find_one({"tax_year": year2})
        
        clients1 = await db.season_clients.find({"tax_year": year1}).to_list(2000)
        clients2 = await db.season_clients.find({"tax_year": year2}).to_list(2000)
        
        # Get unique client identifiers (by name or email)
        def get_client_key(c):
            if c.get('email'):
                return c['email'].lower().strip()
            return f"{c.get('first_name', '')} {c.get('last_name', '')}".lower().strip()
        
        clients1_keys = set(get_client_key(c) for c in clients1)
        clients2_keys = set(get_client_key(c) for c in clients2)
        
        # Calculate metrics
        returning_clients = clients1_keys & clients2_keys
        new_clients_year2 = clients2_keys - clients1_keys
        lost_clients = clients1_keys - clients2_keys
        
        comparison = {
            "year1": {
                "tax_year": year1,
                "total_clients": len(clients1),
                "efiled": len([c for c in clients1 if c.get('efiled') == 'YES']),
                "monthly": season1.get('monthly_distribution', {}) if season1 else {}
            },
            "year2": {
                "tax_year": year2,
                "total_clients": len(clients2),
                "efiled": len([c for c in clients2 if c.get('efiled') == 'YES']),
                "monthly": season2.get('monthly_distribution', {}) if season2 else {}
            },
            "comparison": {
                "returning_clients": len(returning_clients),
                "new_clients": len(new_clients_year2),
                "lost_clients": len(lost_clients),
                "retention_rate": round(len(returning_clients) / len(clients1_keys) * 100, 1) if clients1_keys else 0,
                "growth_rate": round((len(clients2) - len(clients1)) / len(clients1) * 100, 1) if clients1 else 0
            }
        }
        
        return comparison
        
    except Exception as e:
        logger.error(f"Error comparing seasons: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/stats/{tax_year}")
async def get_season_stats(tax_year: int):
    """Get detailed statistics for a season"""
    try:
        clients = await db.season_clients.find({"tax_year": tax_year}).to_list(2000)
        
        if not clients:
            return {"error": "No data for this season"}
        
        # City distribution
        cities = {}
        for c in clients:
            city = c.get('city', 'Unknown')
            cities[city] = cities.get(city, 0) + 1
        
        # Sort by count
        cities_sorted = sorted(cities.items(), key=lambda x: x[1], reverse=True)
        
        # E-Filed by month
        monthly = {}
        for c in clients:
            if c.get('efiled_date'):
                try:
                    date = pd.to_datetime(c['efiled_date'])
                    month = date.strftime('%B %Y')
                    monthly[month] = monthly.get(month, 0) + 1
                except:
                    pass
        
        # State distribution
        states = {}
        for c in clients:
            state = c.get('state', 'Unknown')
            states[state] = states.get(state, 0) + 1
        
        return {
            "tax_year": tax_year,
            "total_clients": len(clients),
            "efiled_count": len([c for c in clients if c.get('efiled') == 'YES']),
            "pending_count": len([c for c in clients if c.get('efiled') != 'YES']),
            "cities": dict(cities_sorted[:15]),
            "states": states,
            "monthly_efiled": monthly,
            "efiled_rate": round(len([c for c in clients if c.get('efiled') == 'YES']) / len(clients) * 100, 1)
        }
        
    except Exception as e:
        logger.error(f"Error getting season stats: {e}")
        raise HTTPException(status_code=500, detail=str(e))
