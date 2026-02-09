#!/usr/bin/env python3
"""
Check Nina Mozharska's visits in CeHuPo customer portal
"""

import asyncio
import httpx
from bs4 import BeautifulSoup
from datetime import datetime

BASE_URL = "https://customer.cehupo.cz"
LOGIN_URL = f"{BASE_URL}/user/authenticate"
CEHUPO_USERNAME = "DavidNovak"
CEHUPO_PASSWORD = "Supr414nd!"
NINA_CEHUPO_ID = 1937

async def check_nina_visits():
    print("=" * 80)
    print("🔍 CHECKING NINA MOZHARSKA IN CEHUPO CUSTOMER PORTAL")
    print("=" * 80)
    print()
    
    async with httpx.AsyncClient(timeout=30.0, follow_redirects=True) as client:
        # Login
        print("🔐 Logging in...")
        await client.get(f"{BASE_URL}/user")
        await client.post(
            LOGIN_URL,
            data={'action': 'auth', 'username': CEHUPO_USERNAME, 'password': CEHUPO_PASSWORD},
            follow_redirects=True
        )
        print("✅ Logged in")
        print()
        
        # Get Nina's detail page
        url = f"{BASE_URL}/customer/viewcustomer/{NINA_CEHUPO_ID}"
        print(f"📄 Fetching Nina's page: {url}")
        response = await client.get(url)
        
        if response.status_code != 200:
            print(f"❌ Failed to fetch page (Status: {response.status_code})")
            return
        
        soup = BeautifulSoup(response.text, 'html.parser')
        
        # Find visits table
        print()
        print("=" * 80)
        print("📅 VISITS IN CEHUPO PORTAL:")
        print("=" * 80)
        
        # Look for visit log section
        visit_tables = soup.find_all('table')
        
        visit_count = 0
        for table in visit_tables:
            rows = table.find_all('tr')
            # Check if this looks like a visit log table
            if len(rows) > 1:
                header = rows[0].get_text()
                if any(word in header.lower() for word in ['date', 'datum', 'время', 'дата', 'посещен']):
                    visit_count = len(rows) - 1  # Minus header row
                    print(f"✅ Found visit table with {visit_count} row(s)")
                    
                    # Show first few visits
                    print()
                    print("First 5 visits:")
                    for i, row in enumerate(rows[1:6], 1):
                        cells = row.find_all('td')
                        if cells:
                            print(f"  {i}. {' | '.join(cell.get_text(strip=True)[:50] for cell in cells[:3])}")
                    
                    if visit_count > 5:
                        print(f"  ... and {visit_count - 5} more visits")
                    break
        
        if visit_count == 0:
            print("❌ No visit table found on Nina's page")
            print()
            print("Checking for 'Výkony' (Services) section...")
            
            # Look for any mention of visits/services
            if 'Výkony' in response.text:
                print("✅ Found 'Výkony' section")
                # Extract the number
                import re
                match = re.search(r'Výkony\s*\((\d+)\)', response.text)
                if match:
                    count = match.group(1)
                    print(f"   📊 Výkony count: {count}")
            else:
                print("❌ No 'Výkony' section found")
        
        print()
        print("=" * 80)
        print("📊 COMPARISON:")
        print("=" * 80)
        print(f"Visits in CeHuPo portal: {visit_count if visit_count > 0 else 'Unknown'}")
        print(f"Visits in our database: 25")
        print()
        
        if visit_count > 0 and visit_count != 25:
            print(f"⚠️  MISMATCH! CeHuPo has {visit_count}, we have 25")
        elif visit_count == 25:
            print("✅ MATCH! Both systems have 25 visits")
        
        print("=" * 80)

if __name__ == '__main__':
    asyncio.run(check_nina_visits())

