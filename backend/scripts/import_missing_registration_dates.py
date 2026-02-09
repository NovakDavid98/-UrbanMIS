#!/usr/bin/env python3
"""
Script to import missing project_registration_date from CeHuPo portal
for clients that don't have this date set.
"""

import asyncio
import aiohttp
import psycopg2
from bs4 import BeautifulSoup
from datetime import datetime
import time

# CeHuPo credentials
CEHUPO_USERNAME = "DavidNovak"
CEHUPO_PASSWORD = "Supr414nd!"
CEHUPO_BASE_URL = "https://customer.cehupo.cz"

# Database configuration
DB_CONFIG = {
    'dbname': 'centralnimozek_cehupo',
    'user': 'postgres',
    'password': 'IDvEg1WH40wVn7aa8MT9haYsbtRhF1PC',
    'host': 'localhost',
    'port': 5432
}

async def login_to_cehupo(session):
    """Login to CeHuPo portal and return authenticated session"""
    print("🔐 Logging into CeHuPo portal...")
    
    try:
        login_data = {
            'username': CEHUPO_USERNAME,
            'password': CEHUPO_PASSWORD,
            'action': 'auth'  # CRITICAL: This was in the working script!
        }
        
        async with session.post(
            f"{CEHUPO_BASE_URL}/user/authenticate",
            data=login_data,
            allow_redirects=True
        ) as response:
            text = await response.text()
            url_str = str(response.url)
            
            # Check if login was successful
            if ('home' in url_str.lower() or 
                'customer' in url_str.lower() or
                'davidnovak' in text.lower() or
                'odhlásit' in text):  # "logout" in Czech
                print("✅ Login successful!")
                print(f"   Current URL: {response.url}")
                return True
            else:
                print("❌ Login failed!")
                print(f"   Response URL: {response.url}")
                print(f"   Status: {response.status}")
                return False
    except Exception as e:
        print(f"❌ Login error: {e}")
        return False

async def extract_registration_date(session, cehupo_id):
    """Extract registration date from CeHuPo for a specific client"""
    try:
        url = f"{CEHUPO_BASE_URL}/customer/viewcustomer/{cehupo_id}"
        async with session.get(url, allow_redirects=True) as response:
            if response.status != 200:
                return None
            
            text = await response.text()
        
        soup = BeautifulSoup(text, 'html.parser')
        
        # Look for the input field with name="is_create" (Дата регистрации = registration date)
        is_create_field = soup.find('input', {'name': 'is_create'})
        if is_create_field and is_create_field.get('value'):
            date_str = is_create_field.get('value').strip()
            if date_str:
                try:
                    # The format is YYYY-MM-DD (ISO format from HTML date input)
                    date_obj = datetime.strptime(date_str, '%Y-%m-%d')
                    return date_obj.date()
                except Exception as e:
                    pass
        
        return None
        
    except Exception as e:
        # print(f"⚠️  Error extracting date for cehupo_id {cehupo_id}: {e}")
        return None

async def process_batch(clients_batch, session):
    """Process a batch of clients"""
    results = []
    
    for client_data in clients_batch:
        client_id, cehupo_id, first_name, last_name = client_data
        
        if not cehupo_id:
            results.append({
                'client_id': client_id,
                'name': f"{first_name} {last_name}",
                'status': 'no_cehupo_id',
                'date': None
            })
            continue
        
        # Extract registration date
        reg_date = await extract_registration_date(session, cehupo_id)
        
        if reg_date:
            results.append({
                'client_id': client_id,
                'name': f"{first_name} {last_name}",
                'cehupo_id': cehupo_id,
                'status': 'success',
                'date': reg_date
            })
        else:
            results.append({
                'client_id': client_id,
                'name': f"{first_name} {last_name}",
                'cehupo_id': cehupo_id,
                'status': 'not_found',
                'date': None
            })
        
        # Small delay to avoid overwhelming the server
        await asyncio.sleep(0.1)
    
    return results

async def extract_all_dates():
    """Extract all missing registration dates from CeHuPo"""
    
    # Get clients without registration date
    print("📋 Fetching clients without registration date from database...")
    conn = psycopg2.connect(**DB_CONFIG)
    cursor = conn.cursor()
    
    cursor.execute("""
        SELECT id, cehupo_id, first_name, last_name
        FROM clients
        WHERE project_registration_date IS NULL
        ORDER BY created_at DESC
    """)
    
    clients = cursor.fetchall()
    cursor.close()
    conn.close()
    
    print(f"✅ Found {len(clients)} clients without registration date")
    print()
    
    if len(clients) == 0:
        print("No clients to process!")
        return
    
    # Ask for confirmation
    print(f"⚠️  This will extract registration dates for {len(clients)} clients")
    print(f"   Estimated time: ~{len(clients) * 0.15 / 60:.1f} minutes")
    
    # Create HTTP session with extended timeout
    timeout = aiohttp.ClientTimeout(total=30.0, connect=10.0)
    async with aiohttp.ClientSession(timeout=timeout) as session:
        # Login
        if not await login_to_cehupo(session):
            print("❌ Failed to login. Exiting.")
            return
        
        print()
        print("🔄 Starting extraction...")
        print("=" * 80)
        
        # Process in batches of 50
        batch_size = 50
        all_results = []
        
        # Open database connection for incremental updates
        conn = psycopg2.connect(**DB_CONFIG)
        cursor = conn.cursor()
        
        total_updated = 0
        
        for i in range(0, len(clients), batch_size):
            batch = clients[i:i+batch_size]
            batch_num = i // batch_size + 1
            total_batches = (len(clients) + batch_size - 1) // batch_size
            
            print(f"\n📦 Processing batch {batch_num}/{total_batches} ({len(batch)} clients)...")
            
            batch_results = await process_batch(batch, session)
            all_results.extend(batch_results)
            
            # Save successful results immediately after each batch
            success_results = [r for r in batch_results if r['status'] == 'success']
            for result in success_results:
                try:
                    cursor.execute("""
                        UPDATE clients
                        SET project_registration_date = %s
                        WHERE id = %s
                    """, (result['date'], result['client_id']))
                    total_updated += 1
                except Exception as e:
                    print(f"⚠️  Error updating {result['name']}: {e}")
            
            # Commit after each batch
            conn.commit()
            
            # Show progress
            success_count = len(success_results)
            print(f"   ✅ {success_count}/{len(batch)} dates extracted and saved")
        
        cursor.close()
        conn.close()
    
    # Summary
    print()
    print("=" * 80)
    print("📊 EXTRACTION SUMMARY")
    print("=" * 80)
    
    success_results = [r for r in all_results if r['status'] == 'success']
    no_cehupo_id = [r for r in all_results if r['status'] == 'no_cehupo_id']
    not_found = [r for r in all_results if r['status'] == 'not_found']
    
    print(f"✅ Successfully extracted: {len(success_results)}")
    print(f"⚠️  No CeHuPo ID:         {len(no_cehupo_id)}")
    print(f"❌ Not found in portal:   {len(not_found)}")
    print(f"📊 Total:                 {len(all_results)}")
    print()
    
    # Database was updated incrementally during processing
    success_results_total = [r for r in all_results if r['status'] == 'success']
    if success_results_total:
        print(f"✅ Total {len(success_results_total)} clients updated in database")
    
    print()
    print("=" * 80)
    print("✅ DONE!")
    print("=" * 80)
    
    # Show some sample successful updates
    if success_results_total:
        print("\n📋 Sample of updated dates (first 10):")
        for result in success_results_total[:10]:
            print(f"   {result['name']}: {result['date']}")

if __name__ == "__main__":
    print()
    print("=" * 80)
    print("🔄 IMPORT MISSING REGISTRATION DATES FROM CEHUPO")
    print("=" * 80)
    print()
    
    asyncio.run(extract_all_dates())

