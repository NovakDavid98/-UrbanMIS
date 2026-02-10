-- =================================================================================
-- URBANMIS - DATABASE SCHEMA
-- =================================================================================
-- Open-source database design for streetwork and humanitarian NGO management
-- =================================================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "unaccent";

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
    
    -- Czech Address Details
    czech_city VARCHAR(200),
    czech_address TEXT,
    latitude DECIMAL(10,7),
    longitude DECIMAL(10,7),
    
    -- Status
    is_active BOOLEAN DEFAULT true,
    activity_status VARCHAR(50) DEFAULT 'active',
    went_to_ukraine BOOLEAN DEFAULT false,
    is_in_ostrava BOOLEAN DEFAULT true,
    
    -- Notes
    notes TEXT,
    
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
    '$2b$10$QVyYkDxsbTsbEdwx1HZEGuOT0kA.4ZShhAeHYZh5ETeXSgD5XqaPW',
    'System',
    'Administrator',
    'admin'
);

-- =================================================================================
-- 14. USER PRESENCE (Online/Offline tracking for chat)
-- =================================================================================

CREATE TABLE user_presence (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE UNIQUE,
    is_online BOOLEAN DEFAULT false,
    socket_id VARCHAR(255),
    last_seen TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_user_presence_user ON user_presence(user_id);
CREATE INDEX idx_user_presence_online ON user_presence(is_online);

-- =================================================================================
-- 15. USER PREFERENCES
-- =================================================================================

CREATE TABLE user_preferences (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    category VARCHAR(100) NOT NULL,
    key VARCHAR(100) NOT NULL,
    value TEXT,
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(user_id, category, key)
);

CREATE INDEX idx_user_preferences_user ON user_preferences(user_id);

-- =================================================================================
-- 16. CONVERSATIONS (Chat)
-- =================================================================================

CREATE TABLE conversations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    participant_1 UUID REFERENCES users(id) ON DELETE CASCADE,
    participant_2 UUID REFERENCES users(id) ON DELETE CASCADE,
    last_message_at TIMESTAMP DEFAULT NOW(),
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(participant_1, participant_2)
);

CREATE INDEX idx_conversations_p1 ON conversations(participant_1);
CREATE INDEX idx_conversations_p2 ON conversations(participant_2);

-- =================================================================================
-- 17. MESSAGES (Chat)
-- =================================================================================

CREATE TABLE messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE,
    sender_id UUID REFERENCES users(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    message_type VARCHAR(50) DEFAULT 'text',
    file_url VARCHAR(500),
    file_name VARCHAR(255),
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_messages_conversation ON messages(conversation_id);
CREATE INDEX idx_messages_sender ON messages(sender_id);
CREATE INDEX idx_messages_created ON messages(created_at DESC);

-- =================================================================================
-- 18. MESSAGE READ STATUS
-- =================================================================================

CREATE TABLE message_read_status (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    message_id UUID REFERENCES messages(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    read_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(message_id, user_id)
);

CREATE INDEX idx_message_read_message ON message_read_status(message_id);
CREATE INDEX idx_message_read_user ON message_read_status(user_id);

-- =================================================================================
-- 19. WALL POSTS
-- =================================================================================

CREATE TABLE wall_posts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    author_id UUID REFERENCES users(id) ON DELETE CASCADE,
    content TEXT,
    post_type VARCHAR(50) DEFAULT 'text',
    image_url VARCHAR(500),
    file_url VARCHAR(500),
    file_name VARCHAR(255),
    tags TEXT[],
    vote_id UUID,
    is_pinned BOOLEAN DEFAULT false,
    is_archived BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_wall_posts_author ON wall_posts(author_id);
CREATE INDEX idx_wall_posts_created ON wall_posts(created_at DESC);
CREATE INDEX idx_wall_posts_pinned ON wall_posts(is_pinned);

-- =================================================================================
-- 20. WALL POST LIKES
-- =================================================================================

CREATE TABLE wall_post_likes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    post_id UUID REFERENCES wall_posts(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(post_id, user_id)
);

CREATE INDEX idx_wall_post_likes_post ON wall_post_likes(post_id);

-- =================================================================================
-- 21. WALL POST COMMENTS
-- =================================================================================

CREATE TABLE wall_post_comments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    post_id UUID REFERENCES wall_posts(id) ON DELETE CASCADE,
    author_id UUID REFERENCES users(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    parent_comment_id UUID REFERENCES wall_post_comments(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_wall_post_comments_post ON wall_post_comments(post_id);
CREATE INDEX idx_wall_post_comments_parent ON wall_post_comments(parent_comment_id);

-- =================================================================================
-- 22. VISITS
-- =================================================================================

CREATE TABLE visits (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
    visit_date DATE NOT NULL,
    time_spent INTEGER,
    notes TEXT,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_visits_client ON visits(client_id);
CREATE INDEX idx_visits_date ON visits(visit_date);
CREATE INDEX idx_visits_created_by ON visits(created_by);

-- =================================================================================
-- 23. VISIT REASONS
-- =================================================================================

CREATE TABLE visit_reasons (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    category VARCHAR(100) NOT NULL,
    name_cs VARCHAR(255) NOT NULL,
    name_uk VARCHAR(255),
    name_ru VARCHAR(255),
    display_order INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_visit_reasons_category ON visit_reasons(category);

-- =================================================================================
-- 24. VISIT-VISIT REASONS (Many-to-Many)
-- =================================================================================

CREATE TABLE visit_visit_reasons (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    visit_id UUID REFERENCES visits(id) ON DELETE CASCADE,
    visit_reason_id UUID REFERENCES visit_reasons(id) ON DELETE CASCADE,
    UNIQUE(visit_id, visit_reason_id)
);

CREATE INDEX idx_vvr_visit ON visit_visit_reasons(visit_id);
CREATE INDEX idx_vvr_reason ON visit_visit_reasons(visit_reason_id);

-- =================================================================================
-- 25. VOTES (Voting/Polls)
-- =================================================================================

CREATE TABLE votes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title VARCHAR(255) NOT NULL,
    description TEXT,
    vote_type VARCHAR(50) DEFAULT 'single',
    is_anonymous BOOLEAN DEFAULT false,
    is_active BOOLEAN DEFAULT true,
    ends_at TIMESTAMP,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_votes_created_by ON votes(created_by);
CREATE INDEX idx_votes_active ON votes(is_active);

-- Add foreign key for wall_posts.vote_id now that votes exists
ALTER TABLE wall_posts ADD CONSTRAINT fk_wall_posts_vote FOREIGN KEY (vote_id) REFERENCES votes(id) ON DELETE SET NULL;

-- =================================================================================
-- 26. VOTE OPTIONS
-- =================================================================================

CREATE TABLE vote_options (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    vote_id UUID REFERENCES votes(id) ON DELETE CASCADE,
    option_text VARCHAR(255) NOT NULL,
    option_order INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_vote_options_vote ON vote_options(vote_id);

-- =================================================================================
-- 27. VOTE RESPONSES
-- =================================================================================

CREATE TABLE vote_responses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    vote_id UUID REFERENCES votes(id) ON DELETE CASCADE,
    option_id UUID REFERENCES vote_options(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    rating INTEGER,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_vote_responses_vote ON vote_responses(vote_id);
CREATE INDEX idx_vote_responses_option ON vote_responses(option_id);
CREATE INDEX idx_vote_responses_user ON vote_responses(user_id);

-- =================================================================================
-- 28. WEEKLY PLANNERS
-- =================================================================================

CREATE TABLE weekly_planners (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title VARCHAR(255) NOT NULL,
    description TEXT,
    week_start_date DATE NOT NULL,
    week_number INTEGER,
    year INTEGER,
    is_template BOOLEAN DEFAULT false,
    is_shared BOOLEAN DEFAULT false,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_weekly_planners_week ON weekly_planners(year, week_number);
CREATE INDEX idx_weekly_planners_created_by ON weekly_planners(created_by);

-- =================================================================================
-- 29. ACTIVITY TYPES (Reference data for planner)
-- =================================================================================

CREATE TABLE activity_types (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    name_cs VARCHAR(255),
    color VARCHAR(7) DEFAULT '#3B82F6',
    icon VARCHAR(50),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW()
);

-- =================================================================================
-- 30. ROOMS (Reference data for planner)
-- =================================================================================

CREATE TABLE rooms (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    capacity INTEGER,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW()
);

-- =================================================================================
-- 31. PLANNER ACTIVITIES
-- =================================================================================

CREATE TABLE planner_activities (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    planner_id UUID REFERENCES weekly_planners(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    activity_type_id UUID REFERENCES activity_types(id),
    client_id UUID REFERENCES clients(id),
    assigned_worker_id UUID REFERENCES users(id),
    room_id UUID REFERENCES rooms(id),
    day_of_week INTEGER NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    notes TEXT,
    is_recurring BOOLEAN DEFAULT false,
    recurrence_pattern VARCHAR(50),
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_planner_activities_planner ON planner_activities(planner_id);
CREATE INDEX idx_planner_activities_day ON planner_activities(day_of_week);

-- =================================================================================
-- 32. PLANNER COLLABORATORS
-- =================================================================================

CREATE TABLE planner_collaborators (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    planner_id UUID REFERENCES weekly_planners(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    permission_level VARCHAR(50) DEFAULT 'view',
    added_by UUID REFERENCES users(id),
    added_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(planner_id, user_id)
);

CREATE INDEX idx_planner_collaborators_planner ON planner_collaborators(planner_id);
CREATE INDEX idx_planner_collaborators_user ON planner_collaborators(user_id);

-- =================================================================================
-- 33. PLANNER COMMENTS
-- =================================================================================

CREATE TABLE planner_comments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    planner_id UUID REFERENCES weekly_planners(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_planner_comments_planner ON planner_comments(planner_id);

-- =================================================================================
-- 34. DUPLICATE PAIRS (Data repair)
-- =================================================================================

CREATE TABLE duplicate_pairs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    client_1_id UUID REFERENCES clients(id) ON DELETE CASCADE,
    client_2_id UUID REFERENCES clients(id) ON DELETE CASCADE,
    similarity_score DECIMAL(5,2),
    status VARCHAR(50) DEFAULT 'pending',
    resolved_by UUID REFERENCES users(id),
    resolved_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_duplicate_pairs_status ON duplicate_pairs(status);

-- =================================================================================
-- 35. IP TRACKING
-- =================================================================================

CREATE TABLE ip_tracking (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    ip_address VARCHAR(45) NOT NULL,
    user_agent TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_ip_tracking_user ON ip_tracking(user_id);

-- =================================================================================
-- INSERT DEFAULT VISIT REASONS
-- =================================================================================

INSERT INTO visit_reasons (category, name_cs, name_uk, display_order) VALUES
('warehouse', 'Sklad oblečení', 'Склад одягу', 1),
('warehouse', 'Sklad potravin', 'Склад продуктів', 2),
('warehouse', 'Sklad hygienických potřeb', 'Склад гігієнічних засобів', 3),
('assistance', 'Poradenství', 'Консультація', 10),
('assistance', 'Doprovod na úřad', 'Супровід до установи', 11),
('assistance', 'Tlumočení', 'Переклад', 12),
('assistance', 'Právní pomoc', 'Правова допомога', 13),
('community', 'Komunitní akce', 'Громадська подія', 20),
('community', 'Volnočasové aktivity', 'Дозвільні заходи', 21),
('community', 'Jazykový kurz', 'Мовний курс', 22),
('donations', 'Humanitární dávka', 'Гуманітарна допомога', 30),
('donations', 'Finanční pomoc', 'Фінансова допомога', 31);

-- =================================================================================
-- INSERT DEFAULT ACTIVITY TYPES
-- =================================================================================

INSERT INTO activity_types (name, name_cs, color, icon) VALUES
('Consultation', 'Konzultace', '#3B82F6', 'chat'),
('Workshop', 'Workshop', '#10B981', 'users'),
('Meeting', 'Schůzka', '#F59E0B', 'calendar'),
('Training', 'Školení', '#8B5CF6', 'book'),
('Community Event', 'Komunitní akce', '#EC4899', 'star');

-- =================================================================================
-- INSERT DEFAULT ROOMS
-- =================================================================================

INSERT INTO rooms (name, capacity) VALUES
('Kancelář 1', 4),
('Kancelář 2', 4),
('Zasedací místnost', 12),
('Komunitní prostor', 30),
('Poradenská místnost', 2);

-- =================================================================================
-- ADDITIONAL TRIGGERS FOR NEW TABLES
-- =================================================================================

CREATE TRIGGER update_visits_updated_at BEFORE UPDATE ON visits
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_wall_posts_updated_at BEFORE UPDATE ON wall_posts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_weekly_planners_updated_at BEFORE UPDATE ON weekly_planners
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =================================================================================
-- END OF SCHEMA
-- =================================================================================


























