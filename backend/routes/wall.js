import express from 'express';
import { query } from '../config/database.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();
router.use(authenticateToken);

// =================================================================================
// GET ALL POSTS (with pagination and filtering)
// =================================================================================

router.get('/posts', async (req, res) => {
    try {
        const { 
            page = 1, 
            limit = 20,
            type,
            pinned
        } = req.query;

        const offset = (page - 1) * limit;
        let whereConditions = ['p.is_archived = false'];
        let queryParams = [];
        let paramCount = 1;

        if (type && type !== 'all') {
            whereConditions.push(`p.post_type = $${paramCount}`);
            queryParams.push(type);
            paramCount++;
        }

        if (pinned === 'true') {
            whereConditions.push('p.is_pinned = true');
        }

        const whereClause = whereConditions.length > 0 
            ? `WHERE ${whereConditions.join(' AND ')}` 
            : '';

        // Get posts with author info and counts
        const postsQuery = `
            SELECT 
                p.id,
                p.author_id,
                p.content,
                p.post_type,
                p.image_url,
                p.file_url,
                p.file_name,
                p.is_pinned,
                p.tags,
                p.vote_id,
                p.created_at,
                p.updated_at,
                u.first_name as author_first_name,
                u.last_name as author_last_name,
                u.role as author_role,
                COUNT(DISTINCT l.id) as like_count,
                COUNT(DISTINCT c.id) as comment_count,
                ARRAY_AGG(DISTINCT l.user_id) FILTER (WHERE l.user_id IS NOT NULL) as liked_by_users,
                v.title as vote_title,
                v.description as vote_description,
                v.vote_type,
                v.is_anonymous as vote_is_anonymous,
                v.is_active as vote_is_active,
                v.ends_at as vote_ends_at
            FROM wall_posts p
            LEFT JOIN users u ON p.author_id = u.id
            LEFT JOIN wall_post_likes l ON p.id = l.post_id
            LEFT JOIN wall_post_comments c ON p.id = c.post_id
            LEFT JOIN votes v ON p.vote_id = v.id
            ${whereClause}
            GROUP BY p.id, u.first_name, u.last_name, u.role, v.title, v.description, v.vote_type, v.is_anonymous, v.is_active, v.ends_at
            ORDER BY p.is_pinned DESC, p.created_at DESC
            LIMIT $${paramCount} OFFSET $${paramCount + 1}
        `;

        queryParams.push(limit, offset);
        const posts = await query(postsQuery, queryParams);

        // Get total count
        const countQuery = `
            SELECT COUNT(*) as total
            FROM wall_posts p
            ${whereClause}
        `;
        const countResult = await query(countQuery, queryParams.slice(0, -2));

        res.json({
            posts: posts.rows,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total: parseInt(countResult.rows[0].total),
                pages: Math.ceil(countResult.rows[0].total / limit)
            }
        });

    } catch (error) {
        console.error('Get posts error:', error);
        res.status(500).json({ error: 'Failed to fetch posts' });
    }
});

// =================================================================================
// CREATE POST
// =================================================================================

router.post('/posts', async (req, res) => {
    try {
        const { content, postType, imageUrl, fileUrl, fileName, tags } = req.body;

        if (!content || content.trim().length === 0) {
            return res.status(400).json({ error: 'Content is required' });
        }

        const result = await query(
            `INSERT INTO wall_posts (author_id, content, post_type, image_url, file_url, file_name, tags)
             VALUES ($1, $2, $3, $4, $5, $6, $7)
             RETURNING *`,
            [req.user.id, content.trim(), postType || 'general', imageUrl, fileUrl, fileName, tags || []]
        );

        // Get the post with author info
        const post = await query(
            `SELECT 
                p.*,
                u.first_name as author_first_name,
                u.last_name as author_last_name,
                u.role as author_role
             FROM wall_posts p
             LEFT JOIN users u ON p.author_id = u.id
             WHERE p.id = $1`,
            [result.rows[0].id]
        );

        res.status(201).json(post.rows[0]);

    } catch (error) {
        console.error('Create post error:', error);
        res.status(500).json({ error: 'Failed to create post' });
    }
});

// =================================================================================
// UPDATE POST
// =================================================================================

router.put('/posts/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { content, postType, tags } = req.body;

        // Check if user owns the post or is admin
        const existing = await query(
            'SELECT author_id FROM wall_posts WHERE id = $1',
            [id]
        );

        if (existing.rows.length === 0) {
            return res.status(404).json({ error: 'Post not found' });
        }

        if (existing.rows[0].author_id !== req.user.id && req.user.role !== 'admin') {
            return res.status(403).json({ error: 'Not authorized to edit this post' });
        }

        const result = await query(
            `UPDATE wall_posts 
             SET content = $1, post_type = $2, tags = $3, updated_at = NOW()
             WHERE id = $4
             RETURNING *`,
            [content, postType, tags || [], id]
        );

        res.json(result.rows[0]);

    } catch (error) {
        console.error('Update post error:', error);
        res.status(500).json({ error: 'Failed to update post' });
    }
});

// =================================================================================
// DELETE POST
// =================================================================================

router.delete('/posts/:id', async (req, res) => {
    try {
        const { id } = req.params;

        // Check if user owns the post or is admin
        const existing = await query(
            'SELECT author_id FROM wall_posts WHERE id = $1',
            [id]
        );

        if (existing.rows.length === 0) {
            return res.status(404).json({ error: 'Post not found' });
        }

        if (existing.rows[0].author_id !== req.user.id && req.user.role !== 'admin') {
            return res.status(403).json({ error: 'Not authorized to delete this post' });
        }

        await query('DELETE FROM wall_posts WHERE id = $1', [id]);

        res.json({ message: 'Post deleted successfully' });

    } catch (error) {
        console.error('Delete post error:', error);
        res.status(500).json({ error: 'Failed to delete post' });
    }
});

// =================================================================================
// PIN/UNPIN POST (Admin only)
// =================================================================================

router.put('/posts/:id/pin', async (req, res) => {
    try {
        if (req.user.role !== 'admin') {
            return res.status(403).json({ error: 'Admin access required' });
        }

        const { id } = req.params;
        const { pinned } = req.body;

        const result = await query(
            `UPDATE wall_posts 
             SET is_pinned = $1, pinned_at = $2, pinned_by = $3
             WHERE id = $4
             RETURNING *`,
            [pinned, pinned ? new Date() : null, pinned ? req.user.id : null, id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Post not found' });
        }

        res.json(result.rows[0]);

    } catch (error) {
        console.error('Pin post error:', error);
        res.status(500).json({ error: 'Failed to pin post' });
    }
});

// =================================================================================
// LIKE/UNLIKE POST
// =================================================================================

router.post('/posts/:id/like', async (req, res) => {
    try {
        const { id } = req.params;

        // Check if already liked
        const existing = await query(
            'SELECT id FROM wall_post_likes WHERE post_id = $1 AND user_id = $2',
            [id, req.user.id]
        );

        if (existing.rows.length > 0) {
            // Unlike
            await query(
                'DELETE FROM wall_post_likes WHERE post_id = $1 AND user_id = $2',
                [id, req.user.id]
            );
            res.json({ liked: false });
        } else {
            // Like
            await query(
                'INSERT INTO wall_post_likes (post_id, user_id) VALUES ($1, $2)',
                [id, req.user.id]
            );
            res.json({ liked: true });
        }

    } catch (error) {
        console.error('Like post error:', error);
        res.status(500).json({ error: 'Failed to like post' });
    }
});

// =================================================================================
// GET COMMENTS FOR POST
// =================================================================================

router.get('/posts/:id/comments', async (req, res) => {
    try {
        const { id } = req.params;

        const comments = await query(
            `SELECT 
                c.*,
                u.first_name as author_first_name,
                u.last_name as author_last_name,
                u.role as author_role,
                (SELECT COUNT(*) FROM wall_post_comments WHERE parent_comment_id = c.id) as reply_count
             FROM wall_post_comments c
             LEFT JOIN users u ON c.author_id = u.id
             WHERE c.post_id = $1
             ORDER BY 
                CASE WHEN c.parent_comment_id IS NULL THEN c.created_at ELSE '1970-01-01' END ASC,
                c.parent_comment_id NULLS FIRST,
                c.created_at ASC`,
            [id]
        );

        res.json(comments.rows);

    } catch (error) {
        console.error('Get comments error:', error);
        res.status(500).json({ error: 'Failed to fetch comments' });
    }
});

// =================================================================================
// ADD COMMENT
// =================================================================================

router.post('/posts/:id/comments', async (req, res) => {
    try {
        const { id } = req.params;
        const { content, parent_comment_id } = req.body;

        if (!content || content.trim().length === 0) {
            return res.status(400).json({ error: 'Comment content is required' });
        }

        // If replying to a comment, verify it exists and belongs to this post
        if (parent_comment_id) {
            const parentComment = await query(
                `SELECT post_id FROM wall_post_comments WHERE id = $1`,
                [parent_comment_id]
            );
            if (parentComment.rows.length === 0 || parentComment.rows[0].post_id !== id) {
                return res.status(400).json({ error: 'Invalid parent comment' });
            }
        }

        const result = await query(
            `INSERT INTO wall_post_comments (post_id, author_id, content, parent_comment_id)
             VALUES ($1, $2, $3, $4)
             RETURNING *`,
            [id, req.user.id, content.trim(), parent_comment_id || null]
        );

        // Get comment with author info
        const comment = await query(
            `SELECT 
                c.*,
                u.first_name as author_first_name,
                u.last_name as author_last_name,
                u.role as author_role,
                0 as reply_count
             FROM wall_post_comments c
             LEFT JOIN users u ON c.author_id = u.id
             WHERE c.id = $1`,
            [result.rows[0].id]
        );

        res.status(201).json(comment.rows[0]);

    } catch (error) {
        console.error('Add comment error:', error);
        res.status(500).json({ error: 'Failed to add comment' });
    }
});

// =================================================================================
// DELETE COMMENT
// =================================================================================

router.delete('/comments/:id', async (req, res) => {
    try {
        const { id } = req.params;

        // Check if user owns the comment or is admin
        const existing = await query(
            'SELECT author_id FROM wall_post_comments WHERE id = $1',
            [id]
        );

        if (existing.rows.length === 0) {
            return res.status(404).json({ error: 'Comment not found' });
        }

        if (existing.rows[0].author_id !== req.user.id && req.user.role !== 'admin') {
            return res.status(403).json({ error: 'Not authorized to delete this comment' });
        }

        await query('DELETE FROM wall_post_comments WHERE id = $1', [id]);

        res.json({ message: 'Comment deleted successfully' });

    } catch (error) {
        console.error('Delete comment error:', error);
        res.status(500).json({ error: 'Failed to delete comment' });
    }
});

export default router;
