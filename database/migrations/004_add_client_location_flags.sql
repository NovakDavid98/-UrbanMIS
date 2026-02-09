-- Migration: Add location tracking fields for clients
-- Date: 2025-11-13
-- Description: Add fields to track if client went to Ukraine and if they're in Ostrava

-- Add the two boolean fields
ALTER TABLE clients 
ADD COLUMN IF NOT EXISTS went_to_ukraine BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS is_in_ostrava BOOLEAN DEFAULT FALSE;

-- Create indexes for filtering
CREATE INDEX IF NOT EXISTS idx_clients_went_to_ukraine ON clients(went_to_ukraine);
CREATE INDEX IF NOT EXISTS idx_clients_is_in_ostrava ON clients(is_in_ostrava);

-- Add comments for documentation
COMMENT ON COLUMN clients.went_to_ukraine IS 'Indicates if client went back to Ukraine (Odjel na Ukrajinu)';
COMMENT ON COLUMN clients.is_in_ostrava IS 'Indicates if client is located in Ostrava';

