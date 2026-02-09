#!/usr/bin/env python3
"""
Smart Complete Re-Import Script
- Extracts ALL available fields from customer portal
- Only updates fields that are currently NULL or empty
- Better client matching using multiple criteria
- Comprehensive field extraction
"""

import requests
from bs4 import BeautifulSoup
import json
import logging
import psycopg2
from datetime import datetime
import time
import re
from typing import Dict, Optional, List

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('smart_reimport.log'),
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

class SmartExtractor:
    """Smart extractor that gets ALL available fields"""
    
    def __init__(self):
        self.session = requests.Session()
        self.session.headers.update({
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        })
        self.extracted = []
        self.stats = {
            'total': 0,
            'extracted': 0,
            'failed': 0,
            'fields_found': {}
        }
        
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
    
    def extract_all_form_fields(self, soup: BeautifulSoup) -> Dict:
        """Extract ALL form fields from the page"""
        fields = {}
        
        # List of all possible form fields from the portal
        form_field_names = [
            'email', 'phone_cz', 'phone_ua', 'street', 'city_full',
            'in_ua', 'note_volunteer', 'sub_id', 'kinship',
            'city_of_origin', 'insurance', 'free_housing',
            'education', 'profession', 'hobbies',
            'job', 'search_job', 'text_help',
            'volunteer', 'volunteer_text', 'note'
        ]
        
        for field_name in form_field_names:
            element = soup.find(['input', 'select', 'textarea'], {'name': field_name})
            
            if element:
                if element.name == 'input':
                    if element.get('type') == 'checkbox':
                        fields[field_name] = '1' if element.get('checked') else '0'
                    else:
                        fields[field_name] = element.get('value', '')
                elif element.name == 'select':
                    selected = element.find('option', {'selected': True})
                    if selected:
                        fields[field_name] = selected.text.strip()
                    else:
                        fields[field_name] = ''
                elif element.name == 'textarea':
                    fields[field_name] = element.text.strip()
            else:
                fields[field_name] = ''
        
        return fields
    
    def extract_client_detail(self, client: Dict) -> Optional[Dict]:
        """Extract complete details for one client"""
        try:
            client_id = client.get('customer_id') or client.get('id')
            self.stats['total'] += 1
            
            # Get detail page
            url = f"{CUSTOMER_BASE_URL}/customer/viewcustomer/{client_id}"
            response = self.session.get(url)
            
            if response.status_code != 200:
                logger.error(f"❌ HTTP {response.status_code} for client {client_id}")
                self.stats['failed'] += 1
                return None
            
            html = response.text
            
            # Check if we got login page
            if 'Signin' in html or len(html) < 2000:
                logger.warning(f"⚠️  Got login page for client {client_id}")
                self.stats['failed'] += 1
                return None
            
            soup = BeautifulSoup(html, 'html.parser')
            
            # Initialize details
            details = {
                'customer_id': client_id,
                'full_name': client.get('full_name', ''),
                'email': '',
                'phone_cz': '',
                'phone_ua': '',
                'street': '',
                'city_full': '',
                'city_of_origin': '',
                'insurance': '',
                'education': '',
                'profession': '',
                'hobbies': '',
                'volunteer_text': '',
                'note_volunteer': '',
                'text_help': '',
                'note': '',
                'free_housing': '',
                'job': '',
                'search_job': '',
                'volunteer': '',
                'in_ua': ''
            }
            
            # Method 1: Extract from text sections
            info_sections = soup.find_all('div', class_='invoice-col')
            
            for section in info_sections:
                text = section.get_text()
                
                # Contact info section (Russian labels)
                if 'Город' in text:
                    details['city_full'] = self.extract_field(text, 'Город:')
                if 'Улица' in text:
                    details['street'] = self.extract_field(text, 'Улица:')
                if 'Телефон CZ' in text:
                    details['phone_cz'] = self.extract_field(text, 'Телефон CZ:')
                if 'Телефон UA' in text:
                    details['phone_ua'] = self.extract_field(text, 'Телефон UA:')
                if 'Email' in text:
                    details['email'] = self.extract_field(text, 'Email:')
            
            # Method 2: Extract from ALL form fields
            form_fields = self.extract_all_form_fields(soup)
            
            # Merge form fields, preferring non-empty values
            for key, value in form_fields.items():
                if value and value.strip():  # If form has value
                    if key in details:
                        details[key] = value
                    else:
                        details[key] = value
            
            # Track which fields were found
            for key, value in details.items():
                if value and value.strip() and key != 'customer_id' and key != 'full_name':
                    if key not in self.stats['fields_found']:
                        self.stats['fields_found'][key] = 0
                    self.stats['fields_found'][key] += 1
            
            self.stats['extracted'] += 1
            
            if self.stats['extracted'] % 100 == 0:
                logger.info(f"Progress: {self.stats['extracted']}/{self.stats['total']}")
            
            return details
            
        except Exception as e:
            logger.error(f"❌ Error extracting client {client_id}: {e}")
            self.stats['failed'] += 1
            return None
    
    def extract_all(self, clients: List[Dict]):
        """Extract all client details"""
        logger.info(f"📝 Extracting details for {len(clients)} clients...")
        
        for client in clients:
            details = self.extract_client_detail(client)
            if details:
                self.extracted.append(details)
            time.sleep(0.3)  # Be respectful
        
        logger.info(f"\n✅ Extraction complete!")
        logger.info(f"   Succeeded: {self.stats['extracted']}/{self.stats['total']}")
        logger.info(f"   Failed: {self.stats['failed']}/{self.stats['total']}")
        logger.info(f"\n📊 Fields found:")
        for field, count in sorted(self.stats['fields_found'].items(), key=lambda x: x[1], reverse=True):
            logger.info(f"   {field}: {count}")


class SmartImporter:
    """Smart importer that only updates empty fields"""
    
    def __init__(self):
        self.conn = psycopg2.connect(**DB_CONFIG)
        self.cursor = self.conn.cursor()
        self.stats = {
            'matched': 0,
            'not_matched': 0,
            'updated': 0,
            'fields_updated': {}
        }
    
    def find_client(self, portal_data: Dict) -> Optional[str]:
        """Find client in DB using multiple matching strategies"""
        
        # Strategy 1: Match by visa number (if available)
        customer_id = portal_data.get('customer_id', '')
        if customer_id:
            self.cursor.execute("""
                SELECT id FROM clients 
                WHERE visa_number LIKE %s
                LIMIT 1
            """, (f"%{customer_id}%",))
            
            result = self.cursor.fetchone()
            if result:
                return result[0]
        
        # Strategy 2: Match by full name
        full_name = portal_data.get('full_name', '')
        if full_name:
            parts = full_name.split()
            if len(parts) >= 2:
                last_name = ' '.join(parts[:-1])  # Everything except last word
                first_name = parts[-1]  # Last word
                
                # Try exact match
                self.cursor.execute("""
                    SELECT id FROM clients 
                    WHERE LOWER(first_name) = LOWER(%s) 
                    AND LOWER(last_name) = LOWER(%s)
                    LIMIT 1
                """, (first_name, last_name))
                
                result = self.cursor.fetchone()
                if result:
                    return result[0]
                
                # Try reversed (first_name last_name might be swapped)
                first_name_part = parts[0]
                last_name_part = ' '.join(parts[1:])
                
                self.cursor.execute("""
                    SELECT id FROM clients 
                    WHERE LOWER(first_name) = LOWER(%s) 
                    AND LOWER(last_name) = LOWER(%s)
                    LIMIT 1
                """, (first_name_part, last_name_part))
                
                result = self.cursor.fetchone()
                if result:
                    return result[0]
        
        return None
    
    def update_client(self, client_id: str, portal_data: Dict):
        """Update only empty fields for this client"""
        
        # Get current client data
        self.cursor.execute("""
            SELECT 
                email, czech_phone, ukrainian_phone, czech_address, czech_city,
                insurance_company, education_level, profession_ukraine, hobbies,
                volunteer_notes, volunteer_skills, help_needed, notes,
                free_housing, has_work_czech, needs_job_help, volunteer_interest,
                home_address
            FROM clients WHERE id = %s
        """, (client_id,))
        
        current = self.cursor.fetchone()
        if not current:
            return
        
        # Map current values to dict
        current_data = {
            'email': current[0],
            'czech_phone': current[1],
            'ukrainian_phone': current[2],
            'czech_address': current[3],
            'czech_city': current[4],
            'insurance_company': current[5],
            'education_level': current[6],
            'profession_ukraine': current[7],
            'hobbies': current[8],
            'volunteer_notes': current[9],
            'volunteer_skills': current[10],
            'help_needed': current[11],
            'notes': current[12],
            'free_housing': current[13],
            'has_work_czech': current[14],
            'needs_job_help': current[15],
            'volunteer_interest': current[16],
            'home_address': current[17]
        }
        
        # Map portal fields to DB fields
        field_mapping = {
            'email': 'email',
            'phone_cz': 'czech_phone',
            'phone_ua': 'ukrainian_phone',
            'street': 'czech_address',
            'city_full': 'czech_city',
            'insurance': 'insurance_company',
            'education': 'education_level',
            'profession': 'profession_ukraine',
            'hobbies': 'hobbies',
            'note_volunteer': 'volunteer_notes',
            'volunteer_text': 'volunteer_skills',
            'text_help': 'help_needed',
            'note': 'notes',
            'city_of_origin': 'home_address'
        }
        
        # Boolean field mapping
        bool_mapping = {
            'free_housing': 'free_housing',
            'job': 'has_work_czech',
            'search_job': 'needs_job_help',
            'volunteer': 'volunteer_interest'
        }
        
        # Build UPDATE statement for only empty fields
        updates = []
        params = []
        
        for portal_field, db_field in field_mapping.items():
            portal_value = portal_data.get(portal_field, '').strip()
            current_value = current_data.get(db_field)
            
            # Only update if current is empty and portal has value
            if portal_value and (not current_value or str(current_value).strip() == ''):
                updates.append(f"{db_field} = %s")
                params.append(portal_value)
                
                if db_field not in self.stats['fields_updated']:
                    self.stats['fields_updated'][db_field] = 0
                self.stats['fields_updated'][db_field] += 1
        
        # Handle boolean fields
        for portal_field, db_field in bool_mapping.items():
            portal_value = portal_data.get(portal_field, '').strip()
            current_value = current_data.get(db_field)
            
            if portal_value and current_value is None:
                bool_val = portal_value == '1' or portal_value.lower() == 'true'
                updates.append(f"{db_field} = %s")
                params.append(bool_val)
                
                if db_field not in self.stats['fields_updated']:
                    self.stats['fields_updated'][db_field] = 0
                self.stats['fields_updated'][db_field] += 1
        
        if updates:
            sql = f"""
                UPDATE clients 
                SET {', '.join(updates)}, updated_at = CURRENT_TIMESTAMP
                WHERE id = %s
            """
            params.append(client_id)
            
            self.cursor.execute(sql, params)
            self.stats['updated'] += 1
    
    def import_all(self, extracted_data: List[Dict]):
        """Import all extracted data smartly"""
        logger.info(f"\n💾 Smart importing {len(extracted_data)} clients...")
        
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
    """Main execution"""
    print("=" * 80)
    print("  SMART COMPLETE RE-IMPORT")
    print("  Only updates empty fields with available portal data")
    print("=" * 80)
    
    # Load client list
    logger.info("\n📂 Loading client list...")
    with open('customer_data_20251108_230656.json', 'r') as f:
        data = json.load(f)
    
    clients = data['clients']
    logger.info(f"✅ Loaded {len(clients)} clients")
    
    # Extract
    extractor = SmartExtractor()
    if not extractor.login():
        logger.error("❌ Login failed")
        return
    
    extractor.extract_all(clients)
    
    # Save extraction
    output_file = f"smart_extracted_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(extractor.extracted, f, indent=2, ensure_ascii=False)
    logger.info(f"\n📄 Saved to: {output_file}")
    
    # Import
    importer = SmartImporter()
    importer.import_all(extractor.extracted)
    importer.close()
    
    print("\n" + "=" * 80)
    print("  COMPLETE!")
    print("=" * 80)


if __name__ == '__main__':
    main()
