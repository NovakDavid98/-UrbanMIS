-- =================================================================================
-- USER PREFERENCES TABLE
-- =================================================================================
-- Add user preferences table for storing user-specific settings

CREATE TABLE user_preferences (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    category VARCHAR(50) NOT NULL, -- 'interface', 'notifications', 'workflow', etc.
    key VARCHAR(100) NOT NULL,
    value JSONB NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(user_id, category, key)
);

CREATE INDEX idx_user_preferences_user ON user_preferences(user_id);
CREATE INDEX idx_user_preferences_category ON user_preferences(category);

-- Insert default preferences for existing users
INSERT INTO user_preferences (user_id, category, key, value)
SELECT 
    id as user_id,
    'interface' as category,
    'theme' as key,
    '"light"'::jsonb as value
FROM users
WHERE is_active = true;

INSERT INTO user_preferences (user_id, category, key, value)
SELECT 
    id as user_id,
    'interface' as category,
    'language' as key,
    '"cs"'::jsonb as value
FROM users
WHERE is_active = true;

INSERT INTO user_preferences (user_id, category, key, value)
SELECT 
    id as user_id,
    'interface' as category,
    'sidebarCollapsed' as key,
    'false'::jsonb as value
FROM users
WHERE is_active = true;
