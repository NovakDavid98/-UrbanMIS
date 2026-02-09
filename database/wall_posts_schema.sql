-- =================================================================================
-- WALL/FEED POSTS SYSTEM - Database Schema Addition
-- =================================================================================
-- Social wall feature for team collaboration and updates
-- =================================================================================

-- Posts table
CREATE TABLE IF NOT EXISTS wall_posts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    author_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
    
    -- Content
    content TEXT NOT NULL,
    post_type VARCHAR(50) DEFAULT 'general', -- general, announcement, event, success, resource, milestone
    
    -- Media
    image_url VARCHAR(500),
    file_url VARCHAR(500),
    file_name VARCHAR(255),
    
    -- Metadata
    is_pinned BOOLEAN DEFAULT false,
    is_archived BOOLEAN DEFAULT false,
    tags TEXT[], -- Array of tags
    
    -- Timestamps
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    pinned_at TIMESTAMP,
    pinned_by UUID REFERENCES users(id)
);

-- Post likes/reactions
CREATE TABLE IF NOT EXISTS wall_post_likes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    post_id UUID REFERENCES wall_posts(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
    reaction_type VARCHAR(20) DEFAULT 'like', -- like, love, celebrate, support
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(post_id, user_id)
);

-- Post comments
CREATE TABLE IF NOT EXISTS wall_post_comments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    post_id UUID REFERENCES wall_posts(id) ON DELETE CASCADE NOT NULL,
    author_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
    content TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_wall_posts_author ON wall_posts(author_id);
CREATE INDEX IF NOT EXISTS idx_wall_posts_type ON wall_posts(post_type);
CREATE INDEX IF NOT EXISTS idx_wall_posts_created ON wall_posts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_wall_posts_pinned ON wall_posts(is_pinned, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_wall_post_likes_post ON wall_post_likes(post_id);
CREATE INDEX IF NOT EXISTS idx_wall_post_comments_post ON wall_post_comments(post_id);

-- Trigger for updated_at
CREATE TRIGGER update_wall_posts_updated_at BEFORE UPDATE ON wall_posts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_wall_post_comments_updated_at BEFORE UPDATE ON wall_post_comments
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- View for posts with counts
CREATE OR REPLACE VIEW wall_posts_with_stats AS
SELECT 
    p.id,
    p.author_id,
    p.content,
    p.post_type,
    p.image_url,
    p.file_url,
    p.file_name,
    p.is_pinned,
    p.is_archived,
    p.tags,
    p.created_at,
    p.updated_at,
    p.pinned_at,
    u.first_name as author_first_name,
    u.last_name as author_last_name,
    u.role as author_role,
    COUNT(DISTINCT l.id) as like_count,
    COUNT(DISTINCT c.id) as comment_count
FROM wall_posts p
LEFT JOIN users u ON p.author_id = u.id
LEFT JOIN wall_post_likes l ON p.id = l.post_id
LEFT JOIN wall_post_comments c ON p.id = c.post_id
WHERE p.is_archived = false
GROUP BY p.id, u.first_name, u.last_name, u.role;
