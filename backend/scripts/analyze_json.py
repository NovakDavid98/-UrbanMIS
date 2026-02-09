#!/usr/bin/env python3
import json

with open('customer_data_20251108_230656.json', 'r') as f:
    data = json.load(f)

# Find a client with the most fields
max_fields = 0
best_client = None

for client in data['clients'][:100]:
    num_fields = sum(1 for v in client.values() if v and v != '0' and v != '')
    if num_fields > max_fields:
        max_fields = num_fields
        best_client = client

print(f'Client with most fields ({max_fields} non-empty fields):')
print(f'Name: {best_client["full_name"]}')
print('\nAll non-empty fields:')
for key, value in sorted(best_client.items()):
    if value and value != '0' and value != '':
        print(f'  {key}: {value}')

# Check if email and phone fields exist
print('\n\nChecking for email/phone fields in all clients:')
has_email = sum(1 for c in data['clients'] if c.get('email'))
has_phone_cz = sum(1 for c in data['clients'] if c.get('phone_cz'))
has_phone_ua = sum(1 for c in data['clients'] if c.get('phone_ua'))
has_street = sum(1 for c in data['clients'] if c.get('street'))
has_city_full = sum(1 for c in data['clients'] if c.get('city_full'))

total = len(data['clients'])
print(f'Total clients: {total}')
print(f'Has email: {has_email} ({total - has_email} missing)')
print(f'Has phone_cz: {has_phone_cz} ({total - has_phone_cz} missing)')
print(f'Has phone_ua: {has_phone_ua} ({total - has_phone_ua} missing)')
print(f'Has street: {has_street} ({total - has_street} missing)')
print(f'Has city_full: {has_city_full} ({total - has_city_full} missing)')
