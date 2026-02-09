#!/usr/bin/env python3
"""
Simple import script to load data from JSON into database
"""

import json
import psycopg2
import logging
from datetime import datetime

# Set up logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Database configuration
DB_CONFIG = {
    'host': 'localhost',
    'port': 5432,
    'database': 'centralnimozek_cehupo',
    'user': 'postgres',
    'password': 'IDvEg1WH40wVn7aa8MT9haYsbtRhF1PC'
}

def import_data(json_file):
    """Import data from JSON file"""
    
    # Load JSON data
    logger.info(f"📂 Loading data from {json_file}...")
    with open(json_file, 'r', encoding='utf-8') as f:
        data = json.load(f)
    
    clients = data.get('clients', [])
    visits = data.get('visits', [])
    
    logger.info(f"✅ Loaded {len(clients)} clients and {len(visits)} visits")
    
    # Connect to database
    logger.info("🔌 Connecting to database...")
    conn = psycopg2.connect(**DB_CONFIG)
    cursor = conn.cursor()
    
    # Import clients
    logger.info(f"💾 Importing {len(clients)} clients...")
    imported = 0
    skipped = 0
    id_mapping = {}
    
    for client in clients:
        try:
            # Build portal notes
            portal_notes = client.get('notes', '')
            
            # Build structured notes
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
            
            # Help Needed note (important!)
            if client.get('help_needed'):
                structured_notes.append({
                    'title': 'Help Needed',
                    'content': client['help_needed'],
                    'is_important': True
                })
            
            # Volunteer Information note
            volunteer_parts = []
            if client.get('volunteer_interest'):
                volunteer_parts.append(f"Zájem o dobrovolnictví: {client['volunteer_interest']}")
            if client.get('volunteer_skills'):
                volunteer_parts.append(f"Dovednosti: {client['volunteer_skills']}")
            if client.get('volunteer_notes'):
                volunteer_parts.append(f"Poznámky: {client['volunteer_notes']}")
            if volunteer_parts:
                structured_notes.append({
                    'title': 'Volunteer Information',
                    'content': '\n'.join(volunteer_parts),
                    'is_important': False
                })
            
            # Family Connections note
            family_info = []
            if client.get('family_in_czech'):
                family_info.append(f"Rodina v ČR: {client['family_in_czech']}")
            if client.get('family_details'):
                family_info.append(f"Detaily: {client['family_details']}")
            if family_info:
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
            
            # Check if client already exists
            cursor.execute('''
                SELECT id FROM clients 
                WHERE first_name = %s AND last_name = %s AND date_of_birth = %s
                LIMIT 1
            ''', (client['first_name'], client['last_name'], client['date_of_birth']))
            
            existing = cursor.fetchone()
            
            if existing:
                # Update existing client
                client_uuid = existing[0]
                cursor.execute('''
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
                # Insert new client
                cursor.execute('''
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
                
                client_uuid = cursor.fetchone()[0]
                imported += 1
            
            id_mapping[client['source_id']] = client_uuid
            
            # Create structured notes
            for note_data in structured_notes:
                cursor.execute('''
                    INSERT INTO notes (
                        id, client_id, title, content, is_important,
                        created_at, updated_at
                    ) VALUES (
                        uuid_generate_v4(), %s, %s, %s, %s,
                        CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
                    )
                ''', (
                    client_uuid, note_data['title'], note_data['content'], note_data['is_important']
                ))
            
        except Exception as e:
            logger.error(f"❌ Error importing client {client.get('first_name', 'Unknown')}: {e}")
            continue
    
    conn.commit()
    logger.info(f"✅ Imported {imported} clients, updated {skipped} existing clients")
    
    # Close connection
    cursor.close()
    conn.close()
    logger.info("🔌 Disconnected from database")
    logger.info("✅ Import completed successfully!")

if __name__ == '__main__':
    import sys
    if len(sys.argv) < 2:
        print("Usage: python simple-import.py <json_file>")
        print("Example: python simple-import.py customer_data_20251108_221428.json")
        sys.exit(1)
    
    import_data(sys.argv[1])
