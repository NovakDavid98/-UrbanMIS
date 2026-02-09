import pool from '../config/database.js';
import dotenv from 'dotenv';

dotenv.config({ path: '../.env' });

async function findAllNina() {
    try {
        const result = await pool.query(`
            SELECT id, first_name, last_name, cehupo_id, email, 
                   date_of_arrival_czech, project_registration_date,
                   created_at,
                   (SELECT COUNT(*) FROM visits WHERE client_id = clients.id) as visit_count
            FROM clients 
            WHERE (first_name ILIKE '%Nina%' AND last_name ILIKE '%Mozharska%')
               OR (first_name ILIKE '%Mozharska%' AND last_name ILIKE '%Nina%')
            ORDER BY created_at
        `);
        
        console.log("=".repeat(70));
        console.log(`🔍 FOUND ${result.rows.length} NINA MOZHARSKA RECORD(S)`);
        console.log("=".repeat(70));
        console.log();
        
        result.rows.forEach((client, i) => {
            console.log(`Record ${i+1}:`);
            console.log(`  ID: ${client.id}`);
            console.log(`  Name: ${client.first_name} ${client.last_name}`);
            console.log(`  CeHuPo ID: ${client.cehupo_id || '(none)'}`);
            console.log(`  Email: ${client.email || '(none)'}`);
            console.log(`  Arrival Date: ${client.date_of_arrival_czech || '(none)'}`);
            console.log(`  Registration: ${client.project_registration_date || '(none)'}`);
            console.log(`  Visits: ${client.visit_count}`);
            console.log(`  Created: ${client.created_at}`);
            console.log();
        });
        
        await pool.end();
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
}

findAllNina();

