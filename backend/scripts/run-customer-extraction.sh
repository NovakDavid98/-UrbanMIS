#!/bin/bash

# ========================================
# Customer Data Extraction - Quick Start
# ========================================

echo "=============================================="
echo "  CEHUPO CUSTOMER DATA EXTRACTION"
echo "=============================================="
echo ""

# Check if Python 3 is installed
if ! command -v python3 &> /dev/null; then
    echo "❌ Python 3 is not installed!"
    echo "   Install it with: sudo apt install python3 python3-pip"
    exit 1
fi

echo "✅ Python 3 found"

# Check if pip is installed
if ! command -v pip3 &> /dev/null; then
    echo "❌ pip3 is not installed!"
    echo "   Install it with: sudo apt install python3-pip"
    exit 1
fi

echo "✅ pip3 found"

# Install dependencies
echo ""
echo "📦 Setting up virtual environment..."
if [ ! -d "venv" ]; then
    python3 -m venv venv
fi
source venv/bin/activate

echo "📦 Installing dependencies..."
if ! pip install -r requirements_extractor.txt > /dev/null 2>&1; then
    echo "❌ Failed to install dependencies!"
    exit 1
fi
echo "✅ Dependencies installed"

# Check database connection
echo ""
echo "🔌 Testing database connection..."
PGPASSWORD=IDvEg1WH40wVn7aa8MT9haYsbtRhF1PC psql -U postgres -h localhost -d centralnimozek_cehupo -c "SELECT 1" > /dev/null 2>&1

if [ $? -ne 0 ]; then
    echo "❌ Cannot connect to database!"
    echo "   Make sure PostgreSQL is running and credentials are correct"
    exit 1
fi

echo "✅ Database connection OK"

# Run the extractor
echo ""
echo "🚀 Starting data extraction..."
echo ""
echo "=============================================="
echo ""

python3 customer-data-extractor.py

# Check if extraction was successful
if [ $? -eq 0 ]; then
    echo ""
    echo "=============================================="
    echo "  ✅ EXTRACTION COMPLETED SUCCESSFULLY!"
    echo "=============================================="
    echo ""
    echo "📋 Next steps:"
    echo "  1. Check the log file: customer_extraction.log"
    echo "  2. Review the JSON backup file"
    echo "  3. Login to Centrální Mozek and verify data"
    echo ""
else
    echo ""
    echo "=============================================="
    echo "  ❌ EXTRACTION FAILED"
    echo "=============================================="
    echo ""
    echo "Check customer_extraction.log for errors"
    echo ""
    exit 1
fi
