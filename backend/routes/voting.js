import express from 'express';
import { query } from '../config/database.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();
router.use(authenticateToken);

// =================================================================================
// GET ALL VOTES
// =================================================================================

router.get('/', async (req, res) => {
    try {
        const { active_only = 'true' } = req.query;
        
        let whereClause = '';
        const params = [];
        
        if (active_only === 'true') {
            whereClause = 'WHERE v.is_active = true AND (v.ends_at IS NULL OR v.ends_at > NOW())';
        }
        
        const votesQuery = `
            SELECT 
                v.id,
                v.title,
                v.description,
                v.vote_type,
                v.is_anonymous,
                v.is_active,
                v.ends_at,
                v.created_at,
                u.first_name as creator_first_name,
                u.last_name as creator_last_name,
                COUNT(DISTINCT vr.id) as total_responses
            FROM votes v
            LEFT JOIN users u ON v.created_by = u.id
            LEFT JOIN vote_responses vr ON v.id = vr.vote_id
            ${whereClause}
            GROUP BY v.id, u.first_name, u.last_name
            ORDER BY v.created_at DESC
        `;
        
        const votes = await query(votesQuery, params);
        res.json({ votes: votes.rows });
        
    } catch (error) {
        console.error('Get votes error:', error);
        res.status(500).json({ error: 'Failed to fetch votes' });
    }
});

// =================================================================================
// GET VOTE DETAILS WITH OPTIONS AND RESULTS
// =================================================================================

router.get('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        
        // Get vote details
        const voteQuery = `
            SELECT 
                v.*,
                u.first_name as creator_first_name,
                u.last_name as creator_last_name
            FROM votes v
            LEFT JOIN users u ON v.created_by = u.id
            WHERE v.id = $1
        `;
        const voteResult = await query(voteQuery, [id]);
        
        if (voteResult.rows.length === 0) {
            return res.status(404).json({ error: 'Vote not found' });
        }
        
        const vote = voteResult.rows[0];
        
        // Get vote options with response counts
        const optionsQuery = `
            SELECT 
                vo.id,
                vo.option_text,
                vo.option_order,
                COUNT(vr.id) as response_count,
                COALESCE(AVG(vr.rating), 0) as average_rating
            FROM vote_options vo
            LEFT JOIN vote_responses vr ON vo.id = vr.option_id
            WHERE vo.vote_id = $1
            GROUP BY vo.id, vo.option_text, vo.option_order
            ORDER BY vo.option_order
        `;
        const options = await query(optionsQuery, [id]);
        
        // Get user's response if not anonymous
        let userResponse = null;
        if (!vote.is_anonymous) {
            const userResponseQuery = `
                SELECT vr.option_id, vr.rating, vo.option_text
                FROM vote_responses vr
                JOIN vote_options vo ON vr.option_id = vo.id
                WHERE vr.vote_id = $1 AND vr.user_id = $2
            `;
            const userResponseResult = await query(userResponseQuery, [id, req.user.id]);
            userResponse = userResponseResult.rows;
        }
        
        // Get total response count
        const totalResponsesQuery = `
            SELECT COUNT(DISTINCT user_id) as total_users
            FROM vote_responses
            WHERE vote_id = $1
        `;
        const totalResult = await query(totalResponsesQuery, [id]);
        
        res.json({
            vote,
            options: options.rows,
            userResponse,
            totalResponses: parseInt(totalResult.rows[0].total_users)
        });
        
    } catch (error) {
        console.error('Get vote details error:', error);
        res.status(500).json({ error: 'Failed to fetch vote details' });
    }
});

// =================================================================================
// CREATE VOTE
// =================================================================================

router.post('/', async (req, res) => {
    try {
        const { 
            title, 
            description, 
            voteType = 'single_choice', 
            isAnonymous = false, 
            endsAt,
            options,
            createWallPost = true
        } = req.body;
        
        if (!title || !options || options.length < 2) {
            return res.status(400).json({ 
                error: 'Title and at least 2 options are required' 
            });
        }
        
        // Create vote
        const voteResult = await query(
            `INSERT INTO votes (title, description, vote_type, is_anonymous, ends_at, created_by)
             VALUES ($1, $2, $3, $4, $5, $6)
             RETURNING *`,
            [title, description, voteType, isAnonymous, endsAt, req.user.id]
        );
        
        const vote = voteResult.rows[0];
        
        // Create vote options
        const optionPromises = options.map((option, index) => {
            return query(
                `INSERT INTO vote_options (vote_id, option_text, option_order)
                 VALUES ($1, $2, $3)
                 RETURNING *`,
                [vote.id, option.text, index]
            );
        });
        
        await Promise.all(optionPromises);
        
        // Create wall post if requested
        if (createWallPost) {
            await query(
                `INSERT INTO wall_posts (author_id, content, post_type, vote_id, is_pinned)
                 VALUES ($1, $2, 'poll', $3, false)`,
                [req.user.id, `📊 Nové hlasování: ${title}`, vote.id]
            );
        }
        
        res.status(201).json(vote);
        
    } catch (error) {
        console.error('Create vote error:', error);
        res.status(500).json({ error: 'Failed to create vote' });
    }
});

// =================================================================================
// SUBMIT VOTE RESPONSE
// =================================================================================

router.post('/:id/respond', async (req, res) => {
    try {
        const { id } = req.params;
        const { optionIds, ratings } = req.body; // optionIds for multiple choice, ratings for rating type
        
        // Check if vote exists and is active
        const voteCheck = await query(
            `SELECT * FROM votes 
             WHERE id = $1 AND is_active = true 
             AND (ends_at IS NULL OR ends_at > NOW())`,
            [id]
        );
        
        if (voteCheck.rows.length === 0) {
            return res.status(404).json({ error: 'Vote not found or inactive' });
        }
        
        const vote = voteCheck.rows[0];
        
        // Check if user already responded (for single choice votes)
        if (vote.vote_type === 'single_choice') {
            const existingResponse = await query(
                `SELECT id FROM vote_responses WHERE vote_id = $1 AND user_id = $2`,
                [id, req.user.id]
            );
            
            if (existingResponse.rows.length > 0) {
                return res.status(400).json({ error: 'You have already voted' });
            }
        }
        
        // Delete existing responses for this user (for multiple choice updates)
        await query(
            `DELETE FROM vote_responses WHERE vote_id = $1 AND user_id = $2`,
            [id, req.user.id]
        );
        
        // Insert new responses
        if (vote.vote_type === 'rating' && ratings) {
            // For rating votes
            const ratingPromises = Object.entries(ratings).map(([optionId, rating]) => {
                return query(
                    `INSERT INTO vote_responses (vote_id, option_id, user_id, rating)
                     VALUES ($1, $2, $3, $4)`,
                    [id, optionId, req.user.id, rating]
                );
            });
            await Promise.all(ratingPromises);
        } else if (optionIds && optionIds.length > 0) {
            // For single/multiple choice votes
            const responsePromises = optionIds.map(optionId => {
                return query(
                    `INSERT INTO vote_responses (vote_id, option_id, user_id)
                     VALUES ($1, $2, $3)`,
                    [id, optionId, req.user.id]
                );
            });
            await Promise.all(responsePromises);
        } else {
            return res.status(400).json({ error: 'No valid options provided' });
        }
        
        res.json({ message: 'Vote recorded successfully' });
        
    } catch (error) {
        console.error('Submit vote response error:', error);
        res.status(500).json({ error: 'Failed to record vote' });
    }
});

// =================================================================================
// DELETE VOTE (admin only)
// =================================================================================

router.delete('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        
        // Check if user is admin or vote creator
        const voteCheck = await query(
            `SELECT created_by FROM votes WHERE id = $1`,
            [id]
        );
        
        if (voteCheck.rows.length === 0) {
            return res.status(404).json({ error: 'Vote not found' });
        }
        
        const isCreator = voteCheck.rows[0].created_by === req.user.id;
        const isAdmin = req.user.role === 'admin';
        
        if (!isCreator && !isAdmin) {
            return res.status(403).json({ error: 'Not authorized to delete this vote' });
        }
        
        // Delete vote (cascade will handle options and responses)
        await query(`DELETE FROM votes WHERE id = $1`, [id]);
        
        res.json({ message: 'Vote deleted successfully' });
        
    } catch (error) {
        console.error('Delete vote error:', error);
        res.status(500).json({ error: 'Failed to delete vote' });
    }
});

// =================================================================================
// TOGGLE VOTE ACTIVE STATUS
// =================================================================================

router.patch('/:id/toggle', async (req, res) => {
    try {
        const { id } = req.params;
        
        // Check if user is admin or vote creator
        const voteCheck = await query(
            `SELECT created_by, is_active FROM votes WHERE id = $1`,
            [id]
        );
        
        if (voteCheck.rows.length === 0) {
            return res.status(404).json({ error: 'Vote not found' });
        }
        
        const isCreator = voteCheck.rows[0].created_by === req.user.id;
        const isAdmin = req.user.role === 'admin';
        
        if (!isCreator && !isAdmin) {
            return res.status(403).json({ error: 'Not authorized to modify this vote' });
        }
        
        // Toggle active status
        const newStatus = !voteCheck.rows[0].is_active;
        await query(
            `UPDATE votes SET is_active = $1 WHERE id = $2`,
            [newStatus, id]
        );
        
        res.json({ message: `Vote ${newStatus ? 'activated' : 'deactivated'} successfully` });
        
    } catch (error) {
        console.error('Toggle vote status error:', error);
        res.status(500).json({ error: 'Failed to toggle vote status' });
    }
});

export default router;
