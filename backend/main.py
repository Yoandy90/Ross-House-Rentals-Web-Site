"""
Smart entry point for Railway deployments.
Checks LENDING_MODE env var to decide which app to load.
Nixpacks auto-detects main.py as the primary entry point.
"""
import os

LENDING_MODE = os.getenv("LENDING_MODE", "false").lower() == "true"

if LENDING_MODE:
    print("🏦 Starting Ross Lending Solutions (Independent Server)...")
    from lending_server import app
else:
    print("📋 Starting Ross Tax Server...")
    from server import app

# This 'app' is what uvicorn will use: uvicorn main:app
