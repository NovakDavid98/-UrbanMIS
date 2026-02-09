-- =================================================================================
-- URBANMIS - DATABASE SCHEMA
-- =================================================================================
-- Open-source database design for streetwork and humanitarian NGO management
-- =================================================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =================================================================================
-- 1. USER MANAGEMENT & AUTHENTICATION
-- =================================================================================

CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    username VARCHAR(100) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    role VARCHAR(50) NOT NULL DEFAULT 'worker',
    phone VARCHAR(50),
    is_active BOOLEAN DEFAULT true,
    last_login TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_username ON users(username);
CREATE INDEX idx_users_role ON users(role);

-- =================================================================================
-- 2. CLIENT MANAGEMENT
-- =================================================================================

CREATE TABLE clients (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    nickname VARCHAR(100),
    gender VARCHAR(20),
    date_of_birth DATE,
    age INTEGER,
    
    -- Contact Information
    home_address TEXT,
    czech_phone VARCHAR(50),
    ukrainian_phone VARCHAR(50),
    email VARCHAR(255),
    
    -- Immigration Details
    date_of_arrival_czech DATE,
    project_registration_date DATE,
    visa_number VARCHAR(100),
    visa_type VARCHAR(100),
    insurance_company VARCHAR(200),
    ukrainian_region VARCHAR(200),
    
    -- Status
    is_active BOOLEAN DEFAULT true,
    activity_status VARCHAR(50) DEFAULT 'active',
    
    -- Metadata
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_clients_last_name ON clients(last_name);
CREATE INDEX idx_clients_first_name ON clients(first_name);
CREATE INDEX idx_clients_is_active ON clients(is_active);
CREATE INDEX idx_clients_activity_status ON clients(activity_status);

-- =================================================================================
-- 3. KEY WORKER ASSIGNMENTS
-- =================================================================================

CREATE TABLE key_worker_assignments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
    worker_id UUID REFERENCES users(id) ON DELETE CASCADE,
    assigned_date DATE DEFAULT CURRENT_DATE,
    is_primary BOOLEAN DEFAULT false,
    notes TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(client_id, worker_id)
);

CREATE INDEX idx_key_worker_client ON key_worker_assignments(client_id);
CREATE INDEX idx_key_worker_worker ON key_worker_assignments(worker_id);

-- =================================================================================
-- 4. TAGS/LABELS SYSTEM
-- =================================================================================

CREATE TABLE tags (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) UNIQUE NOT NULL,
    color VARCHAR(7) DEFAULT '#3B82F6',
    description TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE client_tags (
    client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
    tag_id UUID REFERENCES tags(id) ON DELETE CASCADE,
    added_at TIMESTAMP DEFAULT NOW(),
    added_by UUID REFERENCES users(id),
    PRIMARY KEY (client_id, tag_id)
);

CREATE INDEX idx_client_tags_client ON client_tags(client_id);
CREATE INDEX idx_client_tags_tag ON client_tags(tag_id);

-- =================================================================================
-- 5. CONTRACTS (SMLOUVY)
-- =================================================================================

CREATE TABLE contracts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    contract_type VARCHAR(100),
    description TEXT,
    start_date DATE NOT NULL,
    end_date DATE,
    is_active BOOLEAN DEFAULT true,
    
    -- File attachments (optional)
    file_path VARCHAR(500),
    
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_contracts_client ON contracts(client_id);
CREATE INDEX idx_contracts_is_active ON contracts(is_active);
CREATE INDEX idx_contracts_end_date ON contracts(end_date);

-- =================================================================================
-- 6. INDIVIDUAL PLANS (INDIVIDUÁLNÍ PLÁNY)
-- =================================================================================

CREATE TABLE individual_plans (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    service_type VARCHAR(100),
    description TEXT,
    goal TEXT,
    completion_percentage INTEGER DEFAULT 0 CHECK (completion_percentage BETWEEN 0 AND 100),
    is_active BOOLEAN DEFAULT true,
    start_date DATE DEFAULT CURRENT_DATE,
    target_date DATE,
    
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_individual_plans_client ON individual_plans(client_id);
CREATE INDEX idx_individual_plans_is_active ON individual_plans(is_active);

-- =================================================================================
-- 7. PLAN REVISIONS (REVIZE)
-- =================================================================================

CREATE TABLE plan_revisions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    plan_id UUID REFERENCES individual_plans(id) ON DELETE CASCADE,
    revision_date DATE NOT NULL,
    description TEXT,
    notes TEXT,
    completion_update INTEGER,
    
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_plan_revisions_plan ON plan_revisions(plan_id);
CREATE INDEX idx_plan_revisions_date ON plan_revisions(revision_date);

-- =================================================================================
-- 8. SERVICE RECORDS (VÝKONY)
-- =================================================================================

CREATE TABLE service_records (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
    
    -- Service Details
    subject VARCHAR(255) NOT NULL,
    service_type VARCHAR(100) NOT NULL,
    service_date DATE NOT NULL,
    duration_minutes INTEGER,
    
    -- Location & Topic
    location VARCHAR(100),
    topic VARCHAR(100),
    
    -- Description
    description TEXT,
    
    -- Metadata
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_service_records_client ON service_records(client_id);
CREATE INDEX idx_service_records_date ON service_records(service_date);
CREATE INDEX idx_service_records_type ON service_records(service_type);
CREATE INDEX idx_service_records_topic ON service_records(topic);
CREATE INDEX idx_service_records_created_by ON service_records(created_by);

-- =================================================================================
-- 9. NOTES (POZNÁMKY)
-- =================================================================================

CREATE TABLE notes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
    title VARCHAR(255),
    content TEXT NOT NULL,
    is_important BOOLEAN DEFAULT false,
    is_archived BOOLEAN DEFAULT false,
    
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_notes_client ON notes(client_id);
CREATE INDEX idx_notes_is_important ON notes(is_important);
CREATE INDEX idx_notes_created_at ON notes(created_at DESC);

-- =================================================================================
-- 10. SANCTIONS (SANKCE)
-- =================================================================================

CREATE TABLE sanctions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
    sanction_type VARCHAR(100) NOT NULL,
    reason TEXT NOT NULL,
    description TEXT,
    sanction_date DATE NOT NULL,
    expiry_date DATE,
    is_active BOOLEAN DEFAULT true,
    
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_sanctions_client ON sanctions(client_id);
CREATE INDEX idx_sanctions_is_active ON sanctions(is_active);
CREATE INDEX idx_sanctions_date ON sanctions(sanction_date);

-- =================================================================================
-- 11. DAILY RECORDS (DENNÍ ZÁPISY)
-- =================================================================================

CREATE TABLE daily_records (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    record_date DATE NOT NULL,
    location VARCHAR(100) NOT NULL,
    title VARCHAR(255),
    description TEXT,
    
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_daily_records_date ON daily_records(record_date);
CREATE INDEX idx_daily_records_location ON daily_records(location);

-- =================================================================================
-- 12. SYSTEM CONFIGURATION & LOOKUPS
-- =================================================================================

CREATE TABLE lookup_values (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    category VARCHAR(100) NOT NULL,
    value VARCHAR(255) NOT NULL,
    display_order INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_lookup_category ON lookup_values(category);

-- =================================================================================
-- 13. AUDIT LOG
-- =================================================================================

CREATE TABLE audit_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    table_name VARCHAR(100) NOT NULL,
    record_id UUID NOT NULL,
    action VARCHAR(50) NOT NULL,
    old_values JSONB,
    new_values JSONB,
    user_id UUID REFERENCES users(id),
    ip_address VARCHAR(45),
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_audit_log_table ON audit_log(table_name);
CREATE INDEX idx_audit_log_record ON audit_log(record_id);
CREATE INDEX idx_audit_log_user ON audit_log(user_id);
CREATE INDEX idx_audit_log_created ON audit_log(created_at DESC);

-- =================================================================================
-- VIEWS FOR COMMON QUERIES
-- =================================================================================

-- Client overview with statistics
CREATE VIEW client_overview AS
SELECT 
    c.id,
    c.first_name,
    c.last_name,
    c.nickname,
    c.gender,
    c.date_of_birth,
    c.age,
    c.is_active,
    c.activity_status,
    COUNT(DISTINCT sr.id) as service_count,
    MIN(sr.service_date) as first_service_date,
    MAX(sr.service_date) as last_service_date,
    COUNT(DISTINCT ct.id) as active_contracts,
    COUNT(DISTINCT ip.id) as active_plans,
    STRING_AGG(DISTINCT t.name, ', ') as tags
FROM clients c
LEFT JOIN service_records sr ON c.id = sr.client_id
LEFT JOIN contracts ct ON c.id = ct.client_id AND ct.is_active = true
LEFT JOIN individual_plans ip ON c.id = ip.client_id AND ip.is_active = true
LEFT JOIN client_tags ctags ON c.id = ctags.client_id
LEFT JOIN tags t ON ctags.tag_id = t.id
GROUP BY c.id;

-- Worker performance statistics
CREATE VIEW worker_statistics AS
SELECT 
    u.id,
    u.first_name,
    u.last_name,
    COUNT(DISTINCT sr.id) as services_provided,
    COUNT(DISTINCT kw.client_id) as key_clients,
    COUNT(DISTINCT ip.id) as plans_created,
    MAX(sr.service_date) as last_service_date
FROM users u
LEFT JOIN service_records sr ON u.id = sr.created_by
LEFT JOIN key_worker_assignments kw ON u.id = kw.worker_id
LEFT JOIN individual_plans ip ON u.id = ip.created_by
WHERE u.role = 'worker' OR u.role = 'admin'
GROUP BY u.id;

-- =================================================================================
-- INSERT DEFAULT LOOKUP VALUES
-- =================================================================================

-- Service Types
INSERT INTO lookup_values (category, value, display_order) VALUES
('service_type', 'Konzultace', 1),
('service_type', 'Doprovod', 2),
('service_type', 'Úvodní schůzka', 3),
('service_type', 'Psychologická konzultace', 4),
('service_type', 'Humanitární pomoc', 5),
('service_type', 'Interkulturní práce', 6),
('service_type', 'Jednání s institucí', 7),
('service_type', 'Informační servis', 8),
('service_type', 'Situační intervence', 9),
('service_type', 'Tlumočení', 10),
('service_type', 'Humanitární dávka', 11);

-- Service Locations
INSERT INTO lookup_values (category, value, display_order) VALUES
('location', 'Asistenční centrum', 1),
('location', 'Terénní práce', 2),
('location', 'Klub', 3),
('location', 'Streetwork', 4),
('location', 'Ostatní', 5);

-- Service Topics
INSERT INTO lookup_values (category, value, display_order) VALUES
('topic', 'Zdravotnictví', 1),
('topic', 'Bydlení', 2),
('topic', 'Doklady/víza', 3),
('topic', 'Dávka HUD', 4),
('topic', 'Úřad', 5),
('topic', 'Osobní, intimní', 6),
('topic', 'Ostatní', 7),
('topic', 'Vrstevnická skupina', 8),
('topic', 'Psychologická pomoc', 9);

-- Genders
INSERT INTO lookup_values (category, value, display_order) VALUES
('gender', 'Muž', 1),
('gender', 'Žena', 2),
('gender', 'Nespecifikováno', 3);

-- User Roles
INSERT INTO lookup_values (category, value, display_order) VALUES
('role', 'admin', 1),
('role', 'worker', 2),
('role', 'viewer', 3);

-- =================================================================================
-- FUNCTIONS & TRIGGERS
-- =================================================================================

-- Update timestamp trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply updated_at trigger to all tables with updated_at column
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_clients_updated_at BEFORE UPDATE ON clients
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_contracts_updated_at BEFORE UPDATE ON contracts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_individual_plans_updated_at BEFORE UPDATE ON individual_plans
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_service_records_updated_at BEFORE UPDATE ON service_records
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_notes_updated_at BEFORE UPDATE ON notes
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_sanctions_updated_at BEFORE UPDATE ON sanctions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_daily_records_updated_at BEFORE UPDATE ON daily_records
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =================================================================================
-- INITIAL ADMIN USER (password: admin123 - CHANGE IN PRODUCTION)
-- =================================================================================

-- Password hash for 'admin123' using bcrypt (MUST be changed after first login)
INSERT INTO users (username, email, password_hash, first_name, last_name, role) 
VALUES (
    'admin',
    'admin@example.org',
    '$2b$10$rBV2KLV5P7ZgKPQD9YM0me7qVHQqCpqT5GvQyU0VZ0EVMQKJ0XYAK',
    'System',
    'Administrator',
    'admin'
);

-- =================================================================================
-- END OF SCHEMA
-- =================================================================================


























