#!/usr/bin/env python3
"""
Test script to diagnose why detail extraction failed
"""

import json
import requests
from bs4 import BeautifulSoup

# Load credentials
USERNAME = 'hana.dolejsi@cehupo.cz'
PASSWORD = 'Hana1234567+'

# URLs
LOGIN_URL = 'https://customer.cehupo.cz/user/auth'
BASE_URL = 'https://customer.cehupo.cz'

# Login
session = requests.Session()
login_data = {
    'action': 'auth',
    'username': USERNAME,
    'password': PASSWORD
}

print("Logging in...")
response = session.post(LOGIN_URL, data=login_data)

if response.status_code == 200:
    print("✅ Logged in successfully!")
else:
    print("❌ Login failed!")
    exit(1)

# Test client detail page
client_id = '1'  # First client
detail_url = f"{BASE_URL}/customer/viewcustomer/{client_id}"

print(f"\nFetching client detail page: {detail_url}")
response = session.get(detail_url)

print(f"Status code: {response.status_code}")
print(f"Response length: {len(response.text)} characters")

# Parse HTML
soup = BeautifulSoup(response.text, 'html.parser')

# Look for invoice-col divs
info_sections = soup.find_all('div', class_='invoice-col')
print(f"\nFound {len(info_sections)} invoice-col divs")

# Check for contact info section
for i, section in enumerate(info_sections):
    text = section.get_text()
    print(f"\n--- Section {i+1} ---")
    print(text[:200])  # First 200 chars
    
    if 'Email:' in text:
        print("  ✅ Found Email in this section!")
    if 'Телефон CZ:' in text:
        print("  ✅ Found Телефон CZ in this section!")

# Check for form fields
print("\n\n=== Form Field Check ===")
email_field = soup.find(['input', 'textarea'], {'name': 'email'})
phone_field = soup.find(['input', 'textarea'], {'name': 'phone_cz'})

print(f"Email input field: {'FOUND' if email_field else 'NOT FOUND'}")
print(f"Phone CZ input field: {'FOUND' if phone_field else 'NOT FOUND'}")

# Save a sample of the HTML
with open('sample_client_detail.html', 'w') as f:
    f.write(response.text)
print("\n📄 Saved full HTML to: sample_client_detail.html")

session.get(f"{BASE_URL}/user/logout")
print("\n✅ Test complete!")
