import pool from '../config/database.js';
import dotenv from 'dotenv';

dotenv.config({ path: '../.env' });

async function checkNinaData() {
    try {
        // Find Nina Mozharska
        const clientResult = await pool.query(`
            SELECT id, first_name, last_name, email, cehupo_id, date_of_birth, 
                   date_of_arrival_czech, project_registration_date, czech_phone, ukrainian_phone
            FROM clients 
            WHERE first_name ILIKE '%Nina%' AND last_name ILIKE '%Mozharska%'
        `);
        
        if (clientResult.rows.length === 0) {
            console.log("❌ Nina Mozharska not found!");
            return;
        }
        
        const nina = clientResult.rows[0];
        console.log("=".repeat(70));
        console.log("👤 NINA MOZHARSKA - DATABASE RECORD");
        console.log("=".repeat(70));
        console.log(`ID: ${nina.id}`);
        console.log(`Name: ${nina.first_name} ${nina.last_name}`);
        console.log(`CeHuPo ID: ${nina.cehupo_id || '(EMPTY)'}`);
        console.log(`Date of Birth: ${nina.date_of_birth || '(EMPTY)'}`);
        console.log(`Email: ${nina.email || '❌ MISSING'}`);
        console.log(`Czech Phone: ${nina.czech_phone || '(EMPTY)'}`);
        console.log(`Ukrainian Phone: ${nina.ukrainian_phone || '(EMPTY)'}`);
        console.log(`Arrival Date: ${nina.date_of_arrival_czech || '❌ MISSING'}`);
        console.log(`Registration Date: ${nina.project_registration_date || '❌ MISSING'}`);
        console.log();
        
        // Check visits
        const visitsResult = await pool.query(`
            SELECT id, visit_date, notes, time_spent, created_at
            FROM visits 
            WHERE client_id = $1
            ORDER BY visit_date DESC
        `, [nina.id]);
        
        console.log("=".repeat(70));
        console.log(`📅 VISITS FOR NINA MOZHARSKA: ${visitsResult.rows.length}`);
        console.log("=".repeat(70));
        
        if (visitsResult.rows.length > 0) {
            console.log("\n✅ Visits ARE in database! Showing first 10:");
            visitsResult.rows.slice(0, 10).forEach((visit, i) => {
                console.log(`  ${i+1}. Date: ${visit.visit_date} | Notes: ${visit.notes?.substring(0, 60) || 'No notes'}...`);
            });
            if (visitsResult.rows.length > 10) {
                console.log(`\n  ... and ${visitsResult.rows.length - 10} more visits`);
            }
        } else {
            console.log("❌ NO VISITS FOUND IN DATABASE!");
        }
        console.log();
        
        await pool.end();
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
}

checkNinaData();

