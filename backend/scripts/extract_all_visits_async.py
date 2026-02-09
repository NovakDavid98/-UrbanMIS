#!/usr/bin/env python3
"""
=================================================================================
COMPLETE VISIT DATA EXTRACTOR - CeHuPo Customer Portal
=================================================================================
Extracts ALL visit data for ALL clients from the beginning of time (2022-03-01)
until November 12, 2025, using async HTTP requests for maximum speed.

Author: AI Assistant
Date: November 12, 2025
=================================================================================
"""

import asyncio
import aiohttp
import json
import psycopg2
from bs4 import BeautifulSoup
from datetime import datetime, timedelta
import time
from typing import List, Dict, Optional
import logging

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('extract_all_visits.log'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

# =================================================================================
# CONFIGURATION
# =================================================================================

# CeHuPo Portal Credentials (UPDATE THESE!)
CEHUPO_USERNAME = "DavidNovak"
CEHUPO_PASSWORD = "Supr414nd!"

# CeHuPo Portal URLs
BASE_URL = "https://customer.cehupo.cz"
LOGIN_URL = f"{BASE_URL}/user/authenticate"
HOME_URL = f"{BASE_URL}/home"

# Date range for extraction
START_DATE = "2022-03-01"  # Beginning of CeHuPo system
END_DATE = "2025-11-12"  # November 12, 2025

# Database configuration
DB_CONFIG = {
    'dbname': 'centralnimozek_cehupo',
    'user': 'postgres',
    'password': 'IDvEg1WH40wVn7aa8MT9haYsbtRhF1PC',
    'host': 'localhost',
    'port': '5432'
}

# Async configuration
MAX_CONCURRENT_REQUESTS = 10  # Number of simultaneous requests
REQUEST_DELAY = 0.2  # Delay between requests (seconds)

# =================================================================================
# DATABASE FUNCTIONS
# =================================================================================

def get_all_clients_from_db() -> List[Dict]:
    """Get all clients from our database"""
    try:
        conn = psycopg2.connect(**DB_CONFIG)
        cur = conn.cursor()
        
        query = """
            SELECT 
                id,
                first_name,
                last_name,
                visa_number,
                date_of_birth,
                project_registration_date
            FROM clients
            ORDER BY id
        """
        
        cur.execute(query)
        rows = cur.fetchall()
        
        clients = []
        for row in rows:
            clients.append({
                'id': str(row[0]),
                'first_name': row[1],
                'last_name': row[2],
                'visa_number': row[3],
                'date_of_birth': str(row[4]) if row[4] else None,
                'registration_date': str(row[5]) if row[5] else None
            })
        
        cur.close()
        conn.close()
        
        logger.info(f"✓ Loaded {len(clients)} clients from database")
        return clients
        
    except Exception as e:
        logger.error(f"Database error: {e}")
        return []

# =================================================================================
# CEHUPO PORTAL INTERACTION
# =================================================================================

async def login_to_cehupo(session: aiohttp.ClientSession) -> bool:
    """Login to CeHuPo portal and establish session"""
    try:
        login_data = {
            'username': CEHUPO_USERNAME,
            'password': CEHUPO_PASSWORD,
            'action': 'auth'
        }
        
        async with session.post(LOGIN_URL, data=login_data, allow_redirects=True) as response:
            text = await response.text()
            
            # Check if login was successful (look for dashboard elements)
            if 'Журнал посещений' in text or 'home' in str(response.url):
                logger.info("✓ Successfully logged in to CeHuPo")
                return True
            else:
                logger.error("✗ Login failed - check credentials")
                return False
                
    except Exception as e:
        logger.error(f"Login error: {e}")
        return False

async def search_client_in_cehupo(session: aiohttp.ClientSession, client: Dict) -> Optional[str]:
    """
    Search for client in CeHuPo system by visa number or name
    Returns the client ID in CeHuPo system
    """
    try:
        # The home page shows all visits with DataTables
        # We need to search through the DataTables API or HTML
        
        # Method 1: Try to parse the home page HTML table
        async with session.get(HOME_URL) as response:
            if response.status != 200:
                logger.warning(f"Failed to access home page: {response.status}")
                return None
            
            html = await response.text()
            soup = BeautifulSoup(html, 'html.parser')
            
            # Look for client in the customer dropdown/search
            # Based on 10.html structure, clients are in a select element
            select = soup.find('select', {'id': 'customer_id'})
            if not select:
                logger.warning("Could not find customer select element")
                return None
            
            # Find client by visa number or name
            for option in select.find_all('option'):
                option_text = option.text.strip()
                option_value = option.get('value', '')
                
                # Match by visa number or full name
                if (client['visa_number'] and client['visa_number'] in option_text) or \
                   (f"{client['first_name']} {client['last_name']}" in option_text):
                    logger.debug(f"Found client {client['first_name']} {client['last_name']} with CeHuPo ID: {option_value}")
                    return option_value
            
            logger.warning(f"Client not found in CeHuPo: {client['first_name']} {client['last_name']}")
            return None
            
    except Exception as e:
        logger.error(f"Error searching for client {client['first_name']} {client['last_name']}: {e}")
        return None

async def get_client_visits(session: aiohttp.ClientSession, cehupo_client_id: str, client: Dict) -> Dict:
    """
    Extract all visit data for a specific client
    Returns dictionary with client info and all their visits
    """
    try:
        # Construct URL to client's visit history page
        visit_url = f"{BASE_URL}/home/view_visit/{cehupo_client_id}"
        
        logger.debug(f"Fetching visits for {client['first_name']} {client['last_name']}...")
        
        async with session.get(visit_url) as response:
            if response.status != 200:
                logger.warning(f"Failed to fetch visits for client {cehupo_client_id}: {response.status}")
                return {
                    'client_id': client['id'],
                    'visa_number': client['visa_number'],
                    'first_name': client['first_name'],
                    'last_name': client['last_name'],
                    'visits': [],
                    'error': f'HTTP {response.status}'
                }
            
            html = await response.text()
            soup = BeautifulSoup(html, 'html.parser')
            
            # Find the visit table (id="visit" based on 11.html structure)
            visit_table = soup.find('table', {'id': 'visit'})
            
            if not visit_table:
                logger.info(f"No visits found for {client['first_name']} {client['last_name']}")
                return {
                    'client_id': client['id'],
                    'visa_number': client['visa_number'],
                    'first_name': client['first_name'],
                    'last_name': client['last_name'],
                    'visits': []
                }
            
            # Parse visit rows
            visits = []
            tbody = visit_table.find('tbody')
            if tbody:
                for row in tbody.find_all('tr'):
                    cols = row.find_all('td')
                    
                    if len(cols) >= 5:
                        visit = {
                            'visit_number': cols[0].text.strip(),
                            'visit_date': cols[1].text.strip(),  # Format: DD.MM.YYYY
                            'reasons': [r.strip() for r in cols[2].text.split(',') if r.strip()],
                            'notes': cols[3].text.strip(),
                            'time_spent': cols[4].text.strip()  # Format: HH:MM:SS
                        }
                        visits.append(visit)
            
            # Get total time from footer if available
            total_time = None
            tfoot = visit_table.find('tfoot')
            if tfoot:
                total_time_cell = tfoot.find_all('th')
                if len(total_time_cell) >= 5:
                    total_time = total_time_cell[-1].text.strip()
            
            logger.info(f"✓ Extracted {len(visits)} visits for {client['first_name']} {client['last_name']}")
            
            return {
                'client_id': client['id'],
                'cehupo_client_id': cehupo_client_id,
                'visa_number': client['visa_number'],
                'first_name': client['first_name'],
                'last_name': client['last_name'],
                'date_of_birth': client['date_of_birth'],
                'registration_date': client['registration_date'],
                'visits': visits,
                'total_time_spent': total_time,
                'visit_count': len(visits)
            }
            
    except Exception as e:
        logger.error(f"Error extracting visits for {client['first_name']} {client['last_name']}: {e}")
        return {
            'client_id': client['id'],
            'visa_number': client['visa_number'],
            'first_name': client['first_name'],
            'last_name': client['last_name'],
            'visits': [],
            'error': str(e)
        }

async def process_client(session: aiohttp.ClientSession, client: Dict, semaphore: asyncio.Semaphore) -> Dict:
    """Process a single client with rate limiting"""
    async with semaphore:
        try:
            # Step 1: Find client in CeHuPo system
            cehupo_id = await search_client_in_cehupo(session, client)
            
            if not cehupo_id:
                logger.warning(f"⚠️  Client not found in CeHuPo: {client['first_name']} {client['last_name']}")
                return {
                    'client_id': client['id'],
                    'visa_number': client['visa_number'],
                    'first_name': client['first_name'],
                    'last_name': client['last_name'],
                    'visits': [],
                    'error': 'Not found in CeHuPo system'
                }
            
            # Step 2: Extract all visits for this client
            client_data = await get_client_visits(session, cehupo_id, client)
            
            # Rate limiting delay
            await asyncio.sleep(REQUEST_DELAY)
            
            return client_data
            
        except Exception as e:
            logger.error(f"Error processing client {client['first_name']} {client['last_name']}: {e}")
            return {
                'client_id': client['id'],
                'visa_number': client['visa_number'],
                'first_name': client['first_name'],
                'last_name': client['last_name'],
                'visits': [],
                'error': str(e)
            }

# =================================================================================
# MAIN EXTRACTION FUNCTION
# =================================================================================

async def extract_all_visits():
    """Main extraction function - extracts all visits for all clients"""
    
    logger.info("=" * 80)
    logger.info("COMPLETE VISIT DATA EXTRACTION - CeHuPo Portal")
    logger.info("=" * 80)
    logger.info(f"Date range: {START_DATE} to {END_DATE}")
    logger.info(f"Max concurrent requests: {MAX_CONCURRENT_REQUESTS}")
    logger.info("")
    
    # Step 1: Get all clients from database
    logger.info("📊 Step 1: Loading clients from database...")
    clients = get_all_clients_from_db()
    
    if not clients:
        logger.error("No clients found in database!")
        return
    
    logger.info(f"✓ Loaded {len(clients)} clients")
    logger.info("")
    
    # Step 2: Setup async session and login
    logger.info("🔐 Step 2: Logging in to CeHuPo portal...")
    
    # Configure session with cookies enabled
    connector = aiohttp.TCPConnector(limit=MAX_CONCURRENT_REQUESTS)
    timeout = aiohttp.ClientTimeout(total=60)
    
    async with aiohttp.ClientSession(
        connector=connector,
        timeout=timeout,
        cookie_jar=aiohttp.CookieJar()
    ) as session:
        
        # Login
        if not await login_to_cehupo(session):
            logger.error("Failed to login. Please check credentials!")
            return
        
        logger.info("")
        
        # Step 3: Extract visits for all clients (async)
        logger.info("🚀 Step 3: Extracting visit data (async)...")
        logger.info("")
        
        start_time = time.time()
        
        # Create semaphore for rate limiting
        semaphore = asyncio.Semaphore(MAX_CONCURRENT_REQUESTS)
        
        # Process all clients concurrently
        tasks = [process_client(session, client, semaphore) for client in clients]
        
        # Execute with progress tracking
        all_client_data = []
        completed = 0
        
        for coro in asyncio.as_completed(tasks):
            result = await coro
            all_client_data.append(result)
            completed += 1
            
            if completed % 50 == 0:
                elapsed = time.time() - start_time
                rate = completed / elapsed if elapsed > 0 else 0
                remaining = len(clients) - completed
                eta = remaining / rate if rate > 0 else 0
                
                logger.info(f"Progress: {completed}/{len(clients)} clients ({completed/len(clients)*100:.1f}%) - "
                          f"Rate: {rate:.1f} clients/sec - ETA: {eta/60:.1f} min")
        
        elapsed_time = time.time() - start_time
        
        logger.info("")
        logger.info("✅ Extraction complete!")
        logger.info(f"   Total time: {elapsed_time/60:.1f} minutes")
        logger.info(f"   Clients processed: {len(all_client_data)}")
        
        # Calculate statistics
        total_visits = sum(len(c['visits']) for c in all_client_data)
        clients_with_visits = sum(1 for c in all_client_data if len(c['visits']) > 0)
        clients_with_errors = sum(1 for c in all_client_data if 'error' in c)
        
        logger.info(f"   Total visits extracted: {total_visits}")
        logger.info(f"   Clients with visits: {clients_with_visits}")
        logger.info(f"   Clients with errors: {clients_with_errors}")
        logger.info("")
        
        # Step 4: Save to JSON file
        logger.info("💾 Step 4: Saving to JSON file...")
        
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        output_file = f"complete_visits_extraction_{timestamp}.json"
        
        output_data = {
            'extraction_date': datetime.now().isoformat(),
            'date_range': {
                'start': START_DATE,
                'end': END_DATE
            },
            'statistics': {
                'total_clients': len(all_client_data),
                'clients_with_visits': clients_with_visits,
                'clients_with_errors': clients_with_errors,
                'total_visits': total_visits,
                'extraction_time_seconds': elapsed_time
            },
            'clients': all_client_data
        }
        
        with open(output_file, 'w', encoding='utf-8') as f:
            json.dump(output_data, f, ensure_ascii=False, indent=2)
        
        logger.info(f"✓ Data saved to: {output_file}")
        logger.info(f"   File size: {os.path.getsize(output_file) / 1024 / 1024:.2f} MB")
        logger.info("")
        
        # Print summary by category
        logger.info("📈 Summary:")
        logger.info(f"   Avg visits per client: {total_visits/len(clients):.1f}")
        logger.info(f"   Max visits per client: {max(len(c['visits']) for c in all_client_data)}")
        logger.info(f"   Processing rate: {len(clients)/elapsed_time*60:.1f} clients/minute")
        logger.info("")
        logger.info("=" * 80)
        logger.info("NEXT STEP: Run import script to load data into database")
        logger.info(f"Command: node import-visits-from-json.js {output_file}")
        logger.info("=" * 80)
        
        return output_file

# =================================================================================
# ENTRY POINT
# =================================================================================

import os

if __name__ == "__main__":
    # Validate configuration
    if CEHUPO_USERNAME == "YOUR_USERNAME" or CEHUPO_PASSWORD == "YOUR_PASSWORD":
        print("")
        print("=" * 80)
        print("⚠️  ERROR: Please update the configuration!")
        print("=" * 80)
        print("")
        print("You need to update these variables in the script:")
        print("")
        print("  CEHUPO_USERNAME = 'your_actual_username'")
        print("  CEHUPO_PASSWORD = 'your_actual_password'")
        print("")
        print("Also check DB_CONFIG if your database password is different.")
        print("")
        print("=" * 80)
        exit(1)
    
    # Confirmation prompt
    print("")
    print("=" * 80)
    print("COMPLETE VISIT DATA EXTRACTION")
    print("=" * 80)
    print("")
    print(f"This script will extract ALL visit data for ALL {get_all_clients_from_db().__len__()} clients")
    print(f"Date range: {START_DATE} to {END_DATE}")
    print(f"Estimated time: 20-40 minutes")
    print("")
    print("⚠️  WARNING: This will make thousands of HTTP requests to the CeHuPo portal.")
    print("   Please ensure you have permission to access this data.")
    print("")
    
    # Auto-confirm when running in automated mode
    print("Auto-confirming: yes")
    print("")
    
    print("")
    print("🚀 Starting extraction...")
    print("")
    
    # Run async extraction
    asyncio.run(extract_all_visits())

