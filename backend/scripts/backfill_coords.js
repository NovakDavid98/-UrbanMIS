
import fs from 'fs';
import path from 'path';
import axios from 'axios';
import pool from '../config/database.js';

const HEADERS = {
    'User-Agent': 'CentralniMozekCehupo/1.0 (internal migration tool)'
};

const SLEEP_MS = 800; // Fast speed
const BATCH_SIZE = 1;

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const LOG_FILE = path.join(process.cwd(), 'backfill.log');

function logToFile(msg) {
    const timestamp = new Date().toISOString();
    const logLine = `[${timestamp}] ${msg}\n`;
    try {
        fs.appendFileSync(LOG_FILE, logLine);
    } catch (e) {
        console.error('Failed to write to log:', e);
    }
    console.log(msg);
}

async function getNextBatch(client) {
    const res = await client.query(`
        SELECT id, czech_address, czech_city
        FROM clients 
        WHERE latitude IS NULL 
        AND (czech_address IS NOT NULL OR czech_city IS NOT NULL)
        ORDER BY id DESC
        LIMIT $1
    `, [BATCH_SIZE]);
    return res.rows;
}

async function processOne(c) {
    const db = await pool.connect();
    try {
        const address = [c.czech_address, c.czech_city].filter(Boolean).join(', ');

        if (!address) {
            logToFile(`⏭️  Skipping Client ${c.id} (empty address)`);
            await db.query('UPDATE clients SET latitude = 0, longitude = 0 WHERE id = $1', [c.id]);
            return;
        }

        logToFile(`📍 Processing Client ${c.id}: ${address}`);

        let lat = null;
        let lon = null;

        try {
            const geoRes = await axios.get('https://nominatim.openstreetmap.org/search', {
                params: { q: address, format: 'json', limit: 1, countrycodes: 'cz' },
                headers: HEADERS,
                timeout: 5000
            });

            if (geoRes.data.length > 0) {
                lat = geoRes.data[0].lat;
                lon = geoRes.data[0].lon;
                logToFile(`   ✅ Found: ${lat}, ${lon}`);
            } else {
                logToFile(`   ❌ No result`);
            }
        } catch (apiErr) {
            logToFile(`   ⚠️  API Error: ${apiErr.message}`);
            // Sleep a bit longer on error
            await sleep(2000);
        }

        // ALWAYS update to prevent infinite loop
        if (lat && lon) {
            await db.query('UPDATE clients SET latitude = $1, longitude = $2 WHERE id = $3', [lat, lon, c.id]);
        } else {
            logToFile(`   ⏭️  Marking as failed (0,0) to advance queue.`);
            await db.query('UPDATE clients SET latitude = 0, longitude = 0 WHERE id = $1', [c.id]);
        }

    } catch (e) {
        logToFile(`CRITICAL DB ERROR: ${e.message}`);
    } finally {
        db.release();
    }
}

async function backfill() {
    logToFile('🐢 Starting Robust Backfill...');

    // Check pending count
    const countRes = await pool.query('SELECT count(*) FROM clients WHERE latitude IS NULL AND (czech_address IS NOT NULL OR czech_city IS NOT NULL)');
    logToFile(`Total pending: ${countRes.rows[0].count}`);

    while (true) {
        // 1. Get One ID
        const db = await pool.connect();
        let candidates = [];
        try {
            candidates = await getNextBatch(db);
        } finally {
            db.release();
        }

        if (candidates.length === 0) {
            logToFile('🎉 No more candidates. Done.');
            break;
        }

        // 2. Process it
        await processOne(candidates[0]);

        // 3. Sleep
        await sleep(SLEEP_MS);
    }

    await pool.end();
}

backfill();
