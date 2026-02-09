#!/usr/bin/env python3
"""
Import NEW data from existing extraction file

This script:
1. Reads the complete extraction file we already have
2. Imports NEW clients (that don't have cehupo_id in our DB)
3. Imports NEW visits (that don't exist in our DB)

Usage:
    python3 import-new-data-from-extraction.py
"""

import json
import psycopg2
from psycopg2.extras import RealDictCursor
import uuid
from datetime import datetime
import glob

# Database config
DB_CONFIG = {
    'dbname': 'centralnimozek_cehupo',
    'user': 'postgres',
    'password': 'IDvEg1WH40wVn7aa8MT9haYsbtRhF1PC',
    'host': 'localhost',
    'port': '5432'
}

def parse_date(date_str):
    """Parse DD.MM.YYYY to YYYY-MM-DD"""
    if not date_str:
        return None
    try:
        parts = date_str.strip().split('.')
        if len(parts) == 3:
            day, month, year = parts
            return f"{year}-{month.zfill(2)}-{day.zfill(2)}"
    except:
        pass
    return None

def parse_name(full_name):
    """Parse 'LastName FirstName' into separate parts"""
    parts = full_name.strip().split()
    if len(parts) >= 2:
        return parts[1], parts[0]  # FirstName, LastName
    elif len(parts) == 1:
        return parts[0], ''
    return '', ''

def main():
    print("=" * 80)
    print("📥 IMPORTING NEW DATA FROM EXTRACTION FILE")
    print("=" * 80)
    print()
    
    # Find latest extraction file
    extraction_files = sorted(glob.glob('complete_visits_extraction_*.json'), reverse=True)
    if not extraction_files:
        print("❌ No extraction file found!")
        print("   Please run extract_all_visits_async.py first!")
        return
    
    extraction_file = extraction_files[0]
    print(f"📂 Loading: {extraction_file}")
    
    with open(extraction_file, 'r', encoding='utf-8') as f:
        data = json.load(f)
    
    print(f"   Total clients in extraction: {len(data['clients'])}")
    print()
    
    # Connect to database
    conn = psycopg2.connect(**DB_CONFIG)
    cur = conn.cursor(cursor_factory=RealDictCursor)
    
    # Get existing data from DB
    print("📊 Analyzing existing data in database...")
    
    # Get all existing cehupo_ids
    cur.execute("SELECT id, cehupo_id FROM clients WHERE cehupo_id IS NOT NULL")
    existing_clients = {}
    for row in cur.fetchall():
        existing_clients[row['cehupo_id']] = str(row['id'])
    
    # Get all existing visits (by client_id + visit_date)
    cur.execute("SELECT client_id, visit_date FROM visits")
    existing_visits = set()
    for row in cur.fetchall():
        existing_visits.add((str(row['client_id']), str(row['visit_date'])))
    
    print(f"   Existing clients with CeHuPo ID: {len(existing_clients)}")
    print(f"   Existing visits in DB: {len(existing_visits)}")
    print()
    
    # Process extracted data
    new_clients_imported = 0
    new_visits_imported = 0
    skipped_visits = 0
    errors = []
    
    print("=" * 80)
    print("🔄 PROCESSING EXTRACTED DATA")
    print("=" * 80)
    print()
    
    for i, client_data in enumerate(data['clients'], 1):
        if 'error' in client_data:
            continue
        
        cehupo_id = client_data.get('cehupo_client_id')
        if not cehupo_id:
            continue
        
        first_name = client_data.get('first_name', '')
        last_name = client_data.get('last_name', '')
        client_name = f"{first_name} {last_name}"
        
        # Check if client exists in our DB
        if cehupo_id not in existing_clients:
            # This is a NEW client - import it!
            try:
                client_id = str(uuid.uuid4())
                
                # Parse date of birth
                dob = parse_date(client_data.get('date_of_birth'))
                
                cur.execute("""
                    INSERT INTO clients (
                        id, first_name, last_name, date_of_birth,
                        visa_number, cehupo_id, created_at
                    )
                    VALUES (%s, %s, %s, %s, %s, %s, NOW())
                """, (
                    client_id,
                    first_name,
                    last_name,
                    dob,
                    client_data.get('visa_number'),
                    cehupo_id
                ))
                
                conn.commit()
                existing_clients[cehupo_id] = client_id
                new_clients_imported += 1
                print(f"[{i}/{len(data['clients'])}] ✅ NEW CLIENT: {client_name} (CeHuPo ID: {cehupo_id})")
                
            except Exception as e:
                conn.rollback()
                error_msg = f"Failed to import client {client_name}: {e}"
                errors.append(error_msg)
                print(f"[{i}/{len(data['clients'])}] ❌ {error_msg}")
                continue
        else:
            client_id = existing_clients[cehupo_id]
        
        # Now process visits for this client
        visits_to_import = []
        
        for visit in client_data.get('visits', []):
            visit_date = parse_date(visit.get('visit_date'))
            if not visit_date:
                continue
            
            # Check if this visit already exists
            if (client_id, visit_date) in existing_visits:
                skipped_visits += 1
                continue
            
            # This is a NEW visit!
            visits_to_import.append({
                'visit_date': visit_date,
                'notes': visit.get('notes', ''),
                'time_spent': visit.get('time_spent'),
                'reasons': visit.get('reasons', [])
            })
        
        # Import new visits
        if visits_to_import:
            try:
                for visit in visits_to_import:
                    visit_id = str(uuid.uuid4())
                    
                    # Prepare notes with reasons
                    notes = visit.get('notes', '')
                    if visit.get('reasons'):
                        reasons_str = ', '.join(visit['reasons'])
                        notes = f"Reasons: {reasons_str}\n{notes}" if notes else f"Reasons: {reasons_str}"
                    
                    cur.execute("""
                        INSERT INTO visits (id, client_id, visit_date, time_spent, notes, created_at)
                        VALUES (%s, %s, %s, %s, %s, NOW())
                    """, (
                        visit_id,
                        client_id,
                        visit['visit_date'],
                        visit.get('time_spent'),
                        notes[:1000]  # Limit notes length
                    ))
                    
                    # Add to existing_visits set
                    existing_visits.add((client_id, visit['visit_date']))
                
                conn.commit()
                new_visits_imported += len(visits_to_import)
                print(f"[{i}/{len(data['clients'])}]    ✅ Imported {len(visits_to_import)} new visit(s) for {client_name}")
                
            except Exception as e:
                conn.rollback()
                error_msg = f"Failed to import visits for {client_name}: {e}"
                errors.append(error_msg)
                print(f"[{i}/{len(data['clients'])}]    ❌ {error_msg}")
        
        # Progress indicator every 100 clients
        if i % 100 == 0:
            print(f"\n... Processed {i}/{len(data['clients'])} clients ...\n")
    
    # Close database
    cur.close()
    conn.close()
    
    # Final summary
    print()
    print("=" * 80)
    print("🎉 IMPORT COMPLETE!")
    print("=" * 80)
    print(f"✅ NEW clients imported: {new_clients_imported}")
    print(f"✅ NEW visits imported: {new_visits_imported}")
    print(f"→  Existing visits skipped: {skipped_visits}")
    if errors:
        print(f"❌ Errors: {len(errors)}")
        for error in errors[:10]:
            print(f"   • {error}")
        if len(errors) > 10:
            print(f"   ... and {len(errors) - 10} more errors")
    print("=" * 80)
    
    # Save report
    report = {
        'timestamp': datetime.now().isoformat(),
        'extraction_file': extraction_file,
        'new_clients_imported': new_clients_imported,
        'new_visits_imported': new_visits_imported,
        'existing_visits_skipped': skipped_visits,
        'errors': errors
    }
    
    report_file = f"new_data_import_report_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
    with open(report_file, 'w', encoding='utf-8') as f:
        json.dump(report, f, indent=2, ensure_ascii=False)
    
    print(f"\n💾 Report saved to: {report_file}\n")

if __name__ == '__main__':
    main()

