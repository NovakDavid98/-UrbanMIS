#!/usr/bin/env python3
"""
FULL CLIENT DATA EXTRACTION AND UPDATE

This script extracts ALL fields from CeHuPo client detail pages and updates
our database with the complete information.

It will process:
1. All 240 newly imported clients (that have cehupo_id but missing data)
2. Optionally, all other clients with cehupo_id to fill in missing fields

Usage:
    python3 extract_full_client_data.py
"""

import asyncio
import httpx
from bs4 import BeautifulSoup
import psycopg2
from psycopg2.extras import RealDictCursor
from datetime import datetime
import re
from typing import Dict, Optional

# Database config
DB_CONFIG = {
    'dbname': 'centralnimozek_cehupo',
    'user': 'postgres',
    'password': 'IDvEg1WH40wVn7aa8MT9haYsbtRhF1PC',
    'host': 'localhost',
    'port': '5432'
}

# CeHuPo Portal
BASE_URL = "https://customer.cehupo.cz"
LOGIN_URL = f"{BASE_URL}/user/authenticate"
CEHUPO_USERNAME = "DavidNovak"
CEHUPO_PASSWORD = "Supr414nd!"

def parse_date(date_str: str) -> Optional[str]:
    """Parse date from DD/MM/YYYY to YYYY-MM-DD"""
    if not date_str or date_str.strip() == '':
        return None
    try:
        parts = date_str.strip().split('/')
        if len(parts) == 3:
            day, month, year = parts
            return f"{year}-{month.zfill(2)}-{day.zfill(2)}"
    except:
        pass
    return None

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
        return response.status_code == 200
    except Exception as e:
        print(f"❌ Login failed: {e}")
        return False

async def extract_full_client_data(client: httpx.AsyncClient, cehupo_id: int) -> Dict:
    """Extract ALL fields from CeHuPo client detail page"""
    try:
        url = f"{BASE_URL}/customer/viewcustomer/{cehupo_id}"
        response = await client.get(url)
        
        if response.status_code != 200:
            return {'error': f'HTTP {response.status_code}'}
        
        soup = BeautifulSoup(response.text, 'html.parser')
        data = {'cehupo_id': cehupo_id}
        
        # Extract all input fields by name attribute
        for input_field in soup.find_all(['input', 'textarea', 'select']):
            name = input_field.get('name', '')
            
            if input_field.name == 'textarea':
                value = input_field.get_text(strip=True)
            else:
                value = input_field.get('value', '')
            
            if not name or not value:
                continue
            
            # Map field names to our database columns
            field_mapping = {
                'surname': 'last_name',
                'firstname': 'first_name',
                'birthday': 'date_of_birth',
                'visa': 'visa_number',
                'visa_type': 'visa_type',
                'arrival_date': 'date_of_arrival_czech',
                'registration_date': 'project_registration_date',
                'city_cz': 'czech_city',
                'address_cz': 'czech_address',
                'street_cz': 'czech_address',
                'region_ua': 'ukrainian_region',
                'phone_cz': 'czech_phone',
                'phone_ua': 'ukrainian_phone',
                'email': 'email',
                'education': 'education',
                'profession': 'profession_in_ukraine',
                'hobby': 'hobbies',
                'help_needed': 'assistance_needed',
                'volunteer_notes': 'notes_for_volunteers',
                'comment': 'internal_notes'
            }
            
            for cehupo_name, db_name in field_mapping.items():
                if cehupo_name in name.lower():
                    # Parse dates
                    if 'date' in cehupo_name or 'birthday' in cehupo_name:
                        value = parse_date(value)
                    data[db_name] = value
                    break
        
        # Extract checkboxes (has_work, needs_help, wants_volunteer, etc.)
        for checkbox in soup.find_all('input', {'type': 'checkbox'}):
            name = checkbox.get('name', '')
            is_checked = checkbox.has_attr('checked')
            
            if 'work' in name.lower() and 'czech' in name.lower():
                data['has_work_in_czech'] = is_checked
            elif 'help' in name.lower() and 'work' in name.lower():
                data['needs_work_assistance'] = is_checked
            elif 'volunteer' in name.lower():
                data['wants_to_volunteer'] = is_checked
            elif 'housing' in name.lower() or 'free' in name.lower():
                data['receives_free_housing'] = is_checked
        
        # Extract gender from select/radio
        gender_field = soup.find('select', {'name': re.compile('gender|sex|pol', re.I)})
        if gender_field:
            selected = gender_field.find('option', {'selected': True})
            if selected:
                gender_value = selected.get_text(strip=True).lower()
                if 'жен' in gender_value or 'female' in gender_value or 'žena' in gender_value:
                    data['gender'] = 'female'
                elif 'муж' in gender_value or 'male' in gender_value or 'muž' in gender_value:
                    data['gender'] = 'male'
        
        # Extract insurance type (VZP, OZP, etc.)
        insurance_radios = soup.find_all('input', {'type': 'radio', 'name': re.compile('insurance|pojistovna', re.I)})
        for radio in insurance_radios:
            if radio.has_attr('checked'):
                insurance_value = radio.get('value', '')
                if insurance_value:
                    data['insurance_company'] = insurance_value
        
        return data
        
    except Exception as e:
        return {'error': str(e)}

def update_client_in_db(client_id: str, data: Dict) -> bool:
    """Update client record with extracted data"""
    conn = psycopg2.connect(**DB_CONFIG)
    try:
        # Build UPDATE query dynamically based on available data
        update_fields = []
        values = []
        
        field_mapping = {
            'email': 'email',
            'date_of_arrival_czech': 'date_of_arrival_czech',
            'project_registration_date': 'project_registration_date',
            'czech_city': 'czech_city',
            'czech_address': 'home_address',  # Map to existing column
            'ukrainian_region': 'ukrainian_region',
            'education': 'education',
            'profession_in_ukraine': 'profession_in_ukraine',
            'hobbies': 'hobbies',
            'assistance_needed': 'assistance_needed',
            'notes_for_volunteers': 'notes_for_volunteers',
            'internal_notes': 'internal_notes',
            'has_work_in_czech': 'has_work_in_czech',
            'needs_work_assistance': 'needs_work_assistance',
            'wants_to_volunteer': 'wants_to_volunteer',
            'receives_free_housing': 'receives_free_housing',
            'insurance_company': 'insurance_company'
        }
        
        for data_key, db_column in field_mapping.items():
            if data_key in data and data[data_key]:
                update_fields.append(f"{db_column} = %s")
                values.append(data[data_key])
        
        if not update_fields:
            return False
        
        values.append(client_id)
        query = f"UPDATE clients SET {', '.join(update_fields)} WHERE id = %s"
        
        with conn.cursor() as cur:
            cur.execute(query, values)
        
        conn.commit()
        return True
        
    except Exception as e:
        print(f"   ❌ Database error: {e}")
        conn.rollback()
        return False
    finally:
        conn.close()

async def process_all_clients():
    """Main function to process all clients needing data updates"""
    
    print("=" * 80)
    print("🔄 FULL CLIENT DATA EXTRACTION AND UPDATE")
    print("=" * 80)
    print()
    
    # Get all clients with cehupo_id but missing critical data
    conn = psycopg2.connect(**DB_CONFIG)
    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            # Find clients missing at least one of the key fields
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
            """)
            clients = cur.fetchall()
    finally:
        conn.close()
    
    print(f"📊 Found {len(clients)} clients needing data updates")
    print(f"   (clients with cehupo_id but missing email/dates/etc.)")
    print()
    
    if len(clients) == 0:
        print("✅ No clients need updating!")
        return
    
    # Confirm with user
    print(f"⚠️  About to update {len(clients)} client records")
    print(f"   This will take approximately {len(clients) * 2} seconds")
    print()
    
    # Login to CeHuPo
    print("🔐 Logging in to CeHuPo portal...")
    async with httpx.AsyncClient(timeout=30.0, follow_redirects=True) as http_client:
        if not await login_to_cehupo(http_client):
            print("❌ Failed to login!")
            return
        print("✅ Logged in successfully")
        print()
        
        # Process each client
        print("=" * 80)
        print("📥 EXTRACTING AND UPDATING CLIENT DATA")
        print("=" * 80)
        print()
        
        updated_count = 0
        error_count = 0
        
        for i, client in enumerate(clients, 1):
            cehupo_id = client['cehupo_id']
            name = f"{client['first_name']} {client['last_name']}"
            
            print(f"[{i}/{len(clients)}] Processing {name} (CeHuPo ID: {cehupo_id})...")
            
            # Extract data
            data = await extract_full_client_data(http_client, cehupo_id)
            
            if 'error' in data:
                print(f"   ❌ Extraction failed: {data['error']}")
                error_count += 1
                continue
            
            # Update database
            if update_client_in_db(str(client['id']), data):
                fields_updated = len([k for k in data.keys() if k != 'cehupo_id' and k != 'error'])
                print(f"   ✅ Updated {fields_updated} field(s)")
                updated_count += 1
            else:
                print(f"   ⚠️  No fields to update")
            
            # Rate limiting
            await asyncio.sleep(1)
            
            # Progress update every 50 clients
            if i % 50 == 0:
                print(f"\n... Progress: {i}/{len(clients)} ({updated_count} updated, {error_count} errors) ...\n")
    
    # Final summary
    print()
    print("=" * 80)
    print("🎉 EXTRACTION AND UPDATE COMPLETE!")
    print("=" * 80)
    print(f"✅ Successfully updated: {updated_count}")
    print(f"❌ Errors: {error_count}")
    print(f"📊 Total processed: {len(clients)}")
    print("=" * 80)
    
    # Save report
    report = {
        'timestamp': datetime.now().isoformat(),
        'total_clients': len(clients),
        'updated': updated_count,
        'errors': error_count
    }
    
    import json
    report_file = f"full_data_update_report_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
    with open(report_file, 'w', encoding='utf-8') as f:
        json.dump(report, f, indent=2)
    
    print(f"\n💾 Report saved to: {report_file}\n")

if __name__ == '__main__':
    print("\n🚀 Starting Full Client Data Extraction\n")
    asyncio.run(process_all_clients())
    print("\n✅ Complete!\n")

