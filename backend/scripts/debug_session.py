#!/usr/bin/env python3
"""
Debug session handling
"""

import asyncio
import aiohttp

CUSTOMER_BASE_URL = 'https://customer.cehupo.cz'
CUSTOMER_LOGIN_URL = 'https://customer.cehupo.cz/user/auth'
USERNAME = 'hana.dolejsi@cehupo.cz'
PASSWORD = 'Hana1234567+'

async def test_session():
    # Create session with unsafe cookies
    cookie_jar = aiohttp.CookieJar(unsafe=True)
    
    async with aiohttp.ClientSession(cookie_jar=cookie_jar) as session:
        # Login
        print("Logging in...")
        login_data = {
            'action': 'auth',
            'username': USERNAME,
            'password': PASSWORD
        }
        
        async with session.post(CUSTOMER_LOGIN_URL, data=login_data) as response:
            text = await response.text()
            print(f"Login status: {response.status}")
            print(f"Login URL: {response.url}")
            print(f"Cookies after login: {session.cookie_jar}")
            
        # Test home page
        print("\nTesting home page...")
        async with session.get(f"{CUSTOMER_BASE_URL}/home") as response:
            text = await response.text()
            print(f"Home status: {response.status}")
            print(f"Home URL: {response.url}")
            print(f"Response length: {len(text)}")
            print(f"Has 'Signin': {'Signin' in text}")
            print(f"Has 'login': {'login' in str(response.url).lower()}")
            
            # Save response
            with open('debug_home_response.html', 'w') as f:
                f.write(text)
            print("Saved to debug_home_response.html")
        
        # Test client page
        print("\nTesting client detail page...")
        async with session.get(f"{CUSTOMER_BASE_URL}/customer/viewcustomer/1") as response:
            text = await response.text()
            print(f"Client status: {response.status}")
            print(f"Client URL: {response.url}")
            print(f"Response length: {len(text)}")
            print(f"Has 'Signin': {'Signin' in text}")
            
            # Save response
            with open('debug_client_response.html', 'w') as f:
                f.write(text)
            print("Saved to debug_client_response.html")

if __name__ == '__main__':
    asyncio.run(test_session())
