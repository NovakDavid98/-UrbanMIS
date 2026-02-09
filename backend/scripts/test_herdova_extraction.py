#!/usr/bin/env python3
"""
Test extraction for Herdova Svitlana specifically
to see exactly what fields are available
"""

import requests
from bs4 import BeautifulSoup
import json

USERNAME = 'DavidNovak'
PASSWORD = 'Supr414nd!'
BASE_URL = 'https://customer.cehupo.cz'
LOGIN_URL = 'https://customer.cehupo.cz/user/authenticate'

# Login
session = requests.Session()
login_data = {
    'action': 'auth',
    'username': USERNAME,
    'password': PASSWORD
}
response = session.post(LOGIN_URL, data=login_data)
print(f"✅ Login: {response.status_code}")

# Get Herdova Svitlana (customer_id = 2 based on previous data)
url = f"{BASE_URL}/customer/viewcustomer/2"
response = session.get(url)
print(f"✅ Got page: {response.status_code}")

# Save raw HTML for inspection
with open('herdova_page.html', 'w', encoding='utf-8') as f:
    f.write(response.text)
print("✅ Saved to herdova_page.html")

soup = BeautifulSoup(response.text, 'html.parser')

# Find ALL input fields
print("\n" + "="*80)
print("ALL INPUT FIELDS:")
print("="*80)
for inp in soup.find_all('input'):
    name = inp.get('name', '')
    value = inp.get('value', '')
    field_type = inp.get('type', 'text')
    if name:
        print(f"Name: {name:<30} Type: {field_type:<15} Value: {value}")

# Find ALL select fields
print("\n" + "="*80)
print("ALL SELECT FIELDS:")
print("="*80)
for sel in soup.find_all('select'):
    name = sel.get('name', '')
    selected = sel.find('option', {'selected': True})
    value = selected.text.strip() if selected else ''
    if name:
        print(f"Name: {name:<30} Value: {value}")

# Find ALL textarea fields
print("\n" + "="*80)
print("ALL TEXTAREA FIELDS:")
print("="*80)
for txt in soup.find_all('textarea'):
    name = txt.get('name', '')
    value = txt.text.strip()
    if name:
        print(f"Name: {name:<30} Value: {value[:50]}...")

# Search for phone-related text
print("\n" + "="*80)
print("SEARCHING FOR PHONE PATTERNS:")
print("="*80)
text = soup.get_text()
import re
phones = re.findall(r'606775596|0673098610|телефон[a-zA-Zа-яА-Я\s]+\d+', text, re.IGNORECASE)
for phone in phones:
    print(f"Found: {phone}")

# Find all labels
print("\n" + "="*80)
print("ALL FIELD LABELS:")
print("="*80)
for label in soup.find_all(['label', 'strong', 'b']):
    text = label.get_text().strip()
    if 'телефон' in text.lower() or 'phone' in text.lower() or 'email' in text.lower():
        print(f"Label: {text}")
        # Find next input
        next_input = label.find_next(['input', 'textarea'])
        if next_input:
            print(f"  -> Field name: {next_input.get('name', 'N/A')}, Value: {next_input.get('value', next_input.text)[:50]}")
