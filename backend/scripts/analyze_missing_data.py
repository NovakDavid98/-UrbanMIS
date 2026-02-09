#!/usr/bin/env python3
"""
Analyze Missing Data in CEHUPO Database
Compares database with source data to identify gaps
"""

import psycopg2
import json
from datetime import datetime
from typing import Dict, List
import csv

# Database config
DB_CONFIG = {
    'host': 'localhost',
    'port': 5432,
    'database': 'centralnimozek_cehupo',
    'user': 'postgres',
    'password': 'IDvEg1WH40wVn7aa8MT9haYsbtRhF1PC'
}

class MissingDataAnalyzer:
    """Analyzes missing data across all clients"""
    
    def __init__(self):
        self.conn = None
        self.cursor = None
        self.missing_data_report = []
        
    def connect(self):
        """Connect to database"""
        self.conn = psycopg2.connect(**DB_CONFIG)
        self.cursor = self.conn.cursor()
        print("✅ Connected to database")
    
    def disconnect(self):
        """Disconnect from database"""
        if self.cursor:
            self.cursor.close()
        if self.conn:
            self.conn.close()
            print("🔌 Disconnected from database")
    
    def analyze_all_clients(self):
        """Analyze missing data for all clients"""
        print("\n📊 Analyzing all clients...")
        
        # Get all clients from database
        self.cursor.execute("""
            SELECT 
                id, first_name, last_name, date_of_birth,
                czech_city, czech_address, czech_phone, ukrainian_phone,
                email, ukrainian_region, insurance_company,
                visa_number, notes, created_at
            FROM clients
            ORDER BY created_at DESC
        """)
        
        clients = self.cursor.fetchall()
        columns = [desc[0] for desc in self.cursor.description]
        
        print(f"Found {len(clients)} clients in database")
        
        # Statistics
        stats = {
            'total': len(clients),
            'missing_email': 0,
            'missing_phone_cz': 0,
            'missing_phone_ua': 0,
            'missing_address': 0,
            'missing_city': 0,
            'missing_region': 0,
            'missing_insurance': 0,
            'missing_multiple': 0,
            'complete': 0
        }
        
        # Analyze each client
        for row in clients:
            # Convert tuple to dict
            client = dict(zip(columns, row))
            missing_fields = []
            
            # Check each field
            if not client['email'] or str(client['email']).strip() == '':
                missing_fields.append('email')
                stats['missing_email'] += 1
            
            if not client['czech_phone'] or str(client['czech_phone']).strip() == '':
                missing_fields.append('phone_cz')
                stats['missing_phone_cz'] += 1
            
            if not client['ukrainian_phone'] or str(client['ukrainian_phone']).strip() == '':
                missing_fields.append('phone_ua')
                stats['missing_phone_ua'] += 1
            
            if not client['czech_address'] or str(client['czech_address']).strip() == '':
                missing_fields.append('address')
                stats['missing_address'] += 1
            
            if not client['czech_city'] or str(client['czech_city']).strip() == '':
                missing_fields.append('city')
                stats['missing_city'] += 1
            
            if not client['ukrainian_region'] or str(client['ukrainian_region']).strip() == '':
                missing_fields.append('region')
                stats['missing_region'] += 1
            
            if not client['insurance_company'] or str(client['insurance_company']).strip() == '':
                missing_fields.append('insurance')
                stats['missing_insurance'] += 1
            
            # Determine severity
            severity = 'Low'
            if len(missing_fields) >= 5:
                severity = 'Critical'
                stats['missing_multiple'] += 1
            elif len(missing_fields) >= 3:
                severity = 'High'
            elif len(missing_fields) >= 1:
                severity = 'Medium'
            else:
                stats['complete'] += 1
            
            # Add to report if any missing
            if missing_fields:
                self.missing_data_report.append({
                    'client_id': str(client['id']),
                    'first_name': client['first_name'],
                    'last_name': client['last_name'],
                    'date_of_birth': str(client['date_of_birth']) if client['date_of_birth'] else '',
                    'missing_fields': ', '.join(missing_fields),
                    'missing_count': len(missing_fields),
                    'severity': severity,
                    'created_at': str(client['created_at'])
                })
        
        return stats
    
    def print_statistics(self, stats: Dict):
        """Print analysis statistics"""
        print("\n" + "="*70)
        print("📊 MISSING DATA STATISTICS")
        print("="*70)
        print(f"\n📈 Total Clients: {stats['total']}")
        print(f"✅ Complete Data: {stats['complete']} ({stats['complete']/stats['total']*100:.1f}%)")
        print(f"⚠️  Missing Some Data: {stats['total'] - stats['complete']} ({(stats['total']-stats['complete'])/stats['total']*100:.1f}%)")
        print(f"🔴 Missing Multiple Fields: {stats['missing_multiple']} ({stats['missing_multiple']/stats['total']*100:.1f}%)")
        
        print("\n📋 Missing Fields Breakdown:")
        print(f"  • Email: {stats['missing_email']} ({stats['missing_email']/stats['total']*100:.1f}%)")
        print(f"  • Phone CZ: {stats['missing_phone_cz']} ({stats['missing_phone_cz']/stats['total']*100:.1f}%)")
        print(f"  • Phone UA: {stats['missing_phone_ua']} ({stats['missing_phone_ua']/stats['total']*100:.1f}%)")
        print(f"  • Address: {stats['missing_address']} ({stats['missing_address']/stats['total']*100:.1f}%)")
        print(f"  • City: {stats['missing_city']} ({stats['missing_city']/stats['total']*100:.1f}%)")
        print(f"  • Region: {stats['missing_region']} ({stats['missing_region']/stats['total']*100:.1f}%)")
        print(f"  • Insurance: {stats['missing_insurance']} ({stats['missing_insurance']/stats['total']*100:.1f}%)")
        print("="*70)
    
    def save_report(self, filename: str = 'missing_data_report.csv'):
        """Save detailed report to CSV"""
        if not self.missing_data_report:
            print("\n✅ No missing data to report!")
            return
        
        # Sort by severity and missing count
        severity_order = {'Critical': 0, 'High': 1, 'Medium': 2, 'Low': 3}
        self.missing_data_report.sort(
            key=lambda x: (severity_order[x['severity']], -x['missing_count'])
        )
        
        # Write CSV
        with open(filename, 'w', newline='', encoding='utf-8') as f:
            fieldnames = ['severity', 'client_id', 'first_name', 'last_name', 
                         'date_of_birth', 'missing_count', 'missing_fields', 'created_at']
            writer = csv.DictWriter(f, fieldnames=fieldnames)
            
            writer.writeheader()
            writer.writerows(self.missing_data_report)
        
        print(f"\n📄 Detailed report saved to: {filename}")
        print(f"   {len(self.missing_data_report)} clients with missing data")
    
    def save_client_ids_for_reextraction(self, filename: str = 'clients_to_reextract.txt'):
        """Save list of client IDs that need re-extraction"""
        # Filter clients with missing email, phone, or address (critical fields)
        critical_missing = [
            item for item in self.missing_data_report
            if any(field in item['missing_fields'] for field in ['email', 'phone_cz', 'address'])
        ]
        
        if not critical_missing:
            print("\n✅ No clients need re-extraction!")
            return
        
        with open(filename, 'w') as f:
            for item in critical_missing:
                f.write(f"{item['client_id']}\n")
        
        print(f"\n📝 Client IDs for re-extraction saved to: {filename}")
        print(f"   {len(critical_missing)} clients need detail re-extraction")

def main():
    """Main execution"""
    analyzer = MissingDataAnalyzer()
    
    try:
        # Connect to database
        analyzer.connect()
        
        # Analyze all clients
        stats = analyzer.analyze_all_clients()
        
        # Print statistics
        analyzer.print_statistics(stats)
        
        # Save reports
        analyzer.save_report('missing_data_report.csv')
        analyzer.save_client_ids_for_reextraction('clients_to_reextract.txt')
        
        # Disconnect
        analyzer.disconnect()
        
        print("\n✅ Analysis complete!")
        
    except Exception as e:
        print(f"\n❌ Error: {e}")
        import traceback
        traceback.print_exc()

if __name__ == '__main__':
    main()
