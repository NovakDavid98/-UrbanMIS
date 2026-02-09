#!/usr/bin/env python3
"""
Test async extraction on 10 clients to verify it works
"""

import asyncio
import sys
import json

# Import the async extractor
from async_detail_extractor import AsyncSessionManager, AsyncDetailExtractor

async def test_extraction():
    """Test on 10 clients"""
    print("=" * 70)
    print("  TESTING ASYNC EXTRACTION - 10 CLIENTS")
    print("=" * 70)
    
    # Load client list
    print("\n📂 Loading client list...")
    with open('customer_data_20251108_230656.json', 'r') as f:
        data = json.load(f)
    
    # Take first 10 clients
    test_clients = data['clients'][:10]
    print(f"✅ Testing with {len(test_clients)} clients:\n")
    for i, client in enumerate(test_clients, 1):
        print(f"   {i}. {client['full_name']}")
    
    # Create session
    print("\n🔐 Creating session...")
    session_mgr = AsyncSessionManager()
    await session_mgr.create_session()
    
    # Login
    print("🔐 Logging in...")
    if not await session_mgr.login():
        print("❌ Login failed!")
        return
    
    # Extract details
    print("\n📝 Extracting details...\n")
    extractor = AsyncDetailExtractor(session_mgr)
    details = await extractor.extract_all_details(test_clients)
    
    # Show results
    print("\n" + "=" * 70)
    print("  RESULTS")
    print("=" * 70)
    
    for detail in details:
        has_email = bool(detail.get('email'))
        has_phone_cz = bool(detail.get('phone_cz'))
        has_phone_ua = bool(detail.get('phone_ua'))
        has_street = bool(detail.get('street'))
        
        status = "✅" if (has_email or has_phone_cz) else "❌"
        
        print(f"{status} {detail['full_name']}")
        print(f"   Email: {detail.get('email') or '❌ MISSING'}")
        print(f"   Phone CZ: {detail.get('phone_cz') or '❌ MISSING'}")
        print(f"   Phone UA: {detail.get('phone_ua') or '❌ MISSING'}")
        print(f"   Address: {detail.get('street') or '❌ MISSING'}")
        print()
    
    # Stats
    with_email = sum(1 for d in details if d.get('email'))
    with_phone = sum(1 for d in details if d.get('phone_cz') or d.get('phone_ua'))
    
    print("=" * 70)
    print(f"📊 STATISTICS:")
    print(f"   Total processed: {len(details)}")
    print(f"   With email: {with_email}/{len(details)} ({with_email/len(details)*100:.0f}%)")
    print(f"   With phone: {with_phone}/{len(details)} ({with_phone/len(details)*100:.0f}%)")
    print("=" * 70)
    
    # Close session
    await session_mgr.close()
    
    # Decision
    if with_email >= 5 or with_phone >= 5:
        print("\n✅ TEST PASSED! Session handling is working correctly!")
        print("   Ready to run full extraction on all 2,850 clients.")
        return True
    else:
        print("\n❌ TEST FAILED! Not enough data extracted.")
        print("   Need to investigate further before running full extraction.")
        return False

if __name__ == '__main__':
    result = asyncio.run(test_extraction())
    sys.exit(0 if result else 1)
