import express from 'express';
import { query } from '../config/database.js';
import ExcelJS from 'exceljs';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

// All routes require authentication
router.use(authenticateToken);

// =================================================================================
// GET ALL CLIENTS (with filtering and pagination)
// =================================================================================

router.get('/', async (req, res) => {
    try {
        const {
            search,
            activityStatus,
            gender,
            tag,
            insurance,
            ukrainianRegion,
            ageMin,
            ageMax,
            visaType,
            czechCity,
            addressSearch,
            registrationMonth, // Format: YYYY-MM
            geoStatus, // 'failed' or 'ok'
            page = 1,
            limit = 50,
            sortBy = 'last_name',
            sortOrder = 'ASC'
        } = req.query;

        let whereConditions = [];
        let queryParams = [];
        let paramCount = 1;

        // Search filter
        if (search && search.trim()) {
            whereConditions.push(`(
                c.first_name ILIKE $${paramCount} OR 
                c.last_name ILIKE $${paramCount} OR 
                c.nickname ILIKE $${paramCount} OR
                c.email ILIKE $${paramCount} OR
                c.visa_number ILIKE $${paramCount}
            )`);
            queryParams.push(`%${search.trim()}%`);
            paramCount++;
        }

        // Activity status filter
        if (activityStatus && activityStatus !== 'all') {
            whereConditions.push(`c.activity_status = $${paramCount}`);
            queryParams.push(activityStatus);
            paramCount++;
        }

        // Gender filter
        if (gender && gender !== 'all') {
            whereConditions.push(`c.gender = $${paramCount}`);
            queryParams.push(gender);
            paramCount++;
        }

        // Insurance filter
        if (insurance && insurance !== 'all') {
            whereConditions.push(`c.insurance_company = $${paramCount}`);
            queryParams.push(insurance);
            paramCount++;
        }

        // Ukrainian Region filter
        if (ukrainianRegion && ukrainianRegion !== 'all') {
            whereConditions.push(`c.ukrainian_region ILIKE $${paramCount}`);
            queryParams.push(`%${ukrainianRegion}%`);
            paramCount++;
        }

        // Visa Type filter
        if (visaType && visaType !== 'all') {
            whereConditions.push(`c.visa_type ILIKE $${paramCount}`);
            queryParams.push(`%${visaType}%`);
            paramCount++;
        }

        // Age range filter
        if (ageMin) {
            whereConditions.push(`c.age >= $${paramCount}`);
            queryParams.push(parseInt(ageMin));
            paramCount++;
        }
        if (ageMax) {
            whereConditions.push(`c.age <= $${paramCount}`);
            queryParams.push(parseInt(ageMax));
            paramCount++;
        }

        // Czech city filter (exact match)
        if (czechCity && czechCity !== 'all' && czechCity.trim()) {
            whereConditions.push(`c.czech_city = $${paramCount}`);
            queryParams.push(czechCity.trim());
            paramCount++;
        }

        // Address search filter (diacritic-insensitive, searches across all address fields)
        if (addressSearch && addressSearch.trim()) {
            whereConditions.push(`(
                unaccent(LOWER(c.czech_city)) LIKE unaccent(LOWER($${paramCount})) OR 
                unaccent(LOWER(c.czech_address)) LIKE unaccent(LOWER($${paramCount})) OR 
                unaccent(LOWER(c.home_address)) LIKE unaccent(LOWER($${paramCount}))
            )`);
            queryParams.push(`%${addressSearch.trim()}%`);
            paramCount++;
        }

        // Registration Month filter
        if (registrationMonth && /^\d{4}-\d{2}$/.test(registrationMonth)) {
            // Filter by month and year of project_registration_date
            // We cast date column to text and check if it starts with 'YYYY-MM'
            // or use date_trunc('month', date)
            whereConditions.push(`to_char(c.project_registration_date, 'YYYY-MM') = $${paramCount}`);
            queryParams.push(registrationMonth);
            paramCount++;
        }

        // Tag filter
        if (tag) {
            whereConditions.push(`EXISTS (
                SELECT 1 FROM client_tags ct 
                JOIN tags t ON ct.tag_id = t.id 
                WHERE ct.client_id = c.id AND t.name = $${paramCount}
            )`);
            queryParams.push(tag);
            paramCount++;
        }

        // Geo Status filter
        if (geoStatus === 'failed') {
            whereConditions.push(`(c.latitude = 0 OR c.latitude IS NULL)`);
        } else if (geoStatus === 'ok') {
            whereConditions.push(`(c.latitude != 0 AND c.latitude IS NOT NULL)`);
        }

        const whereClause = whereConditions.length > 0
            ? 'WHERE ' + whereConditions.join(' AND ')
            : '';

        // Get total count
        const countResult = await query(
            `SELECT COUNT(*) FROM clients c ${whereClause}`,
            queryParams
        );

        const totalCount = parseInt(countResult.rows[0].count);

        // Get paginated results with service counts
        const offset = (page - 1) * limit;
        const allowedSortFields = ['last_name', 'first_name', 'age', 'created_at'];
        const safeSortBy = allowedSortFields.includes(sortBy) ? sortBy : 'last_name';

        // Only select necessary fields - DO NOT EXPOSE ALL DATA (c.*)
        const clientsResult = await query(
            `SELECT 
                c.id,
                c.first_name,
                c.last_name,
                c.nickname,
                c.age,
                c.gender,
                c.activity_status,
                c.ukrainian_region,
                c.czech_city,
                c.czech_address,
                c.insurance_company,
                c.created_at,
                c.updated_at,
                c.latitude,
                c.longitude,
                (COUNT(DISTINCT sr.id) + COUNT(DISTINCT v.id)) as service_count,
                LEAST(MIN(sr.service_date), MIN(v.visit_date)) as first_service_date,
                GREATEST(MAX(sr.service_date), MAX(v.visit_date)) as last_service_date,
                STRING_AGG(DISTINCT t.name, ', ') as tags
             FROM clients c
             LEFT JOIN service_records sr ON c.id = sr.client_id
             LEFT JOIN visits v ON c.id = v.client_id
             LEFT JOIN client_tags ct ON c.id = ct.client_id
             LEFT JOIN tags t ON ct.tag_id = t.id
             ${whereClause}
             GROUP BY c.id
             ORDER BY ${safeSortBy} ${sortOrder}
             LIMIT $${paramCount} OFFSET $${paramCount + 1}`,
            [...queryParams, limit, offset]
        );

        res.json({
            clients: clientsResult.rows,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total: totalCount,
                pages: Math.ceil(totalCount / limit)
            }
        });

    } catch (error) {
        console.error('Get clients error:', error);
        res.status(500).json({ error: 'Failed to fetch clients' });
    }
});


// ======================================================================================================================================
// EXPORT CLIENTS TO EXCEL - MUST BE BEFORE /:id ROUTE
// =================================================================================

router.get('/export', async (req, res) => {
    try {
        const {
            search,
            activityStatus,
            gender,
            tag,
            insurance,
            ukrainianRegion,
            ageMin,
            ageMax,
            visaType,
            czechCity,
            addressSearch,
            registrationMonth
        } = req.query;

        // Build the same WHERE conditions as GET /api/clients
        let whereConditions = [];
        let queryParams = [];
        let paramCount = 1;

        if (search && search.trim()) {
            whereConditions.push(`(
                c.first_name ILIKE $${paramCount} OR 
                c.last_name ILIKE $${paramCount} OR 
                c.nickname ILIKE $${paramCount} OR
                c.email ILIKE $${paramCount} OR
                c.visa_number ILIKE $${paramCount}
            )`);
            queryParams.push(`%${search.trim()}%`);
            paramCount++;
        }

        if (activityStatus && activityStatus !== 'all') {
            whereConditions.push(`c.activity_status = $${paramCount}`);
            queryParams.push(activityStatus);
            paramCount++;
        }

        if (gender && gender !== 'all') {
            whereConditions.push(`c.gender = $${paramCount}`);
            queryParams.push(gender);
            paramCount++;
        }

        if (insurance && insurance !== 'all') {
            whereConditions.push(`c.insurance_company = $${paramCount}`);
            queryParams.push(insurance);
            paramCount++;
        }

        if (ukrainianRegion && ukrainianRegion !== 'all') {
            whereConditions.push(`c.ukrainian_region ILIKE $${paramCount}`);
            queryParams.push(`%${ukrainianRegion}%`);
            paramCount++;
        }

        if (visaType && visaType !== 'all') {
            whereConditions.push(`c.visa_type ILIKE $${paramCount}`);
            queryParams.push(`%${visaType}%`);
            paramCount++;
        }

        if (ageMin) {
            whereConditions.push(`c.age >= $${paramCount}`);
            queryParams.push(parseInt(ageMin));
            paramCount++;
        }
        if (ageMax) {
            whereConditions.push(`c.age <= $${paramCount}`);
            queryParams.push(parseInt(ageMax));
            paramCount++;
        }

        if (czechCity && czechCity !== 'all' && czechCity.trim()) {
            whereConditions.push(`c.czech_city = $${paramCount}`);
            queryParams.push(czechCity.trim());
            paramCount++;
        }

        if (addressSearch && addressSearch.trim()) {
            whereConditions.push(`(
                unaccent(LOWER(c.czech_city)) LIKE unaccent(LOWER($${paramCount})) OR 
                unaccent(LOWER(c.czech_address)) LIKE unaccent(LOWER($${paramCount})) OR 
                unaccent(LOWER(c.home_address)) LIKE unaccent(LOWER($${paramCount}))
            )`);
            queryParams.push(`%${addressSearch.trim()}%`);
            paramCount++;
        }

        if (registrationMonth && /^\d{4}-\d{2}$/.test(registrationMonth)) {
            whereConditions.push(`to_char(c.project_registration_date, 'YYYY-MM') = $${paramCount}`);
            queryParams.push(registrationMonth);
            paramCount++;
        }

        if (tag) {
            whereConditions.push(`EXISTS (
                SELECT 1 FROM client_tags ct 
                JOIN tags t ON ct.tag_id = t.id 
                WHERE ct.client_id = c.id AND t.name = $${paramCount}
            )`);
            queryParams.push(tag);
            paramCount++;
        }

        const whereClause = whereConditions.length > 0
            ? 'WHERE ' + whereConditions.join(' AND ')
            : '';

        // Query for export data (no pagination, max 10000)
        const clientsResult = await query(
            `SELECT 
                c.id,
                c.first_name,
                c.last_name,
                c.nickname,
                c.age,
                c.gender,
                c.date_of_birth,
                c.czech_city,
                c.czech_address,
                c.czech_phone,
                c.ukrainian_phone,
                c.email,
                c.home_address,
                c.ukrainian_region,
                c.visa_number,
                c.visa_type,
                c.insurance_company,
                c.date_of_arrival_czech,
                c.project_registration_date,
                c.activity_status,
                (COUNT(DISTINCT sr.id) + COUNT(DISTINCT v.id)) as service_count,
                LEAST(MIN(sr.service_date), MIN(v.visit_date)) as first_service_date,
                GREATEST(MAX(sr.service_date), MAX(v.visit_date)) as last_service_date,
                STRING_AGG(DISTINCT t.name, ', ') as tags
             FROM clients c
             LEFT JOIN service_records sr ON c.id = sr.client_id
             LEFT JOIN visits v ON c.id = v.client_id
             LEFT JOIN client_tags ct ON c.id = ct.client_id
             LEFT JOIN tags t ON ct.tag_id = t.id
             ${whereClause}
             GROUP BY c.id
             ORDER BY c.last_name ASC
             LIMIT 10000`,
            queryParams
        );

        // Create Excel workbook
        const workbook = new ExcelJS.Workbook();
        workbook.creator = 'Centrální Mozek CEHUPO';
        workbook.created = new Date();

        const worksheet = workbook.addWorksheet('Clients', {
            views: [{ state: 'frozen', xSplit: 0, ySplit: 1 }]
        });

        // Define columns
        worksheet.columns = [
            { header: 'ID', key: 'id', width: 36 },
            { header: 'Jméno', key: 'first_name', width: 15 },
            { header: 'Příjmení', key: 'last_name', width: 15 },
            { header: 'Přezdívka', key: 'nickname', width: 15 },
            { header: 'Pohlaví', key: 'gender', width: 12 },
            { header: 'Věk', key: 'age', width: 8 },
            { header: 'Datum narození', key: 'date_of_birth', width: 15 },
            { header: 'Město ČR', key: 'czech_city', width: 18 },
            { header: 'Adresa ČR', key: 'czech_address', width: 30 },
            { header: 'Telefon ČR', key: 'czech_phone', width: 15 },
            { header: 'Telefon UA', key: 'ukrainian_phone', width: 15 },
            { header: 'Email', key: 'email', width: 25 },
            { header: 'Adresa UA', key: 'home_address', width: 30 },
            { header: 'Region UA', key: 'ukrainian_region', width: 18 },
            { header: 'Číslo víza', key: 'visa_number', width: 15 },
            { header: 'Typ víza', key: 'visa_type', width: 12 },
            { header: 'Pojišťovna', key: 'insurance_company', width: 12 },
            { header: 'Datum příjezdu', key: 'date_of_arrival_czech', width: 15 },
            { header: 'Datum registrace', key: 'project_registration_date', width: 15 },
            { header: 'Stav', key: 'activity_status', width: 12 },
            { header: 'Počet výkonů', key: 'service_count', width: 12 },
            { header: 'První výkon', key: 'first_service_date', width: 15 },
            { header: 'Poslední výkon', key: 'last_service_date', width: 15 },
            { header: 'Štítky', key: 'tags', width: 25 }
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
        clientsResult.rows.forEach(client => {
            worksheet.addRow({
                id: client.id,
                first_name: client.first_name,
                last_name: client.last_name,
                nickname: client.nickname,
                gender: client.gender,
                age: client.age,
                date_of_birth: client.date_of_birth,
                czech_city: client.czech_city,
                czech_address: client.czech_address,
                czech_phone: client.czech_phone,
                ukrainian_phone: client.ukrainian_phone,
                email: client.email,
                home_address: client.home_address,
                ukrainian_region: client.ukrainian_region,
                visa_number: client.visa_number,
                visa_type: client.visa_type,
                insurance_company: client.insurance_company,
                date_of_arrival_czech: client.date_of_arrival_czech,
                project_registration_date: client.project_registration_date,
                activity_status: client.activity_status,
                service_count: parseInt(client.service_count) || 0,
                first_service_date: client.first_service_date,
                last_service_date: client.last_service_date,
                tags: client.tags
            });
        });

        // Generate filename with timestamp
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
        const filename = `clients_export_${timestamp}.xlsx`;

        // Write to buffer instead of directly to response
        const buffer = await workbook.xlsx.writeBuffer();

        // Set response headers
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.setHeader('Content-Length', buffer.length);

        // Send buffer
        res.send(buffer);

    } catch (error) {
        console.error('Export clients error:', error);
        res.status(500).json({ error: 'Failed to export clients' });
    }
});

// =================================================================================
// GET CLIENT BY ID (with all related data)
// =================================================================================

router.get('/:id', async (req, res) => {
    try {
        const { id } = req.params;

        // Get client basic info
        const clientResult = await query(
            'SELECT * FROM clients WHERE id = $1',
            [id]
        );

        if (clientResult.rows.length === 0) {
            return res.status(404).json({ error: 'Client not found' });
        }

        const client = clientResult.rows[0];

        // Get key workers
        const workersResult = await query(
            `SELECT kwa.*, u.first_name, u.last_name, u.email
             FROM key_worker_assignments kwa
             JOIN users u ON kwa.worker_id = u.id
             WHERE kwa.client_id = $1
             ORDER BY kwa.is_primary DESC, kwa.assigned_date DESC`,
            [id]
        );

        // Get tags
        const tagsResult = await query(
            `SELECT t.* FROM tags t
             JOIN client_tags ct ON t.id = ct.tag_id
             WHERE ct.client_id = $1`,
            [id]
        );

        // Get contracts
        const contractsResult = await query(
            `SELECT * FROM contracts 
             WHERE client_id = $1 
             ORDER BY is_active DESC, start_date DESC`,
            [id]
        );

        // Get individual plans with revisions
        const plansResult = await query(
            `SELECT ip.*, 
                    u.first_name as creator_first_name, 
                    u.last_name as creator_last_name
             FROM individual_plans ip
             LEFT JOIN users u ON ip.created_by = u.id
             WHERE ip.client_id = $1
             ORDER BY ip.is_active DESC, ip.created_at DESC`,
            [id]
        );

        // For each plan, get revisions
        for (let plan of plansResult.rows) {
            const revisionsResult = await query(
                `SELECT pr.*, u.first_name, u.last_name
                 FROM plan_revisions pr
                 LEFT JOIN users u ON pr.created_by = u.id
                 WHERE pr.plan_id = $1
                 ORDER BY pr.revision_date DESC`,
                [plan.id]
            );
            plan.revisions = revisionsResult.rows;
        }

        // Get recent services (last 50)
        const servicesResult = await query(
            `SELECT sr.*, u.first_name as worker_first_name, u.last_name as worker_last_name
             FROM service_records sr
             LEFT JOIN users u ON sr.created_by = u.id
             WHERE sr.client_id = $1
             ORDER BY sr.service_date DESC
             LIMIT 50`,
            [id]
        );

        // Get service statistics by topic
        const topicStatsResult = await query(
            `SELECT topic, COUNT(*) as count
             FROM service_records
             WHERE client_id = $1 AND topic IS NOT NULL
             GROUP BY topic
             ORDER BY count DESC`,
            [id]
        );

        // Get notes
        const notesResult = await query(
            `SELECT * FROM notes
             WHERE client_id = $1
             ORDER BY is_important DESC, created_at DESC`,
            [id]
        );

        // Get visits (from žurnál návštěv) - last 50
        const visitsResult = await query(
            `SELECT 
                v.id,
                v.visit_date,
                v.time_spent,
                v.notes,
                v.created_at,
                u.first_name as worker_first_name,
                u.last_name as worker_last_name,
                ARRAY_AGG(DISTINCT vr.name_cs ORDER BY vr.name_cs) 
                    FILTER (WHERE vr.id IS NOT NULL) as visit_reasons
             FROM visits v
             LEFT JOIN users u ON v.created_by = u.id
             LEFT JOIN visit_visit_reasons vvr ON v.id = vvr.visit_id
             LEFT JOIN visit_reasons vr ON vvr.visit_reason_id = vr.id
             WHERE v.client_id = $1
             GROUP BY v.id, u.first_name, u.last_name
             ORDER BY v.visit_date DESC
             LIMIT 50`,
            [id]
        );

        res.json({
            client,
            keyWorkers: workersResult.rows,
            tags: tagsResult.rows,
            contracts: contractsResult.rows,
            individualPlans: plansResult.rows,
            recentServices: servicesResult.rows,
            servicesByTopic: topicStatsResult.rows,
            notes: notesResult.rows,
            visits: visitsResult.rows
        });

    } catch (error) {
        console.error('Get client error:', error);
        res.status(500).json({ error: 'Failed to fetch client data' });
    }
});

// =================================================================================
// CREATE NEW CLIENT
// =================================================================================

router.post('/', async (req, res) => {
    try {
        const {
            firstName, lastName, nickname, gender, dateOfBirth,
            homeAddress, czechCity, czechAddress, czechPhone, ukrainianPhone, email,
            dateOfArrivalCzech, projectRegistrationDate,
            visaNumber, visaType, insuranceCompany, ukrainianRegion,
            notes
        } = req.body;

        if (!firstName || !lastName) {
            return res.status(400).json({ error: 'First name and last name are required' });
        }

        // Convert empty strings to null for date fields
        const cleanDateOfBirth = dateOfBirth?.trim() || null;
        const cleanDateOfArrivalCzech = dateOfArrivalCzech?.trim() || null;
        const cleanProjectRegistrationDate = projectRegistrationDate?.trim() || null;

        // Calculate age if date of birth provided
        let age = null;
        if (cleanDateOfBirth) {
            const birthDate = new Date(cleanDateOfBirth);
            const today = new Date();
            age = today.getFullYear() - birthDate.getFullYear();
            if (today.getMonth() < birthDate.getMonth() ||
                (today.getMonth() === birthDate.getMonth() && today.getDate() < birthDate.getDate())) {
                age--;
            }
        }

        const result = await query(
            `INSERT INTO clients (
                first_name, last_name, nickname, gender, date_of_birth, age,
                home_address, czech_city, czech_address, czech_phone, ukrainian_phone, email,
                date_of_arrival_czech, project_registration_date,
                visa_number, visa_type, insurance_company, ukrainian_region,
                notes,
                latitude, longitude,
                created_by
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22)
            RETURNING *`,
            [
                firstName, lastName, nickname, gender, cleanDateOfBirth, age,
                homeAddress, czechCity, czechAddress, czechPhone, ukrainianPhone, email,
                cleanDateOfArrivalCzech, cleanProjectRegistrationDate,
                visaNumber, visaType, insuranceCompany, ukrainianRegion,
                notes,
                req.body.latitude || null,
                req.body.longitude || null,
                req.user.id
            ]
        );

        res.status(201).json({
            message: 'Client created successfully',
            client: result.rows[0]
        });

    } catch (error) {
        console.error('Create client error:', error);
        res.status(500).json({ error: 'Failed to create client' });
    }
});

// =================================================================================
// UPDATE CLIENT
// =================================================================================

router.put('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const {
            firstName, lastName, nickname, gender, dateOfBirth,
            homeAddress, czechCity, czechAddress, czechPhone, ukrainianPhone, email,
            dateOfArrivalCzech, projectRegistrationDate,
            visaNumber, visaType, insuranceCompany, ukrainianRegion,
            activityStatus, notes,
            wentToUkraine, isInOstrava
        } = req.body;

        // Convert empty strings to null for date fields
        const cleanDateOfBirth = dateOfBirth?.trim() || null;
        const cleanDateOfArrivalCzech = dateOfArrivalCzech?.trim() || null;
        const cleanProjectRegistrationDate = projectRegistrationDate?.trim() || null;

        // Calculate age if date of birth provided
        let age = null;
        if (cleanDateOfBirth) {
            const birthDate = new Date(cleanDateOfBirth);
            const today = new Date();
            age = today.getFullYear() - birthDate.getFullYear();
            if (today.getMonth() < birthDate.getMonth() ||
                (today.getMonth() === birthDate.getMonth() && today.getDate() < birthDate.getDate())) {
                age--;
            }
        }

        const result = await query(
            `UPDATE clients SET
                first_name = COALESCE($1, first_name),
                last_name = COALESCE($2, last_name),
                nickname = COALESCE($3, nickname),
                gender = COALESCE($4, gender),
                date_of_birth = COALESCE($5, date_of_birth),
                age = COALESCE($6, age),
                home_address = COALESCE($7, home_address),
                czech_city = COALESCE($8, czech_city),
                czech_address = COALESCE($9, czech_address),
                czech_phone = COALESCE($10, czech_phone),
                ukrainian_phone = COALESCE($11, ukrainian_phone),
                email = COALESCE($12, email),
                date_of_arrival_czech = COALESCE($13, date_of_arrival_czech),
                project_registration_date = COALESCE($14, project_registration_date),
                visa_number = COALESCE($15, visa_number),
                visa_type = COALESCE($16, visa_type),
                insurance_company = COALESCE($17, insurance_company),
                ukrainian_region = COALESCE($18, ukrainian_region),
                activity_status = COALESCE($19, activity_status),
                notes = COALESCE($20, notes),
                went_to_ukraine = COALESCE($21, went_to_ukraine),
                is_in_ostrava = COALESCE($22, is_in_ostrava),
                latitude = COALESCE($23, latitude),
                longitude = COALESCE($24, longitude),
                updated_at = CURRENT_TIMESTAMP
             WHERE id = $25
             RETURNING *`,
            [
                firstName, lastName, nickname, gender, cleanDateOfBirth, age,
                homeAddress, czechCity, czechAddress, czechPhone, ukrainianPhone, email,
                cleanDateOfArrivalCzech, cleanProjectRegistrationDate,
                visaNumber, visaType, insuranceCompany, ukrainianRegion,
                activityStatus, notes,
                wentToUkraine, isInOstrava,
                req.body.latitude || null,
                req.body.longitude || null,
                id
            ]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Client not found' });
        }

        res.json({
            message: 'Client updated successfully',
            client: result.rows[0]
        });

    } catch (error) {
        console.error('Update client error:', error);
        res.status(500).json({ error: 'Failed to update client' });
    }
});

// =================================================================================
// DELETE CLIENT
// =================================================================================

router.delete('/:id', async (req, res) => {
    try {
        const { id } = req.params;

        // Only admins can delete clients
        if (req.user.role !== 'admin') {
            return res.status(403).json({ error: 'Admin access required' });
        }

        const result = await query(
            'DELETE FROM clients WHERE id = $1 RETURNING id',
            [id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Client not found' });
        }

        res.json({ message: 'Client deleted successfully' });

    } catch (error) {
        console.error('Delete client error:', error);
        res.status(500).json({ error: 'Failed to delete client' });
    }
});

// =================================================================================
// BULK DELETE CLIENTS
// =================================================================================

router.delete('/bulk', async (req, res) => {
    try {
        // Only admins can delete clients
        if (req.user.role !== 'admin') {
            return res.status(403).json({ error: 'Admin access required' });
        }

        const { ids } = req.body;

        if (!ids || !Array.isArray(ids) || ids.length === 0) {
            return res.status(400).json({ error: 'No client IDs provided' });
        }

        // Use a transaction for bulk delete
        await query('BEGIN');

        try {
            const result = await query(
                'DELETE FROM clients WHERE id = ANY($1) RETURNING id',
                [ids]
            );

            await query('COMMIT');

            res.json({
                message: `Successfully deleted ${result.rows.length} client(s)`,
                deletedCount: result.rows.length
            });
        } catch (err) {
            await query('ROLLBACK');
            throw err;
        }

    } catch (error) {
        console.error('Bulk delete clients error:', error);
        res.status(500).json({ error: 'Failed to delete clients' });
    }
});


// =================================================================================
// GET FILTER OPTIONS (for dropdowns)
// =================================================================================

router.get('/filters/options', async (req, res) => {
    try {
        // Get unique insurance companies
        const insuranceResult = await query(`
            SELECT DISTINCT insurance_company 
            FROM clients 
            WHERE insurance_company IS NOT NULL 
            ORDER BY insurance_company
        `);

        // Get unique Ukrainian regions
        const regionsResult = await query(`
            SELECT DISTINCT ukrainian_region 
            FROM clients 
            WHERE ukrainian_region IS NOT NULL AND ukrainian_region != ''
            ORDER BY ukrainian_region
        `);

        // Get unique visa types
        const visaTypesResult = await query(`
            SELECT DISTINCT visa_type 
            FROM clients 
            WHERE visa_type IS NOT NULL 
            ORDER BY visa_type
        `);

        // Get unique Czech cities
        const citiesResult = await query(`
            SELECT DISTINCT czech_city 
            FROM clients 
            WHERE czech_city IS NOT NULL AND czech_city != ''
            ORDER BY czech_city
        `);

        // Get age range
        const ageRangeResult = await query(`
            SELECT MIN(age) as min_age, MAX(age) as max_age
            FROM clients
            WHERE age IS NOT NULL
        `);

        res.json({
            insuranceCompanies: insuranceResult.rows.map(r => r.insurance_company),
            ukrainianRegions: regionsResult.rows.map(r => r.ukrainian_region),
            visaTypes: visaTypesResult.rows.map(r => r.visa_type),
            cities: citiesResult.rows.map(r => r.czech_city),
            ageRange: ageRangeResult.rows[0]
        });

    } catch (error) {
        console.error('Get filter options error:', error);
        res.status(500).json({ error: 'Failed to fetch filter options' });
    }
});

// =================================================================================
// GET CLIENT STATISTICS
// =================================================================================

router.get('/stats/summary', async (req, res) => {
    try {
        const stats = await query(`
            SELECT 
                COUNT(*) as total_clients,
                COUNT(CASE WHEN gender = 'Muž' THEN 1 END) as men,
                COUNT(CASE WHEN gender = 'Žena' THEN 1 END) as women,
                COUNT(CASE WHEN gender = 'Nespecifikováno' OR gender IS NULL THEN 1 END) as unspecified,
                COUNT(CASE WHEN activity_status = 'active' THEN 1 END) as active,
                COUNT(CASE WHEN activity_status = 'inactive' THEN 1 END) as inactive
            FROM clients
        `);

        res.json(stats.rows[0]);

    } catch (error) {
        console.error('Get client stats error:', error);
        res.status(500).json({ error: 'Failed to fetch statistics' });
    }
});

export default router;
