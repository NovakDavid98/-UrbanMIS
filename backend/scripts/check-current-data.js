import pool from '../config/database.js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '../.env' });

async function checkCurrentData() {
    try {
        // Check if cehupo_id column exists
        const columnCheck = await pool.query(`
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'clients' AND column_name = 'cehupo_id'
        `);
        
        const hasCrehupoId = columnCheck.rows.length > 0;
        
        // Get total clients
        const clientCount = await pool.query('SELECT COUNT(*) FROM clients');
        
        // Get latest visit date
        const latestVisit = await pool.query(`
            SELECT MAX(visit_date) as latest_visit, MIN(visit_date) as earliest_visit, COUNT(*) as visit_count
            FROM visits
        `);
        
        console.log('='.repeat(70));
        console.log('📊 CURRENT DATABASE STATUS:');
        console.log('='.repeat(70));
        console.log(`Total Clients: ${clientCount.rows[0].count}`);
        console.log(`Has CeHuPo ID column: ${hasCrehupoId ? '✅ YES' : '❌ NO (will be added)'}`);
        
        if (hasCrehupoId) {
            const cehupoClients = await pool.query(`
                SELECT COUNT(*) as count 
                FROM clients 
                WHERE cehupo_id IS NOT NULL
            `);
            console.log(`Clients with CeHuPo ID: ${cehupoClients.rows[0].count}`);
        }
        
        console.log(`\nVisits:`);
        console.log(`  Total Visits: ${latestVisit.rows[0].visit_count}`);
        console.log(`  Earliest Visit: ${latestVisit.rows[0].earliest_visit}`);
        console.log(`  Latest Visit:   ${latestVisit.rows[0].latest_visit}`);
        
        // Get sample of recent clients from DB
        const recentClients = await pool.query(`
            SELECT first_name, last_name, created_at
            FROM clients 
            ORDER BY created_at DESC 
            LIMIT 10
        `);
        
        console.log('\n' + '='.repeat(70));
        console.log('🔍 10 MOST RECENT CLIENTS IN DB:');
        console.log('='.repeat(70));
        recentClients.rows.forEach((client, i) => {
            console.log(`${i+1}. ${client.first_name} ${client.last_name} (Added: ${client.created_at})`);
        });
        console.log('='.repeat(70));
        
        await pool.end();
    } catch (error) {
        console.error('❌ Error:', error);
        process.exit(1);
    }
}

checkCurrentData();

