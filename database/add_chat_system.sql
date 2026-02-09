-- =================================================================================
-- CHAT SYSTEM TABLES
-- =================================================================================

-- User presence tracking
CREATE TABLE user_presence (
    user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    is_online BOOLEAN DEFAULT false,
    last_seen TIMESTAMP DEFAULT NOW(),
    socket_id VARCHAR(255),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Chat conversations (direct messages between users)
CREATE TABLE conversations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    participant_1 UUID REFERENCES users(id) ON DELETE CASCADE,
    participant_2 UUID REFERENCES users(id) ON DELETE CASCADE,
    last_message_at TIMESTAMP DEFAULT NOW(),
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(participant_1, participant_2)
);

-- Chat messages
CREATE TABLE messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE,
    sender_id UUID REFERENCES users(id) ON DELETE CASCADE,
    content TEXT,
    message_type VARCHAR(50) DEFAULT 'text', -- 'text', 'image', 'file', 'emoji'
    file_url VARCHAR(500),
    file_name VARCHAR(255),
    file_size INTEGER,
    is_read BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Message read status
CREATE TABLE message_read_status (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    message_id UUID REFERENCES messages(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    read_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(message_id, user_id)
);

-- Create indexes for performance
CREATE INDEX idx_user_presence_online ON user_presence(is_online);
CREATE INDEX idx_conversations_participants ON conversations(participant_1, participant_2);
CREATE INDEX idx_messages_conversation ON messages(conversation_id, created_at);
CREATE INDEX idx_messages_sender ON messages(sender_id);
CREATE INDEX idx_message_read_status_message ON message_read_status(message_id);

-- Insert presence records for existing users
INSERT INTO user_presence (user_id, is_online, last_seen)
SELECT id, false, NOW()
FROM users
WHERE is_active = true
ON CONFLICT (user_id) DO NOTHING;
