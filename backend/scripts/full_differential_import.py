#!/usr/bin/env python3
"""
FULL DIFFERENTIAL IMPORT - CeHuPo Customer Portal

This script performs complete differential synchronization:
1. Imports NEW clients (235 clients that exist in CeHuPo but not in our DB)
2. Extracts NEW visits for ALL clients (only visits after their latest visit date)
3. Imports all new visit data into database

Usage:
    python3 full_differential_import.py --test  # Test on 5 clients
    python3 full_differential_import.py         # Full import
"""

import asyncio
import httpx
from bs4 import BeautifulSoup
import psycopg2
from psycopg2.extras import RealDictCursor, execute_values
from datetime import datetime, timedelta
import json
import sys
import re
from typing import List, Dict, Optional
import uuid

# =================================================================================
# CONFIGURATION
# =================================================================================

# CeHuPo Portal Credentials
CEHUPO_USERNAME = "DavidNovak"
CEHUPO_PASSWORD = "Supr414nd!"

# CeHuPo Portal URLs
BASE_URL = "https://customer.cehupo.cz"
LOGIN_URL = f"{BASE_URL}/user/authenticate"
HOME_URL = f"{BASE_URL}/home"
CUSTOMER_URL = f"{BASE_URL}/customer"

# Database configuration
DB_CONFIG = {
    'dbname': 'centralnimozek_cehupo',
    'user': 'postgres',
    'password': 'IDvEg1WH40wVn7aa8MT9haYsbtRhF1PC',
    'host': 'localhost',
    'port': '5432'
}

# Test mode configuration
TEST_MODE = '--test' in sys.argv
CLIENT_LIMIT = 5 if TEST_MODE else None

# Date range for extraction
START_DATE = "2022-03-01"  # Beginning of CeHuPo system
END_DATE = datetime.now().strftime("%Y-%m-%d")

# =================================================================================
# DATABASE UTILITIES
# =================================================================================

def get_db_connection():
    """Create and return database connection"""
    return psycopg2.connect(**DB_CONFIG)

def parse_date(date_str: str) -> Optional[str]:
    """Parse date from various formats to YYYY-MM-DD"""
    if not date_str or date_str.strip() == '':
        return None
    
    try:
        # Try DD.MM.YYYY format (CeHuPo format)
        if '.' in date_str:
            parts = date_str.strip().split('.')
            if len(parts) == 3:
                day, month, year = parts
                return f"{year}-{month.zfill(2)}-{day.zfill(2)}"
        
        # Try YYYY-MM-DD format
        if '-' in date_str and len(date_str.split('-')[0]) == 4:
            return date_str
        
        return None
    except:
        return None

def insert_new_client(client_data: Dict) -> str:
    """Insert a new client into the database and return the client ID"""
    conn = get_db_connection()
    try:
        with conn.cursor() as cur:
            client_id = str(uuid.uuid4())
            
            cur.execute("""
                INSERT INTO clients (
                    id, first_name, last_name, date_of_birth, gender,
                    visa_number, home_address, cehupo_id, created_at
                )
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, NOW())
                RETURNING id
            """, (
                client_id,
                client_data.get('first_name', ''),
                client_data.get('last_name', ''),
                client_data.get('date_of_birth'),
                client_data.get('gender', 'other'),
                client_data.get('visa_number'),
                client_data.get('home_address'),
                client_data.get('cehupo_id')
            ))
            
            conn.commit()
            return client_id
    finally:
        conn.close()

def insert_visits_batch(visits: List[Dict]):
    """Insert multiple visits into the database in a batch"""
    if not visits:
        return
    
    conn = get_db_connection()
    try:
        with conn.cursor() as cur:
            # Insert visits
            visit_values = []
            for visit in visits:
                visit_id = str(uuid.uuid4())
                visit_values.append((
                    visit_id,
                    visit['client_id'],
                    visit['visit_date'],
                    visit.get('time_spent'),
                    visit.get('notes', '')
                ))
            
            execute_values(cur, """
                INSERT INTO visits (id, client_id, visit_date, time_spent, notes, created_at)
                VALUES %s
            """, visit_values, template="(%s, %s, %s, %s, %s, NOW())")
            
            conn.commit()
            print(f"   ✅ Inserted {len(visits)} visits")
    except Exception as e:
        print(f"   ❌ Error inserting visits: {e}")
        conn.rollback()
    finally:
        conn.close()

# =================================================================================
# CEHUPO PORTAL SCRAPING
# =================================================================================

async def login_to_cehupo(client: httpx.AsyncClient) -> bool:
    """Login to CeHuPo portal"""
    try:
        await client.get(f"{BASE_URL}/user")
        response = await client.post(
            LOGIN_URL,
            data={
                'action': 'auth',
                'username': CEHUPO_USERNAME,
                'password': CEHUPO_PASSWORD
            },
            follow_redirects=True
        )
        
        success = (
            'home' in str(response.url) or 
            'customer' in str(response.url) or
            (response.status_code == 200 and 'DavidNovak' in response.text)
        )
        
        return success
    except Exception as e:
        print(f"❌ Login failed: {e}")
        return False

async def get_client_detail(client: httpx.AsyncClient, cehupo_id: int) -> Optional[Dict]:
    """Get detailed client information from CeHuPo"""
    try:
        url = f"{BASE_URL}/customer/viewcustomer/{cehupo_id}"
        response = await client.get(url)
        
        if response.status_code != 200:
            return None
        
        soup = BeautifulSoup(response.text, 'html.parser')
        
        # Extract client data from the page
        # This is based on the structure we saw in the uploaded HTML
        client_data = {'cehupo_id': cehupo_id}
        
        # Find all form inputs and textareas to extract data
        inputs = soup.find_all(['input', 'textarea', 'select'])
        for inp in inputs:
            name = inp.get('name', '')
            value = inp.get('value', '') or inp.get_text(strip=True)
            
            if 'firstname' in name.lower():
                client_data['first_name'] = value
            elif 'lastname' in name.lower() or 'surname' in name.lower():
                client_data['last_name'] = value
            elif 'birth' in name.lower() or 'dob' in name.lower():
                client_data['date_of_birth'] = parse_date(value)
            elif 'visa' in name.lower():
                client_data['visa_number'] = value
            elif 'address' in name.lower() or 'adresa' in name.lower():
                client_data['home_address'] = value
            elif 'gender' in name.lower() or 'sex' in name.lower() or 'pol' in name.lower():
                # Map gender values
                gender_lower = value.lower()
                if 'жен' in gender_lower or 'female' in gender_lower or 'žena' in gender_lower:
                    client_data['gender'] = 'female'
                elif 'муж' in gender_lower or 'male' in gender_lower or 'muž' in gender_lower:
                    client_data['gender'] = 'male'
        
        return client_data if client_data.get('first_name') else None
        
    except Exception as e:
        print(f"   ❌ Error fetching client {cehupo_id}: {e}")
        return None

async def get_client_visits(client: httpx.AsyncClient, cehupo_id: int, client_id: str, 
                           since_date: Optional[str] = None) -> List[Dict]:
    """Get visits for a client, optionally filtering by date"""
    try:
        # Construct URL with date range
        end_date = END_DATE
        start_date = since_date if since_date else START_DATE
        
        url = f"{BASE_URL}/customer/viewcustomer/{cehupo_id}"
        response = await client.get(url)
        
        if response.status_code != 200:
            return []
        
        soup = BeautifulSoup(response.text, 'html.parser')
        visits = []
        
        # Find visit logs table
        # Based on the structure from the uploaded HTML, visits are in a table
        tables = soup.find_all('table')
        
        for table in tables:
            rows = table.find_all('tr')
            for row in rows[1:]:  # Skip header
                cells = row.find_all(['td', 'th'])
                if len(cells) >= 2:
                    # Try to extract visit date from first cell
                    date_text = cells[0].get_text(strip=True)
                    visit_date = parse_date(date_text)
                    
                    if visit_date:
                        # Only include if after since_date
                        if since_date is None or visit_date > since_date:
                            # Extract other visit details
                            notes = ' | '.join([c.get_text(strip=True) for c in cells[1:]])
                            
                            visits.append({
                                'client_id': client_id,
                                'visit_date': visit_date,
                                'time_spent': None,
                                'notes': notes[:500] if notes else None  # Limit notes length
                            })
        
        return visits
        
    except Exception as e:
        print(f"   ❌ Error fetching visits for client {cehupo_id}: {e}")
        return []

# =================================================================================
# MAIN IMPORT LOGIC
# =================================================================================

async def perform_full_differential_import():
    """Main function to perform full differential import"""
    
    print("=" * 80)
    print("🚀 FULL DIFFERENTIAL IMPORT - CeHuPo Customer Portal")
    print("=" * 80)
    print(f"Mode: {'TEST (5 clients)' if TEST_MODE else 'FULL IMPORT'}")
    print()
    
    # Load the previous differential report to get the list of new clients
    try:
        with open('differential_update_report_20251112_200221.json', 'r') as f:
            report = json.load(f)
            new_clients_to_import = report['new_clients']
    except:
        print("❌ Could not load previous differential report")
        print("   Please run differential_update.py first!")
        return
    
    if TEST_MODE and len(new_clients_to_import) > CLIENT_LIMIT:
        new_clients_to_import = new_clients_to_import[:CLIENT_LIMIT]
    
    print(f"📊 Clients to import: {len(new_clients_to_import)}")
    print()
    
    # Get list of existing clients with cehupo_id for visit extraction
    print("📊 Loading existing clients from database...")
    conn = get_db_connection()
    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute("""
                SELECT id, first_name, last_name, cehupo_id,
                       (SELECT MAX(visit_date) FROM visits WHERE client_id = clients.id) as latest_visit_date
                FROM clients
                WHERE cehupo_id IS NOT NULL
            """)
            existing_clients = cur.fetchall()
    finally:
        conn.close()
    
    if TEST_MODE and len(existing_clients) > CLIENT_LIMIT:
        existing_clients = existing_clients[:CLIENT_LIMIT]
    
    print(f"   ✅ Loaded {len(existing_clients)} existing clients for visit updates")
    print()
    
    # Login to CeHuPo
    print("📊 Connecting to CeHuPo portal...")
    async with httpx.AsyncClient(timeout=30.0, follow_redirects=True) as http_client:
        login_success = await login_to_cehupo(http_client)
        if not login_success:
            print("❌ Failed to login to CeHuPo portal")
            return
        print("   ✅ Successfully logged in")
        print()
        
        # =============================================================================
        # PART 1: Import NEW Clients
        # =============================================================================
        print("=" * 80)
        print("📥 PART 1: Importing NEW Clients")
        print("=" * 80)
        
        imported_clients = []
        for i, new_client in enumerate(new_clients_to_import, 1):
            cehupo_id = new_client['cehupo_id']
            name = new_client['name']
            
            print(f"[{i}/{len(new_clients_to_import)}] Importing {name} (CeHuPo ID: {cehupo_id})...")
            
            # Get full client details
            client_data = await get_client_detail(http_client, cehupo_id)
            
            if client_data:
                # Insert into database
                try:
                    client_id = insert_new_client(client_data)
                    imported_clients.append({
                        'client_id': client_id,
                        'cehupo_id': cehupo_id,
                        'name': name
                    })
                    print(f"   ✅ Imported successfully (DB ID: {client_id[:8]}...)")
                except Exception as e:
                    print(f"   ❌ Failed to import: {e}")
            else:
                print(f"   ⚠️  Could not fetch client details")
            
            # Rate limiting
            await asyncio.sleep(0.5)
        
        print()
        print(f"✅ Imported {len(imported_clients)} new clients")
        print()
        
        # =============================================================================
        # PART 2: Extract NEW Visits for Existing Clients
        # =============================================================================
        print("=" * 80)
        print("📅 PART 2: Extracting NEW Visits for Existing Clients")
        print("=" * 80)
        print()
        
        all_new_visits = []
        clients_with_new_visits = 0
        
        for i, client in enumerate(existing_clients, 1):
            cehupo_id = client['cehupo_id']
            client_id = client['id']
            name = f"{client['first_name']} {client['last_name']}"
            latest_visit = str(client['latest_visit_date']) if client['latest_visit_date'] else None
            
            print(f"[{i}/{len(existing_clients)}] {name} (CeHuPo ID: {cehupo_id})...")
            print(f"   Latest visit in DB: {latest_visit or 'None'}")
            
            # Get visits from CeHuPo (only after latest_visit)
            visits = await get_client_visits(http_client, cehupo_id, client_id, latest_visit)
            
            if visits:
                all_new_visits.extend(visits)
                clients_with_new_visits += 1
                print(f"   ✅ Found {len(visits)} new visit(s)")
            else:
                print(f"   → No new visits")
            
            # Rate limiting
            await asyncio.sleep(0.5)
        
        print()
        print(f"✅ Found {len(all_new_visits)} new visits from {clients_with_new_visits} clients")
        print()
        
        # =============================================================================
        # PART 3: Import All NEW Visits
        # =============================================================================
        if all_new_visits:
            print("=" * 80)
            print("💾 PART 3: Importing NEW Visits to Database")
            print("=" * 80)
            
            # Import in batches of 100
            batch_size = 100
            for i in range(0, len(all_new_visits), batch_size):
                batch = all_new_visits[i:i+batch_size]
                print(f"Importing batch {i//batch_size + 1}/{(len(all_new_visits)-1)//batch_size + 1}...")
                insert_visits_batch(batch)
            
            print()
            print(f"✅ Successfully imported {len(all_new_visits)} new visits")
        
        # =============================================================================
        # FINAL SUMMARY
        # =============================================================================
        print()
        print("=" * 80)
        print("🎉 FULL DIFFERENTIAL IMPORT COMPLETE!")
        print("=" * 80)
        print(f"✅ New clients imported: {len(imported_clients)}")
        print(f"✅ New visits imported: {len(all_new_visits)}")
        print(f"✅ Clients with new visits: {clients_with_new_visits}")
        print("=" * 80)
        
        # Save report
        report = {
            'timestamp': datetime.now().isoformat(),
            'mode': 'test' if TEST_MODE else 'full',
            'new_clients_imported': len(imported_clients),
            'new_visits_imported': len(all_new_visits),
            'clients_with_new_visits': clients_with_new_visits,
            'imported_client_ids': [c['client_id'] for c in imported_clients]
        }
        
        report_filename = f"full_differential_import_report_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
        with open(report_filename, 'w', encoding='utf-8') as f:
            json.dump(report, f, indent=2, ensure_ascii=False)
        
        print(f"\n💾 Report saved to: {report_filename}")

# =================================================================================
# MAIN ENTRY POINT
# =================================================================================

if __name__ == '__main__':
    print("\n🚀 Starting Full Differential Import\n")
    asyncio.run(perform_full_differential_import())
    print("\n✅ Import complete!\n")

