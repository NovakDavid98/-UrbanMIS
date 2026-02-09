import pool from '../config/database.js';
import dotenv from 'dotenv';
dotenv.config({ path: '../.env' });

async function investigateNinaVisits() {
    console.log("=".repeat(80));
    console.log("🔍 INVESTIGATING NINA MOZHARSKA'S VISITS");
    console.log("=".repeat(80));
    console.log();
    
    // 1. Check Nina's client record
    const clientResult = await pool.query(`
        SELECT id, first_name, last_name, cehupo_id, created_at
        FROM clients
        WHERE first_name ILIKE 'Nina' AND last_name ILIKE 'Mozharska'
    `);
    
    if (clientResult.rows.length === 0) {
        console.log("❌ Nina Mozharska NOT FOUND in clients table!");
        await pool.end();
        return;
    }
    
    const nina = clientResult.rows[0];
    console.log("👤 NINA MOZHARSKA - CLIENT RECORD:");
    console.log(`   ID: ${nina.id}`);
    console.log(`   Name: ${nina.first_name} ${nina.last_name}`);
    console.log(`   CeHuPo ID: ${nina.cehupo_id || '(none)'}`);
    console.log(`   Created: ${nina.created_at}`);
    console.log();
    
    // 2. Check her visits
    const visitsResult = await pool.query(`
        SELECT 
            v.id,
            v.visit_date,
            v.time_spent,
            v.notes,
            v.created_at,
            u.username as created_by_username,
            array_agg(vr.name_cs) as reasons
        FROM visits v
        LEFT JOIN users u ON v.created_by = u.id
        LEFT JOIN visit_visit_reasons vvr ON v.id = vvr.visit_id
        LEFT JOIN visit_reasons vr ON vvr.visit_reason_id = vr.id
        WHERE v.client_id = $1
        GROUP BY v.id, v.visit_date, v.time_spent, v.notes, v.created_at, u.username
        ORDER BY v.visit_date DESC
    `, [nina.id]);
    
    console.log("=".repeat(80));
    console.log(`📅 NINA'S VISITS IN DATABASE: ${visitsResult.rows.length}`);
    console.log("=".repeat(80));
    
    if (visitsResult.rows.length === 0) {
        console.log("❌ NO VISITS FOUND for Nina Mozharska!");
    } else {
        console.log();
        console.log("Showing all visits:");
        visitsResult.rows.forEach((visit, i) => {
            console.log(`\n${i+1}. Visit on ${visit.visit_date.toISOString().split('T')[0]}`);
            console.log(`   Notes: ${visit.notes?.substring(0, 80)}...`);
            console.log(`   Time: ${visit.time_spent || '(not set)'}`);
            console.log(`   Reasons: ${visit.reasons.filter(Boolean).join(', ') || '(none)'}`);
            console.log(`   Created by: ${visit.created_by_username || '(unknown)'}`);
            console.log(`   Created at: ${visit.created_at}`);
        });
        
        // Check date range
        const oldestVisit = visitsResult.rows[visitsResult.rows.length - 1];
        const newestVisit = visitsResult.rows[0];
        
        console.log();
        console.log("=".repeat(80));
        console.log("📊 DATE RANGE:");
        console.log("=".repeat(80));
        console.log(`   Oldest visit: ${oldestVisit.visit_date.toISOString().split('T')[0]}`);
        console.log(`   Newest visit: ${newestVisit.visit_date.toISOString().split('T')[0]}`);
        console.log();
        console.log("⚠️  NOTE: The Visit Log page defaults to TODAY's date!");
        console.log("   You need to expand the date range to see older visits.");
    }
    
    // 3. Test the API query that the frontend uses
    console.log();
    console.log("=".repeat(80));
    console.log("🔍 TESTING API QUERY (What the frontend sees):");
    console.log("=".repeat(80));
    
    const today = new Date().toISOString().split('T')[0];
    console.log(`   Date range: ${today} to ${today} (TODAY ONLY)`);
    
    const apiTestResult = await pool.query(`
        SELECT 
            v.id,
            v.visit_date,
            c.first_name as client_first_name,
            c.last_name as client_last_name
        FROM visits v
        JOIN clients c ON v.client_id = c.id
        WHERE v.visit_date BETWEEN $1 AND $2
          AND c.first_name ILIKE 'Nina'
          AND c.last_name ILIKE 'Mozharska'
    `, [today, today]);
    
    console.log(`   Found ${apiTestResult.rows.length} visit(s) for Nina TODAY`);
    
    if (apiTestResult.rows.length === 0) {
        console.log("   ❌ Nina has NO visits today!");
        console.log("   ✅ This is why she doesn't appear in the Visit Log (which defaults to today)");
    }
    
    // 4. Check what date ranges would show her visits
    console.log();
    console.log("=".repeat(80));
    console.log("📅 TO SEE NINA'S VISITS, SET DATE RANGE TO:");
    console.log("=".repeat(80));
    console.log(`   Start Date: ${oldestVisit.visit_date.toISOString().split('T')[0]} (or earlier)`);
    console.log(`   End Date: ${newestVisit.visit_date.toISOString().split('T')[0]} (or later)`);
    console.log();
    console.log("💡 TIP: Use the quick date buttons:");
    console.log("   - 'Tento rok' to see all visits from the past year");
    console.log("   - 'Tento měsíc' to see all visits from the past month");
    
    await pool.end();
}

investigateNinaVisits();

