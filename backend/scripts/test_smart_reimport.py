#!/usr/bin/env python3
"""Test smart reimport on 10 clients"""

import sys
sys.path.insert(0, '.')

from smart_complete_reimport import SmartExtractor, SmartImporter
import json
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def test_extraction():
    """Test on 10 clients"""
    print("=" * 80)
    print("  TESTING SMART RE-IMPORT ON 10 CLIENTS")
    print("=" * 80)
    
    # Load clients
    with open('customer_data_20251108_230656.json', 'r') as f:
        data = json.load(f)
    
    test_clients = data['clients'][:10]
    logger.info(f"Testing with {len(test_clients)} clients")
    
    # Extract
    extractor = SmartExtractor()
    if not extractor.login():
        logger.error("Login failed")
        return False
    
    extractor.extract_all(test_clients)
    
    # Show what we got
    print("\n" + "=" * 80)
    print("  EXTRACTION RESULTS")
    print("=" * 80)
    
    for data in extractor.extracted:
        print(f"\n{data['full_name']}")
        print(f"  Email: {data.get('email') or '(empty)'}")
        print(f"  Phone CZ: {data.get('phone_cz') or '(empty)'}")
        print(f"  Phone UA: {data.get('phone_ua') or '(empty)'}")
        print(f"  City: {data.get('city_full') or '(empty)'}")
        print(f"  Insurance: {data.get('insurance') or '(empty)'}")
        print(f"  Education: {data.get('education') or '(empty)'}")
        print(f"  Profession: {data.get('profession') or '(empty)'}")
    
    # Import
    print("\n" + "=" * 80)
    print("  IMPORT TEST")
    print("=" * 80)
    
    importer = SmartImporter()
    importer.import_all(extractor.extracted)
    importer.close()
    
    return True

if __name__ == '__main__':
    success = test_extraction()
    sys.exit(0 if success else 1)
