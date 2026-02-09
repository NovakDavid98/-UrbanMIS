-- =================================================================================
-- VISITS SYSTEM - Database Schema Addition
-- =================================================================================
-- Visit log tracking system from Customer CeHuPo
-- =================================================================================

-- Visit reasons lookup table
CREATE TABLE IF NOT EXISTS visit_reasons (
    id SERIAL PRIMARY KEY,
    category VARCHAR(100) NOT NULL, -- 'warehouse', 'assistance', 'community', 'donations'
    name_cs VARCHAR(255) NOT NULL, -- Czech name
    name_uk VARCHAR(255), -- Ukrainian name
    name_ru VARCHAR(255), -- Russian name
    is_active BOOLEAN DEFAULT true,
    display_order INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Visits table
CREATE TABLE IF NOT EXISTS visits (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    client_id UUID REFERENCES clients(id) ON DELETE CASCADE NOT NULL,
    visit_date DATE NOT NULL,
    time_spent TIME, -- HH:MM format for time spent with client
    notes TEXT,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Many-to-many relationship for visit reasons (multiple reasons per visit)
CREATE TABLE IF NOT EXISTS visit_visit_reasons (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    visit_id UUID REFERENCES visits(id) ON DELETE CASCADE NOT NULL,
    visit_reason_id INTEGER REFERENCES visit_reasons(id) ON DELETE CASCADE NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(visit_id, visit_reason_id)
);

-- Enhanced client fields from Customer CeHuPo questionnaire
ALTER TABLE clients ADD COLUMN IF NOT EXISTS relative_type VARCHAR(50);
ALTER TABLE clients ADD COLUMN IF NOT EXISTS volunteer_notes TEXT;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS education_level VARCHAR(100);
ALTER TABLE clients ADD COLUMN IF NOT EXISTS profession_ukraine TEXT;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS hobbies TEXT;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS has_work_czech BOOLEAN DEFAULT false;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS needs_job_help BOOLEAN DEFAULT false;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS help_needed TEXT;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS volunteer_interest BOOLEAN DEFAULT false;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS volunteer_skills TEXT;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS free_housing BOOLEAN DEFAULT false;

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_visits_client ON visits(client_id);
CREATE INDEX IF NOT EXISTS idx_visits_date ON visits(visit_date DESC);
CREATE INDEX IF NOT EXISTS idx_visits_created_by ON visits(created_by);
CREATE INDEX IF NOT EXISTS idx_visit_reasons_category ON visit_reasons(category);
CREATE INDEX IF NOT EXISTS idx_visit_visit_reasons_visit ON visit_visit_reasons(visit_id);
CREATE INDEX IF NOT EXISTS idx_visit_visit_reasons_reason ON visit_visit_reasons(visit_reason_id);

-- Trigger for updated_at
CREATE TRIGGER update_visits_updated_at BEFORE UPDATE ON visits
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- View for visits with all details
CREATE OR REPLACE VIEW visits_with_details AS
SELECT 
    v.id,
    v.client_id,
    v.visit_date,
    v.time_spent,
    v.notes,
    v.created_at,
    v.updated_at,
    c.first_name as client_first_name,
    c.last_name as client_last_name,
    c.age as client_age,
    c.gender as client_gender,
    c.ukrainian_region as client_city,
    u.first_name as worker_first_name,
    u.last_name as worker_last_name,
    ARRAY_AGG(vr.name_cs ORDER BY vr.name_cs) FILTER (WHERE vr.id IS NOT NULL) as visit_reasons_cs,
    ARRAY_AGG(vr.name_uk ORDER BY vr.name_uk) FILTER (WHERE vr.id IS NOT NULL) as visit_reasons_uk,
    ARRAY_AGG(vr.category ORDER BY vr.category) FILTER (WHERE vr.id IS NOT NULL) as visit_categories
FROM visits v
LEFT JOIN clients c ON v.client_id = c.id
LEFT JOIN users u ON v.created_by = u.id
LEFT JOIN visit_visit_reasons vvr ON v.id = vvr.visit_id
LEFT JOIN visit_reasons vr ON vvr.visit_reason_id = vr.id
GROUP BY v.id, c.first_name, c.last_name, c.age, c.gender, c.ukrainian_region, 
         u.first_name, u.last_name;
