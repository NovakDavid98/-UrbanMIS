#!/usr/bin/env python3
"""
Download CeHuPo user list page for inspection
"""

import asyncio
import httpx

BASE_URL = "https://customer.cehupo.cz"
LOGIN_URL = f"{BASE_URL}/user/authenticate"
CEHUPO_USERNAME = "DavidNovak"
CEHUPO_PASSWORD = "Supr414nd!"

async def download_user_list():
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
        
        # Save to file
        with open('cehupo_user_list.html', 'w', encoding='utf-8') as f:
            f.write(response.text)
        
        print(f"✅ Downloaded user list page")
        print(f"   Status: {response.status_code}")
        print(f"   Size: {len(response.text)} bytes")
        print(f"   Saved to: cehupo_user_list.html")

if __name__ == '__main__':
    asyncio.run(download_user_list())

