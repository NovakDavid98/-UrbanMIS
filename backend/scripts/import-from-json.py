#!/usr/bin/env python3
"""
Import customer data from saved JSON file
This script imports data that was already extracted from customer.cehupo.cz
"""

import json
import sys
import logging
import os

# Add current directory to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

# Import the extractor module
import customer_data_extractor
CustomerDataExtractor = customer_data_extractor.CustomerDataExtractor

# Set up logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('customer_import.log'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

def main():
    if len(sys.argv) < 2:
        print("Usage: python import-from-json.py <json_file>")
        print("Example: python import-from-json.py customer_data_20251108_221428.json")
        sys.exit(1)
    
    json_file = sys.argv[1]
    
    logger.info(f"📂 Loading data from {json_file}...")
    
    try:
        with open(json_file, 'r', encoding='utf-8') as f:
            data = json.load(f)
        
        logger.info(f"✅ Loaded {len(data.get('clients', []))} clients and {len(data.get('visits', []))} visits")
        
        # Create extractor instance (just for database connection)
        extractor = CustomerDataExtractor()
        
        # Connect to database
        extractor.connect_db()
        
        # Import the data
        logger.info("💾 Starting import...")
        extractor.import_to_database(data)
        
        # Disconnect
        extractor.disconnect_db()
        
        logger.info("✅ Import completed successfully!")
        
    except FileNotFoundError:
        logger.error(f"❌ File not found: {json_file}")
        sys.exit(1)
    except json.JSONDecodeError as e:
        logger.error(f"❌ Invalid JSON file: {e}")
        sys.exit(1)
    except Exception as e:
        logger.error(f"❌ Import failed: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)

if __name__ == '__main__':
    main()
