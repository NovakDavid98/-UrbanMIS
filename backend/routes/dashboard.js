import express from 'express';
import { query } from '../config/database.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();
router.use(authenticateToken);

// =================================================================================
// GET DASHBOARD DATA
// =================================================================================

router.get('/', async (req, res) => {
    try {
        // Client statistics
        const clientStats = await query(`
            SELECT 
                COUNT(*) as total_clients,
                COUNT(CASE WHEN activity_status = 'active' THEN 1 END) as active_clients,
                COUNT(CASE WHEN gender = 'Muž' THEN 1 END) as men,
                COUNT(CASE WHEN gender = 'Žena' THEN 1 END) as women
            FROM clients
        `);

        // Service statistics (last 30 days)
        const serviceStats = await query(`
            SELECT 
                COUNT(*) as total_services,
                COUNT(DISTINCT client_id) as unique_clients,
                SUM(duration_minutes) as total_minutes,
                COUNT(CASE WHEN service_date >= CURRENT_DATE - INTERVAL '7 days' THEN 1 END) as last_week
            FROM service_records
            WHERE service_date >= CURRENT_DATE - INTERVAL '30 days'
        `);

        // Upcoming revisions (next 30 days)
        const upcomingRevisions = await query(`
            SELECT 
                pr.id, pr.revision_date, pr.description,
                c.id as client_id, c.first_name, c.last_name,
                u.first_name as worker_first_name, u.last_name as worker_last_name
            FROM plan_revisions pr
            JOIN individual_plans ip ON pr.plan_id = ip.id
            JOIN clients c ON ip.client_id = c.id
            LEFT JOIN users u ON pr.created_by = u.id
            WHERE pr.revision_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '30 days'
            ORDER BY pr.revision_date ASC
            LIMIT 10
        `);

        // Contracts expiring soon (next 60 days)
        const expiringContracts = await query(`
            SELECT 
                ct.id, ct.title, ct.end_date,
                c.id as client_id, c.first_name, c.last_name
            FROM contracts ct
            JOIN clients c ON ct.client_id = c.id
            WHERE ct.is_active = true 
            AND ct.end_date IS NOT NULL
            AND ct.end_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '60 days'
            ORDER BY ct.end_date ASC
            LIMIT 10
        `);

        // Recent notes (last 10)
        const recentNotes = await query(`
            SELECT 
                n.id, n.title, n.content, n.is_important, n.created_at,
                c.id as client_id, c.first_name, c.last_name,
                u.first_name as author_first_name, u.last_name as author_last_name
            FROM notes n
            JOIN clients c ON n.client_id = c.id
            LEFT JOIN users u ON n.created_by = u.id
            WHERE n.is_archived = false
            ORDER BY n.created_at DESC
            LIMIT 10
        `);

        // Active sanctions
        const activeSanctions = await query(`
            SELECT 
                s.id, s.sanction_type, s.reason, s.sanction_date,
                c.id as client_id, c.first_name, c.last_name
            FROM sanctions s
            JOIN clients c ON s.client_id = c.id
            WHERE s.is_active = true
            ORDER BY s.sanction_date DESC
            LIMIT 10
        `);

        // Services by type (last 30 days)
        const servicesByType = await query(`
            SELECT service_type, COUNT(*) as count
            FROM service_records
            WHERE service_date >= CURRENT_DATE - INTERVAL '30 days'
            GROUP BY service_type
            ORDER BY count DESC
            LIMIT 10
        `);

        // My key clients (if user is a worker)
        const myClients = await query(`
            SELECT 
                c.id, c.first_name, c.last_name, c.activity_status,
                (COUNT(DISTINCT sr.id) + COUNT(DISTINCT v.id)) as service_count,
                GREATEST(MAX(sr.service_date), MAX(v.visit_date)) as last_service
            FROM key_worker_assignments kwa
            JOIN clients c ON kwa.client_id = c.id
            LEFT JOIN service_records sr ON c.id = sr.client_id
            LEFT JOIN visits v ON c.id = v.client_id
            WHERE kwa.worker_id = $1
            GROUP BY c.id
            ORDER BY last_service DESC NULLS LAST
            LIMIT 10
        `, [req.user.id]);

        res.json({
            clientStats: clientStats.rows[0],
            serviceStats: serviceStats.rows[0],
            upcomingRevisions: upcomingRevisions.rows,
            expiringContracts: expiringContracts.rows,
            recentNotes: recentNotes.rows,
            activeSanctions: activeSanctions.rows,
            servicesByType: servicesByType.rows,
            myClients: myClients.rows
        });

    } catch (error) {
        console.error('Get dashboard data error:', error);
        res.status(500).json({ error: 'Failed to fetch dashboard data' });
    }
});

export default router;


























