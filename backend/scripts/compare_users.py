#!/usr/bin/env python3
"""
Compare users between CeHuPo portal and our centralnimozek system
"""

import asyncio
import httpx
from bs4 import BeautifulSoup
import psycopg2
from psycopg2.extras import RealDictCursor

BASE_URL = "https://customer.cehupo.cz"
LOGIN_URL = f"{BASE_URL}/user/authenticate"
CEHUPO_USERNAME = "DavidNovak"
CEHUPO_PASSWORD = "Supr414nd!"

DB_CONFIG = {
    'dbname': 'centralnimozek_cehupo',
    'user': 'postgres',
    'password': 'IDvEg1WH40wVn7aa8MT9haYsbtRhF1PC',
    'host': 'localhost',
    'port': '5432'
}

async def get_cehupo_users():
    """Get user list from CeHuPo portal"""
    
    async with httpx.AsyncClient(timeout=30.0, follow_redirects=True) as client:
        # Login
        await client.get(f"{BASE_URL}/user")
        await client.post(
            LOGIN_URL,
            data={'action': 'auth', 'username': CEHUPO_USERNAME, 'password': CEHUPO_PASSWORD},
            follow_redirects=True
        )
        
        # Get user list
        response = await client.get(f"{BASE_URL}/user/list")
        soup = BeautifulSoup(response.text, 'html.parser')
        
        users = []
        
        # Find user table
        table = soup.find('table')
        if table:
            rows = table.find_all('tr')[1:]  # Skip header
            
            for row in rows:
                cells = row.find_all('td')
                if len(cells) >= 3:
                    user = {
                        'username': cells[0].get_text(strip=True),
                        'full_name': cells[1].get_text(strip=True),
                        'email': cells[2].get_text(strip=True) if len(cells) > 2 else '',
                        'role': cells[3].get_text(strip=True) if len(cells) > 3 else ''
                    }
                    users.append(user)
        
        return users

def get_our_users():
    """Get users from our database"""
    conn = psycopg2.connect(**DB_CONFIG)
    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute("""
                SELECT username, email, first_name, last_name, role, is_active
                FROM users
                ORDER BY username
            """)
            return cur.fetchall()
    finally:
        conn.close()

async def main():
    print("=" * 80)
    print("👥 USER COMPARISON: CeHuPo Portal vs Centralnimozek App")
    print("=" * 80)
    print()
    
    print("📥 Fetching CeHuPo users...")
    cehupo_users = await get_cehupo_users()
    print(f"   Found {len(cehupo_users)} users in CeHuPo")
    
    print("📥 Fetching Centralnimozek users...")
    our_users = get_our_users()
    print(f"   Found {len(our_users)} users in our system")
    
    print()
    print("=" * 80)
    print("🔍 CEHUPO PORTAL USERS:")
    print("=" * 80)
    
    for i, user in enumerate(cehupo_users, 1):
        print(f"{i}. @{user['username']}")
        print(f"   Name: {user['full_name']}")
        print(f"   Email: {user['email']}")
        print(f"   Role: {user['role']}")
        print()
    
    print("=" * 80)
    print("🔍 CENTRALNIMOZEK USERS:")
    print("=" * 80)
    
    for i, user in enumerate(our_users, 1):
        status = '✅' if user['is_active'] else '❌'
        print(f"{i}. @{user['username']} {status}")
        print(f"   Name: {user['first_name']} {user['last_name']}")
        print(f"   Email: {user['email']}")
        print(f"   Role: {user['role']}")
        print()
    
    print("=" * 80)
    print("📊 COMPARISON SUMMARY:")
    print("=" * 80)
    
    # Compare
    cehupo_usernames = {u['username'].lower() for u in cehupo_users}
    our_usernames = {u['username'].lower() for u in our_users}
    
    only_in_cehupo = cehupo_usernames - our_usernames
    only_in_our_system = our_usernames - cehupo_usernames
    in_both = cehupo_usernames & our_usernames
    
    print(f"👥 Users in both systems: {len(in_both)}")
    if in_both:
        for username in sorted(in_both):
            print(f"   - @{username}")
    
    print()
    print(f"📍 Only in CeHuPo: {len(only_in_cehupo)}")
    if only_in_cehupo:
        for username in sorted(only_in_cehupo):
            print(f"   - @{username}")
    
    print()
    print(f"📍 Only in Centralnimozek: {len(only_in_our_system)}")
    if only_in_our_system:
        for username in sorted(only_in_our_system):
            print(f"   - @{username}")
            # Check if it's the system user
            for user in our_users:
                if user['username'].lower() == username:
                    if user['email'] == 'system@cehupo.cz':
                        print(f"     ℹ️  This is the auto-created import tracking user")
    
    print()
    print("=" * 80)

if __name__ == '__main__':
    asyncio.run(main())

