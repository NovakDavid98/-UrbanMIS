#!/usr/bin/env python3
"""
Async Detail Extractor - Fast parallel extraction of client details
Fixes session management issues and uses async for performance
"""

import asyncio
import aiohttp
import json
import logging
from datetime import datetime
from typing import Dict, List, Optional
from bs4 import BeautifulSoup
import re
import psycopg2
from psycopg2.extras import execute_values
import time

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('async_extraction.log'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

# Configuration
CUSTOMER_BASE_URL = 'https://customer.cehupo.cz'
CUSTOMER_LOGIN_URL = 'https://customer.cehupo.cz/user/authenticate'
USERNAME = 'DavidNovak'
PASSWORD = 'Supr414nd!'

# Database config
DB_CONFIG = {
    'host': 'localhost',
    'port': 5432,
    'database': 'centralnimozek_cehupo',
    'user': 'postgres',
    'password': 'IDvEg1WH40wVn7aa8MT9haYsbtRhF1PC'
}

# Concurrency settings
MAX_CONCURRENT_REQUESTS = 5  # Process 5 clients at a time (conservative)
BATCH_SIZE = 50  # Process in batches of 50


class AsyncSessionManager:
    """Manages authenticated session with automatic re-login"""
    
    def __init__(self):
        self.session = None
        self.logged_in = False
        self.login_lock = asyncio.Lock()
        self.request_semaphore = asyncio.Semaphore(MAX_CONCURRENT_REQUESTS)
        
    async def create_session(self):
        """Create aiohttp session with cookie jar"""
        timeout = aiohttp.ClientTimeout(total=30)
        # Use unsafe=True to allow cookies on all domains
        cookie_jar = aiohttp.CookieJar(unsafe=True)
        
        connector = aiohttp.TCPConnector(
            limit=MAX_CONCURRENT_REQUESTS + 2,
            limit_per_host=MAX_CONCURRENT_REQUESTS + 2,
            force_close=False,
            enable_cleanup_closed=True
        )
        
        self.session = aiohttp.ClientSession(
            timeout=timeout,
            cookie_jar=cookie_jar,
            connector=connector,
            headers={
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.5',
                'Connection': 'keep-alive',
                'Upgrade-Insecure-Requests': '1'
            }
        )
        
    async def login(self) -> bool:
        """Login to customer portal"""
        async with self.login_lock:
            try:
                logger.info(f"🔐 Logging in as {USERNAME}...")
                
                # Use the exact same format as working script
                login_data = {
                    'action': 'auth',
                    'username': USERNAME,
                    'password': PASSWORD
                }
                
                async with self.session.post(CUSTOMER_LOGIN_URL, data=login_data, allow_redirects=True) as response:
                    text = await response.text()
                    
                    # Check if login successful - same logic as working script
                    if 'error' not in str(response.url) and response.status == 200:
                        self.logged_in = True
                        logger.info("✅ Login successful!")
                        logger.info(f"   Session cookies: {len(self.session.cookie_jar)} cookies")
                        return True
                    else:
                        logger.error(f"❌ Login failed! URL: {response.url}, Status: {response.status}")
                        self.logged_in = False
                        return False
                        
            except Exception as e:
                logger.error(f"❌ Login error: {e}")
                self.logged_in = False
                return False
    
    async def is_logged_in(self) -> bool:
        """Check if session is still valid"""
        try:
            async with self.session.get(f"{CUSTOMER_BASE_URL}/home") as response:
                text = await response.text()
                # If we see signin/login page, session expired
                is_valid = 'Signin' not in text and 'login' not in str(response.url).lower()
                return is_valid
        except:
            return False
    
    async def get_with_auth(self, url: str, save_debug: bool = False) -> Optional[str]:
        """GET with semaphore-controlled concurrency"""
        full_url = f"{CUSTOMER_BASE_URL}{url}" if not url.startswith('http') else url
        
        # Use semaphore to limit concurrent requests
        async with self.request_semaphore:
            try:
                async with self.session.get(full_url, allow_redirects=True) as response:
                    text = await response.text()
                    
                    # Save first response for debugging
                    if save_debug:
                        with open('debug_response.html', 'w', encoding='utf-8') as f:
                            f.write(text)
                        logger.info(f"📝 Saved debug response to debug_response.html")
                    
                    # Check if we got redirected to login
                    if 'Signin' in text or 'login' in str(response.url).lower() or len(text) < 2000:
                        logger.warning(f"⚠️  Got login/error page for {url}")
                        return None
                    
                    return text
                    
            except Exception as e:
                logger.error(f"❌ Error fetching {url}: {e}")
                return None
    
    async def close(self):
        """Close session"""
        if self.session:
            await self.session.close()


class AsyncDetailExtractor:
    """Extract client details asynchronously"""
    
    def __init__(self, session_manager: AsyncSessionManager):
        self.session = session_manager
        self.extracted_count = 0
        self.failed_count = 0
        self.extracted_details = []
        
    def extract_field(self, text: str, field_name: str) -> str:
        """Extract field value from text"""
        try:
            pattern = f"{field_name}\\s*([^\\n]*)"
            match = re.search(pattern, text)
            if match:
                return match.group(1).strip()
        except:
            pass
        return ''
    
    async def extract_client_detail(self, client: Dict) -> Optional[Dict]:
        """Extract detailed information for a single client"""
        try:
            client_id = client.get('customer_id') or client.get('id')
            
            # Get detail page HTML
            html = await self.session.get_with_auth(f"/customer/viewcustomer/{client_id}")
            
            if not html:
                logger.error(f"❌ Failed to fetch details for client {client_id}")
                self.failed_count += 1
                return None
            
            # Verify we got the detail page
            if 'Signin' in html or len(html) < 1000:
                logger.error(f"❌ Got login page for client {client_id}")
                self.failed_count += 1
                return None
            
            soup = BeautifulSoup(html, 'html.parser')
            
            # Extract detailed information
            details = {
                'customer_id': client_id,
                'full_name': client.get('full_name', ''),
                'email': '',
                'phone_cz': '',
                'phone_ua': '',
                'street': '',
                'city_full': '',
                'registration_date': '',
                'note': '',
                'arrival_date_czech': '',
                'visa_type': ''
            }
            
            # Find all invoice-col divs with client info
            info_sections = soup.find_all('div', class_='invoice-col')
            
            for section in info_sections:
                text = section.get_text()
                
                # General info
                if 'Дата регистрации' in text:
                    details['registration_date'] = self.extract_field(text, 'Дата регистрации:')
                    details['note'] = self.extract_field(text, 'Примечание:')
                
                # Personal data
                if 'Дата рождения' in text:
                    details['arrival_date_czech'] = self.extract_field(text, 'Дата приезда в чехию:')
                    details['visa_type'] = self.extract_field(text, 'Тип визы:')
                
                # Contact info - THIS IS THE CRITICAL PART
                if 'Город' in text and 'Улица' in text:
                    details['city_full'] = self.extract_field(text, 'Город:')
                    details['street'] = self.extract_field(text, 'Улица:')
                    details['phone_cz'] = self.extract_field(text, 'Телефон CZ:')
                    details['phone_ua'] = self.extract_field(text, 'Телефон UA:')
                    details['email'] = self.extract_field(text, 'Email:')
            
            # Also try to extract from form fields
            email_field = soup.find(['input', 'textarea'], {'name': 'email'})
            if email_field and not details['email']:
                details['email'] = email_field.get('value', '') or email_field.text.strip()
            
            phone_cz_field = soup.find(['input', 'textarea'], {'name': 'phone_cz'})
            if phone_cz_field and not details['phone_cz']:
                details['phone_cz'] = phone_cz_field.get('value', '') or phone_cz_field.text.strip()
            
            phone_ua_field = soup.find(['input', 'textarea'], {'name': 'phone_ua'})
            if phone_ua_field and not details['phone_ua']:
                details['phone_ua'] = phone_ua_field.get('value', '') or phone_ua_field.text.strip()
            
            self.extracted_count += 1
            
            # Log if we got contact info
            has_contact = details['email'] or details['phone_cz'] or details['phone_ua']
            if has_contact:
                logger.info(f"✅ [{self.extracted_count}] {details['full_name']} - Email: {bool(details['email'])}, Phone: {bool(details['phone_cz'])}")
            else:
                logger.warning(f"⚠️  [{self.extracted_count}] {details['full_name']} - No contact info found")
            
            return details
            
        except Exception as e:
            logger.error(f"❌ Error extracting client {client_id}: {e}")
            self.failed_count += 1
            return None
    
    async def extract_batch(self, clients: List[Dict]) -> List[Dict]:
        """Extract details for a batch of clients"""
        # Create all tasks at once - semaphore will control concurrency
        tasks = [self.extract_client_detail(client) for client in clients]
        
        # Execute all tasks concurrently (but limited by semaphore)
        results = await asyncio.gather(*tasks, return_exceptions=True)
        
        # Filter out None and exceptions
        valid_results = []
        for result in results:
            if result and not isinstance(result, Exception):
                valid_results.append(result)
        
        return valid_results
    
    async def extract_all_details(self, clients: List[Dict]) -> List[Dict]:
        """Extract details for all clients with batching"""
        total = len(clients)
        logger.info(f"📝 Starting async extraction for {total} clients...")
        logger.info(f"⚡ Concurrency: {MAX_CONCURRENT_REQUESTS} parallel requests")
        logger.info(f"📦 Batch size: {BATCH_SIZE} clients per batch")
        
        all_details = []
        
        # Process in batches
        for i in range(0, total, BATCH_SIZE):
            batch = clients[i:i + BATCH_SIZE]
            batch_num = i // BATCH_SIZE + 1
            total_batches = (total + BATCH_SIZE - 1) // BATCH_SIZE
            
            logger.info(f"\n📦 Processing batch {batch_num}/{total_batches} ({len(batch)} clients)...")
            
            batch_results = await self.extract_batch(batch)
            all_details.extend(batch_results)
            
            # Progress update
            progress = (i + len(batch)) / total * 100
            logger.info(f"📊 Progress: {self.extracted_count}/{total} ({progress:.1f}%) - Failed: {self.failed_count}")
            
            # Small delay between batches to be respectful
            if i + BATCH_SIZE < total:
                await asyncio.sleep(1)
        
        logger.info(f"\n✅ Extraction complete!")
        logger.info(f"   Succeeded: {self.extracted_count}/{total}")
        logger.info(f"   Failed: {self.failed_count}/{total}")
        
        return all_details


def update_database(details: List[Dict]):
    """Update database with extracted details"""
    logger.info(f"\n💾 Updating database with {len(details)} client details...")
    
    conn = psycopg2.connect(**DB_CONFIG)
    cursor = conn.cursor()
    
    updated = 0
    failed = 0
    
    for detail in details:
        try:
            # Find client by customer_id or by name
            cursor.execute("""
                SELECT id FROM clients 
                WHERE visa_number LIKE %s OR 
                      (first_name = %s AND last_name LIKE %s)
                LIMIT 1
            """, (
                f"%{detail['customer_id']}%",
                detail['full_name'].split()[0] if detail['full_name'] else '',
                f"%{detail['full_name'].split()[-1]}%" if detail['full_name'] else ''
            ))
            
            result = cursor.fetchone()
            
            if result:
                client_id = result[0]
                
                # Update with new details
                cursor.execute("""
                    UPDATE clients SET
                        email = COALESCE(NULLIF(%s, ''), email),
                        czech_phone = COALESCE(NULLIF(%s, ''), czech_phone),
                        ukrainian_phone = COALESCE(NULLIF(%s, ''), ukrainian_phone),
                        czech_address = COALESCE(NULLIF(%s, ''), czech_address),
                        czech_city = COALESCE(NULLIF(%s, ''), czech_city),
                        visa_type = COALESCE(NULLIF(%s, ''), visa_type),
                        updated_at = CURRENT_TIMESTAMP
                    WHERE id = %s
                """, (
                    detail['email'],
                    detail['phone_cz'],
                    detail['phone_ua'],
                    detail['street'],
                    detail['city_full'],
                    detail['visa_type'],
                    client_id
                ))
                
                updated += 1
            else:
                logger.warning(f"⚠️  Client not found in DB: {detail['full_name']}")
                failed += 1
                
        except Exception as e:
            logger.error(f"❌ Error updating client {detail.get('full_name')}: {e}")
            failed += 1
            continue
    
    conn.commit()
    cursor.close()
    conn.close()
    
    logger.info(f"✅ Database update complete!")
    logger.info(f"   Updated: {updated}")
    logger.info(f"   Failed: {failed}")


async def main():
    """Main execution"""
    start_time = time.time()
    
    print("=" * 70)
    print("  ASYNC CLIENT DETAIL EXTRACTOR")
    print("  Fast parallel extraction with session management")
    print("=" * 70)
    
    # Load client list from previous extraction
    logger.info("\n📂 Loading client list from JSON...")
    with open('customer_data_20251108_230656.json', 'r') as f:
        data = json.load(f)
    
    clients = data['clients']
    logger.info(f"✅ Loaded {len(clients)} clients")
    
    # Create session manager
    logger.info("\n🔧 Creating session with cookie handling...")
    session_mgr = AsyncSessionManager()
    await session_mgr.create_session()
    
    # Login
    logger.info("🔐 Logging in...")
    if not await session_mgr.login():
        logger.error("❌ Failed to login, aborting")
        await session_mgr.close()
        return
    
    # Wait a bit after login to ensure session is established
    logger.info("⏳ Waiting for session to stabilize...")
    await asyncio.sleep(2)
    
    # Verify session is working
    logger.info("🔍 Verifying session...")
    if not await session_mgr.is_logged_in():
        logger.error("❌ Session verification failed, aborting")
        await session_mgr.close()
        return
    
    logger.info("✅ Session verified, starting extraction!")
    logger.info(f"⚡ Concurrency: {MAX_CONCURRENT_REQUESTS} parallel requests\n")
    
    # Extract details
    extractor = AsyncDetailExtractor(session_mgr)
    details = await extractor.extract_all_details(clients)
    
    # Save results
    output_file = f"client_details_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(details, f, indent=2, ensure_ascii=False)
    
    logger.info(f"\n📄 Details saved to: {output_file}")
    
    # Update database
    if details:
        update_database(details)
    
    # Close session properly
    await session_mgr.close()
    
    # Final stats
    elapsed = time.time() - start_time
    logger.info(f"\n⏱️  Total time: {elapsed:.1f} seconds ({elapsed/60:.1f} minutes)")
    logger.info(f"⚡ Average: {elapsed/len(clients):.2f} seconds per client")
    
    # Calculate success metrics
    with_email = sum(1 for d in details if d.get('email'))
    with_phone = sum(1 for d in details if d.get('phone_cz') or d.get('phone_ua'))
    
    print("\n" + "=" * 70)
    print("  EXTRACTION COMPLETE!")
    print("=" * 70)
    print(f"  Clients processed: {len(clients)}")
    print(f"  Successfully extracted: {extractor.extracted_count}")
    print(f"  Failed: {extractor.failed_count}")
    print(f"  With email: {with_email} ({with_email/len(details)*100:.1f}%)" if details else "  With email: 0")
    print(f"  With phone: {with_phone} ({with_phone/len(details)*100:.1f}%)" if details else "  With phone: 0")
    print(f"  Total time: {elapsed:.1f}s ({elapsed/60:.1f} min)")
    print("=" * 70)


if __name__ == '__main__':
    asyncio.run(main())
