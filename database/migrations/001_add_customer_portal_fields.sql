-- =================================================================================
-- MIGRATION: Add Customer Portal Fields
-- =================================================================================
-- This migration adds missing fields needed for customer portal data import
-- Run this BEFORE importing data from customer.cehupo.cz
-- =================================================================================

-- Add new columns to clients table
ALTER TABLE clients 
ADD COLUMN IF NOT EXISTS czech_city VARCHAR(200),
ADD COLUMN IF NOT EXISTS czech_address TEXT,
ADD COLUMN IF NOT EXISTS notes TEXT;

-- Update existing data (optional - only if home_address exists)
-- This copies home_address to czech_address for backward compatibility
UPDATE clients 
SET czech_address = home_address 
WHERE czech_address IS NULL AND home_address IS NOT NULL;

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_clients_czech_city ON clients(czech_city);

-- Add full-text search index for notes (for future search functionality)
CREATE INDEX IF NOT EXISTS idx_clients_notes_search ON clients USING gin(to_tsvector('simple', COALESCE(notes, '')));

-- Add comments for documentation
COMMENT ON COLUMN clients.czech_city IS 'City in Czech Republic where client resides';
COMMENT ON COLUMN clients.czech_address IS 'Street address in Czech Republic';
COMMENT ON COLUMN clients.notes IS 'General notes from customer portal and other sources';

-- Verify the changes
SELECT 
    column_name, 
    data_type, 
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_name = 'clients'
    AND column_name IN ('czech_city', 'czech_address', 'notes', 'home_address')
ORDER BY column_name;

-- Success message
DO $$
BEGIN
    RAISE NOTICE '✅ Migration completed successfully!';
    RAISE NOTICE 'Added columns: czech_city, czech_address, notes';
    RAISE NOTICE 'Ready to import customer portal data.';
END $$;
