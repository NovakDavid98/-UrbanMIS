import pool from '../config/database.js';
import dotenv from 'dotenv';
dotenv.config({ path: '../.env' });

async function checkNina() {
    const result = await pool.query(`
        SELECT * FROM clients 
        WHERE first_name ILIKE 'Nina' AND last_name ILIKE 'Mozharska'
    `);
    
    if (result.rows.length === 0) {
        console.log("❌ Nina Mozharska not found!");
        await pool.end();
        return;
    }
    
    const nina = result.rows[0];
    console.log("=".repeat(70));
    console.log("NINA MOZHARSKA - ALL FIELDS");
    console.log("=".repeat(70));
    
    for (const [key, value] of Object.entries(nina)) {
        const status = value ? '✅' : '❌';
        const display = value || '(empty)';
        console.log(`${status} ${key.padEnd(30)}: ${display}`);
    }
    
    await pool.end();
}

checkNina();

