-- =================================================================================
-- WEEKLY PLANNER SYSTEM SCHEMA
-- =================================================================================
-- Digital version of the paper weekly planning boards
-- =================================================================================

-- =================================================================================
-- WEEKLY PLANNERS
-- =================================================================================

-- Main weekly planner table
CREATE TABLE weekly_planners (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title VARCHAR(255) NOT NULL,
    description TEXT,
    week_start_date DATE NOT NULL, -- Monday of the week
    week_number INTEGER NOT NULL,
    year INTEGER NOT NULL,
    created_by UUID REFERENCES users(id),
    is_template BOOLEAN DEFAULT false,
    is_shared BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Activity types for color coding and categorization
CREATE TABLE activity_types (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL,
    name_cs VARCHAR(100) NOT NULL, -- Czech name
    color VARCHAR(7) NOT NULL, -- hex color code
    icon VARCHAR(50), -- icon name
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Rooms/locations for resource booking
CREATE TABLE rooms (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL,
    capacity INTEGER,
    description TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Individual activity blocks on the planner
CREATE TABLE planner_activities (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    planner_id UUID REFERENCES weekly_planners(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    activity_type_id UUID REFERENCES activity_types(id),
    client_id UUID REFERENCES clients(id), -- optional, for client-specific activities
    assigned_worker_id UUID REFERENCES users(id), -- who is responsible
    room_id UUID REFERENCES rooms(id), -- optional, for room booking
    day_of_week INTEGER NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6), -- 0=Monday, 6=Sunday
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    notes TEXT,
    is_recurring BOOLEAN DEFAULT false,
    recurrence_pattern VARCHAR(50), -- 'weekly', 'monthly', etc.
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    
    -- Ensure end time is after start time
    CONSTRAINT valid_time_range CHECK (end_time > start_time)
);

-- Comments on planners for team collaboration
CREATE TABLE planner_comments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    planner_id UUID REFERENCES weekly_planners(id) ON DELETE CASCADE,
    activity_id UUID REFERENCES planner_activities(id) ON DELETE CASCADE, -- optional, for activity-specific comments
    user_id UUID REFERENCES users(id),
    content TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Planner sharing/collaboration
CREATE TABLE planner_collaborators (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    planner_id UUID REFERENCES weekly_planners(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id),
    permission_level VARCHAR(20) DEFAULT 'view', -- 'view', 'edit', 'admin'
    added_by UUID REFERENCES users(id),
    added_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(planner_id, user_id)
);

-- =================================================================================
-- INDEXES
-- =================================================================================

CREATE INDEX idx_weekly_planners_week ON weekly_planners(week_start_date, year, week_number);
CREATE INDEX idx_weekly_planners_created_by ON weekly_planners(created_by);
CREATE INDEX idx_weekly_planners_shared ON weekly_planners(is_shared);

CREATE INDEX idx_planner_activities_planner ON planner_activities(planner_id);
CREATE INDEX idx_planner_activities_day_time ON planner_activities(day_of_week, start_time);
CREATE INDEX idx_planner_activities_worker ON planner_activities(assigned_worker_id);
CREATE INDEX idx_planner_activities_client ON planner_activities(client_id);
CREATE INDEX idx_planner_activities_room ON planner_activities(room_id);

CREATE INDEX idx_planner_comments_planner ON planner_comments(planner_id);
CREATE INDEX idx_planner_comments_activity ON planner_comments(activity_id);

CREATE INDEX idx_planner_collaborators_planner ON planner_collaborators(planner_id);
CREATE INDEX idx_planner_collaborators_user ON planner_collaborators(user_id);

-- =================================================================================
-- TRIGGERS
-- =================================================================================

CREATE TRIGGER update_weekly_planners_updated_at BEFORE UPDATE ON weekly_planners
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_planner_activities_updated_at BEFORE UPDATE ON planner_activities
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =================================================================================
-- DEFAULT DATA
-- =================================================================================

-- Insert default activity types based on the paper system
INSERT INTO activity_types (name, name_cs, color, icon) VALUES
('individual_meeting', 'Individuální schůzka', '#ef4444', 'UserIcon'),
('group_activity', 'Skupinová aktivita', '#22c55e', 'UserGroupIcon'),
('psychology_session', 'Psychologická podpora', '#a855f7', 'HeartIcon'),
('administrative', 'Administrativa', '#3b82f6', 'DocumentTextIcon'),
('field_work', 'Terénní práce', '#f59e0b', 'MapPinIcon'),
('education', 'Vzdělávání', '#06b6d4', 'BookOpenIcon'),
('break', 'Přestávka', '#6b7280', 'ClockIcon'),
('meeting', 'Porada', '#ec4899', 'ChatBubbleLeftIcon');

-- Insert default rooms based on the paper system
INSERT INTO rooms (name, capacity, description) VALUES
('Malý sál', 15, 'Menší místnost pro skupinové aktivity'),
('Sál', 30, 'Hlavní sál pro větší skupiny'),
('Kancelář', 4, 'Kancelář pro individuální schůzky'),
('Kancelář 2', 4, 'Druhá kancelář pro individuální schůzky'),
('Venkovní prostor', 50, 'Venkovní prostory pro aktivity'),
('Online', 999, 'Online prostředí pro vzdálené aktivity');

-- =================================================================================
-- SAMPLE DATA (for testing)
-- =================================================================================

-- Create a sample planner for current week
DO $$
DECLARE
    planner_uuid UUID;
    admin_user_id UUID;
    current_monday DATE;
BEGIN
    -- Get admin user
    SELECT id INTO admin_user_id FROM users WHERE role = 'admin' LIMIT 1;
    
    -- Get current Monday
    current_monday := date_trunc('week', CURRENT_DATE);
    
    -- Create sample planner
    INSERT INTO weekly_planners (title, description, week_start_date, week_number, year, created_by, is_shared)
    VALUES (
        'Týdenní plán - Týden ' || EXTRACT(week FROM current_monday),
        'Plán aktivit pro aktuální týden',
        current_monday,
        EXTRACT(week FROM current_monday)::INTEGER,
        EXTRACT(year FROM current_monday)::INTEGER,
        admin_user_id,
        true
    )
    RETURNING id INTO planner_uuid;
    
    -- Add sample activities
    INSERT INTO planner_activities (planner_id, title, description, activity_type_id, day_of_week, start_time, end_time, assigned_worker_id, room_id, created_by)
    SELECT 
        planner_uuid,
        'Ranní porada',
        'Týmová porada na začátek týdne',
        at.id,
        0, -- Monday
        '09:00'::TIME,
        '09:30'::TIME,
        admin_user_id,
        r.id,
        admin_user_id
    FROM activity_types at, rooms r 
    WHERE at.name = 'meeting' AND r.name = 'Sál'
    LIMIT 1;
    
END $$;
