#!/usr/bin/env python3
"""
WORKING-AGE MALES EMPLOYMENT CANDIDATES FINDER
Uses multiple smart queries and strategies to identify potential work candidates
"""

import psycopg2
from datetime import datetime, date
import json
from collections import defaultdict
import re

DB_CONFIG = {
    'host': 'localhost',
    'port': 5432,
    'database': 'centralnimozek_cehupo',
    'user': 'postgres',
    'password': 'IDvEg1WH40wVn7aa8MT9haYsbtRhF1PC'
}

class WorkCandidateFinder:
    
    def __init__(self):
        self.conn = psycopg2.connect(**DB_CONFIG)
        self.cursor = self.conn.cursor()
        self.candidates = {}  # client_id -> candidate data
        self.scores = {}  # client_id -> priority score
        
    def calculate_age(self, birth_date):
        """Calculate age from birth date"""
        if not birth_date:
            return None
        today = date.today()
        return today.year - birth_date.year - ((today.month, today.day) < (birth_date.month, birth_date.day))
    
    def add_candidate(self, client_id, data, reason, score_boost=0):
        """Add or update candidate with reason and score"""
        if client_id not in self.candidates:
            self.candidates[client_id] = {
                'id': client_id,
                'name': data['name'],
                'age': data['age'],
                'phone_cz': data['phone_cz'],
                'phone_ua': data['phone_ua'],
                'email': data['email'],
                'profession': data['profession'],
                'education': data['education'],
                'has_work': data['has_work'],
                'needs_job_help': data['needs_job_help'],
                'city': data['city'],
                'reasons': [],
                'priority_score': 0
            }
            self.scores[client_id] = 0
        
        self.candidates[client_id]['reasons'].append(reason)
        self.scores[client_id] += score_boost
        self.candidates[client_id]['priority_score'] = self.scores[client_id]
    
    def strategy_1_explicit_job_seekers(self):
        """Strategy 1: Clients who explicitly need job help or are searching"""
        print("\n📋 Strategy 1: Explicit Job Seekers")
        print("="*80)
        
        self.cursor.execute("""
            SELECT 
                id, 
                first_name || ' ' || last_name as name,
                date_of_birth,
                czech_phone,
                ukrainian_phone,
                email,
                profession_ukraine,
                education_level,
                has_work_czech,
                needs_job_help,
                czech_city
            FROM clients
            WHERE gender = 'Muž' 
            AND (needs_job_help = TRUE OR has_work_czech = FALSE)
            AND date_of_birth IS NOT NULL
            AND EXTRACT(YEAR FROM AGE(date_of_birth)) BETWEEN 18 AND 65
            AND is_active = TRUE
        """)
        
        count = 0
        for row in self.cursor.fetchall():
            age = self.calculate_age(row[2])
            data = {
                'name': row[1],
                'age': age,
                'phone_cz': row[3] or '',
                'phone_ua': row[4] or '',
                'email': row[5] or '',
                'profession': row[6] or '',
                'education': row[7] or '',
                'has_work': row[8],
                'needs_job_help': row[9],
                'city': row[10] or ''
            }
            
            reason = "Explicitly seeking job help" if row[9] else "Does not have work"
            score = 10 if row[9] else 5
            self.add_candidate(row[0], data, reason, score)
            count += 1
        
        print(f"✅ Found {count} explicit job seekers")
    
    def strategy_2_skilled_workers(self):
        """Strategy 2: Males with professions/education but no work"""
        print("\n📋 Strategy 2: Skilled Workers Without Employment")
        print("="*80)
        
        self.cursor.execute("""
            SELECT 
                id, 
                first_name || ' ' || last_name as name,
                date_of_birth,
                czech_phone,
                ukrainian_phone,
                email,
                profession_ukraine,
                education_level,
                has_work_czech,
                needs_job_help,
                czech_city
            FROM clients
            WHERE gender = 'Muž' 
            AND (profession_ukraine IS NOT NULL AND profession_ukraine <> '')
            AND has_work_czech = FALSE
            AND date_of_birth IS NOT NULL
            AND EXTRACT(YEAR FROM AGE(date_of_birth)) BETWEEN 18 AND 65
            AND is_active = TRUE
        """)
        
        count = 0
        for row in self.cursor.fetchall():
            age = self.calculate_age(row[2])
            data = {
                'name': row[1],
                'age': age,
                'phone_cz': row[3] or '',
                'phone_ua': row[4] or '',
                'email': row[5] or '',
                'profession': row[6] or '',
                'education': row[7] or '',
                'has_work': row[8],
                'needs_job_help': row[9],
                'city': row[10] or ''
            }
            
            reason = f"Has profession ({row[6]}) but no work"
            self.add_candidate(row[0], data, reason, 8)
            count += 1
        
        print(f"✅ Found {count} skilled workers without employment")
    
    def strategy_3_educated_candidates(self):
        """Strategy 3: Males with higher education"""
        print("\n📋 Strategy 3: Educated Candidates")
        print("="*80)
        
        # Higher education keywords in Russian/Ukrainian
        education_keywords = ['Высшее', 'высшее', 'университет', 'Universitet']
        
        self.cursor.execute("""
            SELECT 
                id, 
                first_name || ' ' || last_name as name,
                date_of_birth,
                czech_phone,
                ukrainian_phone,
                email,
                profession_ukraine,
                education_level,
                has_work_czech,
                needs_job_help,
                czech_city
            FROM clients
            WHERE gender = 'Muž' 
            AND education_level IS NOT NULL
            AND date_of_birth IS NOT NULL
            AND EXTRACT(YEAR FROM AGE(date_of_birth)) BETWEEN 18 AND 65
            AND is_active = TRUE
        """)
        
        count = 0
        for row in self.cursor.fetchall():
            education = row[7] or ''
            # Check if higher education
            is_higher_ed = any(keyword in education for keyword in education_keywords)
            
            if is_higher_ed:
                age = self.calculate_age(row[2])
                data = {
                    'name': row[1],
                    'age': age,
                    'phone_cz': row[3] or '',
                    'phone_ua': row[4] or '',
                    'email': row[5] or '',
                    'profession': row[6] or '',
                    'education': row[7] or '',
                    'has_work': row[8],
                    'needs_job_help': row[9],
                    'city': row[10] or ''
                }
                
                reason = f"Higher education: {education}"
                score = 7 if not row[8] else 3  # Higher score if no work
                self.add_candidate(row[0], data, reason, score)
                count += 1
        
        print(f"✅ Found {count} candidates with higher education")
    
    def strategy_4_text_analysis(self):
        """Strategy 4: Text analysis for work-related keywords"""
        print("\n📋 Strategy 4: Text Analysis for Work Interest")
        print("="*80)
        
        # Keywords indicating work interest (Russian/Ukrainian/Czech)
        work_keywords = [
            'práce', 'práci', 'prací', 'pracovat', 'zaměstnání', 'job',
            'работа', 'работу', 'робота', 'роботу', 'employment'
        ]
        
        self.cursor.execute("""
            SELECT 
                id, 
                first_name || ' ' || last_name as name,
                date_of_birth,
                czech_phone,
                ukrainian_phone,
                email,
                profession_ukraine,
                education_level,
                has_work_czech,
                needs_job_help,
                czech_city,
                help_needed,
                notes,
                volunteer_notes
            FROM clients
            WHERE gender = 'Muž' 
            AND date_of_birth IS NOT NULL
            AND EXTRACT(YEAR FROM AGE(date_of_birth)) BETWEEN 18 AND 65
            AND is_active = TRUE
            AND (
                help_needed IS NOT NULL OR 
                notes IS NOT NULL OR 
                volunteer_notes IS NOT NULL
            )
        """)
        
        count = 0
        for row in self.cursor.fetchall():
            help_text = (row[11] or '').lower()
            notes_text = (row[12] or '').lower()
            volunteer_text = (row[13] or '').lower()
            combined_text = f"{help_text} {notes_text} {volunteer_text}"
            
            # Check for work keywords
            found_keywords = [kw for kw in work_keywords if kw in combined_text]
            
            if found_keywords:
                age = self.calculate_age(row[2])
                data = {
                    'name': row[1],
                    'age': age,
                    'phone_cz': row[3] or '',
                    'phone_ua': row[4] or '',
                    'email': row[5] or '',
                    'profession': row[6] or '',
                    'education': row[7] or '',
                    'has_work': row[8],
                    'needs_job_help': row[9],
                    'city': row[10] or ''
                }
                
                reason = f"Mentions work in text: {', '.join(found_keywords)}"
                self.add_candidate(row[0], data, reason, 6)
                count += 1
        
        print(f"✅ Found {count} candidates mentioning work in text")
    
    def strategy_5_prime_age_workers(self):
        """Strategy 5: Prime working age males (25-45)"""
        print("\n📋 Strategy 5: Prime Working Age (25-45)")
        print("="*80)
        
        self.cursor.execute("""
            SELECT 
                id, 
                first_name || ' ' || last_name as name,
                date_of_birth,
                czech_phone,
                ukrainian_phone,
                email,
                profession_ukraine,
                education_level,
                has_work_czech,
                needs_job_help,
                czech_city
            FROM clients
            WHERE gender = 'Muž' 
            AND date_of_birth IS NOT NULL
            AND EXTRACT(YEAR FROM AGE(date_of_birth)) BETWEEN 25 AND 45
            AND is_active = TRUE
        """)
        
        count = 0
        for row in self.cursor.fetchall():
            age = self.calculate_age(row[2])
            data = {
                'name': row[1],
                'age': age,
                'phone_cz': row[3] or '',
                'phone_ua': row[4] or '',
                'email': row[5] or '',
                'profession': row[6] or '',
                'education': row[7] or '',
                'has_work': row[8],
                'needs_job_help': row[9],
                'city': row[10] or ''
            }
            
            reason = f"Prime working age: {age} years"
            score = 5 if not row[8] else 2
            self.add_candidate(row[0], data, reason, score)
            count += 1
        
        print(f"✅ Found {count} prime working age males")
    
    def strategy_6_contactable_candidates(self):
        """Strategy 6: Boost score for candidates with contact info"""
        print("\n📋 Strategy 6: Prioritizing Contactable Candidates")
        print("="*80)
        
        contacted = 0
        for client_id, candidate in self.candidates.items():
            contact_boost = 0
            reasons = []
            
            if candidate['phone_cz']:
                contact_boost += 3
                reasons.append("Has Czech phone")
            if candidate['phone_ua']:
                contact_boost += 2
                reasons.append("Has Ukrainian phone")
            if candidate['email']:
                contact_boost += 2
                reasons.append("Has email")
            
            if contact_boost > 0:
                self.scores[client_id] += contact_boost
                candidate['priority_score'] = self.scores[client_id]
                candidate['reasons'].extend(reasons)
                contacted += 1
        
        print(f"✅ Boosted {contacted} candidates with contact information")
    
    def generate_report(self):
        """Generate comprehensive report"""
        print("\n" + "="*80)
        print("  EMPLOYMENT CANDIDATES ANALYSIS COMPLETE")
        print("="*80)
        
        # Sort by priority score
        sorted_candidates = sorted(
            self.candidates.values(),
            key=lambda x: x['priority_score'],
            reverse=True
        )
        
        # Statistics
        total = len(sorted_candidates)
        
        if total == 0:
            print(f"\n⚠️  No candidates found matching criteria")
            return []
        
        with_phone = sum(1 for c in sorted_candidates if c['phone_cz'] or c['phone_ua'])
        with_email = sum(1 for c in sorted_candidates if c['email'])
        with_profession = sum(1 for c in sorted_candidates if c['profession'])
        needs_help = sum(1 for c in sorted_candidates if c['needs_job_help'])
        
        print(f"\n📊 STATISTICS:")
        print(f"   Total candidates: {total}")
        print(f"   With phone: {with_phone} ({with_phone/total*100:.1f}%)")
        print(f"   With email: {with_email} ({with_email/total*100:.1f}%)")
        print(f"   With profession: {with_profession} ({with_profession/total*100:.1f}%)")
        print(f"   Explicitly need job help: {needs_help} ({needs_help/total*100:.1f}%)")
        
        # Age distribution
        age_groups = defaultdict(int)
        for c in sorted_candidates:
            if c['age']:
                if c['age'] < 25:
                    age_groups['18-24'] += 1
                elif c['age'] < 35:
                    age_groups['25-34'] += 1
                elif c['age'] < 45:
                    age_groups['35-44'] += 1
                elif c['age'] < 55:
                    age_groups['45-54'] += 1
                else:
                    age_groups['55-65'] += 1
        
        print(f"\n📊 AGE DISTRIBUTION:")
        for age_range, count in sorted(age_groups.items()):
            print(f"   {age_range}: {count} ({count/total*100:.1f}%)")
        
        # City distribution (top 10)
        city_counts = defaultdict(int)
        for c in sorted_candidates:
            if c['city']:
                city_counts[c['city']] += 1
        
        print(f"\n📊 TOP CITIES:")
        for city, count in sorted(city_counts.items(), key=lambda x: x[1], reverse=True)[:10]:
            print(f"   {city}: {count}")
        
        # Save to JSON
        output_file = f"work_candidates_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
        with open(output_file, 'w', encoding='utf-8') as f:
            json.dump({
                'generated_at': datetime.now().isoformat(),
                'total_candidates': total,
                'statistics': {
                    'with_phone': with_phone,
                    'with_email': with_email,
                    'with_profession': with_profession,
                    'needs_help': needs_help
                },
                'age_distribution': dict(age_groups),
                'city_distribution': dict(city_counts),
                'candidates': sorted_candidates
            }, f, indent=2, ensure_ascii=False)
        
        print(f"\n✅ Full report saved to: {output_file}")
        
        # Print top 50 candidates
        print("\n" + "="*80)
        print("  TOP 50 PRIORITY CANDIDATES")
        print("="*80)
        print(f"{'#':<4} {'Name':<30} {'Age':<5} {'Score':<6} {'Phone CZ':<15} {'City':<20}")
        print("-"*80)
        
        for i, candidate in enumerate(sorted_candidates[:50], 1):
            print(f"{i:<4} {candidate['name']:<30} {candidate['age'] or 'N/A':<5} "
                  f"{candidate['priority_score']:<6} {candidate['phone_cz']:<15} {candidate['city']:<20}")
        
        # Save CSV for easy use
        csv_file = f"work_candidates_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"
        with open(csv_file, 'w', encoding='utf-8') as f:
            f.write("Priority,Name,Age,Phone_CZ,Phone_UA,Email,Profession,Education,City,Reasons\n")
            for i, c in enumerate(sorted_candidates, 1):
                reasons = '; '.join(c['reasons'])
                f.write(f"{i},{c['name']},{c['age'] or 'N/A'},{c['phone_cz']},{c['phone_ua']},"
                       f"{c['email']},{c['profession']},{c['education']},{c['city']},\"{reasons}\"\n")
        
        print(f"\n✅ CSV export saved to: {csv_file}")
        
        return sorted_candidates
    
    def run_analysis(self):
        """Run all strategies"""
        print("="*80)
        print("  WORKING-AGE MALES EMPLOYMENT CANDIDATES FINDER")
        print("  Multi-Strategy Analysis")
        print("="*80)
        
        self.strategy_1_explicit_job_seekers()
        self.strategy_2_skilled_workers()
        self.strategy_3_educated_candidates()
        self.strategy_4_text_analysis()
        self.strategy_5_prime_age_workers()
        self.strategy_6_contactable_candidates()
        
        results = self.generate_report()
        
        return results
    
    def close(self):
        self.cursor.close()
        self.conn.close()


if __name__ == '__main__':
    finder = WorkCandidateFinder()
    try:
        candidates = finder.run_analysis()
        print(f"\n🎯 Analysis complete! Found {len(candidates)} employment candidates")
    finally:
        finder.close()
