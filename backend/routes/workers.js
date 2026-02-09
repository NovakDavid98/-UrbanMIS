import express from 'express';
import { query } from '../config/database.js';
import { authenticateToken } from '../middleware/auth.js';
import bcrypt from 'bcrypt';

const router = express.Router();

// All routes require authentication
router.use(authenticateToken);

// Helper function to check if user is admin
const requireAdmin = (req, res, next) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
};

// GET /api/workers - Get all workers with statistics
router.get('/', async (req, res) => {
  try {
    const { search, role, status, sortBy = 'last_name', sortOrder = 'ASC' } = req.query;

    let sql = `
      SELECT 
        u.id,
        u.username,
        u.email,
        u.first_name,
        u.last_name,
        u.role,
        u.phone,
        u.is_active,
        u.last_login,
        u.created_at,
        COUNT(DISTINCT kwa.client_id) as assigned_clients_count,
        COUNT(DISTINCT CASE WHEN kwa.is_primary = true THEN kwa.client_id END) as primary_clients_count,
        COUNT(DISTINCT sr.id) + COUNT(DISTINCT v.id) as services_count,
        GREATEST(MAX(sr.service_date), MAX(v.visit_date)) as last_service_date,
        (SELECT COUNT(*) FROM clients c WHERE c.created_by = u.id) as created_clients_count
      FROM users u
      LEFT JOIN key_worker_assignments kwa ON u.id = kwa.worker_id
      LEFT JOIN service_records sr ON u.id = sr.created_by
      LEFT JOIN visits v ON u.id = v.created_by
      WHERE 1=1
    `;

    const params = [];
    let paramIndex = 1;

    // Search filter
    if (search && search.trim()) {
      sql += ` AND (
        u.first_name ILIKE $${paramIndex} OR 
        u.last_name ILIKE $${paramIndex} OR 
        u.username ILIKE $${paramIndex} OR 
        u.email ILIKE $${paramIndex}
      )`;
      params.push(`%${search.trim()}%`);
      paramIndex++;
    }

    // Role filter
    if (role && role !== 'all') {
      sql += ` AND u.role = $${paramIndex}`;
      params.push(role);
      paramIndex++;
    }

    // Status filter
    if (status && status !== 'all') {
      const isActive = status === 'active';
      sql += ` AND u.is_active = $${paramIndex}`;
      params.push(isActive);
      paramIndex++;
    }

    sql += ` GROUP BY u.id, u.username, u.email, u.first_name, u.last_name, u.role, u.phone, u.is_active, u.last_login, u.created_at`;

    // Sorting
    const allowedSortFields = {
      'first_name': 'u.first_name',
      'last_name': 'u.last_name',
      'email': 'u.email',
      'role': 'u.role',
      'created_at': 'u.created_at',
      'last_login': 'u.last_login'
    };
    const safeSortBy = allowedSortFields[sortBy] || 'u.last_name';
    const safeSortOrder = sortOrder.toUpperCase() === 'DESC' ? 'DESC' : 'ASC';
    
    sql += ` ORDER BY ${safeSortBy} ${safeSortOrder}`;

    const result = await query(sql, params);

    res.json({
      success: true,
      workers: result.rows,
      count: result.rows.length
    });
  } catch (error) {
    console.error('Error fetching workers:', error);
    res.status(500).json({ error: 'Failed to fetch workers' });
  }
});

// GET /api/workers/stats - Get overall statistics
router.get('/stats', async (req, res) => {
  try {
    const statsQuery = `
      SELECT 
        COUNT(*) as total_workers,
        COUNT(CASE WHEN is_active = true THEN 1 END) as active_workers,
        COUNT(CASE WHEN role = 'admin' THEN 1 END) as admin_count,
        COUNT(CASE WHEN role = 'worker' THEN 1 END) as worker_count,
        COUNT(CASE WHEN role = 'viewer' THEN 1 END) as viewer_count,
        COUNT(CASE WHEN last_login >= NOW() - INTERVAL '30 days' THEN 1 END) as active_last_month
      FROM users
    `;

    const servicesQuery = `
      SELECT COUNT(*) as total_services
      FROM service_records
    `;

    const clientsQuery = `
      SELECT 
        COUNT(DISTINCT client_id) as total_assigned_clients
      FROM key_worker_assignments
    `;

    const [statsResult, servicesResult, clientsResult] = await Promise.all([
      query(statsQuery),
      query(servicesQuery),
      query(clientsQuery)
    ]);

    const stats = {
      ...statsResult.rows[0],
      total_services: parseInt(servicesResult.rows[0].total_services),
      total_assigned_clients: parseInt(clientsResult.rows[0].total_assigned_clients),
      avg_clients_per_worker: statsResult.rows[0].total_workers > 0 
        ? (parseInt(clientsResult.rows[0].total_assigned_clients) / parseInt(statsResult.rows[0].total_workers)).toFixed(1)
        : 0
    };

    res.json({ success: true, stats });
  } catch (error) {
    console.error('Error fetching worker stats:', error);
    res.status(500).json({ error: 'Failed to fetch statistics' });
  }
});

// GET /api/workers/:id - Get worker by ID with detailed info
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    // Get worker basic info
    const workerQuery = `
      SELECT 
        id, username, email, first_name, last_name, role, phone, 
        is_active, last_login, created_at, updated_at
      FROM users
      WHERE id = $1
    `;
    const workerResult = await query(workerQuery, [id]);

    if (workerResult.rows.length === 0) {
      return res.status(404).json({ error: 'Worker not found' });
    }

    const worker = workerResult.rows[0];

    // Get assigned clients
    const clientsQuery = `
      SELECT 
        c.id, c.first_name, c.last_name, c.nickname,
        kwa.is_primary, kwa.assigned_date
      FROM key_worker_assignments kwa
      JOIN clients c ON kwa.client_id = c.id
      WHERE kwa.worker_id = $1
      ORDER BY kwa.is_primary DESC, c.last_name ASC
    `;
    const clientsResult = await query(clientsQuery, [id]);

    // Get recent services
    const servicesQuery = `
      SELECT 
        sr.id, sr.service_date, sr.subject, sr.service_type, sr.location,
        c.first_name, c.last_name
      FROM service_records sr
      JOIN clients c ON sr.client_id = c.id
      WHERE sr.created_by = $1
      ORDER BY sr.service_date DESC
      LIMIT 20
    `;
    const servicesResult = await query(servicesQuery, [id]);

    // Get statistics
    const statsQuery = `
      SELECT 
        COUNT(DISTINCT kwa.client_id) as assigned_clients_count,
        COUNT(DISTINCT CASE WHEN kwa.is_primary = true THEN kwa.client_id END) as primary_clients_count,
        COUNT(DISTINCT sr.id) + COUNT(DISTINCT v.id) as total_services,
        GREATEST(MAX(sr.service_date), MAX(v.visit_date)) as last_service_date,
        COUNT(DISTINCT v.client_id) as visited_clients_count,
        COUNT(DISTINCT c.id) as created_clients_count
      FROM users u
      LEFT JOIN key_worker_assignments kwa ON u.id = kwa.worker_id
      LEFT JOIN service_records sr ON u.id = sr.created_by
      LEFT JOIN visits v ON u.id = v.created_by
      LEFT JOIN clients c ON u.id = c.created_by
      WHERE u.id = $1
      GROUP BY u.id
    `;
    const statsResult = await query(statsQuery, [id]);

    res.json({
      success: true,
      worker,
      assignedClients: clientsResult.rows,
      recentServices: servicesResult.rows,
      stats: statsResult.rows[0] || {
        assigned_clients_count: 0,
        primary_clients_count: 0,
        total_services: 0,
        last_service_date: null
      }
    });
  } catch (error) {
    console.error('Error fetching worker details:', error);
    res.status(500).json({ error: 'Failed to fetch worker details' });
  }
});

// POST /api/workers - Create new worker (admin only)
router.post('/', requireAdmin, async (req, res) => {
  try {
    const { username, email, password, first_name, last_name, role, phone } = req.body;

    // Validation
    if (!username || !email || !password || !first_name || !last_name || !role) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Check if username already exists
    const usernameCheck = await query('SELECT id FROM users WHERE username = $1', [username]);
    if (usernameCheck.rows.length > 0) {
      return res.status(400).json({ error: 'Username already exists' });
    }

    // Check if email already exists
    const emailCheck = await query('SELECT id FROM users WHERE email = $1', [email]);
    if (emailCheck.rows.length > 0) {
      return res.status(400).json({ error: 'Email already exists' });
    }

    // Validate role
    const validRoles = ['admin', 'worker', 'viewer'];
    if (!validRoles.includes(role)) {
      return res.status(400).json({ error: 'Invalid role' });
    }

    // Hash password
    const saltRounds = 10;
    const password_hash = await bcrypt.hash(password, saltRounds);

    // Insert new worker
    const insertQuery = `
      INSERT INTO users (username, email, password_hash, first_name, last_name, role, phone, is_active)
      VALUES ($1, $2, $3, $4, $5, $6, $7, true)
      RETURNING id, username, email, first_name, last_name, role, phone, is_active, created_at
    `;
    
    const result = await query(insertQuery, [
      username,
      email,
      password_hash,
      first_name,
      last_name,
      role,
      phone || null
    ]);

    res.status(201).json({
      success: true,
      message: 'Worker created successfully',
      worker: result.rows[0]
    });
  } catch (error) {
    console.error('Error creating worker:', error);
    res.status(500).json({ error: 'Failed to create worker' });
  }
});

// PUT /api/workers/:id - Update worker (admin only)
router.put('/:id', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { username, email, first_name, last_name, role, phone, is_active, password } = req.body;

    // Check if worker exists
    const checkQuery = 'SELECT id FROM users WHERE id = $1';
    const checkResult = await query(checkQuery, [id]);
    
    if (checkResult.rows.length === 0) {
      return res.status(404).json({ error: 'Worker not found' });
    }

    // Build dynamic update query
    const updates = [];
    const params = [];
    let paramIndex = 1;

    if (username !== undefined) {
      // Check if new username is taken by another user
      const usernameCheck = await query(
        'SELECT id FROM users WHERE username = $1 AND id != $2',
        [username, id]
      );
      if (usernameCheck.rows.length > 0) {
        return res.status(400).json({ error: 'Username already exists' });
      }
      updates.push(`username = $${paramIndex}`);
      params.push(username);
      paramIndex++;
    }

    if (email !== undefined) {
      // Check if new email is taken by another user
      const emailCheck = await query(
        'SELECT id FROM users WHERE email = $1 AND id != $2',
        [email, id]
      );
      if (emailCheck.rows.length > 0) {
        return res.status(400).json({ error: 'Email already exists' });
      }
      updates.push(`email = $${paramIndex}`);
      params.push(email);
      paramIndex++;
    }

    if (first_name !== undefined) {
      updates.push(`first_name = $${paramIndex}`);
      params.push(first_name);
      paramIndex++;
    }

    if (last_name !== undefined) {
      updates.push(`last_name = $${paramIndex}`);
      params.push(last_name);
      paramIndex++;
    }

    if (role !== undefined) {
      const validRoles = ['admin', 'worker', 'viewer'];
      if (!validRoles.includes(role)) {
        return res.status(400).json({ error: 'Invalid role' });
      }
      updates.push(`role = $${paramIndex}`);
      params.push(role);
      paramIndex++;
    }

    if (phone !== undefined) {
      updates.push(`phone = $${paramIndex}`);
      params.push(phone);
      paramIndex++;
    }

    if (is_active !== undefined) {
      updates.push(`is_active = $${paramIndex}`);
      params.push(is_active);
      paramIndex++;
    }

    // Handle password update separately
    if (password && password.trim()) {
      const saltRounds = 10;
      const password_hash = await bcrypt.hash(password, saltRounds);
      updates.push(`password_hash = $${paramIndex}`);
      params.push(password_hash);
      paramIndex++;
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    params.push(id);
    const updateQuery = `
      UPDATE users 
      SET ${updates.join(', ')}, updated_at = NOW()
      WHERE id = $${paramIndex}
      RETURNING id, username, email, first_name, last_name, role, phone, is_active, updated_at
    `;

    const result = await query(updateQuery, params);

    res.json({
      success: true,
      message: 'Worker updated successfully',
      worker: result.rows[0]
    });
  } catch (error) {
    console.error('Error updating worker:', error);
    res.status(500).json({ error: 'Failed to update worker' });
  }
});

// DELETE /api/workers/:id - Delete worker (admin only)
router.delete('/:id', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    // Check if worker exists
    const checkQuery = 'SELECT id, first_name, last_name FROM users WHERE id = $1';
    const checkResult = await query(checkQuery, [id]);
    
    if (checkResult.rows.length === 0) {
      return res.status(404).json({ error: 'Worker not found' });
    }

    // Prevent deleting yourself
    if (req.user && req.user.id === id) {
      return res.status(400).json({ error: 'Cannot delete your own account' });
    }

    // Check if worker has assigned clients
    const assignmentsCheck = await query(
      'SELECT COUNT(*) as count FROM key_worker_assignments WHERE worker_id = $1',
      [id]
    );

    const assignmentsCount = parseInt(assignmentsCheck.rows[0].count);
    if (assignmentsCount > 0) {
      return res.status(400).json({ 
        error: `Cannot delete worker with ${assignmentsCount} assigned client(s). Please reassign clients first.` 
      });
    }

    // Delete worker
    await query('DELETE FROM users WHERE id = $1', [id]);

    res.json({
      success: true,
      message: 'Worker deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting worker:', error);
    res.status(500).json({ error: 'Failed to delete worker' });
  }
});

export default router;
