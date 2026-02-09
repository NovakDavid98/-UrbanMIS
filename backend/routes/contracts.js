import express from 'express';
import { query } from '../config/database.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();
router.use(authenticateToken);

router.get('/client/:clientId', async (req, res) => {
    try {
        const result = await query(
            'SELECT * FROM contracts WHERE client_id = $1 ORDER BY is_active DESC, start_date DESC',
            [req.params.clientId]
        );
        res.json({ contracts: result.rows });
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch contracts' });
    }
});

router.post('/', async (req, res) => {
    try {
        const { clientId, title, contractType, description, startDate, endDate } = req.body;
        const result = await query(
            'INSERT INTO contracts (client_id, title, contract_type, description, start_date, end_date, created_by) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *',
            [clientId, title, contractType, description, startDate, endDate, req.user.id]
        );
        res.status(201).json({ contract: result.rows[0] });
    } catch (error) {
        res.status(500).json({ error: 'Failed to create contract' });
    }
});

export default router;
