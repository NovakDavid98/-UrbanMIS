import express from 'express';
import { query } from '../config/database.js';
import ExcelJS from 'exceljs';
import { authenticateToken, requireRole } from '../middleware/auth.js';

const router = express.Router();

// All routes require authentication
router.use(authenticateToken);

// =================================================================================
// GET ALL VISITS
// =================================================================================
router.get('/', async (req, res) => {
  try {
    const {
      startDate,
      endDate,
      clientId,
      category,
      limit,
      offset,
      clientName,
      workerName,
      city,
      ageMin,
      ageMax,
      notesSearch,
      visitReasons,
      sortOrder
    } = req.query;

    // Debug: Log address filter
    console.log('🔍 Visits Query Params:', {
      address: req.query.address,
      clientName,
      city,
      startDate,
      endDate
    });

    // Set a reasonable default limit to prevent performance issues
    const queryLimit = limit ? parseInt(limit) : 50; // Default: 50 visits max for performance
    const queryOffset = offset ? parseInt(offset) : 0;

    let queryText = `
      SELECT DISTINCT
        v.id,
        v.client_id,
        v.visit_date,
        v.time_spent,
        v.notes,
        v.created_at,
        c.first_name as client_first_name,
        c.last_name as client_last_name,
        c.age as client_age,
        c.czech_city as client_city,
        c.czech_address as client_address,
        u.first_name as worker_first_name,
        u.last_name as worker_last_name,
        ARRAY_AGG(DISTINCT vr.name_cs ORDER BY vr.name_cs) FILTER (WHERE vr.id IS NOT NULL) as visit_reasons
      FROM visits v
      LEFT JOIN clients c ON v.client_id = c.id
      LEFT JOIN users u ON v.created_by = u.id
      LEFT JOIN visit_visit_reasons vvr ON v.id = vvr.visit_id
      LEFT JOIN visit_reasons vr ON vvr.visit_reason_id = vr.id
      WHERE 1=1
    `;

    const params = [];
    let paramCount = 1;

    if (startDate && startDate !== 'all') {
      queryText += ` AND v.visit_date >= $${paramCount}`;
      params.push(startDate);
      paramCount++;
    }

    if (endDate && endDate !== 'all') {
      queryText += ` AND v.visit_date <= $${paramCount}`;
      params.push(endDate);
      paramCount++;
    }

    if (clientId) {
      queryText += ` AND v.client_id = $${paramCount}`;
      params.push(clientId);
      paramCount++;
    }


    if (category && category !== 'all') {
      queryText += ` AND vr.category = $${paramCount}`;
      params.push(category);
      paramCount++;
    }

    // Client name search - match both "firstname lastname" and "lastname firstname"
    if (clientName && clientName !== 'all' && clientName.trim() !== '') {
      queryText += ` AND (
        LOWER(c.first_name || ' ' || c.last_name) LIKE LOWER($${paramCount})
        OR LOWER(c.last_name || ' ' || c.first_name) LIKE LOWER($${paramCount})
      )`;
      params.push(`%${clientName}%`);
      paramCount++;
    }

    // Worker name search - match both name orders
    if (req.query.workerName && req.query.workerName.trim() !== '') {
      queryText += ` AND (
        LOWER(u.first_name || ' ' || u.last_name) LIKE LOWER($${paramCount})
        OR LOWER(u.last_name || ' ' || u.first_name) LIKE LOWER($${paramCount})
      )`;
      params.push(`%${req.query.workerName.trim()}%`);
      paramCount++;
    }

    // City filter
    if (city && city !== 'all') {
      queryText += ` AND c.czech_city = $${paramCount}`;
      params.push(city);
      paramCount++;
    }

    // Age range filters - validate they're actually numbers
    const ageMinNum = parseInt(ageMin);
    if (ageMin && ageMin !== 'all' && !isNaN(ageMinNum)) {
      queryText += ` AND c.age >= $${paramCount}`;
      params.push(ageMinNum);
      paramCount++;
    }

    const ageMaxNum = parseInt(ageMax);
    if (ageMax && ageMax !== 'all' && !isNaN(ageMaxNum)) {
      queryText += ` AND c.age <= $${paramCount}`;
      params.push(ageMaxNum);
      paramCount++;
    }

    // Notes search
    if (notesSearch && notesSearch !== 'all' && notesSearch.trim() !== '') {
      queryText += ` AND LOWER(v.notes) LIKE LOWER($${paramCount})`;
      params.push(`%${notesSearch}%`);
      paramCount++;
    }

    // Visit reasons filter
    if (visitReasons) {
      const reasonsArray = Array.isArray(visitReasons) ? visitReasons : [visitReasons];
      queryText += ` AND vr.name_cs = ANY($${paramCount})`;
      params.push(reasonsArray);
      paramCount++;
    }

    // Address filter (diacritic insensitive)
    if (req.query.address && req.query.address !== 'all' && req.query.address.trim() !== '') {
      queryText += ` AND unaccent(LOWER(c.czech_address)) LIKE unaccent(LOWER($${paramCount}))`;
      params.push(`%${req.query.address.trim()}%`);
      paramCount++;
    }

    // Validate sortOrder - only allow ASC or DESC
    const safeSortOrder = sortOrder === 'ASC' ? 'ASC' : 'DESC';

    queryText += ` 
      GROUP BY v.id, c.first_name, c.last_name, c.age, c.czech_city, c.czech_address, 
               u.first_name, u.last_name
      ORDER BY v.visit_date ${safeSortOrder}, v.created_at ${safeSortOrder}
      LIMIT $${paramCount} OFFSET $${paramCount + 1}
    `;

    params.push(queryLimit, queryOffset);

    // Debug: Log complete query
    console.log('📊 Executing visits query:', {
      queryPreview: queryText.substring(0, 500),
      paramCount: params.length,
      params,
      hasAddressFilter: !!req.query.address
    });

    // Get total count for pagination info
    let countQueryText = `
      SELECT COUNT(DISTINCT v.id) as total
      FROM visits v
      LEFT JOIN clients c ON v.client_id = c.id
      LEFT JOIN visit_visit_reasons vvr ON v.id = vvr.visit_id
      LEFT JOIN visit_reasons vr ON vvr.visit_reason_id = vr.id
      WHERE 1=1
    `;

    const countParams = [];
    let countParamCount = 1;

    if (startDate && startDate !== 'all') {
      countQueryText += ` AND v.visit_date >= $${countParamCount}`;
      countParams.push(startDate);
      countParamCount++;
    }

    if (endDate && endDate !== 'all') {
      countQueryText += ` AND v.visit_date <= $${countParamCount}`;
      countParams.push(endDate);
      countParamCount++;
    }

    if (clientId) {
      countQueryText += ` AND v.client_id = $${countParamCount}`;
      countParams.push(clientId);
      countParamCount++;
    }

    if (category && category !== 'all') {
      countQueryText += ` AND vr.category = $${countParamCount}`;
      countParams.push(category);
      countParamCount++;
    }

    // Apply same filters to count query
    if (clientName && clientName !== 'all' && clientName.trim() !== '') {
      countQueryText += ` AND (LOWER(c.first_name || ' ' || c.last_name) LIKE LOWER($${countParamCount}))`;
      countParams.push(`%${clientName}%`);
      countParamCount++;
    }

    if (city && city !== 'all') {
      countQueryText += ` AND c.czech_city = $${countParamCount}`;
      countParams.push(city);
      countParamCount++;
    }

    // Age range filters - validate they're actually numbers
    const countAgeMinNum = parseInt(ageMin);
    if (ageMin && ageMin !== 'all' && !isNaN(countAgeMinNum)) {
      countQueryText += ` AND c.age >= $${countParamCount}`;
      countParams.push(countAgeMinNum);
      countParamCount++;
    }

    const countAgeMaxNum = parseInt(ageMax);
    if (ageMax && ageMax !== 'all' && !isNaN(countAgeMaxNum)) {
      countQueryText += ` AND c.age <= $${countParamCount}`;
      countParams.push(countAgeMaxNum);
      countParamCount++;
    }

    if (notesSearch && notesSearch !== 'all' && notesSearch.trim() !== '') {
      countQueryText += ` AND LOWER(v.notes) LIKE LOWER($${countParamCount})`;
      countParams.push(`%${notesSearch}%`);
      countParamCount++;
    }

    if (visitReasons) {
      const reasonsArray = Array.isArray(visitReasons) ? visitReasons : [visitReasons];
      countQueryText += ` AND vr.name_cs = ANY($${countParamCount})`;
      countParams.push(reasonsArray);
      countParamCount++;
    }

    // Address filter (diacritic insensitive)
    if (req.query.address && req.query.address !== 'all' && req.query.address.trim() !== '') {
      countQueryText += ` AND unaccent(LOWER(c.czech_address)) LIKE unaccent(LOWER($${countParamCount}))`;
      countParams.push(`%${req.query.address.trim()}%`);
      countParamCount++;
    }

    const [result, countResult] = await Promise.all([
      query(queryText, params),
      query(countQueryText, countParams)
    ]);

    const totalCount = parseInt(countResult.rows[0].total);

    res.json({
      success: true,
      visits: result.rows,
      pagination: {
        total: totalCount,
        limit: queryLimit,
        offset: queryOffset,
        hasMore: (queryOffset + queryLimit) < totalCount
      }
    });
  } catch (error) {
    console.error('Error fetching visits:', error);
    res.status(500).json({ error: 'Failed to fetch visits' });
  }
});

// =================================================================================
// GET FILTER OPTIONS (cities, reasons)
// =================================================================================
router.get('/filter-options', async (req, res) => {
  try {
    const [citiesResult, reasonsResult] = await Promise.all([
      query(`
        SELECT DISTINCT c.czech_city as city
        FROM clients c
        WHERE c.czech_city IS NOT NULL AND c.czech_city != ''
        ORDER BY city
      `),
      query(`
        SELECT DISTINCT vr.name_cs as reason, vr.display_order
        FROM visit_reasons vr
        ORDER BY vr.display_order, vr.name_cs
      `)
    ]);

    res.json({
      success: true,
      cities: citiesResult.rows.map(row => row.city),
      reasons: reasonsResult.rows.map(row => row.reason)
    });
  } catch (error) {
    console.error('Error fetching filter options:', error);
    res.status(500).json({ error: 'Failed to fetch filter options' });
  }
});

// =================================================================================
// EXPORT VISITS TO EXCEL - MUST BE BEFORE /:id ROUTE
// =================================================================================

router.get('/export', async (req, res) => {
  try {
    const {
      startDate,
      endDate,
      clientId,
      category,
      clientName,
      city,
      ageMin,
      ageMax,
      notesSearch,
      visitReasons,
      address
    } = req.query;

    // Build query (same logic as GET /api/visits but no pagination)
    let queryText = `
            SELECT DISTINCT
                v.id,
                v.client_id,
                v.visit_date,
                v.time_spent,
                v.notes,
                v.created_at,
                c.first_name as client_first_name,
                c.last_name as client_last_name,
                c.age as client_age,
                c.gender as client_gender,
                c.czech_city as client_city,
                c.czech_address as client_address,
                u.first_name as worker_first_name,
                u.last_name as worker_last_name,
                ARRAY_AGG(DISTINCT vr.name_cs ORDER BY vr.name_cs) FILTER (WHERE vr.id IS NOT NULL) as visit_reasons
            FROM visits v
            LEFT JOIN clients c ON v.client_id = c.id
            LEFT JOIN users u ON v.created_by = u.id
            LEFT JOIN visit_visit_reasons vvr ON v.id = vvr.visit_id
            LEFT JOIN visit_reasons vr ON vvr.visit_reason_id = vr.id
            WHERE 1=1
        `;

    const params = [];
    let paramCount = 1;

    if (startDate && startDate !== 'all') {
      queryText += ` AND v.visit_date >= $${paramCount}`;
      params.push(startDate);
      paramCount++;
    }

    if (endDate && endDate !== 'all') {
      queryText += ` AND v.visit_date <= $${paramCount}`;
      params.push(endDate);
      paramCount++;
    }

    if (clientId) {
      queryText += ` AND v.client_id = $${paramCount}`;
      params.push(clientId);
      paramCount++;
    }

    if (category && category !== 'all') {
      queryText += ` AND vr.category = $${paramCount}`;
      params.push(category);
      paramCount++;
    }

    if (clientName && clientName !== 'all' && clientName.trim() !== '') {
      queryText += ` AND (LOWER(c.first_name || ' ' || c.last_name) LIKE LOWER($${paramCount}))`;
      params.push(`%${clientName}%`);
      paramCount++;
    }

    if (city && city !== 'all') {
      queryText += ` AND c.czech_city = $${paramCount}`;
      params.push(city);
      paramCount++;
    }

    const ageMinNum = parseInt(ageMin);
    if (ageMin && ageMin !== 'all' && !isNaN(ageMinNum)) {
      queryText += ` AND c.age >= $${paramCount}`;
      params.push(ageMinNum);
      paramCount++;
    }

    const ageMaxNum = parseInt(ageMax);
    if (ageMax && ageMax !== 'all' && !isNaN(ageMaxNum)) {
      queryText += ` AND c.age <= $${paramCount}`;
      params.push(ageMaxNum);
      paramCount++;
    }

    if (notesSearch && notesSearch !== 'all' && notesSearch.trim() !== '') {
      queryText += ` AND LOWER(v.notes) LIKE LOWER($${paramCount})`;
      params.push(`%${notesSearch}%`);
      paramCount++;
    }

    if (visitReasons) {
      const reasonsArray = Array.isArray(visitReasons) ? visitReasons : [visitReasons];
      queryText += ` AND vr.name_cs = ANY($${paramCount})`;
      params.push(reasonsArray);
      paramCount++;
    }

    if (address && address !== 'all' && address.trim() !== '') {
      queryText += ` AND unaccent(LOWER(c.czech_address)) LIKE unaccent(LOWER($${paramCount}))`;
      params.push(`%${address.trim()}%`);
      paramCount++;
    }

    queryText += ` 
            GROUP BY v.id, c.first_name, c.last_name, c.age, c.gender, c.czech_city, c.czech_address, 
                     u.first_name, u.last_name
            ORDER BY v.visit_date DESC, v.created_at DESC
            LIMIT 10000
        `;

    const result = await query(queryText, params);

    // Create Excel workbook
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Centrální Mozek CEHUPO';
    workbook.created = new Date();

    const worksheet = workbook.addWorksheet('Visits', {
      views: [{ state: 'frozen', xSplit: 0, ySplit: 1 }]
    });

    // Define columns
    worksheet.columns = [
      { header: 'ID návštěvy', key: 'id', width: 36 },
      { header: 'Datum návštěvy', key: 'visit_date', width: 15 },
      { header: 'Jméno klienta', key: 'client_first_name', width: 15 },
      { header: 'Příjmení klienta', key: 'client_last_name', width: 15 },
      { header: 'Věk klienta', key: 'client_age', width: 12 },
      { header: 'Pohlaví', key: 'client_gender', width: 12 },
      { header: 'Město', key: 'client_city', width: 18 },
      { header: 'Adresa', key: 'client_address', width: 30 },
      { header: 'Důvody návštěvy', key: 'visit_reasons', width: 40 },
      { header: 'Čas strávený', key: 'time_spent', width: 12 },
      { header: 'Poznámka', key: 'notes', width: 40 },
      { header: 'Pracovník', key: 'worker_name', width: 20 },
      { header: 'Vytvořeno', key: 'created_at', width: 18 }
    ];

    // Style header row
    worksheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    worksheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF4472C4' }
    };
    worksheet.getRow(1).alignment = { vertical: 'middle', horizontal: 'center' };
    worksheet.getRow(1).height = 20;

    // Add data rows
    result.rows.forEach(visit => {
      const workerName = visit.worker_first_name && visit.worker_last_name
        ? `${visit.worker_first_name} ${visit.worker_last_name}`
        : '—';

      const visitReasonsStr = visit.visit_reasons && visit.visit_reasons.length > 0
        ? visit.visit_reasons.join(', ')
        : '';

      worksheet.addRow({
        id: visit.id,
        visit_date: visit.visit_date,
        client_first_name: visit.client_first_name,
        client_last_name: visit.client_last_name,
        client_age: visit.client_age,
        client_gender: visit.client_gender,
        client_city: visit.client_city,
        client_address: visit.client_address,
        visit_reasons: visitReasonsStr,
        time_spent: visit.time_spent,
        notes: visit.notes,
        worker_name: workerName,
        created_at: visit.created_at
      });
    });

    // Generate filename with timestamp
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const filename = `visits_export_${timestamp}.xlsx`;

    // Write to buffer instead of directly to response
    const buffer = await workbook.xlsx.writeBuffer();

    // Set response headers
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', buffer.length);

    // Send buffer
    res.send(buffer);

  } catch (error) {
    console.error('Export visits error:', error);
    res.status(500).json({ error: 'Failed to export visits' });
  }
});

// =================================================================================
// GET SINGLE VISIT
// =================================================================================
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const result = await query(`
      SELECT 
        v.*,
        c.first_name as client_first_name,
        c.last_name as client_last_name,
        ARRAY_AGG(vvr.visit_reason_id) FILTER (WHERE vvr.visit_reason_id IS NOT NULL) as reason_ids
      FROM visits v
      LEFT JOIN clients c ON v.client_id = c.id
      LEFT JOIN visit_visit_reasons vvr ON v.id = vvr.visit_id
      WHERE v.id = $1
      GROUP BY v.id, c.first_name, c.last_name
    `, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Visit not found' });
    }

    res.json({
      success: true,
      visit: result.rows[0]
    });
  } catch (error) {
    console.error('Error fetching visit:', error);
    res.status(500).json({ error: 'Failed to fetch visit' });
  }
});

// =================================================================================
// CREATE VISIT
// =================================================================================
router.post('/', async (req, res) => {
  try {
    const { clientId, visitDate, timeSpent, notes, visitReasonIds } = req.body;
    const userId = req.user.id;

    // Validate required fields
    if (!clientId || !visitDate || !visitReasonIds || visitReasonIds.length === 0) {
      return res.status(400).json({
        error: 'Client, visit date, and at least one visit reason are required'
      });
    }

    // Start transaction
    await query('BEGIN');

    // Parse timeSpent if it's a string (e.g., "HH:MM")
    let timeSpentMinutes = timeSpent;
    if (typeof timeSpent === 'string' && timeSpent.includes(':')) {
      const [hours, minutes] = timeSpent.split(':').map(Number);
      timeSpentMinutes = (hours * 60) + minutes;
    } else if (timeSpent) {
      timeSpentMinutes = parseInt(timeSpent);
    }

    try {
      // Insert visit
      const visitResult = await query(`
        INSERT INTO visits (client_id, visit_date, time_spent, notes, created_by)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING *
      `, [clientId, visitDate, timeSpentMinutes || null, notes || null, userId]);

      const visit = visitResult.rows[0];

      // Insert visit reasons
      for (const reasonId of visitReasonIds) {
        await query(`
          INSERT INTO visit_visit_reasons (visit_id, visit_reason_id)
          VALUES ($1, $2)
        `, [visit.id, reasonId]);
      }

      await query('COMMIT');

      res.status(201).json({
        success: true,
        visit
      });
    } catch (error) {
      await query('ROLLBACK');
      throw error;
    }
  } catch (error) {
    console.error('Error creating visit:', error);
    res.status(500).json({ error: 'Failed to create visit' });
  }
});

// =================================================================================
// UPDATE VISIT
// =================================================================================
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { visitDate, timeSpent, notes, visitReasonIds } = req.body;

    // Start transaction
    await query('BEGIN');

    try {
      // Update visit
      const visitResult = await query(`
        UPDATE visits 
        SET visit_date = $1,
            time_spent = $2,
            notes = $3,
            updated_at = NOW()
        WHERE id = $4
        RETURNING *
      `, [visitDate, timeSpent || null, notes || null, id]);

      if (visitResult.rows.length === 0) {
        await query('ROLLBACK');
        return res.status(404).json({ error: 'Visit not found' });
      }

      // Update visit reasons if provided
      if (visitReasonIds && visitReasonIds.length > 0) {
        // Delete existing reasons
        await query('DELETE FROM visit_visit_reasons WHERE visit_id = $1', [id]);

        // Insert new reasons
        for (const reasonId of visitReasonIds) {
          await query(`
            INSERT INTO visit_visit_reasons (visit_id, visit_reason_id)
            VALUES ($1, $2)
          `, [id, reasonId]);
        }
      }

      await query('COMMIT');

      res.json({
        success: true,
        visit: visitResult.rows[0]
      });
    } catch (error) {
      await query('ROLLBACK');
      throw error;
    }
  } catch (error) {
    console.error('Error updating visit:', error);
    res.status(500).json({ error: 'Failed to update visit' });
  }
});

// =================================================================================
// DELETE VISIT
// =================================================================================
router.delete('/:id', requireRole('admin'), async (req, res) => {
  try {
    const { id } = req.params;

    const result = await query('DELETE FROM visits WHERE id = $1 RETURNING id', [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Visit not found' });
    }

    res.json({
      success: true,
      message: 'Visit deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting visit:', error);
    res.status(500).json({ error: 'Failed to delete visit' });
  }
});

// =================================================================================
// GET VISIT REASONS
// =================================================================================
router.get('/reasons/all', async (req, res) => {
  try {
    const result = await query(`
      SELECT id, category, name_cs, name_uk, name_ru, display_order
      FROM visit_reasons
      WHERE is_active = true
      ORDER BY display_order
    `);

    // Group by category
    const grouped = {
      warehouse: [],
      assistance: [],
      community: [],
      donations: []
    };

    result.rows.forEach(reason => {
      if (grouped[reason.category]) {
        grouped[reason.category].push(reason);
      }
    });

    res.json({
      success: true,
      reasons: result.rows,
      grouped
    });
  } catch (error) {
    console.error('Error fetching visit reasons:', error);
    res.status(500).json({ error: 'Failed to fetch visit reasons' });
  }
});

// =================================================================================
// GET VISIT STATISTICS
// =================================================================================
router.get('/stats/summary', async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    let dateFilter = '';
    const params = [];

    if (startDate && endDate && startDate !== 'all' && endDate !== 'all') {
      dateFilter = ' AND visit_date BETWEEN $1 AND $2';
      params.push(startDate, endDate);
    }

    const statsQuery = `
      SELECT 
        COUNT(*) as total_visits,
        COUNT(DISTINCT client_id) as unique_clients,
        COUNT(CASE WHEN visit_date >= CURRENT_DATE - INTERVAL '7 days' THEN 1 END) as visits_last_week,
        COUNT(CASE WHEN visit_date >= CURRENT_DATE - INTERVAL '30 days' THEN 1 END) as visits_last_month
      FROM visits
      WHERE 1=1 ${dateFilter}
    `;

    const categoryQuery = `
      SELECT 
        vr.category,
        COUNT(*) as count
      FROM visits v
      JOIN visit_visit_reasons vvr ON v.id = vvr.visit_id
      JOIN visit_reasons vr ON vvr.visit_reason_id = vr.id
      WHERE 1=1 ${dateFilter}
      GROUP BY vr.category
      ORDER BY count DESC
    `;

    const [statsResult, categoryResult] = await Promise.all([
      query(statsQuery, params),
      query(categoryQuery, params)
    ]);

    res.json({
      success: true,
      stats: statsResult.rows[0],
      byCategory: categoryResult.rows
    });
  } catch (error) {
    console.error('Error fetching visit statistics:', error);
    res.status(500).json({ error: 'Failed to fetch statistics' });
  }
});

export default router;
