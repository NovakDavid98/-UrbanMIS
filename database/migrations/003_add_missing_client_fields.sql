-- =================================================================================
-- Migration 003: Add Missing Client Fields from CeHuPo Portal
-- =================================================================================
-- This migration adds fields that exist in CeHuPo but were missing from our schema
-- =================================================================================

-- Add city field (separate from full address)
ALTER TABLE clients ADD COLUMN IF NOT EXISTS czech_city VARCHAR(100);

-- Add education, profession, hobbies
ALTER TABLE clients ADD COLUMN IF NOT EXISTS education VARCHAR(255);
ALTER TABLE clients ADD COLUMN IF NOT EXISTS profession_in_ukraine VARCHAR(255);
ALTER TABLE clients ADD COLUMN IF NOT EXISTS hobbies TEXT;

-- Add assistance and work-related fields
ALTER TABLE clients ADD COLUMN IF NOT EXISTS assistance_needed TEXT;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS has_work_in_czech BOOLEAN DEFAULT false;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS needs_work_assistance BOOLEAN DEFAULT false;

-- Add volunteer information
ALTER TABLE clients ADD COLUMN IF NOT EXISTS wants_to_volunteer BOOLEAN DEFAULT false;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS notes_for_volunteers TEXT;

-- Add housing information
ALTER TABLE clients ADD COLUMN IF NOT EXISTS receives_free_housing BOOLEAN DEFAULT false;

-- Add internal notes (different from notes_for_volunteers)
ALTER TABLE clients ADD COLUMN IF NOT EXISTS internal_notes TEXT;

-- Create indexes for searchable fields
CREATE INDEX IF NOT EXISTS idx_clients_czech_city ON clients(czech_city);
CREATE INDEX IF NOT EXISTS idx_clients_has_work ON clients(has_work_in_czech);
CREATE INDEX IF NOT EXISTS idx_clients_needs_assistance ON clients(needs_work_assistance);
CREATE INDEX IF NOT EXISTS idx_clients_wants_volunteer ON clients(wants_to_volunteer);

-- Add comment
COMMENT ON COLUMN clients.czech_city IS 'City where client lives in Czech Republic';
COMMENT ON COLUMN clients.education IS 'Education level or institution';
COMMENT ON COLUMN clients.profession_in_ukraine IS 'Profession/specialty in Ukraine';
COMMENT ON COLUMN clients.hobbies IS 'Hobbies and interests';
COMMENT ON COLUMN clients.assistance_needed IS 'What kind of help the client needs';
COMMENT ON COLUMN clients.has_work_in_czech IS 'Whether client has job in Czech Republic';
COMMENT ON COLUMN clients.needs_work_assistance IS 'Whether client needs help finding work';
COMMENT ON COLUMN clients.wants_to_volunteer IS 'Whether client wants to volunteer';
COMMENT ON COLUMN clients.notes_for_volunteers IS 'Notes visible to volunteers';
COMMENT ON COLUMN clients.receives_free_housing IS 'Whether client receives free housing';
COMMENT ON COLUMN clients.internal_notes IS 'Internal notes for staff only';

