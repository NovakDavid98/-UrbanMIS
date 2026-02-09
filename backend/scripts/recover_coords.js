
import fs from 'fs';
import path from 'path';
import axios from 'axios';
import pool from '../config/database.js';

const HEADERS = {
    'User-Agent': 'CentralniMozekCehupo/1.0 (recovery pass tool)'
};

const SLEEP_MS = 1000; // Be gentle during recovery
const BATCH_SIZE = 1;

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));
const LOG_FILE = path.join(process.cwd(), 'recovery.log');

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

function cleanAddress(street, city) {
    if (!street) return city;

    // Pass 1: Original
    const versions = [[street, city].filter(Boolean).join(', ')];

    // Pass 2: Strip parentheses and extra descriptive words
    let v2 = street
        .replace(/\([^)]*\)/g, '') // Strip brackets
        .replace(/hotel|byt|vchod|pokoje|patro|číslo|budova|areál/gi, '') // Strip common noise
        .replace(/\s+/g, ' ')
        .trim();

    // Fix missing space between street name and number: e.g. "Hrdinů278" -> "Hrdinů 278"
    v2 = v2.replace(/([a-zA-Zá-žÁ-Ž])(\d+)/g, '$1 $2');

    if (v2 && v2 !== street) {
        versions.push([v2, city].filter(Boolean).join(', '));
    }

    // Pass 3: Very aggressive - just first word/number combo
    // e.g. "Husova 101/45 Hotel Cazanova" -> "Husova 101/45"
    let v3Match = street.match(/^([^,]+?\d+[\/\d]*)/);
    if (v3Match) {
        let v3 = v3Match[1].trim();
        if (v3 && v3 !== v2 && v3 !== street) {
            versions.push([v3, city].filter(Boolean).join(', '));
        }
    }

    return [...new Set(versions)]; // Return unique versions to try
}

async function tryGeocode(address) {
    try {
        const geoRes = await axios.get('https://nominatim.openstreetmap.org/search', {
            params: { q: address, format: 'json', limit: 1, countrycodes: 'cz' },
            headers: HEADERS,
            timeout: 5000
        });

        if (geoRes.data.length > 0) {
            return {
                lat: geoRes.data[0].lat,
                lon: geoRes.data[0].lon,
                display: geoRes.data[0].display_name
            };
        }
    } catch (err) {
        logToFile(`      ⚠️ API Error for "${address}": ${err.message}`);
    }
    return null;
}

async function processOne(c) {
    const db = await pool.connect();
    try {
        const versions = cleanAddress(c.czech_address, c.czech_city);
        logToFile(`📍 Recovery for Client ${c.id}`);
        logToFile(`   Original: "${c.czech_address}, ${c.czech_city}"`);

        let found = null;
        for (let i = 0; i < versions.length; i++) {
            const v = versions[i];
            logToFile(`   🔍 Try ${i + 1}/${versions.length}: "${v}"`);

            found = await tryGeocode(v);
            if (found) {
                logToFile(`      ✅ Found: ${found.lat}, ${found.lon}`);
                break;
            }
            // Be nice to Nominatim
            if (i < versions.length - 1) await sleep(500);
        }

        if (found) {
            await db.query('UPDATE clients SET latitude = $1, longitude = $2 WHERE id = $3', [found.lat, found.lon, c.id]);
        } else {
            logToFile(`   ❌ Still no result after ${versions.length} attempts.`);
            // No update here to let it stay 0,0 (or we could mark it as "permanently failed" 
            // but keeping it 0 lets us try future logic improvements)
        }

    } catch (e) {
        logToFile(`   CRITICAL ERROR: ${e.message}`);
    } finally {
        db.release();
    }
}

async function recover() {
    logToFile('🚀 Starting Smart Recovery Pass...');

    const res = await pool.query('SELECT id, czech_address, czech_city FROM clients WHERE latitude = 0 AND (czech_address IS NOT NULL OR czech_city IS NOT NULL)');
    const failedOnes = res.rows;
    logToFile(`Found ${failedOnes.length} candidates for recovery.`);

    for (const c of failedOnes) {
        await processOne(c);
        await sleep(SLEEP_MS);
    }

    logToFile('🏁 Recovery pass complete.');
    await pool.end();
}

recover();
