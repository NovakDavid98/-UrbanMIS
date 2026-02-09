import express from 'express';
import { query } from '../config/database.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();
router.use(authenticateToken);

// Get all services for a client
router.get('/client/:clientId', async (req, res) => {
    try {
        const { clientId } = req.params;
        const { limit = 100, offset = 0 } = req.query;

        const result = await query(
            `SELECT sr.*, u.first_name as worker_first_name, u.last_name as worker_last_name
             FROM service_records sr
             LEFT JOIN users u ON sr.created_by = u.id
             WHERE sr.client_id = $1
             ORDER BY sr.service_date DESC
             LIMIT $2 OFFSET $3`,
            [clientId, limit, offset]
        );

        res.json({ services: result.rows });
    } catch (error) {
        console.error('Get services error:', error);
        res.status(500).json({ error: 'Failed to fetch services' });
    }
});

// Create new service
router.post('/', async (req, res) => {
    try {
        const {
            clientId, subject, serviceType, serviceDate, durationMinutes,
            location, topic, description
        } = req.body;

        if (!clientId || !subject || !serviceType || !serviceDate) {
            return res.status(400).json({ error: 'Required fields missing' });
        }

        const result = await query(
            `INSERT INTO service_records 
             (client_id, subject, service_type, service_date, duration_minutes, location, topic, description, created_by)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
             RETURNING *`,
            [clientId, subject, serviceType, serviceDate, durationMinutes, location, topic, description, req.user.id]
        );

        res.status(201).json({ message: 'Service created', service: result.rows[0] });
    } catch (error) {
        console.error('Create service error:', error);
        res.status(500).json({ error: 'Failed to create service' });
    }
});

// Update service
router.put('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { subject, serviceType, serviceDate, durationMinutes, location, topic, description } = req.body;

        const result = await query(
            `UPDATE service_records SET
                subject = COALESCE($1, subject),
                service_type = COALESCE($2, service_type),
                service_date = COALESCE($3, service_date),
                duration_minutes = $4,
                location = $5,
                topic = $6,
                description = $7
             WHERE id = $8
             RETURNING *`,
            [subject, serviceType, serviceDate, durationMinutes, location, topic, description, id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Service not found' });
        }

        res.json({ message: 'Service updated', service: result.rows[0] });
    } catch (error) {
        console.error('Update service error:', error);
        res.status(500).json({ error: 'Failed to update service' });
    }
});

// Delete service
router.delete('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        
        const result = await query('DELETE FROM service_records WHERE id = $1 RETURNING id', [id]);
        
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Service not found' });
        }

        res.json({ message: 'Service deleted' });
    } catch (error) {
        console.error('Delete service error:', error);
        res.status(500).json({ error: 'Failed to delete service' });
    }
});

export default router;


























