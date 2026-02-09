#!/usr/bin/env python3
"""
One-time migration script to fix created_by field for historical clients.

Logic:
- For clients created between 13.2.2025 and 17.11.2025
- Find their first service_record OR visit (whichever came first)
- Update client's created_by to that worker
- This corrects historical attribution

After this runs, we can use simple COUNT(clients WHERE created_by = worker.id)
"""

import psycopg2
from datetime import datetime
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv('/root/CascadeProjects/centralnimozek/centralnimozekcehupo/backend/.env')

def get_db_connection():
    return psycopg2.connect(
        dbname=os.getenv('DB_NAME'),
        user=os.getenv('DB_USER'),
        password=os.getenv('DB_PASSWORD'),
        host=os.getenv('DB_HOST', 'localhost'),
        port=os.getenv('DB_PORT', '5432')
    )

def fix_historical_clients():
    conn = get_db_connection()
    cursor = conn.cursor()
    
    print("=" * 80)
    print("FIXING HISTORICAL CLIENT ATTRIBUTION (created_by field)")
    print("=" * 80)
    print("\nDate range: 13.2.2025 - 17.11.2025")
    print("Logic: Whoever did first service/visit is the one who added the client\n")
    
    # Get all clients in the date range
    cursor.execute("""
        SELECT 
            c.id,
            c.first_name,
            c.last_name,
            c.created_by as current_created_by,
            c.created_at
        FROM clients c
        WHERE c.created_at >= '2025-02-13'
          AND c.created_at <= '2025-11-17'
        ORDER BY c.created_at
    """)
    
    clients = cursor.fetchall()
    total_clients = len(clients)
    
    print(f"Found {total_clients} clients in date range\n")
    
    if total_clients == 0:
        print("No clients to process!")
        cursor.close()
        conn.close()
        return
    
    updated_count = 0
    no_services_count = 0
    unchanged_count = 0
    
    for idx, (client_id, first_name, last_name, current_created_by, created_at) in enumerate(clients, 1):
        # Find earliest service_record
        cursor.execute("""
            SELECT created_by, service_date
            FROM service_records
            WHERE client_id = %s
            ORDER BY service_date ASC
            LIMIT 1
        """, (client_id,))
        
        first_service = cursor.fetchone()
        
        # Find earliest visit
        cursor.execute("""
            SELECT created_by, visit_date
            FROM visits
            WHERE client_id = %s
            ORDER BY visit_date ASC
            LIMIT 1
        """, (client_id,))
        
        first_visit = cursor.fetchone()
        
        # Determine who should be credited
        new_created_by = None
        attribution_source = None
        
        if first_service and first_visit:
            # Both exist, pick the earlier one
            service_worker, service_date = first_service
            visit_worker, visit_date = first_visit
            
            if service_date <= visit_date:
                new_created_by = service_worker
                attribution_source = f"first service on {service_date}"
            else:
                new_created_by = visit_worker
                attribution_source = f"first visit on {visit_date}"
        elif first_service:
            service_worker, service_date = first_service
            new_created_by = service_worker
            attribution_source = f"first service on {service_date}"
        elif first_visit:
            visit_worker, visit_date = first_visit
            new_created_by = visit_worker
            attribution_source = f"first visit on {visit_date}"
        else:
            # No services or visits at all
            no_services_count += 1
            print(f"[{idx}/{total_clients}] ⚠️  {first_name} {last_name} - No services/visits, leaving as is")
            continue
        
        # Update the client's created_by if it's different
        if new_created_by and new_created_by != current_created_by:
            cursor.execute("""
                UPDATE clients
                SET created_by = %s
                WHERE id = %s
            """, (new_created_by, client_id))
            
            # Get worker name for reporting
            cursor.execute("""
                SELECT first_name, last_name, email
                FROM users
                WHERE id = %s
            """, (new_created_by,))
            
            worker_info = cursor.fetchone()
            if worker_info:
                worker_name = f"{worker_info[0]} {worker_info[1]} ({worker_info[2]})"
            else:
                worker_name = str(new_created_by)
            
            updated_count += 1
            print(f"[{idx}/{total_clients}] ✅ {first_name} {last_name} → {worker_name}")
            print(f"              Attribution: {attribution_source}")
            
            # Commit every 10 updates
            if updated_count % 10 == 0:
                conn.commit()
        else:
            unchanged_count += 1
            if idx % 50 == 0:  # Only print every 50th to reduce spam
                print(f"[{idx}/{total_clients}] ⏭️  Already correct (skipped {unchanged_count} so far)")
    
    # Final commit
    conn.commit()
    
    print("\n" + "=" * 80)
    print("MIGRATION COMPLETE!")
    print("=" * 80)
    print(f"\nTotal clients processed: {total_clients}")
    print(f"✅ Updated: {updated_count}")
    print(f"⏭️  Unchanged (already correct): {unchanged_count}")
    print(f"⚠️  No services/visits (left as is): {no_services_count}")
    print("\n" + "=" * 80)
    print("\nNext steps:")
    print("1. Backend will now use simple COUNT(clients WHERE created_by = worker.id)")
    print("2. Workers page will show accurate client counts")
    print("3. For new clients going forward, created_by is set correctly when created")
    print("=" * 80 + "\n")
    
    cursor.close()
    conn.close()

if __name__ == "__main__":
    try:
        fix_historical_clients()
    except Exception as e:
        print(f"\n❌ ERROR: {e}")
        import traceback
        traceback.print_exc()

