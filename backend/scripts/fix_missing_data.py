#!/usr/bin/env python3
"""
Simple Sequential Data Fixer - Reliable extraction with proper session handling
This version uses sequential requests to avoid session issues
"""

import requests
from bs4 import BeautifulSoup
import json
import logging
from datetime import datetime
import time
import psycopg2
import re
from typing import Dict, List, Optional

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('fix_missing_data.log'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

# Configuration
CUSTOMER_BASE_URL = 'https://customer.cehupo.cz'
CUSTOMER_LOGIN_URL = 'https://customer.cehupo.cz/user/auth'
USERNAME = 'DavidNovak'
PASSWORD = 'Supr414nd!'

# Database config
DB_CONFIG = {
    'host': 'localhost',
    'port': 5432,
    'database': 'centralnimozek_cehupo',
    'user': 'postgres',
    'password': 'IDvEg1WH40wVn7aa8MT9haYsbtRhF1PC'
}


class SimpleDetailExtractor:
    """Simple sequential extractor with reliable session handling"""
    
    def __init__(self):
        self.session = requests.Session()
        self.session.headers.update({
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        })
        self.logged_in = False
        self.extracted = []
        self.failed = []
        
    def login(self) -> bool:
        """Login to portal"""
        try:
            logger.info(f"🔐 Logging in as {USERNAME}...")
            
            login_data = {
                'action': 'auth',
                'username': USERNAME,
                'password': PASSWORD
            }
            
            response = self.session.post(CUSTOMER_LOGIN_URL, data=login_data)
            
            if response.status_code == 200 and 'error' not in response.url:
                self.logged_in = True
                logger.info("✅ Login successful!")
                return True
            else:
                logger.error("❌ Login failed!")
                return False
                
        except Exception as e:
            logger.error(f"❌ Login error: {e}")
            return False
    
    def extract_field(self, text: str, field_name: str) -> str:
        """Extract field value from text"""
        try:
            pattern = f"{field_name}\\s*([^\\n]*)"
            match = re.search(pattern, text)
            if match:
                return match.group(1).strip()
        except:
            pass
        return ''
    
    def extract_client_detail(self, client: Dict) -> Optional[Dict]:
        """Extract details for one client"""
        try:
            client_id = client.get('customer_id') or client.get('id')
            
            # Get detail page
            url = f"{CUSTOMER_BASE_URL}/customer/viewcustomer/{client_id}"
            response = self.session.get(url)
            
            if response.status_code != 200:
                logger.error(f"❌ HTTP {response.status_code} for client {client_id}")
                return None
            
            html = response.text
            
            # Check if we got login page
            if 'Signin' in html or len(html) < 2000:
                logger.warning(f"⚠️  Got login page, re-logging in...")
                if self.login():
                    # Retry
                    response = self.session.get(url)
                    html = response.text
                    
                    if 'Signin' in html:
                        logger.error(f"❌ Still getting login page for client {client_id}")
                        return None
                else:
                    return None
            
            soup = BeautifulSoup(html, 'html.parser')
            
            # Extract details
            details = {
                'customer_id': client_id,
                'full_name': client.get('full_name', ''),
                'email': '',
                'phone_cz': '',
                'phone_ua': '',
                'street': '',
                'city_full': ''
            }
            
            # Method 1: Extract from display sections
            info_sections = soup.find_all('div', class_='invoice-col')
            
            for section in info_sections:
                text = section.get_text()
                
                # Contact info section
                if 'Город' in text and 'Улица' in text:
                    details['city_full'] = self.extract_field(text, 'Город:')
                    details['street'] = self.extract_field(text, 'Улица:')
                    details['phone_cz'] = self.extract_field(text, 'Телефон CZ:')
                    details['phone_ua'] = self.extract_field(text, 'Телефон UA:')
                    details['email'] = self.extract_field(text, 'Email:')
            
            # Method 2: Extract from form fields (fallback)
            if not details['email']:
                email_field = soup.find(['input', 'textarea'], {'name': 'email'})
                if email_field:
                    details['email'] = email_field.get('value', '') or email_field.text.strip()
            
            if not details['phone_cz']:
                phone_field = soup.find(['input', 'textarea'], {'name': 'phone_cz'})
                if phone_field:
                    details['phone_cz'] = phone_field.get('value', '') or phone_field.text.strip()
            
            if not details['phone_ua']:
                phone_field = soup.find(['input', 'textarea'], {'name': 'phone_ua'})
                if phone_field:
                    details['phone_ua'] = phone_field.get('value', '') or phone_field.text.strip()
            
            return details
            
        except Exception as e:
            logger.error(f"❌ Error extracting client {client_id}: {e}")
            return None
    
    def extract_all(self, clients: List[Dict], limit: int = None):
        """Extract all client details"""
        total = len(clients) if not limit else min(limit, len(clients))
        logger.info(f"📝 Extracting details for {total} clients...")
        
        for i, client in enumerate(clients[:total], 1):
            logger.info(f"\n[{i}/{total}] Processing: {client.get('full_name')}")
            
            details = self.extract_client_detail(client)
            
            if details:
                has_contact = details['email'] or details['phone_cz'] or details['phone_ua']
                if has_contact:
                    logger.info(f"  ✅ Email: {bool(details['email'])}, Phone: {bool(details['phone_cz'])}")
                    self.extracted.append(details)
                else:
                    logger.warning(f"  ⚠️  No contact info found")
                    self.extracted.append(details)  # Still save it
            else:
                logger.error(f"  ❌ Failed to extract")
                self.failed.append(client)
            
            # Small delay to be respectful
            time.sleep(0.3)
            
            # Progress update every 50 clients
            if i % 50 == 0:
                logger.info(f"\n📊 Progress: {i}/{total} - Extracted: {len(self.extracted)}, Failed: {len(self.failed)}")
        
        logger.info(f"\n✅ Extraction complete!")
        logger.info(f"   Succeeded: {len(self.extracted)}/{total}")
        logger.info(f"   Failed: {len(self.failed)}/{total}")


def update_database(details: List[Dict]):
    """Update database with extracted details"""
    logger.info(f"\n💾 Updating database...")
    
    conn = psycopg2.connect(**DB_CONFIG)
    cursor = conn.cursor()
    
    updated = 0
    
    for detail in details:
        try:
            # Update by matching name
            names = detail['full_name'].split()
            if len(names) >= 2:
                first_name = names[0]
                last_name = ' '.join(names[1:])
                
                cursor.execute("""
                    UPDATE clients SET
                        email = COALESCE(NULLIF(%s, ''), email),
                        czech_phone = COALESCE(NULLIF(%s, ''), czech_phone),
                        ukrainian_phone = COALESCE(NULLIF(%s, ''), ukrainian_phone),
                        czech_address = COALESCE(NULLIF(%s, ''), czech_address),
                        updated_at = CURRENT_TIMESTAMP
                    WHERE first_name = %s AND last_name = %s
                """, (
                    detail['email'],
                    detail['phone_cz'],
                    detail['phone_ua'],
                    detail['street'],
                    first_name,
                    last_name
                ))
                
                if cursor.rowcount > 0:
                    updated += cursor.rowcount
                    
        except Exception as e:
            logger.error(f"❌ Error updating {detail['full_name']}: {e}")
            continue
    
    conn.commit()
    cursor.close()
    conn.close()
    
    logger.info(f"✅ Updated {updated} clients in database")


def main():
    """Main execution"""
    print("=" * 70)
    print("  SIMPLE DETAIL EXTRACTOR - Reliable Sequential Extraction")
    print("=" * 70)
    
    # Load clients
    logger.info("\n📂 Loading client list...")
    with open('customer_data_20251108_230656.json', 'r') as f:
        data = json.load(f)
    
    clients = data['clients']
    logger.info(f"✅ Loaded {len(clients)} clients")
    
    # Create extractor
    extractor = SimpleDetailExtractor()
    
    # Login
    if not extractor.login():
        logger.error("❌ Login failed, aborting")
        return
    
    # Ask user
    print(f"\nReady to extract details for {len(clients)} clients")
    print(f"Estimated time: ~{len(clients) * 0.5 / 60:.0f} minutes")
    
    response = input("\nStart extraction? (yes/no): ")
    if response.lower() != 'yes':
        print("Aborted by user")
        return
    
    # Extract
    start_time = time.time()
    extractor.extract_all(clients)
    elapsed = time.time() - start_time
    
    # Save results
    output_file = f"extracted_details_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(extractor.extracted, f, indent=2, ensure_ascii=False)
    
    logger.info(f"\n📄 Saved to: {output_file}")
    
    # Update database
    if extractor.extracted:
        update_database(extractor.extracted)
    
    # Stats
    print("\n" + "=" * 70)
    print("  COMPLETE!")
    print("=" * 70)
    print(f"  Total time: {elapsed/60:.1f} minutes")
    print(f"  Extracted: {len(extractor.extracted)}")
    print(f"  Failed: {len(extractor.failed)}")
    print("=" * 70)


if __name__ == '__main__':
    main()
