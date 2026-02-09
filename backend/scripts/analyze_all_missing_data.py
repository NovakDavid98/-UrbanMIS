#!/usr/bin/env python3
"""
Comprehensive analysis of ALL missing data across all client fields
"""

import psycopg2
import json
from collections import defaultdict

DB_CONFIG = {
    'host': 'localhost',
    'port': 5432,
    'database': 'centralnimozek_cehupo',
    'user': 'postgres',
    'password': 'IDvEg1WH40wVn7aa8MT9haYsbtRhF1PC'
}

def analyze_all_fields():
    """Analyze all client fields for missing data"""
    
    conn = psycopg2.connect(**DB_CONFIG)
    cursor = conn.cursor()
    
    # Get all clients
    cursor.execute("SELECT COUNT(*) FROM clients")
    total_clients = cursor.fetchone()[0]
    
    print(f"{'='*80}")
    print(f"  COMPREHENSIVE MISSING DATA ANALYSIS")
    print(f"{'='*80}")
    print(f"\nTotal Clients: {total_clients}\n")
    
    # Fields to check
    fields_to_check = [
        ('email', 'Email'),
        ('czech_phone', 'Czech Phone'),
        ('ukrainian_phone', 'Ukrainian Phone'),
        ('czech_city', 'Czech City'),
        ('czech_address', 'Czech Address'),
        ('home_address', 'Ukrainian Home Address'),
        ('insurance_company', 'Insurance Company'),
        ('ukrainian_region', 'Ukrainian Region'),
        ('visa_number', 'Visa Number'),
        ('visa_type', 'Visa Type'),
        ('date_of_arrival_czech', 'Arrival Date'),
        ('project_registration_date', 'Registration Date'),
        ('education_level', 'Education Level'),
        ('profession_ukraine', 'Profession in Ukraine'),
        ('hobbies', 'Hobbies'),
        ('volunteer_notes', 'Volunteer Notes'),
        ('volunteer_skills', 'Volunteer Skills'),
        ('help_needed', 'Help Needed'),
        ('notes', 'General Notes')
    ]
    
    results = []
    
    for field_name, display_name in fields_to_check:
        # Count non-null and non-empty
        cursor.execute(f"""
            SELECT 
                COUNT(*) FILTER (WHERE {field_name} IS NOT NULL AND {field_name}::text <> '') as filled,
                COUNT(*) FILTER (WHERE {field_name} IS NULL OR {field_name}::text = '') as empty
            FROM clients
        """)
        
        filled, empty = cursor.fetchone()
        filled_pct = (filled / total_clients * 100) if total_clients > 0 else 0
        empty_pct = (empty / total_clients * 100) if total_clients > 0 else 0
        
        results.append({
            'field': field_name,
            'display_name': display_name,
            'filled': filled,
            'empty': empty,
            'filled_pct': filled_pct,
            'empty_pct': empty_pct
        })
    
    # Sort by most missing
    results.sort(key=lambda x: x['empty'], reverse=True)
    
    print(f"{'Field':<30} {'Filled':<12} {'Missing':<12} {'% Missing'}")
    print(f"{'-'*80}")
    
    critical_missing = []
    moderate_missing = []
    low_missing = []
    
    for r in results:
        status = "🔴" if r['empty_pct'] > 70 else "🟡" if r['empty_pct'] > 30 else "🟢"
        print(f"{status} {r['display_name']:<28} {r['filled']:<12} {r['empty']:<12} {r['empty_pct']:.1f}%")
        
        if r['empty_pct'] > 70:
            critical_missing.append(r)
        elif r['empty_pct'] > 30:
            moderate_missing.append(r)
        else:
            low_missing.append(r)
    
    # Summary
    print(f"\n{'='*80}")
    print(f"  SUMMARY")
    print(f"{'='*80}")
    print(f"🔴 Critical Missing (>70%): {len(critical_missing)} fields")
    print(f"🟡 Moderate Missing (30-70%): {len(moderate_missing)} fields")
    print(f"🟢 Good Coverage (<30%): {len(low_missing)} fields")
    
    # Save detailed report
    report = {
        'total_clients': total_clients,
        'critical_missing': critical_missing,
        'moderate_missing': moderate_missing,
        'low_missing': low_missing,
        'all_fields': results
    }
    
    with open('complete_missing_data_analysis.json', 'w') as f:
        json.dump(report, f, indent=2)
    
    print(f"\n📄 Full report saved to: complete_missing_data_analysis.json")
    
    # List clients with most missing data
    cursor.execute("""
        SELECT 
            id,
            first_name || ' ' || last_name as full_name,
            CASE WHEN email IS NULL OR email = '' THEN 0 ELSE 1 END +
            CASE WHEN czech_phone IS NULL OR czech_phone = '' THEN 0 ELSE 1 END +
            CASE WHEN ukrainian_phone IS NULL OR ukrainian_phone = '' THEN 0 ELSE 1 END +
            CASE WHEN czech_address IS NULL OR czech_address = '' THEN 0 ELSE 1 END +
            CASE WHEN insurance_company IS NULL OR insurance_company = '' THEN 0 ELSE 1 END +
            CASE WHEN education_level IS NULL OR education_level = '' THEN 0 ELSE 1 END
            as fields_filled
        FROM clients
        ORDER BY fields_filled ASC
        LIMIT 20
    """)
    
    print(f"\n{'='*80}")
    print(f"  TOP 20 CLIENTS WITH MOST MISSING DATA")
    print(f"{'='*80}")
    print(f"{'Name':<40} {'Fields Filled (of 6 key fields)'}")
    print(f"{'-'*80}")
    
    for row in cursor.fetchall():
        client_id, name, filled = row
        print(f"{name:<40} {filled}/6")
    
    cursor.close()
    conn.close()

if __name__ == '__main__':
    analyze_all_fields()
