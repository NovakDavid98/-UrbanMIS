#!/usr/bin/env python3
"""
Test extraction on ONE client to debug issues
"""

import asyncio
import httpx
from bs4 import BeautifulSoup
import psycopg2

# Test with Nina Mozharska - CeHuPo ID 1937
TEST_CEHUPO_ID = 1937
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

async def test_login():
    """Test login"""
    print("🔐 Testing login...")
    async with httpx.AsyncClient(timeout=30.0, follow_redirects=True) as client:
        await client.get(f"{BASE_URL}/user")
        response = await client.post(
            LOGIN_URL,
            data={
                'action': 'auth',
                'username': CEHUPO_USERNAME,
                'password': CEHUPO_PASSWORD
            },
            follow_redirects=True
        )
        print(f"   Status: {response.status_code}")
        print(f"   URL: {response.url}")
        if response.status_code == 200:
            print("   ✅ Login successful!")
            return True
        else:
            print("   ❌ Login failed!")
            return False

async def test_fetch_page():
    """Test fetching client page"""
    print(f"\n📄 Testing fetch of client page (ID: {TEST_CEHUPO_ID})...")
    async with httpx.AsyncClient(timeout=30.0, follow_redirects=True) as client:
        # Login first
        await client.get(f"{BASE_URL}/user")
        await client.post(
            LOGIN_URL,
            data={
                'action': 'auth',
                'username': CEHUPO_USERNAME,
                'password': CEHUPO_PASSWORD
            },
            follow_redirects=True
        )
        
        # Fetch client page
        url = f"{BASE_URL}/customer/viewcustomer/{TEST_CEHUPO_ID}"
        print(f"   URL: {url}")
        response = await client.get(url)
        print(f"   Status: {response.status_code}")
        print(f"   Content length: {len(response.text)} bytes")
        
        if response.status_code == 200:
            # Parse and show some fields
            soup = BeautifulSoup(response.text, 'html.parser')
            
            # Find all inputs
            inputs = soup.find_all('input', limit=10)
            print(f"\n   Found {len(inputs)} input fields (showing first 10):")
            for inp in inputs[:10]:
                name = inp.get('name', '(no name)')
                value = inp.get('value', '(no value)')
                print(f"     - {name}: {value[:50]}...")
            
            print("   ✅ Page fetched successfully!")
            return True
        else:
            print("   ❌ Failed to fetch page!")
            return False

def test_database():
    """Test database connection and find clients needing updates"""
    print("\n💾 Testing database connection...")
    try:
        conn = psycopg2.connect(**DB_CONFIG)
        cur = conn.cursor()
        
        # Count clients needing updates
        cur.execute("""
            SELECT COUNT(*) 
            FROM clients 
            WHERE cehupo_id IS NOT NULL 
              AND email IS NULL
        """)
        count = cur.fetchone()[0]
        
        print(f"   ✅ Database connected!")
        print(f"   Found {count} clients missing email")
        
        # Show a few examples
        cur.execute("""
            SELECT first_name, last_name, cehupo_id 
            FROM clients 
            WHERE cehupo_id IS NOT NULL 
              AND email IS NULL
            LIMIT 5
        """)
        
        print(f"\n   Examples:")
        for row in cur.fetchall():
            print(f"     - {row[0]} {row[1]} (CeHuPo ID: {row[2]})")
        
        cur.close()
        conn.close()
        return True
        
    except Exception as e:
        print(f"   ❌ Database error: {e}")
        return False

async def main():
    print("=" * 70)
    print("🧪 TESTING EXTRACTION SCRIPT COMPONENTS")
    print("=" * 70)
    print()
    
    # Test 1: Database
    db_ok = test_database()
    
    # Test 2: Login
    login_ok = await test_login()
    
    # Test 3: Fetch page
    if login_ok:
        fetch_ok = await test_fetch_page()
    
    print()
    print("=" * 70)
    print("📊 TEST RESULTS")
    print("=" * 70)
    print(f"Database: {'✅' if db_ok else '❌'}")
    print(f"Login: {'✅' if login_ok else '❌'}")
    print(f"Page Fetch: {'✅' if login_ok and fetch_ok else '❌'}")
    print("=" * 70)

if __name__ == '__main__':
    asyncio.run(main())

