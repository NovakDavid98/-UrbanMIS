import pool from '../config/database.js';
import dotenv from 'dotenv';
dotenv.config({ path: '../.env' });

async function assignNinaCehupoId() {
    const result = await pool.query(`
        UPDATE clients 
        SET cehupo_id = 1937
        WHERE first_name ILIKE 'Nina' 
          AND last_name ILIKE 'Mozharska'
          AND cehupo_id IS NULL
        RETURNING *
    `);
    
    if (result.rowCount > 0) {
        console.log(`✅ Updated Nina Mozharska with CeHuPo ID: ${result.rows[0]?.cehupo_id}`);
    } else {
        console.log('⚠️  No update needed (already has cehupo_id or not found)');
    }
    
    await pool.end();
}

assignNinaCehupoId();

