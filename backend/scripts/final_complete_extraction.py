#!/usr/bin/env python3
"""
FINAL COMPLETE EXTRACTION - With ALL correct field names
Extracts EVERYTHING from the customer portal including phones!
"""

import requests
from bs4 import BeautifulSoup
import json
import logging
import psycopg2
from datetime import datetime
import time
from typing import Dict, Optional, List

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('final_complete_extraction.log'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

# Configuration
CUSTOMER_BASE_URL = 'https://customer.cehupo.cz'
CUSTOMER_LOGIN_URL = 'https://customer.cehupo.cz/user/authenticate'
USERNAME = 'DavidNovak'
PASSWORD = 'Supr414nd!'

DB_CONFIG = {
    'host': 'localhost',
    'port': 5432,
    'database': 'centralnimozek_cehupo',
    'user': 'postgres',
    'password': 'IDvEg1WH40wVn7aa8MT9haYsbtRhF1PC'
}

class FinalExtractor:
    """Extract with CORRECT field names"""
    
    def __init__(self):
        self.session = requests.Session()
        self.session.headers.update({
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        })
        self.extracted = []
        self.stats = {'total': 0, 'extracted': 0, 'failed': 0}
        
    def login(self) -> bool:
        try:
            logger.info(f"🔐 Logging in as {USERNAME}...")
            login_data = {'action': 'auth', 'username': USERNAME, 'password': PASSWORD}
            response = self.session.post(CUSTOMER_LOGIN_URL, data=login_data)
            
            if response.status_code == 200 and 'error' not in response.url:
                logger.info("✅ Login successful!")
                return True
            logger.error("❌ Login failed!")
            return False
        except Exception as e:
            logger.error(f"❌ Login error: {e}")
            return False
    
    def extract_field_value(self, soup: BeautifulSoup, field_name: str, field_type='input') -> str:
        """Extract value from any field type"""
        try:
            if field_type == 'select':
                element = soup.find('select', {'name': field_name})
                if element:
                    selected = element.find('option', {'selected': True})
                    return selected.text.strip() if selected else ''
            else:
                element = soup.find(['input', 'textarea'], {'name': field_name})
                if element:
                    if element.name == 'input':
                        if element.get('type') == 'checkbox':
                            return '1' if element.get('checked') else '0'
                        return element.get('value', '')
                    elif element.name == 'textarea':
                        return element.text.strip()
        except:
            pass
        return ''
    
    def extract_client_detail(self, client: Dict) -> Optional[Dict]:
        try:
            client_id = client.get('customer_id') or client.get('id')
            self.stats['total'] += 1
            
            url = f"{CUSTOMER_BASE_URL}/customer/viewcustomer/{client_id}"
            response = self.session.get(url)
            
            if response.status_code != 200 or 'Signin' in response.text:
                logger.error(f"❌ Failed to get client {client_id}")
                self.stats['failed'] += 1
                return None
            
            soup = BeautifulSoup(response.text, 'html.parser')
            
            # Extract ALL fields with CORRECT names
            details = {
                'customer_id': client_id,
                'full_name': client.get('full_name', ''),
                
                # CORRECT phone field names!
                'tel_cz': self.extract_field_value(soup, 'tel_cz'),
                'tel_ua': self.extract_field_value(soup, 'tel_ua'),
                
                # Contact info
                'email': self.extract_field_value(soup, 'email'),
                'street': self.extract_field_value(soup, 'street'),
                
                # Dropdowns
                'city': self.extract_field_value(soup, 'city', 'select'),
                'gender': self.extract_field_value(soup, 'gender', 'select'),
                'education': self.extract_field_value(soup, 'education', 'select'),
                'kinship': self.extract_field_value(soup, 'kinship', 'select'),
                
                # Text fields
                'first_name': self.extract_field_value(soup, 'first_name'),
                'last_name': self.extract_field_value(soup, 'last_name'),
                'date_of_birth': self.extract_field_value(soup, 'date_of_birth'),
                'visa_number': self.extract_field_value(soup, 'visa_number'),
                'visa_type': self.extract_field_value(soup, 'visa_type'),
                'date_of_visa': self.extract_field_value(soup, 'date_of_visa'),
                'city_of_origin': self.extract_field_value(soup, 'city_of_origin'),
                'profession': self.extract_field_value(soup, 'profession'),
                'hobbies': self.extract_field_value(soup, 'hobbies'),
                'is_create': self.extract_field_value(soup, 'is_create'),
                'sub_id': self.extract_field_value(soup, 'sub_id', 'select'),
                
                # Textareas
                'note': self.extract_field_value(soup, 'note', 'input'),
                'note_volunteer': self.extract_field_value(soup, 'note_volunteer'),
                'text_help': self.extract_field_value(soup, 'text_help', 'input'),
                'volunteer_text': self.extract_field_value(soup, 'volunteer_text'),
                
                # Checkboxes
                'in_ua': self.extract_field_value(soup, 'in_ua'),
                'free_housing': self.extract_field_value(soup, 'free_housing'),
                'job': self.extract_field_value(soup, 'job'),
                'search_job': self.extract_field_value(soup, 'search_job'),
                'volunteer': self.extract_field_value(soup, 'volunteer'),
                
                # Radio (insurance)
                'insurance': ''
            }
            
            # Get insurance (radio button)
            insurance_checked = soup.find('input', {'name': 'insurance', 'checked': True})
            if insurance_checked:
                details['insurance'] = insurance_checked.get('value', '')
            
            self.stats['extracted'] += 1
            
            if self.stats['extracted'] % 100 == 0:
                logger.info(f"Progress: {self.stats['extracted']}/{self.stats['total']}")
            
            return details
            
        except Exception as e:
            logger.error(f"❌ Error extracting client {client_id}: {e}")
            self.stats['failed'] += 1
            return None
    
    def extract_all(self, clients: List[Dict]):
        logger.info(f"📝 Extracting ALL fields for {len(clients)} clients...")
        
        for client in clients:
            details = self.extract_client_detail(client)
            if details:
                self.extracted.append(details)
            time.sleep(0.3)
        
        logger.info(f"\n✅ Extraction complete!")
        logger.info(f"   Succeeded: {self.stats['extracted']}/{self.stats['total']}")
        logger.info(f"   Failed: {self.stats['failed']}/{self.stats['total']}")


class FinalImporter:
    """Import with correct field mapping"""
    
    def __init__(self):
        self.conn = psycopg2.connect(**DB_CONFIG)
        self.cursor = self.conn.cursor()
        self.stats = {'matched': 0, 'not_matched': 0, 'updated': 0, 'fields_updated': {}}
    
    def find_client(self, portal_data: Dict) -> Optional[str]:
        """Find client in DB"""
        # Try by visa number
        visa = portal_data.get('visa_number', '')
        if visa:
            self.cursor.execute("SELECT id FROM clients WHERE visa_number LIKE %s LIMIT 1", (f"%{visa}%",))
            result = self.cursor.fetchone()
            if result:
                return result[0]
        
        # Try by name
        full_name = portal_data.get('full_name', '')
        if full_name:
            parts = full_name.split()
            if len(parts) >= 2:
                # Try Last First
                last_name = ' '.join(parts[:-1])
                first_name = parts[-1]
                
                self.cursor.execute("""
                    SELECT id FROM clients 
                    WHERE LOWER(first_name) = LOWER(%s) AND LOWER(last_name) = LOWER(%s)
                    LIMIT 1
                """, (first_name, last_name))
                
                result = self.cursor.fetchone()
                if result:
                    return result[0]
                
                # Try First Last
                self.cursor.execute("""
                    SELECT id FROM clients 
                    WHERE LOWER(first_name) = LOWER(%s) AND LOWER(last_name) = LOWER(%s)
                    LIMIT 1
                """, (parts[0], ' '.join(parts[1:])))
                
                result = self.cursor.fetchone()
                if result:
                    return result[0]
        
        return None
    
    def update_client(self, client_id: str, portal_data: Dict):
        """Update only empty fields"""
        # Get current data
        self.cursor.execute("""
            SELECT 
                email, czech_phone, ukrainian_phone, czech_address, czech_city,
                insurance_company, education_level, profession_ukraine, hobbies,
                volunteer_notes, volunteer_skills, help_needed, notes,
                free_housing, has_work_czech, needs_job_help, volunteer_interest,
                home_address, gender, visa_number, visa_type, date_of_birth
            FROM clients WHERE id = %s
        """, (client_id,))
        
        current = self.cursor.fetchone()
        if not current:
            return
        
        # Field mapping - CORRECTED!
        updates = []
        params = []
        
        field_mapping = {
            'email': ('email', 0),
            'tel_cz': ('czech_phone', 1),  # CORRECTED!
            'tel_ua': ('ukrainian_phone', 2),  # CORRECTED!
            'street': ('czech_address', 3),
            'city': ('czech_city', 4),
            'insurance': ('insurance_company', 5),
            'education': ('education_level', 6),
            'profession': ('profession_ukraine', 7),
            'hobbies': ('hobbies', 8),
            'note_volunteer': ('volunteer_notes', 9),
            'volunteer_text': ('volunteer_skills', 10),
            'text_help': ('help_needed', 11),
            'note': ('notes', 12),
            'city_of_origin': ('home_address', 17),
            'gender': ('gender', 18),
            'visa_number': ('visa_number', 19),
            'visa_type': ('visa_type', 20),
            'date_of_birth': ('date_of_birth', 21)
        }
        
        for portal_field, (db_field, idx) in field_mapping.items():
            portal_value = portal_data.get(portal_field, '').strip()
            current_value = current[idx]
            
            if portal_value and (not current_value or str(current_value).strip() == ''):
                updates.append(f"{db_field} = %s")
                params.append(portal_value)
                
                if db_field not in self.stats['fields_updated']:
                    self.stats['fields_updated'][db_field] = 0
                self.stats['fields_updated'][db_field] += 1
        
        # Boolean fields
        bool_mapping = {
            'free_housing': ('free_housing', 13),
            'job': ('has_work_czech', 14),
            'search_job': ('needs_job_help', 15),
            'volunteer': ('volunteer_interest', 16)
        }
        
        for portal_field, (db_field, idx) in bool_mapping.items():
            portal_value = portal_data.get(portal_field, '').strip()
            current_value = current[idx]
            
            if portal_value and current_value is None:
                bool_val = portal_value == '1'
                updates.append(f"{db_field} = %s")
                params.append(bool_val)
                
                if db_field not in self.stats['fields_updated']:
                    self.stats['fields_updated'][db_field] = 0
                self.stats['fields_updated'][db_field] += 1
        
        if updates:
            sql = f"UPDATE clients SET {', '.join(updates)}, updated_at = CURRENT_TIMESTAMP WHERE id = %s"
            params.append(client_id)
            self.cursor.execute(sql, params)
            self.stats['updated'] += 1
    
    def import_all(self, extracted_data: List[Dict]):
        logger.info(f"\n💾 Importing {len(extracted_data)} clients...")
        
        for portal_data in extracted_data:
            client_id = self.find_client(portal_data)
            
            if client_id:
                self.stats['matched'] += 1
                self.update_client(client_id, portal_data)
            else:
                self.stats['not_matched'] += 1
                logger.warning(f"⚠️  Not matched: {portal_data['full_name']}")
        
        self.conn.commit()
        
        logger.info(f"\n✅ Import complete!")
        logger.info(f"   Matched: {self.stats['matched']}")
        logger.info(f"   Not matched: {self.stats['not_matched']}")
        logger.info(f"   Updated: {self.stats['updated']}")
        logger.info(f"\n📊 Fields updated:")
        for field, count in sorted(self.stats['fields_updated'].items(), key=lambda x: x[1], reverse=True):
            logger.info(f"   {field}: {count}")
    
    def close(self):
        self.cursor.close()
        self.conn.close()


def main():
    print("=" * 80)
    print("  FINAL COMPLETE EXTRACTION")
    print("  With CORRECT field names (tel_cz, tel_ua, etc.)")
    print("=" * 80)
    
    # Load client list
    logger.info("\n📂 Loading client list...")
    with open('customer_data_20251108_230656.json', 'r') as f:
        data = json.load(f)
    
    clients = data['clients']
    logger.info(f"✅ Loaded {len(clients)} clients")
    
    # Extract
    extractor = FinalExtractor()
    if not extractor.login():
        logger.error("❌ Login failed")
        return
    
    extractor.extract_all(clients)
    
    # Save
    output_file = f"final_extracted_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(extractor.extracted, f, indent=2, ensure_ascii=False)
    logger.info(f"\n📄 Saved to: {output_file}")
    
    # Import
    importer = FinalImporter()
    importer.import_all(extractor.extracted)
    importer.close()
    
    print("\n" + "=" * 80)
    print("  COMPLETE!")
    print("=" * 80)


if __name__ == '__main__':
    main()
