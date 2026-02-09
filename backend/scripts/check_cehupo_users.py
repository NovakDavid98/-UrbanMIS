#!/usr/bin/env python3
"""
Check what user we're logged in as in CeHuPo and look for user management
"""

import asyncio
import httpx
from bs4 import BeautifulSoup

BASE_URL = "https://customer.cehupo.cz"
LOGIN_URL = f"{BASE_URL}/user/authenticate"
CEHUPO_USERNAME = "DavidNovak"
CEHUPO_PASSWORD = "Supr414nd!"

async def check_current_user():
    """Check what user we're logged in as"""
    
    async with httpx.AsyncClient(timeout=30.0, follow_redirects=True) as client:
        # Login
        print("🔐 Logging in to CeHuPo...")
        await client.get(f"{BASE_URL}/user")
        login_response = await client.post(
            LOGIN_URL,
            data={'action': 'auth', 'username': CEHUPO_USERNAME, 'password': CEHUPO_PASSWORD},
            follow_redirects=True
        )
        
        if login_response.status_code != 200:
            print("❌ Login failed!")
            return
        
        print("✅ Logged in successfully")
        print()
        
        # Get home page to check current user
        home_response = await client.get(f"{BASE_URL}/home")
        soup = BeautifulSoup(home_response.text, 'html.parser')
        
        # Look for user info in navigation
        print("=" * 70)
        print("👤 CURRENT USER IN CEHUPO PORTAL:")
        print("=" * 70)
        
        # Find user dropdown or profile info
        user_info = soup.find('li', class_='dropdown user user-menu')
        if user_info:
            print(f"Found user info: {user_info.get_text(strip=True)}")
        
        # Look for username in page
        username_elem = soup.find(string=lambda text: text and CEHUPO_USERNAME in text)
        if username_elem:
            print(f"Username: {CEHUPO_USERNAME}")
        
        # Check if there's a user management link
        print()
        print("=" * 70)
        print("🔍 CHECKING FOR USER MANAGEMENT:")
        print("=" * 70)
        
        # Look for links that might be user management
        all_links = soup.find_all('a', href=True)
        user_related = []
        
        for link in all_links:
            href = link.get('href', '')
            text = link.get_text(strip=True)
            if any(word in href.lower() or word in text.lower() 
                   for word in ['user', 'admin', 'uzivatel', 'настав', 'setting']):
                user_related.append((text, href))
        
        if user_related:
            print("Found potential user management links:")
            for text, href in user_related[:10]:
                print(f"  - {text}: {href}")
        else:
            print("❌ No user management links found")
        
        # Try to directly access user management pages
        print()
        print("=" * 70)
        print("🔍 TRYING COMMON USER MANAGEMENT URLS:")
        print("=" * 70)
        
        common_urls = [
            '/user/list',
            '/users',
            '/admin/users',
            '/user/manage',
            '/settings/users'
        ]
        
        for url in common_urls:
            try:
                response = await client.get(f"{BASE_URL}{url}")
                if response.status_code == 200:
                    print(f"✅ {url} - FOUND (Status: 200)")
                    # Check if it has user list
                    if 'table' in response.text.lower():
                        print(f"   → Contains table, likely user list!")
                elif response.status_code == 403:
                    print(f"🔒 {url} - Forbidden (no permission)")
                elif response.status_code == 404:
                    print(f"❌ {url} - Not found")
                else:
                    print(f"⚠️  {url} - Status: {response.status_code}")
            except Exception as e:
                print(f"❌ {url} - Error: {e}")
        
        print()
        print("=" * 70)

if __name__ == '__main__':
    asyncio.run(check_current_user())

