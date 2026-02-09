#!/usr/bin/env python3
"""
TEST EXTRACTION - 5 Clients Only
Verifies the extraction process works correctly before running full extraction
"""

import asyncio
import aiohttp
import json
import psycopg2
from bs4 import BeautifulSoup
from datetime import datetime
import time
import logging

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# CONFIGURATION - UPDATE THESE!
CEHUPO_USERNAME = "DavidNovak"
CEHUPO_PASSWORD = "Supr414nd!"

BASE_URL = "https://customer.cehupo.cz"
LOGIN_URL = f"{BASE_URL}/user/authenticate"
HOME_URL = f"{BASE_URL}/home"

DB_CONFIG = {
    'dbname': 'centralnimozek_cehupo',
    'user': 'postgres',
    'password': 'IDvEg1WH40wVn7aa8MT9haYsbtRhF1PC',
    'host': 'localhost',
    'port': '5432'
}

# TEST: Only process first 5 clients
TEST_CLIENT_LIMIT = 5

def get_test_clients() -> list:
    """Get first 5 clients for testing"""
    try:
        conn = psycopg2.connect(**DB_CONFIG)
        cur = conn.cursor()
        
        query = """
            SELECT id, first_name, last_name, visa_number, date_of_birth
            FROM clients
            ORDER BY id
            LIMIT %s
        """
        
        cur.execute(query, (TEST_CLIENT_LIMIT,))
        rows = cur.fetchall()
        
        clients = []
        for row in rows:
            clients.append({
                'id': str(row[0]),
                'first_name': row[1],
                'last_name': row[2],
                'visa_number': row[3],
                'date_of_birth': str(row[4]) if row[4] else None
            })
        
        cur.close()
        conn.close()
        
        return clients
    except Exception as e:
        logger.error(f"Database error: {e}")
        return []

async def login_to_cehupo(session: aiohttp.ClientSession) -> bool:
    """Login to CeHuPo portal"""
    try:
        login_data = {
            'username': CEHUPO_USERNAME,
            'password': CEHUPO_PASSWORD,
            'action': 'auth'
        }
        
        async with session.post(LOGIN_URL, data=login_data, allow_redirects=True) as response:
            text = await response.text()
            
            if 'Журнал посещений' in text or 'home' in str(response.url):
                logger.info("✓ Successfully logged in")
                return True
            else:
                logger.error("✗ Login failed")
                logger.debug(f"Response URL: {response.url}")
                logger.debug(f"Response contains 'Ошибка': {'Ошибка' in text}")
                return False
    except Exception as e:
        logger.error(f"Login error: {e}")
        return False

async def search_client_in_cehupo(session: aiohttp.ClientSession, client: dict) -> str:
    """Find client's CeHuPo ID"""
    try:
        async with session.get(HOME_URL) as response:
            if response.status != 200:
                logger.warning(f"Failed to access home page: {response.status}")
                return None
            
            html = await response.text()
            soup = BeautifulSoup(html, 'html.parser')
            
            # Find customer dropdown
            select = soup.find('select', {'id': 'customer_id'})
            if not select:
                logger.warning("Could not find customer select element")
                return None
            
            # Search for client
            for option in select.find_all('option'):
                option_text = option.text.strip()
                option_value = option.get('value', '')
                
                # Match by visa number or name
                if (client['visa_number'] and client['visa_number'] in option_text) or \
                   (f"{client['first_name']} {client['last_name']}" in option_text):
                    logger.info(f"  ✓ Found: {client['first_name']} {client['last_name']} (ID: {option_value})")
                    return option_value
            
            logger.warning(f"  ✗ Not found: {client['first_name']} {client['last_name']}")
            return None
    except Exception as e:
        logger.error(f"Search error: {e}")
        return None

async def get_client_visits(session: aiohttp.ClientSession, cehupo_id: str, client: dict) -> dict:
    """Extract visit data for one client"""
    try:
        visit_url = f"{BASE_URL}/home/view_visit/{cehupo_id}"
        
        async with session.get(visit_url) as response:
            if response.status != 200:
                return {
                    'client_id': client['id'],
                    'first_name': client['first_name'],
                    'last_name': client['last_name'],
                    'visits': [],
                    'error': f'HTTP {response.status}'
                }
            
            html = await response.text()
            soup = BeautifulSoup(html, 'html.parser')
            
            visit_table = soup.find('table', {'id': 'visit'})
            
            if not visit_table:
                logger.info(f"  No visits for {client['first_name']} {client['last_name']}")
                return {
                    'client_id': client['id'],
                    'first_name': client['first_name'],
                    'last_name': client['last_name'],
                    'visits': []
                }
            
            visits = []
            tbody = visit_table.find('tbody')
            if tbody:
                for row in tbody.find_all('tr'):
                    cols = row.find_all('td')
                    
                    if len(cols) >= 5:
                        visit = {
                            'visit_number': cols[0].text.strip(),
                            'visit_date': cols[1].text.strip(),
                            'reasons': [r.strip() for r in cols[2].text.split(',') if r.strip()],
                            'notes': cols[3].text.strip(),
                            'time_spent': cols[4].text.strip()
                        }
                        visits.append(visit)
            
            logger.info(f"  ✓ Extracted {len(visits)} visits for {client['first_name']} {client['last_name']}")
            
            return {
                'client_id': client['id'],
                'cehupo_client_id': cehupo_id,
                'visa_number': client['visa_number'],
                'first_name': client['first_name'],
                'last_name': client['last_name'],
                'visits': visits,
                'visit_count': len(visits)
            }
    except Exception as e:
        logger.error(f"Extraction error: {e}")
        return {
            'client_id': client['id'],
            'first_name': client['first_name'],
            'last_name': client['last_name'],
            'visits': [],
            'error': str(e)
        }

async def test_extraction():
    """Test extraction on 5 clients"""
    
    print("\n" + "="*80)
    print("TEST EXTRACTION - 5 Clients")
    print("="*80 + "\n")
    
    # Get test clients
    print("📊 Loading test clients...")
    clients = get_test_clients()
    
    if not clients:
        print("✗ No clients found!")
        return
    
    print(f"✓ Loaded {len(clients)} test clients:\n")
    for i, client in enumerate(clients, 1):
        print(f"  {i}. {client['first_name']} {client['last_name']} (Visa: {client['visa_number']})")
    
    print(f"\n🔐 Logging in to CeHuPo...\n")
    
    connector = aiohttp.TCPConnector(limit=1)
    timeout = aiohttp.ClientTimeout(total=60)
    
    async with aiohttp.ClientSession(
        connector=connector,
        timeout=timeout,
        cookie_jar=aiohttp.CookieJar()
    ) as session:
        
        if not await login_to_cehupo(session):
            print("\n✗ Login failed! Check credentials.\n")
            return
        
        print("\n🚀 Extracting visit data...\n")
        
        all_data = []
        
        for client in clients:
            print(f"Processing: {client['first_name']} {client['last_name']}")
            
            cehupo_id = await search_client_in_cehupo(session, client)
            
            if not cehupo_id:
                all_data.append({
                    'client_id': client['id'],
                    'first_name': client['first_name'],
                    'last_name': client['last_name'],
                    'visits': [],
                    'error': 'Not found in CeHuPo'
                })
                continue
            
            client_data = await get_client_visits(session, cehupo_id, client)
            all_data.append(client_data)
            
            await asyncio.sleep(0.5)  # Be nice to server
            print()
        
        # Save results
        output_file = f"test_extraction_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
        
        with open(output_file, 'w', encoding='utf-8') as f:
            json.dump({
                'test_mode': True,
                'extraction_date': datetime.now().isoformat(),
                'clients': all_data
            }, f, ensure_ascii=False, indent=2)
        
        # Print summary
        print("\n" + "="*80)
        print("TEST RESULTS")
        print("="*80 + "\n")
        
        total_visits = sum(len(c.get('visits', [])) for c in all_data)
        clients_with_visits = sum(1 for c in all_data if len(c.get('visits', [])) > 0)
        clients_with_errors = sum(1 for c in all_data if 'error' in c)
        
        print(f"✓ Clients processed: {len(all_data)}")
        print(f"✓ Clients with visits: {clients_with_visits}")
        print(f"✓ Total visits extracted: {total_visits}")
        print(f"✓ Clients with errors: {clients_with_errors}")
        print(f"\n✓ Output saved to: {output_file}")
        print(f"  File size: {os.path.getsize(output_file) / 1024:.1f} KB\n")
        
        # Show sample visit data
        if total_visits > 0:
            print("="*80)
            print("SAMPLE VISIT DATA")
            print("="*80 + "\n")
            
            for client_data in all_data:
                if client_data.get('visits'):
                    print(f"Client: {client_data['first_name']} {client_data['last_name']}")
                    print(f"Visits: {len(client_data['visits'])}\n")
                    
                    # Show first 3 visits
                    for i, visit in enumerate(client_data['visits'][:3], 1):
                        print(f"  Visit {i}:")
                        print(f"    Date: {visit['visit_date']}")
                        print(f"    Reasons: {', '.join(visit['reasons'])}")
                        print(f"    Time: {visit['time_spent']}")
                        print(f"    Notes: {visit['notes'][:50]}..." if len(visit['notes']) > 50 else f"    Notes: {visit['notes']}")
                        print()
                    
                    if len(client_data['visits']) > 3:
                        print(f"  ... and {len(client_data['visits']) - 3} more visits\n")
                    
                    break  # Only show one client's sample
        
        print("="*80)
        print("NEXT STEPS")
        print("="*80 + "\n")
        
        if clients_with_errors == 0 and total_visits > 0:
            print("✅ TEST SUCCESSFUL!")
            print("\n1. Review the output file to verify data is correct")
            print("2. Check sample visit data above")
            print("3. If everything looks good, run full extraction:\n")
            print("   python3 extract_all_visits_async.py\n")
        elif total_visits == 0:
            print("⚠️  No visits found for test clients")
            print("   This might be normal if these clients have no visit history")
            print("   Try testing with clients you know have visits\n")
        else:
            print("⚠️  Some errors occurred")
            print("   Review the output and check credentials\n")
        
        print("="*80 + "\n")

import os

if __name__ == "__main__":
    if CEHUPO_USERNAME == "YOUR_USERNAME":
        print("\n⚠️  Please update CEHUPO_USERNAME and CEHUPO_PASSWORD in the script!\n")
        exit(1)
    
    asyncio.run(test_extraction())

