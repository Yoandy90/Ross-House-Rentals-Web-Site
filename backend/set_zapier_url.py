#!/usr/bin/env python3
"""
Script para agregar/actualizar ZAPIER_WEBHOOK_URL en .env
Uso: python set_zapier_url.py "https://hooks.zapier.com/hooks/catch/..."
"""
import sys
import os

def update_env_variable(key, value):
    """Update or add environment variable to .env file"""
    env_path = '/app/backend/.env'
    
    # Read current .env
    with open(env_path, 'r') as f:
        lines = f.readlines()
    
    # Check if key exists
    key_exists = False
    new_lines = []
    for line in lines:
        if line.startswith(f'{key}='):
            new_lines.append(f'{key}="{value}"\n')
            key_exists = True
        else:
            new_lines.append(line)
    
    # If key doesn't exist, add it
    if not key_exists:
        new_lines.append(f'\n{key}="{value}"\n')
    
    # Write back to .env
    with open(env_path, 'w') as f:
        f.writelines(new_lines)
    
    print(f"✅ {key} updated in .env")
    print(f"   Value: {value}")
    print("\n🔄 Now restart backend:")
    print("   sudo supervisorctl restart backend")

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("❌ Error: Please provide the Zapier webhook URL")
        print("\nUsage:")
        print('  python set_zapier_url.py "https://hooks.zapier.com/hooks/catch/..."')
        sys.exit(1)
    
    webhook_url = sys.argv[1]
    
    if not webhook_url.startswith('https://hooks.zapier.com'):
        print("⚠️  Warning: URL doesn't look like a Zapier webhook URL")
        print("   Expected: https://hooks.zapier.com/hooks/catch/...")
        print(f"   Got: {webhook_url}")
        response = input("\nContinue anyway? (y/n): ")
        if response.lower() != 'y':
            print("Cancelled.")
            sys.exit(0)
    
    update_env_variable('ZAPIER_WEBHOOK_URL', webhook_url)
