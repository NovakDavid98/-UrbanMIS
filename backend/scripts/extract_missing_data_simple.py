#!/usr/bin/env python3
"""
Simple and efficient extraction of missing client data from CeHuPo

Extracts only the critical missing fields:
- Email
- Registration date  
- Date of arrival to Czech
- Notes for volunteers

For the 210 clients that are missing this data.
"""

import asyncio
import httpx
from bs4 import BeautifulSoup
import psycopg2
from datetime import datetime
import sys

BASE_URL = "https://customer.cehupo.cz"
LOGIN_URL = f"{BASE_URL}/user/authenticate"
CEHUPO_USERNAME = "DavidNovak"
CEHUPO_PASSWORD = "Supr414nd!"

DB_CONFIG = {
    'dbname': 'centralnimozek_cehupo',
    'user': 'postgres',
    'password': 'IDvEg1WH40wVn7aa8MT9haYsbtRhF1PC',
    'host': 'localhost',
    'port': '5432'
}

def parse_date(date_str):
    """Parse date from YYYY-MM-DD format"""
    if not date_str or len(date_str.strip()) == 0:
        return None
    try:
        # Already in correct format
        if '-' in date_str and len(date_str.split('-')[0]) == 4:
            return date_str
    except:
        pass
    return None

async def extract_client_data(client: httpx.AsyncClient, cehupo_id: int):
    """Extract data from CeHuPo client page"""
    try:
        url = f"{BASE_URL}/customer/viewcustomer/{cehupo_id}"
        response = await client.get(url, timeout=15.0)
        
        if response.status_code != 200:
            return {'error': f'HTTP {response.status_code}'}
        
        soup = BeautifulSoup(response.text, 'html.parser')
        data = {}
        
        # Extract input fields by exact name attributes (from test output)
        input_mapping = {
            'email': 'email',
            'is_create': 'project_registration_date',  # Registration date
            'date_of_visa': 'date_of_arrival_czech',    # Arrival date
            'note_volunteer': 'notes_for_volunteers',    # Notes for volunteers
            'city_cz': 'czech_city',                    # City in CZ
            'address_cz': 'czech_address'               # Address in CZ
        }
        
        for inp in soup.find_all('input'):
            name = inp.get('name', '')
            value = inp.get('value', '').strip()
            
            if name in input_mapping and value:
                db_field = input_mapping[name]
                # Parse dates
                if 'date' in name or 'create' in name:
                    value = parse_date(value)
                if value:  # Only add if not None
                    data[db_field] = value
        
        # Extract textareas
        for textarea in soup.find_all('textarea'):
            name = textarea.get('name', '')
            value = textarea.get_text(strip=True)
            
            if name in input_mapping and value:
                data[input_mapping[name]] = value
        
        return data
        
    except Exception as e:
        return {'error': str(e)}

def update_client(client_id: str, data: dict):
    """Update client in database"""
    if not data or 'error' in data:
        return False
    
    conn = psycopg2.connect(**DB_CONFIG)
    try:
        updates = []
        values = []
        
        # Map to actual DB columns
        field_map = {
            'email': 'email',
            'project_registration_date': 'project_registration_date',
            'date_of_arrival_czech': 'date_of_arrival_czech',
            'notes_for_volunteers': 'notes_for_volunteers',
            'czech_city': 'czech_city',
            'czech_address': 'home_address'  # Map to existing column
        }
        
        for data_key, db_col in field_map.items():
            if data_key in data:
                updates.append(f"{db_col} = %s")
                values.append(data[data_key])
        
        if not updates:
            return False
        
        values.append(client_id)
        query = f"UPDATE clients SET {', '.join(updates)}, updated_at = NOW() WHERE id = %s"
        
        with conn.cursor() as cur:
            cur.execute(query, values)
        conn.commit()
        return True
        
    except Exception as e:
        print(f"     ❌ DB error: {e}")
        return False
    finally:
        conn.close()

async def main():
    print("=" * 80)
    print("📥 EXTRACTING MISSING CLIENT DATA FROM CEHUPO")
    print("=" * 80)
    print()
    
    # Get clients needing updates (only those with cehupo_id but missing data)
    conn = psycopg2.connect(**DB_CONFIG)
    try:
        with conn.cursor() as cur:
            cur.execute("""
                SELECT id, first_name, last_name, cehupo_id
                FROM clients
                WHERE cehupo_id IS NOT NULL 
                  AND (
                      email IS NULL
                      OR date_of_arrival_czech IS NULL
                      OR project_registration_date IS NULL
                  )
                ORDER BY created_at DESC
                LIMIT 250
            """)
            clients = cur.fetchall()
    finally:
        conn.close()
    
    print(f"📊 Found {len(clients)} clients needing updates")
    print()
    
    if len(clients) == 0:
        print("✅ All clients are up to date!")
        return
    
    # Login
    print("🔐 Logging in to CeHuPo...")
    async with httpx.AsyncClient(timeout=30.0, follow_redirects=True) as http_client:
        await http_client.get(f"{BASE_URL}/user")
        login_response = await http_client.post(
            LOGIN_URL,
            data={'action': 'auth', 'username': CEHUPO_USERNAME, 'password': CEHUPO_PASSWORD},
            follow_redirects=True
        )
        
        if login_response.status_code != 200:
            print("❌ Login failed!")
            return
        
        print("✅ Logged in")
        print()
        print("=" * 80)
        print("🔄 PROCESSING CLIENTS")
        print("=" * 80)
        print()
        
        updated = 0
        errors = 0
        
        for i, (client_id, first_name, last_name, cehupo_id) in enumerate(clients, 1):
            name = f"{first_name} {last_name}"
            print(f"[{i}/{len(clients)}] {name} (ID: {cehupo_id})...")
            
            # Extract
            data = await extract_client_data(http_client, cehupo_id)
            
            if 'error' in data:
                print(f"     ❌ {data['error']}")
                errors += 1
                continue
            
            # Update
            if update_client(client_id, data):
                fields = [k for k in data.keys() if k != 'error']
                print(f"     ✅ Updated {len(fields)} field(s): {', '.join(fields)}")
                updated += 1
            else:
                print(f"     → No new data to update")
            
            # Rate limit
            await asyncio.sleep(0.8)
            
            # Progress marker every 25
            if i % 25 == 0:
                print(f"\n... {i}/{len(clients)} processed ({updated} updated, {errors} errors) ...\n")
    
    print()
    print("=" * 80)
    print("🎉 EXTRACTION COMPLETE!")
    print("=" * 80)
    print(f"✅ Updated: {updated}/{len(clients)}")
    print(f"❌ Errors: {errors}")
    print("=" * 80)
    print()

if __name__ == '__main__':
    asyncio.run(main())

