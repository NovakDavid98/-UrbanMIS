import express from 'express';
import { query } from '../config/database.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

// =================================================================================
// GET ONLINE USERS
// =================================================================================

router.get('/users/online', authenticateToken, async (req, res) => {
    try {
        const result = await query(`
            SELECT 
                u.id,
                u.username,
                u.first_name,
                u.last_name,
                u.role,
                up.is_online,
                up.last_seen
            FROM users u
            LEFT JOIN user_presence up ON u.id = up.user_id
            WHERE u.is_active = true AND u.id != $1
            ORDER BY up.is_online DESC, up.last_seen DESC
        `, [req.user.id]);

        res.json({ users: result.rows });
    } catch (error) {
        console.error('Get online users error:', error);
        res.status(500).json({ error: 'Failed to get online users' });
    }
});

// =================================================================================
// GET OR CREATE CONVERSATION
// =================================================================================

router.post('/conversations', authenticateToken, async (req, res) => {
    try {
        const { participantId } = req.body;

        if (!participantId) {
            return res.status(400).json({ error: 'Participant ID is required' });
        }

        // Check if conversation already exists
        let result = await query(`
            SELECT * FROM conversations 
            WHERE (participant_1 = $1 AND participant_2 = $2) 
               OR (participant_1 = $2 AND participant_2 = $1)
        `, [req.user.id, participantId]);

        let conversation;

        if (result.rows.length === 0) {
            // Create new conversation
            const createResult = await query(`
                INSERT INTO conversations (participant_1, participant_2)
                VALUES ($1, $2)
                RETURNING *
            `, [req.user.id, participantId]);
            
            conversation = createResult.rows[0];
        } else {
            conversation = result.rows[0];
        }

        // Get participant info
        const participantResult = await query(`
            SELECT id, username, first_name, last_name, role
            FROM users 
            WHERE id = $1
        `, [participantId]);

        res.json({
            conversation,
            participant: participantResult.rows[0]
        });

    } catch (error) {
        console.error('Create conversation error:', error);
        res.status(500).json({ error: 'Failed to create conversation' });
    }
});

// =================================================================================
// GET CONVERSATION MESSAGES
// =================================================================================

router.get('/conversations/:conversationId/messages', authenticateToken, async (req, res) => {
    try {
        const { conversationId } = req.params;
        const { page = 1, limit = 50 } = req.query;
        const offset = (page - 1) * limit;

        // Verify user is part of this conversation
        const convResult = await query(`
            SELECT * FROM conversations 
            WHERE id = $1 AND (participant_1 = $2 OR participant_2 = $2)
        `, [conversationId, req.user.id]);

        if (convResult.rows.length === 0) {
            return res.status(403).json({ error: 'Access denied to this conversation' });
        }

        // Get messages
        const result = await query(`
            SELECT 
                m.*,
                u.username,
                u.first_name,
                u.last_name
            FROM messages m
            JOIN users u ON m.sender_id = u.id
            WHERE m.conversation_id = $1
            ORDER BY m.created_at DESC
            LIMIT $2 OFFSET $3
        `, [conversationId, limit, offset]);

        // Mark messages as read
        await query(`
            INSERT INTO message_read_status (message_id, user_id)
            SELECT m.id, $1
            FROM messages m
            WHERE m.conversation_id = $2 
              AND m.sender_id != $1
              AND NOT EXISTS (
                  SELECT 1 FROM message_read_status mrs 
                  WHERE mrs.message_id = m.id AND mrs.user_id = $1
              )
        `, [req.user.id, conversationId]);

        res.json({ 
            messages: result.rows.reverse(), // Return in chronological order
            hasMore: result.rows.length === parseInt(limit)
        });

    } catch (error) {
        console.error('Get messages error:', error);
        res.status(500).json({ error: 'Failed to get messages' });
    }
});

// =================================================================================
// GET USER CONVERSATIONS
// =================================================================================

router.get('/conversations', authenticateToken, async (req, res) => {
    try {
        const result = await query(`
            SELECT 
                c.*,
                CASE 
                    WHEN c.participant_1 = $1 THEN u2.id
                    ELSE u1.id
                END as other_user_id,
                CASE 
                    WHEN c.participant_1 = $1 THEN u2.username
                    ELSE u1.username
                END as other_username,
                CASE 
                    WHEN c.participant_1 = $1 THEN u2.first_name
                    ELSE u1.first_name
                END as other_first_name,
                CASE 
                    WHEN c.participant_1 = $1 THEN u2.last_name
                    ELSE u1.last_name
                END as other_last_name,
                CASE 
                    WHEN c.participant_1 = $1 THEN up2.is_online
                    ELSE up1.is_online
                END as other_is_online,
                m.content as last_message_content,
                m.message_type as last_message_type,
                m.created_at as last_message_time,
                sender.first_name as last_message_sender_name,
                (
                    SELECT COUNT(*)
                    FROM messages msg
                    WHERE msg.conversation_id = c.id 
                      AND msg.sender_id != $1
                      AND NOT EXISTS (
                          SELECT 1 FROM message_read_status mrs 
                          WHERE mrs.message_id = msg.id AND mrs.user_id = $1
                      )
                ) as unread_count
            FROM conversations c
            JOIN users u1 ON c.participant_1 = u1.id
            JOIN users u2 ON c.participant_2 = u2.id
            LEFT JOIN user_presence up1 ON u1.id = up1.user_id
            LEFT JOIN user_presence up2 ON u2.id = up2.user_id
            LEFT JOIN messages m ON c.id = m.conversation_id 
                AND m.created_at = (
                    SELECT MAX(created_at) 
                    FROM messages 
                    WHERE conversation_id = c.id
                )
            LEFT JOIN users sender ON m.sender_id = sender.id
            WHERE c.participant_1 = $1 OR c.participant_2 = $1
            ORDER BY c.last_message_at DESC
        `, [req.user.id]);

        res.json({ conversations: result.rows });

    } catch (error) {
        console.error('Get conversations error:', error);
        res.status(500).json({ error: 'Failed to get conversations' });
    }
});

// =================================================================================
// UPLOAD FILE FOR CHAT
// =================================================================================

router.post('/upload', authenticateToken, async (req, res) => {
    try {
        // This will be implemented when we add file upload functionality
        res.status(501).json({ error: 'File upload not implemented yet' });
    } catch (error) {
        console.error('File upload error:', error);
        res.status(500).json({ error: 'Failed to upload file' });
    }
});

export default router;
