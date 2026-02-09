import express from 'express';
import pool from '../config/database.js'; // Fixed import path to match project structure
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = express.Router();

// Path to scraped addresses JSON file
const SCRAPED_ADDRESSES_PATH = path.join(__dirname, '..', 'data', 'scraped_addresses.json');

// Valid standard visa types to exclude from "outliers"
const STANDARD_TYPES = [
    'Dočasná ochrana',
    'Mult',
    'Trvalý pobyt',
    'Strpění',
    'Dlouhodobý pobyt'
];

// GET /api/data-repair/visas
// Returns list of clients with non-standard visa types
router.get('/visas', async (req, res) => {
    try {
        // We want to find visa_types that are NOT in the standard list
        // AND are not null
        const query = `
      SELECT id, first_name, last_name, visa_type 
      FROM clients 
      WHERE visa_type IS NOT NULL 
      AND visa_type != '' 
      AND visa_type NOT IN ($1, $2, $3, $4, $5)
      ORDER BY visa_type, last_name
    `;

        const result = await pool.query(query, STANDARD_TYPES);

        // Group by visa_type for the summary view
        const summary = {};
        result.rows.forEach(row => {
            if (!summary[row.visa_type]) {
                summary[row.visa_type] = 0;
            }
            summary[row.visa_type]++;
        });

        const summaryList = Object.entries(summary).map(([type, count]) => ({ type, count }));
        // Sort by count desc
        summaryList.sort((a, b) => b.count - a.count);

        res.json({
            outliers: result.rows,
            summary: summaryList,
            standardTypes: STANDARD_TYPES
        });
    } catch (err) {
        console.error('Error fetching visa outliers:', err.message);
        res.status(500).json({ error: 'Server error fetching data' });
    }
});

// POST /api/data-repair/visas/replace
// Bulk replace a specific visa string
router.post('/visas/replace', async (req, res) => {
    const { targetType, newType } = req.body;

    if (!targetType || !newType) {
        return res.status(400).json({ error: 'Missing targetType or newType' });
    }

    try {
        const query = `
      UPDATE clients 
      SET visa_type = $1 
      WHERE visa_type = $2
      RETURNING id
    `;
        const result = await pool.query(query, [newType, targetType]);

        res.json({
            message: 'Update successful',
            updatedCount: result.rowCount
        });
    } catch (err) {
        console.error('Error replacing visa type:', err.message);
        res.status(500).json({ error: 'Server error updating data' });
    }
});

// PUT /api/data-repair/visas/:id
// Update single client visa
router.put('/visas/:id', async (req, res) => {
    const { id } = req.params;
    const { visa_type } = req.body;

    try {
        const query = `
      UPDATE clients 
      SET visa_type = $1 
      WHERE id = $2
    `;
        await pool.query(query, [visa_type, id]);
        res.json({ message: 'Client updated' });
    } catch (err) {
        console.error('Error updating client visa:', err.message);
        res.status(500).json({ error: 'Server error' });
    }
});

// =====================================================
// ADDRESS REPAIR ENDPOINTS
// =====================================================

// Helper function to load scraped addresses
function loadScrapedAddresses() {
    try {
        if (!fs.existsSync(SCRAPED_ADDRESSES_PATH)) {
            return { customers: [], scraped_at: null, total_count: 0 };
        }
        const data = fs.readFileSync(SCRAPED_ADDRESSES_PATH, 'utf-8');
        return JSON.parse(data);
    } catch (err) {
        console.error('Error loading scraped addresses:', err.message);
        return { customers: [], scraped_at: null, total_count: 0 };
    }
}

// GET /api/data-repair/addresses
// Returns scraped addresses with matching local client data
router.get('/addresses', async (req, res) => {
    try {
        const { search, page = 1, limit = 50, filter = 'all' } = req.query;
        
        // Load scraped addresses
        const scrapedData = loadScrapedAddresses();
        
        // Get all clients with cehupo_id from database
        const clientsQuery = `
            SELECT id, cehupo_id, first_name, last_name, czech_address, czech_city
            FROM clients
            WHERE cehupo_id IS NOT NULL
            ORDER BY last_name, first_name
        `;
        const clientsResult = await pool.query(clientsQuery);
        
        // Create lookup map by cehupo_id
        const clientsMap = {};
        clientsResult.rows.forEach(client => {
            clientsMap[client.cehupo_id] = client;
        });
        
        // Merge scraped data with local data
        let mergedData = scrapedData.customers.map(scraped => {
            const localClient = clientsMap[scraped.cehupo_id];
            const localAddress = localClient ? 
                [localClient.czech_address, localClient.czech_city].filter(Boolean).join(', ').trim() : '';
            
            return {
                cehupo_id: scraped.cehupo_id,
                scraped_name: scraped.full_name,
                scraped_first_name: scraped.first_name,
                scraped_last_name: scraped.last_name,
                scraped_street: scraped.street,
                scraped_city: scraped.city,
                scraped_address: scraped.full_address,
                local_client_id: localClient?.id || null,
                local_first_name: localClient?.first_name || null,
                local_last_name: localClient?.last_name || null,
                local_address: localAddress,
                local_street: localClient?.czech_address || null,
                local_city: localClient?.czech_city || null,
                has_match: !!localClient,
                address_differs: localClient && scraped.full_address !== localAddress
            };
        });
        
        // Apply filters
        if (filter === 'matched') {
            mergedData = mergedData.filter(item => item.has_match);
        } else if (filter === 'unmatched') {
            mergedData = mergedData.filter(item => !item.has_match);
        } else if (filter === 'different') {
            mergedData = mergedData.filter(item => item.has_match && item.address_differs);
        }
        
        // Apply search filter
        if (search) {
            const searchLower = search.toLowerCase();
            mergedData = mergedData.filter(item => 
                item.scraped_name?.toLowerCase().includes(searchLower) ||
                item.scraped_address?.toLowerCase().includes(searchLower) ||
                item.local_first_name?.toLowerCase().includes(searchLower) ||
                item.local_last_name?.toLowerCase().includes(searchLower) ||
                item.local_address?.toLowerCase().includes(searchLower)
            );
        }
        
        // Calculate stats
        const stats = {
            total_scraped: scrapedData.total_count,
            total_matched: mergedData.filter(i => i.has_match).length,
            total_different: mergedData.filter(i => i.has_match && i.address_differs).length,
            total_unmatched: mergedData.filter(i => !i.has_match).length,
            scraped_at: scrapedData.scraped_at
        };
        
        // Paginate
        const startIndex = (page - 1) * limit;
        const endIndex = startIndex + parseInt(limit);
        const paginatedData = mergedData.slice(startIndex, endIndex);
        
        res.json({
            addresses: paginatedData,
            stats,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total: mergedData.length,
                totalPages: Math.ceil(mergedData.length / limit)
            }
        });
    } catch (err) {
        console.error('Error fetching addresses:', err.message);
        res.status(500).json({ error: 'Server error fetching addresses' });
    }
});

// POST /api/data-repair/addresses/apply
// Bulk apply scraped addresses to selected clients
router.post('/addresses/apply', async (req, res) => {
    const { updates } = req.body;
    
    if (!updates || !Array.isArray(updates) || updates.length === 0) {
        return res.status(400).json({ error: 'No updates provided' });
    }
    
    try {
        let successCount = 0;
        let errorCount = 0;
        const errors = [];
        
        for (const update of updates) {
            try {
                const { client_id, street, city } = update;
                
                if (!client_id) {
                    errors.push({ update, error: 'Missing client_id' });
                    errorCount++;
                    continue;
                }
                
                const query = `
                    UPDATE clients 
                    SET czech_address = $1, czech_city = $2, updated_at = NOW()
                    WHERE id = $3
                    RETURNING id
                `;
                const result = await pool.query(query, [street || '', city || '', client_id]);
                
                if (result.rowCount > 0) {
                    successCount++;
                } else {
                    errors.push({ update, error: 'Client not found' });
                    errorCount++;
                }
            } catch (err) {
                errors.push({ update, error: err.message });
                errorCount++;
            }
        }
        
        res.json({
            message: `Applied ${successCount} address updates`,
            successCount,
            errorCount,
            errors: errors.length > 0 ? errors : undefined
        });
    } catch (err) {
        console.error('Error applying addresses:', err.message);
        res.status(500).json({ error: 'Server error applying addresses' });
    }
});

// PUT /api/data-repair/addresses/:id
// Update single client address
router.put('/addresses/:id', async (req, res) => {
    const { id } = req.params;
    const { street, city } = req.body;
    
    try {
        const query = `
            UPDATE clients 
            SET czech_address = $1, czech_city = $2, updated_at = NOW()
            WHERE id = $3
            RETURNING id, first_name, last_name, czech_address, czech_city
        `;
        const result = await pool.query(query, [street || '', city || '', id]);
        
        if (result.rowCount === 0) {
            return res.status(404).json({ error: 'Client not found' });
        }
        
        res.json({ 
            message: 'Address updated',
            client: result.rows[0]
        });
    } catch (err) {
        console.error('Error updating address:', err.message);
        res.status(500).json({ error: 'Server error' });
    }
});

// GET /api/data-repair/addresses/stats
// Get statistics about address data
router.get('/addresses/stats', async (req, res) => {
    try {
        const scrapedData = loadScrapedAddresses();
        
        // Get client counts
        const statsQuery = `
            SELECT 
                COUNT(*) as total_clients,
                COUNT(cehupo_id) as with_cehupo_id,
                COUNT(czech_address) as with_address,
                COUNT(czech_city) as with_city
            FROM clients
        `;
        const statsResult = await pool.query(statsQuery);
        
        res.json({
            scraped: {
                total: scrapedData.total_count,
                scraped_at: scrapedData.scraped_at
            },
            database: statsResult.rows[0]
        });
    } catch (err) {
        console.error('Error fetching stats:', err.message);
        res.status(500).json({ error: 'Server error' });
    }
});

export default router;
