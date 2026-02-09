#!/usr/bin/env python3
"""
CEHUPO Customer Data Extractor
Comprehensive tool to extract ALL data from customer.cehupo.cz and import to Centrální Mozek
"""

import requests
from bs4 import BeautifulSoup
import json
import csv
import psycopg2
from psycopg2.extras import execute_values
from datetime import datetime
import re
import time
import logging
from typing import Dict, List, Optional
import uuid

# ========================================
# CONFIGURATION
# ========================================

# Customer portal credentials
CUSTOMER_LOGIN_URL = "https://customer.cehupo.cz/user/authenticate"
CUSTOMER_BASE_URL = "https://customer.cehupo.cz"
CUSTOMER_USERNAME = "DavidNovak"
CUSTOMER_PASSWORD = "Supr414nd!"

# Database connection
DB_CONFIG = {
    'host': 'localhost',
    'port': 5432,
    'database': 'centralnimozek_cehupo',
    'user': 'postgres',
    'password': 'IDvEg1WH40wVn7aa8MT9haYsbtRhF1PC'
}

# Logging configuration
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('customer_extraction.log'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

# ========================================
# SESSION MANAGER
# ========================================

class CustomerSession:
    """Manages authenticated session with customer.cehupo.cz"""
    
    def __init__(self, username: str, password: str):
        self.session = requests.Session()
        self.username = username
        self.password = password
        self.base_url = CUSTOMER_BASE_URL
        self.logged_in = False
        
    def login(self) -> bool:
        """Authenticate with customer portal"""
        try:
            logger.info(f"🔐 Logging in as {self.username}...")
            
            login_data = {
                'action': 'auth',
                'username': self.username,
                'password': self.password
            }
            
            response = self.session.post(CUSTOMER_LOGIN_URL, data=login_data)
            
            # Check if login successful (redirect or no error)
            if 'error' not in response.url and response.status_code == 200:
                self.logged_in = True
                logger.info("✅ Login successful!")
                return True
            else:
                logger.error("❌ Login failed!")
                return False
                
        except Exception as e:
            logger.error(f"❌ Login error: {e}")
            return False
    
    def get(self, url: str) -> Optional[requests.Response]:
        """GET request with error handling"""
        try:
            full_url = f"{self.base_url}{url}" if not url.startswith('http') else url
            response = self.session.get(full_url)
            response.raise_for_status()
            return response
        except Exception as e:
            logger.error(f"❌ GET error for {url}: {e}")
            return None
    
    def logout(self):
        """Logout from customer portal"""
        try:
            self.session.get(f"{self.base_url}/user/logout")
            logger.info("🔓 Logged out")
        except:
            pass

# ========================================
# DATA EXTRACTOR
# ========================================

class CustomerDataExtractor:
    """Extracts all data from customer portal"""
    
    def __init__(self, session: CustomerSession):
        self.session = session
        self.clients = []
        self.visits = []
        
    def extract_all_data(self) -> Dict:
        """Main extraction method - gets everything"""
        logger.info("🚀 Starting data extraction...")
        
        # Step 1: Get list of all clients
        self.extract_client_list()
        
        # Step 2: Get details for each client + their visits
        self.extract_client_details()
        
        # Step 3: Extract visit log data
        self.extract_visit_log()
        
        logger.info(f"✅ Extraction complete! {len(self.clients)} clients, {len(self.visits)} visits")
        
        return {
            'clients': self.clients,
            'visits': self.visits,
            'extraction_date': datetime.now().isoformat()
        }
    
    def extract_client_list(self):
        """Extract all clients from /customer page"""
        logger.info("📋 Extracting client list from /customer...")
        
        response = self.session.get("/customer")
        if not response:
            return
        
        soup = BeautifulSoup(response.text, 'html.parser')
        table = soup.find('table', {'id': 'TableCustomer'})
        
        if not table:
            logger.error("❌ Could not find client table!")
            return
        
        rows = table.find('tbody').find_all('tr')
        logger.info(f"Found {len(rows)} clients in table")
        
        for row in rows:
            cells = row.find_all('td')
            if len(cells) < 7:
                continue
            
            # Extract basic info from table
            client_link = cells[1].find('a')
            if not client_link:
                continue
            
            client_id = client_link['href'].split('/')[-1]
            name = client_link.text.strip()
            
            client_data = {
                'customer_id': client_id,
                'full_name': name,
                'gender_ru': cells[2].text.strip(),
                'date_of_birth': cells[3].text.strip(),
                'age': cells[4].text.strip(),
                'visa_number': cells[5].text.strip(),
                'city': cells[6].text.strip(),
                'detail_url': client_link['href']
            }
            
            self.clients.append(client_data)
        
        logger.info(f"✅ Extracted {len(self.clients)} clients from list")
    
    def extract_client_details(self):
        """Get full details for each client"""
        logger.info(f"📝 Extracting detailed data for {len(self.clients)} clients...")
        
        for i, client in enumerate(self.clients, 1):
            logger.info(f"Processing {i}/{len(self.clients)}: {client['full_name']}")
            
            # Get detail page
            response = self.session.get(f"/customer/viewcustomer/{client['customer_id']}")
            if not response:
                continue
            
            soup = BeautifulSoup(response.text, 'html.parser')
            
            # Extract detailed information
            self.extract_client_detail_info(client, soup)
            
            # Extract visit history for this client
            self.extract_client_visits(client, soup)
            
            # Respectful delay to avoid overloading server
            time.sleep(0.5)
    
    def extract_client_detail_info(self, client: Dict, soup: BeautifulSoup):
        """Extract detailed client information from detail page"""
        
        # Find all invoice-col divs with client info  
        info_sections = soup.find_all('div', class_='invoice-col')
        
        for section in info_sections:
            text = section.get_text()
            
            # General info
            if 'Дата регистрации' in text:
                client['registration_date'] = self.extract_field(text, 'Дата регистрации:')
                client['note'] = self.extract_field(text, 'Примечание:')
            
            # Personal data
            if 'Дата рождения' in text:
                client['gender'] = self.extract_field(text, 'Пол:')
                client['date_of_birth_full'] = self.extract_field(text, 'Дата рождения:')
                client['visa_number_full'] = self.extract_field(text, 'Номер визы:')
                client['arrival_date_czech'] = self.extract_field(text, 'Дата приезда в чехию:')
                client['visa_type'] = self.extract_field(text, 'Тип визы:')
            
            # Contact info
            if 'Город' in text and 'Улица' in text:
                client['city_full'] = self.extract_field(text, 'Город:')
                client['street'] = self.extract_field(text, 'Улица:')
                client['phone_cz'] = self.extract_field(text, 'Телефон CZ:')
                client['phone_ua'] = self.extract_field(text, 'Телефон UA:')
                client['email'] = self.extract_field(text, 'Email:')
        
        # Extract ALL form fields from the edit form
        self.extract_form_fields(client, soup)
    
    def extract_form_fields(self, client: Dict, soup: BeautifulSoup):
        """Extract all form fields from the client edit form"""
        
        # Extract form input values
        form_fields = {
            'in_ua': 'in_ua',  # Went back to Ukraine checkbox
            'note_volunteer': 'note_volunteer',  # Volunteer notes
            'sub_id': 'sub_id',  # Related family member
            'kinship': 'kinship',  # Relationship type
            'city_of_origin': 'city_of_origin',  # Ukrainian origin
            'insurance': 'insurance',  # Insurance company
            'free_housing': 'free_housing',  # Free housing checkbox
            'education': 'education',  # Education level
            'profession': 'profession',  # Profession in Ukraine
            'hobbies': 'hobbies',  # Hobbies
            'job': 'job',  # Has job checkbox
            'search_job': 'search_job',  # Needs job help checkbox
            'text_help': 'text_help',  # Help needed
            'volunteer': 'volunteer',  # Wants to volunteer checkbox
            'volunteer_text': 'volunteer_text'  # How to volunteer
        }
        
        for field_name, key in form_fields.items():
            # Try to find input/select/textarea
            element = soup.find(['input', 'select', 'textarea'], {'name': field_name})
            
            if element:
                if element.name == 'input':
                    if element.get('type') == 'checkbox':
                        # Checkbox - check if it has 'checked' attribute
                        client[key] = '1' if element.get('checked') else '0'
                    elif element.get('type') == 'radio':
                        # Radio button - find the checked one
                        checked_radio = soup.find('input', {'name': field_name, 'checked': True})
                        client[key] = checked_radio.get('value', '') if checked_radio else ''
                    else:
                        # Regular input
                        client[key] = element.get('value', '')
                elif element.name == 'select':
                    # Select dropdown - find selected option
                    selected = element.find('option', {'selected': True})
                    if selected:
                        client[key] = selected.text.strip()
                        client[f'{key}_value'] = selected.get('value', '')
                    else:
                        client[key] = ''
                elif element.name == 'textarea':
                    # Textarea
                    client[key] = element.text.strip()
            else:
                client[key] = ''
    
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
    
    def extract_client_visits(self, client: Dict, soup: BeautifulSoup):
        """Extract visit history for a client"""
        
        visit_table = soup.find('table', {'id': 'visit'})
        if not visit_table:
            return
        
        rows = visit_table.find('tbody').find_all('tr')
        
        for row in rows:
            cells = row.find_all('td')
            if len(cells) < 5:
                continue
            
            visit_data = {
                'customer_id': client['customer_id'],
                'client_name': client['full_name'],
                'visit_number': cells[0].text.strip(),
                'visit_date': cells[1].text.strip(),
                'visit_reason': cells[2].text.strip(),
                'note': cells[3].text.strip(),
                'time_spent': cells[4].text.strip()
            }
            
            self.visits.append(visit_data)
    
    def extract_visit_log(self):
        """Extract visit log from /home page"""
        logger.info("📅 Extracting visit log from /home...")
        
        # Get current date range
        today = datetime.now().strftime('%Y-%m-%d')
        
        # Try to get all visits by date range
        # The visit log page uses date filtering
        response = self.session.get("/home")
        if not response:
            return
        
        soup = BeautifulSoup(response.text, 'html.parser')
        
        # Visit log is dynamically loaded via DataTables
        # We already have visits from client detail pages
        logger.info(f"ℹ️  Visit log extracted from client detail pages: {len(self.visits)} total visits")

# ========================================
# DATA TRANSFORMER
# ========================================

class DataTransformer:
    """Transforms customer data to Centrální Mozek format"""
    
    @staticmethod
    def parse_date(date_str: str) -> Optional[str]:
        """Parse date from DD.MM.YYYY to YYYY-MM-DD"""
        if not date_str or date_str.strip() == '':
            return None
        
        try:
            # Handle different date formats
            if '.' in date_str:
                parts = date_str.split('.')
                if len(parts) == 3:
                    day, month, year = parts
                    return f"{year}-{month.zfill(2)}-{day.zfill(2)}"
        except:
            pass
        
        return None
    
    @staticmethod
    def parse_name(full_name: str) -> tuple:
        """Split full name into first and last name"""
        parts = full_name.strip().split()
        if len(parts) >= 2:
            last_name = parts[0]
            first_name = ' '.join(parts[1:])
            return first_name, last_name
        else:
            return full_name, ''
    
    @staticmethod
    def convert_gender(gender_ru: str) -> str:
        """Convert Russian gender to Czech"""
        gender_map = {
            'Женщина': 'Žena',
            'Мужчина': 'Muž'
        }
        return gender_map.get(gender_ru, 'Neznámé')
    
    @staticmethod
    def parse_time_spent(time_str: str) -> int:
        """Convert time HH:MM:SS to minutes"""
        if not time_str:
            return 0
        
        try:
            parts = time_str.split(':')
            if len(parts) == 3:
                hours = int(parts[0])
                minutes = int(parts[1])
                return hours * 60 + minutes
        except:
            pass
        
        return 0
    
    @staticmethod
    def transform_client(client_data: Dict) -> Dict:
        """Transform client data to Centrální Mozek format"""
        first_name, last_name = DataTransformer.parse_name(client_data.get('full_name', ''))
        
        # Determine activity status based on "in_ua" field
        activity_status = 'inactive' if client_data.get('in_ua') == '1' else 'active'
        
        return {
            'id': str(uuid.uuid4()),
            'first_name': first_name,
            'last_name': last_name,
            'gender': DataTransformer.convert_gender(client_data.get('gender_ru', '')),
            'date_of_birth': DataTransformer.parse_date(client_data.get('date_of_birth', '')),
            'age': int(client_data.get('age', 0)) if client_data.get('age', '').isdigit() else None,
            'visa_number': client_data.get('visa_number', ''),
            'visa_type': client_data.get('visa_type', ''),
            'date_of_arrival_czech': DataTransformer.parse_date(client_data.get('arrival_date_czech', '')),
            'czech_city': client_data.get('city_full', client_data.get('city', '')),
            'czech_address': client_data.get('street', ''),
            'czech_phone': client_data.get('phone_cz', ''),
            'ukrainian_phone': client_data.get('phone_ua', ''),
            'email': client_data.get('email', ''),
            'activity_status': activity_status,
            'source': 'customer_portal',
            'source_id': client_data.get('customer_id'),
            'registration_date': DataTransformer.parse_date(client_data.get('registration_date', '')),
            'notes': client_data.get('note', ''),
            # NEW FIELDS FROM CUSTOMER PORTAL
            'ukrainian_region': client_data.get('city_of_origin', ''),
            'insurance_company': client_data.get('insurance', ''),
            'education_level': client_data.get('education', ''),
            'profession': client_data.get('profession', ''),
            'hobbies': client_data.get('hobbies', ''),
            'has_job': client_data.get('job') == '1',
            'needs_job_help': client_data.get('search_job') == '1',
            'help_needed': client_data.get('text_help', ''),
            'wants_to_volunteer': client_data.get('volunteer') == '1',
            'volunteer_skills': client_data.get('volunteer_text', ''),
            'volunteer_notes': client_data.get('note_volunteer', ''),
            'free_housing': client_data.get('free_housing') == '1',
            'related_client_id': client_data.get('sub_id_value', ''),  # Customer portal ID of related person
            'relationship': client_data.get('kinship', '')
        }
    
    @staticmethod
    def transform_visit(visit_data: Dict, client_uuid: str) -> Dict:
        """Transform visit data to Centrální Mozek format"""
        return {
            'id': str(uuid.uuid4()),
            'client_id': client_uuid,
            'visit_date': DataTransformer.parse_date(visit_data.get('visit_date', '')),
            'time_spent': DataTransformer.parse_time_spent(visit_data.get('time_spent', '')),
            'notes': visit_data.get('note', ''),
            'visit_reasons': visit_data.get('visit_reason', '').split(','),
            'source': 'customer_portal'
        }

# ========================================
# DATABASE IMPORTER
# ========================================

class DatabaseImporter:
    """Imports data into Centrální Mozek PostgreSQL database"""
    
    def __init__(self, db_config: Dict):
        self.db_config = db_config
        self.conn = None
        self.cursor = None
        
    def connect(self):
        """Connect to database"""
        try:
            self.conn = psycopg2.connect(**self.db_config)
            self.cursor = self.conn.cursor()
            logger.info("✅ Connected to database")
            return True
        except Exception as e:
            logger.error(f"❌ Database connection failed: {e}")
            return False
    
    def disconnect(self):
        """Close database connection"""
        if self.cursor:
            self.cursor.close()
        if self.conn:
            self.conn.close()
        logger.info("🔌 Disconnected from database")
    
    def import_clients(self, clients: List[Dict]) -> Dict[str, str]:
        """Import clients and return mapping of source_id to UUID"""
        logger.info(f"💾 Importing {len(clients)} clients...")
        
        id_mapping = {}
        imported = 0
        skipped = 0
        
        for client in clients:
            try:
                # Check if client already exists (by visa number)
                self.cursor.execute(
                    "SELECT id FROM clients WHERE visa_number = %s",
                    (client['visa_number'],)
                )
                
                existing = self.cursor.fetchone()
                
                if existing:
                    # Client already exists
                    id_mapping[client['source_id']] = existing[0]
                    skipped += 1
                    continue
                
                # Build portal notes (basic notes field)
                portal_notes = client.get('notes', '')
                
                # Build structured notes for notes table
                structured_notes = []
                
                # Background Information note
                background_parts = []
                if client.get('education_level'):
                    background_parts.append(f"Vzdělání: {client['education_level']}")
                if client.get('profession'):
                    background_parts.append(f"Profese: {client['profession']}")
                if client.get('hobbies'):
                    background_parts.append(f"Koníčky: {client['hobbies']}")
                if background_parts:
                    structured_notes.append({
                        'title': 'Background Information',
                        'content': '\n'.join(background_parts),
                        'is_important': False
                    })
                
                # Help Needed note
                if client.get('help_needed'):
                    structured_notes.append({
                        'title': 'Help Needed',
                        'content': client['help_needed'],
                        'is_important': True
                    })
                
                # Volunteer Information note
                volunteer_parts = []
                if client.get('volunteer_notes'):
                    volunteer_parts.append(f"Poznámky pro dobrovolníky: {client['volunteer_notes']}")
                if client.get('wants_to_volunteer'):
                    volunteer_parts.append("Má zájem o dobrovolnictví: Ano")
                if client.get('volunteer_skills'):
                    volunteer_parts.append(f"Dobrovolnické dovednosti: {client['volunteer_skills']}")
                if volunteer_parts:
                    structured_notes.append({
                        'title': 'Volunteer Information',
                        'content': '\n'.join(volunteer_parts),
                        'is_important': False
                    })
                
                # Family Connections note
                if client.get('relationship') or client.get('related_client_id'):
                    family_info = []
                    if client.get('relationship'):
                        family_info.append(f"Vztah: {client['relationship']}")
                    if client.get('related_client_id'):
                        family_info.append(f"ID příbuzného (customer portal): {client['related_client_id']}")
                    structured_notes.append({
                        'title': 'Family Connections',
                        'content': '\n'.join(family_info),
                        'is_important': False
                    })
                
                # Housing & Employment note
                status_parts = []
                if client.get('free_housing'):
                    status_parts.append("Dostává bezplatné bydlení: Ano")
                if client.get('has_job'):
                    status_parts.append("Má práci v ČR: Ano")
                if client.get('needs_job_help'):
                    status_parts.append("Potřebuje pomoc s hledáním práce: Ano")
                if status_parts:
                    structured_notes.append({
                        'title': 'Housing & Employment',
                        'content': '\n'.join(status_parts),
                        'is_important': False
                    })
                
                # Check if client already exists (by first_name, last_name, date_of_birth)
                self.cursor.execute('''
                    SELECT id FROM clients 
                    WHERE first_name = %s AND last_name = %s AND date_of_birth = %s
                    LIMIT 1
                ''', (client['first_name'], client['last_name'], client['date_of_birth']))
                
                existing = self.cursor.fetchone()
                
                if existing:
                    # Update existing client
                    client_uuid = existing[0]
                    self.cursor.execute('''
                        UPDATE clients SET
                            gender = %s,
                            age = %s,
                            visa_number = %s,
                            visa_type = %s,
                            date_of_arrival_czech = %s,
                            czech_city = %s,
                            czech_address = %s,
                            czech_phone = %s,
                            ukrainian_phone = %s,
                            email = %s,
                            ukrainian_region = %s,
                            insurance_company = %s,
                            activity_status = %s,
                            notes = %s,
                            updated_at = CURRENT_TIMESTAMP
                        WHERE id = %s
                    ''', (
                        client['gender'], client['age'],
                        client['visa_number'], client['visa_type'], client['date_of_arrival_czech'],
                        client['czech_city'], client['czech_address'], 
                        client['czech_phone'], client['ukrainian_phone'], client['email'],
                        client.get('ukrainian_region'), client.get('insurance_company'),
                        client['activity_status'], portal_notes,
                        client_uuid
                    ))
                    skipped += 1
                else:
                    # Insert new client with ALL fields
                    self.cursor.execute('''
                        INSERT INTO clients (
                            id, first_name, last_name, gender, date_of_birth, age,
                            visa_number, visa_type, date_of_arrival_czech,
                            czech_city, czech_address, czech_phone, ukrainian_phone, email,
                            ukrainian_region, insurance_company,
                            activity_status, notes,
                            created_at, updated_at
                        ) VALUES (
                            %s, %s, %s, %s, %s, %s,
                            %s, %s, %s,
                            %s, %s, %s, %s, %s,
                            %s, %s,
                            %s, %s,
                            CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
                        )
                        RETURNING id
                    ''', (
                        client['id'], client['first_name'], client['last_name'], 
                        client['gender'], client['date_of_birth'], client['age'],
                        client['visa_number'], client['visa_type'], client['date_of_arrival_czech'],
                        client['czech_city'], client['czech_address'], 
                        client['czech_phone'], client['ukrainian_phone'], client['email'],
                        client.get('ukrainian_region'), client.get('insurance_company'),
                        client['activity_status'], portal_notes
                    ))
                    
                    client_uuid = self.cursor.fetchone()[0]
                    imported += 1
                
                id_mapping[client['source_id']] = client_uuid
                
                # Create structured notes in notes table
                for note_data in structured_notes:
                    self.cursor.execute('''
                        INSERT INTO notes (
                            id, client_id, title, content, is_important,
                            created_at, updated_at
                        ) VALUES (
                            uuid_generate_v4(), %s, %s, %s, %s,
                            CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
                        )
                    ''', (
                        client_uuid, 
                        note_data['title'], 
                        note_data['content'],
                        note_data['is_important']
                    ))
                
                imported += 1
                
            except Exception as e:
                logger.error(f"❌ Error importing client {client.get('first_name')}: {e}")
                self.conn.rollback()
                continue
        
        self.conn.commit()
        logger.info(f"✅ Imported {imported} clients, skipped {skipped} duplicates")
        
        return id_mapping
    
    def import_visits(self, visits: List[Dict], id_mapping: Dict[str, str]):
        """Import visit records"""
        logger.info(f"💾 Importing {len(visits)} visits...")
        
        imported = 0
        skipped = 0
        
        for visit in visits:
            try:
                # Get client UUID from mapping
                client_uuid = id_mapping.get(visit['client_id'])
                if not client_uuid:
                    skipped += 1
                    continue
                
                # Check if visit already exists
                self.cursor.execute(
                    """SELECT id FROM visits 
                       WHERE client_id = %s AND visit_date = %s AND notes = %s""",
                    (client_uuid, visit['visit_date'], visit['notes'])
                )
                
                if self.cursor.fetchone():
                    skipped += 1
                    continue
                
                # Insert visit
                insert_query = """
                    INSERT INTO visits (
                        id, client_id, visit_date, time_spent, notes,
                        created_at, updated_at, created_by
                    ) VALUES (
                        %s, %s, %s, %s, %s,
                        NOW(), NOW(), (SELECT id FROM users WHERE username = 'admin' LIMIT 1)
                    )
                """
                
                self.cursor.execute(insert_query, (
                    visit['id'], client_uuid, visit['visit_date'],
                    visit['time_spent'], visit['notes']
                ))
                
                imported += 1
                
            except Exception as e:
                logger.error(f"❌ Error importing visit: {e}")
                self.conn.rollback()
                continue
        
        self.conn.commit()
        logger.info(f"✅ Imported {imported} visits, skipped {skipped} duplicates")

# ========================================
# MAIN EXECUTION
# ========================================

def main():
    """Main execution flow"""
    print("=" * 70)
    print("  CEHUPO CUSTOMER DATA EXTRACTOR")
    print("  Extracting ALL data from customer.cehupo.cz")
    print("=" * 70)
    print()
    
    # Step 1: Login and create session
    session = CustomerSession(CUSTOMER_USERNAME, CUSTOMER_PASSWORD)
    if not session.login():
        logger.error("❌ Login failed! Cannot proceed.")
        return
    
    try:
        # Step 2: Extract all data
        extractor = CustomerDataExtractor(session)
        data = extractor.extract_all_data()
        
        # Step 3: Save raw data to JSON
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        json_filename = f'customer_data_{timestamp}.json'
        
        with open(json_filename, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        
        logger.info(f"📄 Raw data saved to {json_filename}")
        
        # Step 4: Transform data
        logger.info("🔄 Transforming data to Centrální Mozek format...")
        
        transformed_clients = []
        for client in data['clients']:
            transformed_clients.append(DataTransformer.transform_client(client))
        
        # Step 5: Import to database
        db = DatabaseImporter(DB_CONFIG)
        if db.connect():
            # Import clients first and get ID mapping
            id_mapping = db.import_clients(transformed_clients)
            
            # Transform and import visits
            transformed_visits = []
            for visit in data['visits']:
                client_uuid = id_mapping.get(visit['customer_id'])
                if client_uuid:
                    transformed_visit = DataTransformer.transform_visit(visit, client_uuid)
                    transformed_visits.append(transformed_visit)
            
            db.import_visits(transformed_visits, id_mapping)
            db.disconnect()
        
        # Step 6: Generate summary
        print()
        print("=" * 70)
        print("  EXTRACTION COMPLETE!")
        print("=" * 70)
        print(f"  Clients extracted: {len(data['clients'])}")
        print(f"  Visits extracted: {len(data['visits'])}")
        print(f"  Data saved to: {json_filename}")
        print("=" * 70)
        
    finally:
        # Cleanup: logout
        session.logout()

if __name__ == "__main__":
    main()
