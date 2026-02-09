-- Add support for comment replies
-- Migration: 002_add_comment_replies.sql

-- Add parent_comment_id column to support threaded replies
ALTER TABLE wall_post_comments 
ADD COLUMN IF NOT EXISTS parent_comment_id UUID REFERENCES wall_post_comments(id) ON DELETE CASCADE;

-- Add index for better performance when loading replies
CREATE INDEX IF NOT EXISTS idx_wall_post_comments_parent ON wall_post_comments(parent_comment_id);

-- Add index for loading all comments with their replies efficiently
CREATE INDEX IF NOT EXISTS idx_wall_post_comments_post_parent ON wall_post_comments(post_id, parent_comment_id);

COMMENT ON COLUMN wall_post_comments.parent_comment_id IS 'Reference to parent comment for threaded replies. NULL for top-level comments.';

