-- =================================================================================
-- VOTING SYSTEM SCHEMA
-- =================================================================================
-- Add voting functionality to the wall system
-- =================================================================================

-- =================================================================================
-- VOTING TABLES
-- =================================================================================

-- Votes table for polls/voting posts
CREATE TABLE votes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title VARCHAR(255) NOT NULL,
    description TEXT,
    vote_type VARCHAR(50) DEFAULT 'single_choice', -- 'single_choice', 'multiple_choice', 'rating'
    is_anonymous BOOLEAN DEFAULT false,
    is_active BOOLEAN DEFAULT true,
    ends_at TIMESTAMP,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Vote options for each vote
CREATE TABLE vote_options (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    vote_id UUID REFERENCES votes(id) ON DELETE CASCADE,
    option_text VARCHAR(500) NOT NULL,
    option_order INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW()
);

-- User responses to votes
CREATE TABLE vote_responses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    vote_id UUID REFERENCES votes(id) ON DELETE CASCADE,
    option_id UUID REFERENCES vote_options(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    rating INTEGER, -- For rating type votes (1-5 or 1-10)
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(vote_id, user_id, option_id) -- Prevent duplicate votes for same option
);

-- Add voting support to wall posts
ALTER TABLE wall_posts ADD COLUMN vote_id UUID REFERENCES votes(id);

-- =================================================================================
-- INDEXES
-- =================================================================================

CREATE INDEX idx_votes_created_by ON votes(created_by);
CREATE INDEX idx_votes_is_active ON votes(is_active);
CREATE INDEX idx_votes_ends_at ON votes(ends_at);

CREATE INDEX idx_vote_options_vote_id ON vote_options(vote_id);
CREATE INDEX idx_vote_options_order ON vote_options(vote_id, option_order);

CREATE INDEX idx_vote_responses_vote_id ON vote_responses(vote_id);
CREATE INDEX idx_vote_responses_user_id ON vote_responses(user_id);
CREATE INDEX idx_vote_responses_option_id ON vote_responses(option_id);

CREATE INDEX idx_wall_posts_vote_id ON wall_posts(vote_id);

-- =================================================================================
-- TRIGGERS
-- =================================================================================

CREATE TRIGGER update_votes_updated_at BEFORE UPDATE ON votes
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =================================================================================
-- INITIAL FEATURE VOTING DATA
-- =================================================================================

-- Create a vote for new features
INSERT INTO votes (title, description, vote_type, is_active, created_by) 
SELECT 
    'Které nové funkce chcete v Centrálním Mozku?',
    'Hlasujte pro funkce, které by podle vás měly být přidány jako první. Můžete vybrat více možností.',
    'multiple_choice',
    true,
    id
FROM users WHERE role = 'admin' LIMIT 1;

-- Get the vote ID for options
DO $$
DECLARE
    vote_uuid UUID;
BEGIN
    SELECT id INTO vote_uuid FROM votes WHERE title = 'Které nové funkce chcete v Centrálním Mozku?' LIMIT 1;
    
    -- Add feature options
    INSERT INTO vote_options (vote_id, option_text, option_order) VALUES
    (vote_uuid, '📱 Mobilní aplikace pro terénní pracovníky', 1),
    (vote_uuid, '🤖 AI-powered analýza klientů a predikce potřeb', 2),
    (vote_uuid, '📊 Pokročilé analytické dashboardy s grafy', 3),
    (vote_uuid, '🗓️ Chytrý kalendář a plánování schůzek', 4),
    (vote_uuid, '📋 Digitální formuláře a elektronické podpisy', 5),
    (vote_uuid, '🎯 Gamifikace a motivační systém pro tým', 6),
    (vote_uuid, '👥 Pokročilá týmová spolupráce a videohovory', 7),
    (vote_uuid, '📞 Komunikační hub (VoIP, SMS, email)', 8),
    (vote_uuid, '🔗 Integrace s externími systémy (úřady, zdravotnictví)', 9),
    (vote_uuid, '📱 Klientský self-service portál', 10),
    (vote_uuid, '🔐 Pokročilé zabezpečení (2FA, audit trail)', 11),
    (vote_uuid, '🚨 Systém nouzové reakce a krizové intervence', 12),
    (vote_uuid, '🏘️ Komunitní funkce a správa dobrovolníků', 13),
    (vote_uuid, '📚 Správa zdrojů a inventáře', 14);
END $$;

-- Create a wall post for the feature voting
INSERT INTO wall_posts (author_id, content, post_type, vote_id, is_pinned)
SELECT 
    u.id,
    'Tým Centrálního Mozku připravil seznam nových funkcí! 🚀 Hlasujte pro ty, které považujete za nejdůležitější. Vaše hlasy pomohou určit priority vývoje.',
    'poll',
    v.id,
    true
FROM users u, votes v 
WHERE u.role = 'admin' 
AND v.title = 'Které nové funkce chcete v Centrálním Mozku?' 
LIMIT 1;
