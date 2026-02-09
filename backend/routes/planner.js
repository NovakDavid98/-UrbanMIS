import express from 'express';
import { query } from '../config/database.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();
router.use(authenticateToken);

// =================================================================================
// GET ALL PLANNERS
// =================================================================================

router.get('/', async (req, res) => {
    try {
        const { year, week, user_id } = req.query;
        
        let whereConditions = ['1=1'];
        let queryParams = [];
        let paramCount = 1;
        
        if (year) {
            whereConditions.push(`wp.year = $${paramCount}`);
            queryParams.push(parseInt(year));
            paramCount++;
        }
        
        if (week) {
            whereConditions.push(`wp.week_number = $${paramCount}`);
            queryParams.push(parseInt(week));
            paramCount++;
        }
        
        if (user_id) {
            whereConditions.push(`(wp.created_by = $${paramCount} OR pc.user_id = $${paramCount} OR wp.is_shared = true)`);
            queryParams.push(user_id);
            paramCount++;
        }
        
        const plannersQuery = `
            SELECT DISTINCT
                wp.id,
                wp.title,
                wp.description,
                wp.week_start_date,
                wp.week_number,
                wp.year,
                wp.is_template,
                wp.is_shared,
                wp.created_at,
                wp.updated_at,
                u.first_name as creator_first_name,
                u.last_name as creator_last_name,
                COUNT(DISTINCT pa.id) as activity_count,
                COUNT(DISTINCT pc2.id) as collaborator_count
            FROM weekly_planners wp
            LEFT JOIN users u ON wp.created_by = u.id
            LEFT JOIN planner_collaborators pc ON wp.id = pc.planner_id
            LEFT JOIN planner_activities pa ON wp.id = pa.planner_id
            LEFT JOIN planner_collaborators pc2 ON wp.id = pc2.planner_id
            WHERE ${whereConditions.join(' AND ')}
            GROUP BY wp.id, u.first_name, u.last_name
            ORDER BY wp.week_start_date DESC, wp.created_at DESC
        `;
        
        const planners = await query(plannersQuery, queryParams);
        res.json({ planners: planners.rows });
        
    } catch (error) {
        console.error('Get planners error:', error);
        res.status(500).json({ error: 'Failed to fetch planners' });
    }
});

// =================================================================================
// GET PLANNER BY ID WITH ACTIVITIES
// =================================================================================

router.get('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        
        // Get planner details
        const plannerQuery = `
            SELECT 
                wp.*,
                u.first_name as creator_first_name,
                u.last_name as creator_last_name
            FROM weekly_planners wp
            LEFT JOIN users u ON wp.created_by = u.id
            WHERE wp.id = $1
        `;
        const plannerResult = await query(plannerQuery, [id]);
        
        if (plannerResult.rows.length === 0) {
            return res.status(404).json({ error: 'Planner not found' });
        }
        
        const planner = plannerResult.rows[0];
        
        // Get activities with all related data
        const activitiesQuery = `
            SELECT 
                pa.*,
                at.name as activity_type_name,
                at.name_cs as activity_type_name_cs,
                at.color as activity_type_color,
                at.icon as activity_type_icon,
                c.first_name as client_first_name,
                c.last_name as client_last_name,
                w.first_name as worker_first_name,
                w.last_name as worker_last_name,
                r.name as room_name,
                r.capacity as room_capacity,
                creator.first_name as creator_first_name,
                creator.last_name as creator_last_name
            FROM planner_activities pa
            LEFT JOIN activity_types at ON pa.activity_type_id = at.id
            LEFT JOIN clients c ON pa.client_id = c.id
            LEFT JOIN users w ON pa.assigned_worker_id = w.id
            LEFT JOIN rooms r ON pa.room_id = r.id
            LEFT JOIN users creator ON pa.created_by = creator.id
            WHERE pa.planner_id = $1
            ORDER BY pa.day_of_week, pa.start_time
        `;
        const activities = await query(activitiesQuery, [id]);
        
        // Get collaborators
        const collaboratorsQuery = `
            SELECT 
                pc.*,
                u.first_name,
                u.last_name,
                u.role,
                adder.first_name as added_by_first_name,
                adder.last_name as added_by_last_name
            FROM planner_collaborators pc
            LEFT JOIN users u ON pc.user_id = u.id
            LEFT JOIN users adder ON pc.added_by = adder.id
            WHERE pc.planner_id = $1
            ORDER BY pc.added_at
        `;
        const collaborators = await query(collaboratorsQuery, [id]);
        
        // Get comments
        const commentsQuery = `
            SELECT 
                pc.*,
                u.first_name,
                u.last_name
            FROM planner_comments pc
            LEFT JOIN users u ON pc.user_id = u.id
            WHERE pc.planner_id = $1
            ORDER BY pc.created_at DESC
        `;
        const comments = await query(commentsQuery, [id]);
        
        res.json({
            planner,
            activities: activities.rows,
            collaborators: collaborators.rows,
            comments: comments.rows
        });
        
    } catch (error) {
        console.error('Get planner details error:', error);
        res.status(500).json({ error: 'Failed to fetch planner details' });
    }
});

// =================================================================================
// CREATE PLANNER
// =================================================================================

router.post('/', async (req, res) => {
    try {
        const { 
            title, 
            description, 
            weekStartDate, 
            isTemplate = false, 
            isShared = false 
        } = req.body;
        
        if (!title || !weekStartDate) {
            return res.status(400).json({ error: 'Title and week start date are required' });
        }
        
        const startDate = new Date(weekStartDate);
        const weekNumber = getWeekNumber(startDate);
        const year = startDate.getFullYear();
        
        const result = await query(
            `INSERT INTO weekly_planners (title, description, week_start_date, week_number, year, created_by, is_template, is_shared)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
             RETURNING *`,
            [title, description, weekStartDate, weekNumber, year, req.user.id, isTemplate, isShared]
        );
        
        res.status(201).json(result.rows[0]);
        
    } catch (error) {
        console.error('Create planner error:', error);
        res.status(500).json({ error: 'Failed to create planner' });
    }
});

// =================================================================================
// UPDATE PLANNER
// =================================================================================

router.put('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { title, description, isShared } = req.body;
        
        const result = await query(
            `UPDATE weekly_planners 
             SET title = $1, description = $2, is_shared = $3
             WHERE id = $4 AND (created_by = $5 OR EXISTS (
                 SELECT 1 FROM planner_collaborators 
                 WHERE planner_id = $4 AND user_id = $5 AND permission_level IN ('edit', 'admin')
             ))
             RETURNING *`,
            [title, description, isShared, id, req.user.id]
        );
        
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Planner not found or no permission' });
        }
        
        res.json(result.rows[0]);
        
    } catch (error) {
        console.error('Update planner error:', error);
        res.status(500).json({ error: 'Failed to update planner' });
    }
});

// =================================================================================
// DELETE PLANNER
// =================================================================================

router.delete('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        
        const result = await query(
            `DELETE FROM weekly_planners 
             WHERE id = $1 AND (created_by = $2 OR $3 = 'admin')
             RETURNING id`,
            [id, req.user.id, req.user.role]
        );
        
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Planner not found or no permission' });
        }
        
        res.json({ message: 'Planner deleted successfully' });
        
    } catch (error) {
        console.error('Delete planner error:', error);
        res.status(500).json({ error: 'Failed to delete planner' });
    }
});

// =================================================================================
// ACTIVITY MANAGEMENT
// =================================================================================

// Create activity
router.post('/:id/activities', async (req, res) => {
    try {
        const { id: plannerId } = req.params;
        const {
            title,
            description,
            activityTypeId,
            clientId,
            assignedWorkerId,
            roomId,
            dayOfWeek,
            startTime,
            endTime,
            notes,
            isRecurring = false,
            recurrencePattern
        } = req.body;
        
        if (!title || dayOfWeek === undefined || !startTime || !endTime) {
            return res.status(400).json({ error: 'Title, day, start time, and end time are required' });
        }
        
        // Check for conflicts
        const conflictQuery = `
            SELECT id FROM planner_activities 
            WHERE planner_id = $1 
            AND day_of_week = $2 
            AND room_id = $3
            AND (
                (start_time <= $4 AND end_time > $4) OR
                (start_time < $5 AND end_time >= $5) OR
                (start_time >= $4 AND end_time <= $5)
            )
        `;
        
        if (roomId) {
            const conflicts = await query(conflictQuery, [plannerId, dayOfWeek, roomId, startTime, endTime]);
            if (conflicts.rows.length > 0) {
                return res.status(400).json({ error: 'Room is already booked for this time slot' });
            }
        }
        
        const result = await query(
            `INSERT INTO planner_activities 
             (planner_id, title, description, activity_type_id, client_id, assigned_worker_id, 
              room_id, day_of_week, start_time, end_time, notes, is_recurring, recurrence_pattern, created_by)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
             RETURNING *`,
            [plannerId, title, description, activityTypeId, clientId, assignedWorkerId, 
             roomId, dayOfWeek, startTime, endTime, notes, isRecurring, recurrencePattern, req.user.id]
        );
        
        res.status(201).json(result.rows[0]);
        
    } catch (error) {
        console.error('Create activity error:', error);
        res.status(500).json({ error: 'Failed to create activity' });
    }
});

// Update activity
router.put('/:id/activities/:activityId', async (req, res) => {
    try {
        const { id: plannerId, activityId } = req.params;
        const {
            title,
            description,
            activityTypeId,
            clientId,
            assignedWorkerId,
            roomId,
            dayOfWeek,
            startTime,
            endTime,
            notes
        } = req.body;
        
        const result = await query(
            `UPDATE planner_activities 
             SET title = $1, description = $2, activity_type_id = $3, client_id = $4, 
                 assigned_worker_id = $5, room_id = $6, day_of_week = $7, 
                 start_time = $8, end_time = $9, notes = $10
             WHERE id = $11 AND planner_id = $12
             RETURNING *`,
            [title, description, activityTypeId, clientId, assignedWorkerId, 
             roomId, dayOfWeek, startTime, endTime, notes, activityId, plannerId]
        );
        
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Activity not found' });
        }
        
        res.json(result.rows[0]);
        
    } catch (error) {
        console.error('Update activity error:', error);
        res.status(500).json({ error: 'Failed to update activity' });
    }
});

// Delete activity
router.delete('/:id/activities/:activityId', async (req, res) => {
    try {
        const { id: plannerId, activityId } = req.params;
        
        const result = await query(
            `DELETE FROM planner_activities 
             WHERE id = $1 AND planner_id = $2
             RETURNING id`,
            [activityId, plannerId]
        );
        
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Activity not found' });
        }
        
        res.json({ message: 'Activity deleted successfully' });
        
    } catch (error) {
        console.error('Delete activity error:', error);
        res.status(500).json({ error: 'Failed to delete activity' });
    }
});

// =================================================================================
// HELPER FUNCTIONS AND REFERENCE DATA
// =================================================================================

// Get activity types
router.get('/reference/activity-types', async (req, res) => {
    try {
        const result = await query(
            `SELECT * FROM activity_types WHERE is_active = true ORDER BY name_cs`
        );
        res.json({ activityTypes: result.rows });
    } catch (error) {
        console.error('Get activity types error:', error);
        res.status(500).json({ error: 'Failed to fetch activity types' });
    }
});

// Get rooms
router.get('/reference/rooms', async (req, res) => {
    try {
        const result = await query(
            `SELECT * FROM rooms WHERE is_active = true ORDER BY name`
        );
        res.json({ rooms: result.rows });
    } catch (error) {
        console.error('Get rooms error:', error);
        res.status(500).json({ error: 'Failed to fetch rooms' });
    }
});

// Helper function to get week number
function getWeekNumber(date) {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
}

export default router;
