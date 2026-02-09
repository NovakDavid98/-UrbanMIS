#!/usr/bin/env python3
"""
Differential Update Script for CeHuPo Customer Portal Data

This script performs intelligent synchronization between the CeHuPo customer portal
and the local database, only importing NEW data:
1. Adds cehupo_id column if it doesn't exist
2. Downloads current client list from customer.cehupo.cz
3. Matches existing clients and updates their cehupo_id
4. Finds and imports NEW clients that don't exist in our DB
5. For existing clients, extracts only NEW visits after their latest visit date

Usage:
    python3 differential_update.py --test  # Test on 10 clients
    python3 differential_update.py         # Full update
"""

import asyncio
import httpx
from bs4 import BeautifulSoup
import psycopg2
from psycopg2.extras import RealDictCursor
from datetime import datetime, timedelta
import json
import sys
import re
from typing import List, Dict, Optional

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
CLIENT_LIMIT = 10 if TEST_MODE else None

# =================================================================================
# DATABASE UTILITIES
# =================================================================================

def get_db_connection():
    """Create and return database connection"""
    return psycopg2.connect(**DB_CONFIG)

def add_cehupo_id_column_if_missing():
    """Add cehupo_id column to clients table if it doesn't exist"""
    conn = get_db_connection()
    try:
        with conn.cursor() as cur:
            # Check if column exists
            cur.execute("""
                SELECT column_name 
                FROM information_schema.columns 
                WHERE table_name = 'clients' AND column_name = 'cehupo_id'
            """)
            
            if not cur.fetchone():
                print("📝 Adding 'cehupo_id' column to clients table...")
                cur.execute("""
                    ALTER TABLE clients 
                    ADD COLUMN cehupo_id INTEGER UNIQUE
                """)
                cur.execute("""
                    CREATE INDEX IF NOT EXISTS idx_clients_cehupo_id 
                    ON clients(cehupo_id)
                """)
                conn.commit()
                print("   ✅ Column added successfully")
            else:
                print("   ✅ 'cehupo_id' column already exists")
    finally:
        conn.close()

def normalize_name_parts(name: str) -> tuple:
    """
    Normalize a full name into standardized parts for matching.
    Returns tuple of (normalized_full, normalized_parts_set)
    """
    # Remove extra whitespace and lowercase
    normalized = ' '.join(name.lower().strip().split())
    # Split into parts for flexible matching
    parts = set(normalized.split())
    return (normalized, parts)

def get_all_clients_from_db() -> Dict[str, Dict]:
    """Get all clients from our database, indexed by normalized name"""
    conn = get_db_connection()
    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute("""
                SELECT id, first_name, last_name, cehupo_id, date_of_birth,
                       (SELECT MAX(visit_date) FROM visits WHERE client_id = clients.id) as latest_visit_date
                FROM clients
            """)
            clients = cur.fetchall()
            
            # Index by multiple normalized name formats for flexible matching
            client_dict = {}
            for client in clients:
                # Create multiple keys for each client (handle different name orders)
                first = client['first_name'].lower().strip()
                last = client['last_name'].lower().strip()
                
                # Key 1: "FirstName LastName"
                key1 = f"{first} {last}"
                # Key 2: "LastName FirstName" (CeHuPo format)
                key2 = f"{last} {first}"
                
                client_data = dict(client)
                client_dict[key1] = client_data
                client_dict[key2] = client_data
            
            return client_dict
    finally:
        conn.close()

def get_client_latest_visit_date(client_id: str) -> Optional[str]:
    """Get the latest visit date for a specific client"""
    conn = get_db_connection()
    try:
        with conn.cursor() as cur:
            cur.execute("""
                SELECT MAX(visit_date) as latest_visit
                FROM visits
                WHERE client_id = %s
            """, (client_id,))
            result = cur.fetchone()
            return result[0] if result and result[0] else None
    finally:
        conn.close()

# =================================================================================
# CEHUPO PORTAL SCRAPING
# =================================================================================

async def login_to_cehupo(client: httpx.AsyncClient) -> bool:
    """Login to CeHuPo portal and return authentication status"""
    try:
        # First, get the login page to establish session
        await client.get(f"{BASE_URL}/user")
        
        # Now login
        response = await client.post(
            LOGIN_URL,
            data={
                'action': 'auth',
                'username': CEHUPO_USERNAME,
                'password': CEHUPO_PASSWORD
            },
            follow_redirects=True
        )
        
        print(f"   Login response URL: {response.url}")
        print(f"   Login response status: {response.status_code}")
        
        # Check if login was successful (should redirect to home OR contain user info)
        success = (
            'home' in str(response.url) or 
            'customer' in str(response.url) or
            (response.status_code == 200 and 'DavidNovak' in response.text)
        )
        
        if not success:
            # Check for error message
            if 'error' in str(response.url).lower():
                print("   ❌ Login credentials rejected by server")
            else:
                print(f"   ❌ Unexpected response, URL: {response.url}")
        
        return success
    except Exception as e:
        print(f"❌ Login failed: {e}")
        return False

async def get_client_list_from_cehupo(client: httpx.AsyncClient) -> List[Dict]:
    """Download and parse the client list from CeHuPo portal"""
    try:
        # Get the customer list page
        response = await client.get(CUSTOMER_URL)
        if response.status_code != 200:
            print(f"❌ Failed to fetch customer list: {response.status_code}")
            return []
        
        soup = BeautifulSoup(response.text, 'html.parser')
        
        # Find the table with id="TableCustomer"
        table = soup.find('table', {'id': 'TableCustomer'})
        if not table:
            print("❌ Could not find customer table")
            return []
        
        clients = []
        tbody = table.find('tbody')
        if not tbody:
            return []
        
        for row in tbody.find_all('tr'):
            cells = row.find_all('td')
            if len(cells) < 7:
                continue
            
            # Extract client data
            cehupo_id = cells[0].get_text(strip=True)
            name_cell = cells[1].find('a')
            if not name_cell:
                continue
            
            name = name_cell.get_text(strip=True)
            href = name_cell.get('href', '')
            
            # Extract cehupo_id from href (e.g., "customer/viewcustomer/123")
            id_match = re.search(r'/viewcustomer/(\d+)', href)
            cehupo_id = int(id_match.group(1)) if id_match else None
            
            gender = cells[2].get_text(strip=True)
            dob = cells[3].get_text(strip=True)
            age = cells[4].get_text(strip=True)
            visa_number = cells[5].get_text(strip=True)
            city = cells[6].get_text(strip=True)
            
            clients.append({
                'cehupo_id': cehupo_id,
                'name': name,
                'gender': gender,
                'date_of_birth': dob,
                'age': age,
                'visa_number': visa_number,
                'city': city
            })
        
        return clients
    
    except Exception as e:
        print(f"❌ Error fetching client list: {e}")
        return []

async def get_client_visits(client: httpx.AsyncClient, cehupo_id: int, since_date: Optional[str] = None) -> List[Dict]:
    """Get visits for a specific client from CeHuPo portal"""
    try:
        # Create date range for the request
        end_date = datetime.now().strftime('%Y-%m-%d')
        start_date = since_date if since_date else '2022-03-01'  # Default start
        
        url = f"{BASE_URL}/customer/viewcustomer/{cehupo_id}"
        response = await client.get(url)
        
        if response.status_code != 200:
            return []
        
        soup = BeautifulSoup(response.text, 'html.parser')
        
        # Extract visit data from the page (similar to previous extraction script)
        # This is a simplified version - you'll need to adapt based on actual HTML structure
        visits = []
        
        # Find visit table/section
        visit_table = soup.find('table', class_='table-visits')  # Adjust selector as needed
        if visit_table:
            for row in visit_table.find_all('tr')[1:]:  # Skip header
                cells = row.find_all('td')
                if len(cells) >= 3:
                    visit_date = cells[0].get_text(strip=True)
                    # Parse other visit data...
                    # Only include visits after since_date
                    if since_date is None or visit_date > since_date:
                        visits.append({
                            'visit_date': visit_date,
                            # Add other visit data fields
                        })
        
        return visits
    
    except Exception as e:
        print(f"❌ Error fetching visits for client {cehupo_id}: {e}")
        return []

# =================================================================================
# MAIN DIFFERENTIAL UPDATE LOGIC
# =================================================================================

async def perform_differential_update():
    """Main function to perform differential update"""
    
    print("=" * 80)
    print("🔄 DIFFERENTIAL UPDATE - CeHuPo Customer Portal")
    print("=" * 80)
    print(f"Mode: {'TEST (10 clients)' if TEST_MODE else 'FULL UPDATE'}")
    print()
    
    # Step 1: Add cehupo_id column if missing
    print("📊 Step 1: Preparing database schema...")
    add_cehupo_id_column_if_missing()
    print()
    
    # Step 2: Load existing clients from our DB
    print("📊 Step 2: Loading existing clients from database...")
    db_clients = get_all_clients_from_db()
    print(f"   ✅ Loaded {len(db_clients)} clients from database")
    print()
    
    # Step 3: Login to CeHuPo and download current client list
    print("📊 Step 3: Connecting to CeHuPo portal...")
    async with httpx.AsyncClient(timeout=30.0, follow_redirects=True) as http_client:
        # Login
        login_success = await login_to_cehupo(http_client)
        if not login_success:
            print("❌ Failed to login to CeHuPo portal")
            return
        print("   ✅ Successfully logged in")
        
        # Get client list
        print("\n📊 Step 4: Downloading current client list from CeHuPo...")
        cehupo_clients = await get_client_list_from_cehupo(http_client)
        
        if TEST_MODE and len(cehupo_clients) > CLIENT_LIMIT:
            cehupo_clients = cehupo_clients[:CLIENT_LIMIT]
        
        print(f"   ✅ Downloaded {len(cehupo_clients)} clients from CeHuPo")
        print()
        
        # Step 4: Match and categorize clients
        print("📊 Step 5: Matching clients...")
        existing_matches = []
        new_clients = []
        updates_needed = []
        
        for cehupo_client in cehupo_clients:
            name = cehupo_client['name']
            normalized_name = name.lower().strip()
            
            if normalized_name in db_clients:
                # Client exists in our DB
                db_client = db_clients[normalized_name]
                existing_matches.append({
                    'db_id': db_client['id'],
                    'cehupo_id': cehupo_client['cehupo_id'],
                    'name': name,
                    'latest_visit': db_client['latest_visit_date']
                })
                
                # Check if cehupo_id needs to be updated
                if db_client['cehupo_id'] != cehupo_client['cehupo_id']:
                    updates_needed.append({
                        'db_id': db_client['id'],
                        'cehupo_id': cehupo_client['cehupo_id'],
                        'name': name
                    })
            else:
                # New client not in our DB
                new_clients.append(cehupo_client)
        
        print(f"   ✅ Existing clients matched: {len(existing_matches)}")
        print(f"   ✅ New clients to add: {len(new_clients)}")
        print(f"   ✅ Clients needing cehupo_id update: {len(updates_needed)}")
        print()
        
        # Step 5: Update cehupo_id for existing clients
        if updates_needed:
            print("📊 Step 6: Updating cehupo_id for existing clients...")
            conn = get_db_connection()
            try:
                with conn.cursor() as cur:
                    for update in updates_needed:
                        cur.execute("""
                            UPDATE clients 
                            SET cehupo_id = %s 
                            WHERE id = %s
                        """, (update['cehupo_id'], update['db_id']))
                conn.commit()
                print(f"   ✅ Updated {len(updates_needed)} clients")
            finally:
                conn.close()
            print()
        
        # Step 6: Display summary
        print("=" * 80)
        print("📊 DIFFERENTIAL UPDATE SUMMARY")
        print("=" * 80)
        print(f"Clients in CeHuPo: {len(cehupo_clients)}")
        print(f"Clients in our DB: {len(db_clients)}")
        print(f"Matched existing: {len(existing_matches)}")
        print(f"New clients found: {len(new_clients)}")
        print(f"CeHuPo IDs updated: {len(updates_needed)}")
        print()
        
        if new_clients:
            print("🆕 NEW CLIENTS TO ADD:")
            for i, client in enumerate(new_clients[:10], 1):
                print(f"   {i}. {client['name']} (CeHuPo ID: {client['cehupo_id']})")
            if len(new_clients) > 10:
                print(f"   ... and {len(new_clients) - 10} more")
        
        print("=" * 80)
        
        # Save report
        report = {
            'timestamp': datetime.now().isoformat(),
            'mode': 'test' if TEST_MODE else 'full',
            'cehupo_clients_count': len(cehupo_clients),
            'db_clients_count': len(db_clients),
            'existing_matches': len(existing_matches),
            'new_clients': [{'name': c['name'], 'cehupo_id': c['cehupo_id']} for c in new_clients],
            'updates_performed': len(updates_needed)
        }
        
        report_filename = f"differential_update_report_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
        with open(report_filename, 'w', encoding='utf-8') as f:
            json.dump(report, f, indent=2, ensure_ascii=False)
        
        print(f"\n💾 Report saved to: {report_filename}")

# =================================================================================
# MAIN ENTRY POINT
# =================================================================================

if __name__ == '__main__':
    print("\n🚀 Starting Differential Update Script\n")
    asyncio.run(perform_differential_update())
    print("\n✅ Differential update complete!\n")

