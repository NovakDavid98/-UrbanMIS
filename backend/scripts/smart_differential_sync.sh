#!/bin/bash
###############################################################################
# SMART DIFFERENTIAL SYNC - CeHuPo to Centrální Mozek
#
# This script performs intelligent differential synchronization:
# 1. Uses the proven extract_all_visits_async.py to extract ALL data
# 2. Then imports ONLY NEW data that doesn't exist in DB
#
# Usage:
#   ./smart_differential_sync.sh --test    # Test on 5 clients
#   ./smart_differential_sync.sh           # Full sync
###############################################################################

set -e  # Exit on error

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Activate virtual environment
source venv/bin/activate

TEST_MODE=""
if [[ "$1" == "--test" ]]; then
    TEST_MODE="--test"
    echo "🧪 TEST MODE: Will sync only 5 clients"
fi

echo ""
echo "================================================================================"
echo "🔄 SMART DIFFERENTIAL SYNC - CeHuPo → Centrální Mozek"
echo "================================================================================"
echo ""

# Step 1: Extract all data from CeHuPo (uses existing proven script)
echo "📥 STEP 1: Extracting data from CeHuPo portal..."
echo "────────────────────────────────────────────────────────────────────────────────"

# Create a modified version of extract script that extracts to temp file
EXTRACT_OUTPUT="differential_extraction_$(date +%Y%m%d_%H%M%S).json"

# Run extraction
if [[ -n "$TEST_MODE" ]]; then
    # For test mode, we'll use a small client limit
    echo "Running in TEST mode (limited clients)..."
    # Modify database query temporarily to limit clients
    python3 -c "
import sys
sys.path.insert(0, '.')
from extract_all_visits_async import *
import json

# Override client loading to limit to 5
original_get_clients = get_all_clients_from_db

def limited_get_clients():
    clients = original_get_clients()
    return clients[:5]

get_all_clients_from_db = limited_get_clients

# Run extraction
import asyncio
asyncio.run(extract_all_visits())
"
else
    echo "Running FULL extraction..."
    python3 extract_all_visits_async.py
fi

# Find the most recent extraction file
LATEST_EXTRACTION=$(ls -t complete_visits_extraction_*.json 2>/dev/null | head -1)

if [[ -z "$LATEST_EXTRACTION" ]]; then
    echo "❌ ERROR: No extraction file found!"
    exit 1
fi

echo ""
echo "✅ Extraction complete: $LATEST_EXTRACTION"
echo ""

# Step 2: Smart import - only NEW data
echo "================================================================================"
echo "💾 STEP 2: Smart Import - Only NEW Data"
echo "================================================================================"
echo ""

python3 << 'PYTHON_EOF'
import json
import psycopg2
from psycopg2.extras import RealDictCursor
import uuid
from datetime import datetime
import glob
import os

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

# Find latest extraction file
extraction_files = sorted(glob.glob('complete_visits_extraction_*.json'), reverse=True)
if not extraction_files:
    print("❌ No extraction file found!")
    exit(1)

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
cur.execute("SELECT cehupo_id FROM clients WHERE cehupo_id IS NOT NULL")
existing_cehupo_ids = {row['cehupo_id'] for row in cur.fetchall()}

cur.execute("""
    SELECT client_id, visit_date 
    FROM visits
""")
existing_visits = {}
for row in cur.fetchall():
    client_id = str(row['client_id'])
    visit_date = str(row['visit_date'])
    if client_id not in existing_visits:
        existing_visits[client_id] = set()
    existing_visits[client_id].add(visit_date)

print(f"   Existing clients with CeHuPo ID: {len(existing_cehupo_ids)}")
print(f"   Existing visits in DB: {sum(len(v) for v in existing_visits.values())}")
print()

# Process each client from extraction
new_visits_count = 0
skipped_visits_count = 0
clients_processed = 0
errors = []

print("=" * 80)
print("🔄 Processing extracted data...")
print("=" * 80)

for client_data in data['clients']:
    if 'error' in client_data:
        continue
    
    cehupo_id = client_data.get('cehupo_client_id')
    if not cehupo_id:
        continue
    
    clients_processed += 1
    
    # Get the DB client ID by cehupo_id
    cur.execute("SELECT id FROM clients WHERE cehupo_id = %s", (cehupo_id,))
    result = cur.fetchone()
    
    if not result:
        print(f"⚠️  Client CeHuPo#{cehupo_id} not in DB - skipping")
        continue
    
    client_id = str(result['id'])
    client_name = f"{client_data['first_name']} {client_data['last_name']}"
    
    # Process visits
    client_existing_visits = existing_visits.get(client_id, set())
    new_visits_for_client = []
    
    for visit in client_data.get('visits', []):
        visit_date = parse_date(visit['visit_date'])
        if not visit_date:
            continue
        
        # Check if this visit already exists
        if visit_date in client_existing_visits:
            skipped_visits_count += 1
            continue
        
        # This is a NEW visit!
        new_visits_for_client.append({
            'client_id': client_id,
            'visit_date': visit_date,
            'notes': visit.get('notes', ''),
            'time_spent': visit.get('time_spent')
        })
    
    # Import new visits
    if new_visits_for_client:
        try:
            for visit in new_visits_for_client:
                visit_id = str(uuid.uuid4())
                cur.execute("""
                    INSERT INTO visits (id, client_id, visit_date, time_spent, notes, created_at)
                    VALUES (%s, %s, %s, %s, %s, NOW())
                """, (
                    visit_id,
                    visit['client_id'],
                    visit['visit_date'],
                    visit.get('time_spent'),
                    visit.get('notes', '')[:500]  # Limit notes length
                ))
            
            conn.commit()
            new_visits_count += len(new_visits_for_client)
            print(f"✅ {client_name}: Imported {len(new_visits_for_client)} new visit(s)")
        except Exception as e:
            conn.rollback()
            error_msg = f"Failed to import visits for {client_name}: {e}"
            errors.append(error_msg)
            print(f"❌ {error_msg}")

# Close database connection
cur.close()
conn.close()

# Final summary
print()
print("=" * 80)
print("🎉 SMART DIFFERENTIAL SYNC COMPLETE!")
print("=" * 80)
print(f"✅ Clients processed: {clients_processed}")
print(f"✅ NEW visits imported: {new_visits_count}")
print(f"→  Existing visits skipped: {skipped_visits_count}")
if errors:
    print(f"❌ Errors: {len(errors)}")
    for error in errors[:10]:
        print(f"   • {error}")
print("=" * 80)

# Save report
report = {
    'timestamp': datetime.now().isoformat(),
    'extraction_file': extraction_file,
    'clients_processed': clients_processed,
    'new_visits_imported': new_visits_count,
    'existing_visits_skipped': skipped_visits_count,
    'errors': errors
}

report_file = f"smart_sync_report_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
with open(report_file, 'w', encoding='utf-8') as f:
    json.dump(report, f, indent=2, ensure_ascii=False)

print(f"\n💾 Report saved to: {report_file}\n")

PYTHON_EOF

echo ""
echo "✅ Smart differential sync completed successfully!"
echo ""

