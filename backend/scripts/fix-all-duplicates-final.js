import pool from '../config/database.js';
import dotenv from 'dotenv';

dotenv.config({ path: '../.env' });

async function fixAllDuplicates() {
    console.log("=".repeat(80));
    console.log("🔧 FINAL DUPLICATE FIX - COMPREHENSIVE SOLUTION");
    console.log("=".repeat(80));
    console.log();
    
    const client = await pool.connect();
    
    try {
        // Find ALL duplicate pairs (same name, different IDs)
        // Strategy: Keep the OLDER record, merge data from newer into it, delete newer
        const duplicatesQuery = `
            WITH duplicate_pairs AS (
                SELECT 
                    c1.id as old_id,
                    c1.first_name,
                    c1.last_name,
                    c1.cehupo_id as old_cehupo_id,
                    c1.email as old_email,
                    c1.date_of_arrival_czech as old_arrival,
                    c1.project_registration_date as old_registration,
                    c1.created_at as old_created,
                    (SELECT COUNT(*) FROM visits WHERE client_id = c1.id) as old_visits,
                    c2.id as new_id,
                    c2.cehupo_id as new_cehupo_id,
                    c2.email as new_email,
                    c2.date_of_arrival_czech as new_arrival,
                    c2.project_registration_date as new_registration,
                    c2.created_at as new_created,
                    (SELECT COUNT(*) FROM visits WHERE client_id = c2.id) as new_visits
                FROM clients c1
                JOIN clients c2 ON (
                    LOWER(TRIM(c1.first_name)) = LOWER(TRIM(c2.first_name))
                    AND LOWER(TRIM(c1.last_name)) = LOWER(TRIM(c2.last_name))
                    AND c1.id != c2.id
                    AND c1.created_at < c2.created_at
                )
            )
            SELECT * FROM duplicate_pairs
            ORDER BY old_created
        `;
        
        const duplicates = await client.query(duplicatesQuery);
        
        console.log(`📊 Found ${duplicates.rows.length} duplicate pairs to fix`);
        console.log();
        
        if (duplicates.rows.length === 0) {
            console.log("✅ No duplicates found!");
            return;
        }
        
        console.log("Starting comprehensive merge...");
        console.log();
        
        let fixed = 0;
        let errors = 0;
        
        for (const dup of duplicates.rows) {
            const name = `${dup.first_name} ${dup.last_name}`;
            console.log(`[${fixed + errors + 1}/${duplicates.rows.length}] Fixing ${name}...`);
            console.log(`   OLD: ${dup.old_id.substring(0,8)}... | CeHuPo: ${dup.old_cehupo_id || '(none)'} | Visits: ${dup.old_visits}`);
            console.log(`   NEW: ${dup.new_id.substring(0,8)}... | CeHuPo: ${dup.new_cehupo_id || '(none)'} | Visits: ${dup.new_visits}`);
            
            try {
                await client.query('BEGIN');
                
                // 1. Update OLD record with any missing data from NEW record
                await client.query(`
                    UPDATE clients
                    SET cehupo_id = COALESCE(cehupo_id, $1),
                        email = COALESCE(email, $2),
                        date_of_arrival_czech = COALESCE(date_of_arrival_czech, $3),
                        project_registration_date = COALESCE(project_registration_date, $4),
                        updated_at = NOW()
                    WHERE id = $5
                `, [
                    dup.new_cehupo_id,
                    dup.new_email,
                    dup.new_arrival,
                    dup.new_registration,
                    dup.old_id
                ]);
                
                // 2. Move visits from NEW to OLD (only non-duplicates)
                if (dup.new_visits > 0) {
                    await client.query(`
                        UPDATE visits
                        SET client_id = $1
                        WHERE client_id = $2
                          AND NOT EXISTS (
                              SELECT 1 FROM visits v2
                              WHERE v2.client_id = $1
                                AND v2.visit_date = visits.visit_date
                                AND v2.notes = visits.notes
                          )
                    `, [dup.old_id, dup.new_id]);
                }
                
                // 3. Delete remaining duplicate visits on NEW record
                await client.query(`
                    DELETE FROM visits WHERE client_id = $1
                `, [dup.new_id]);
                
                // 4. Delete the NEW duplicate client record
                await client.query(`
                    DELETE FROM clients WHERE id = $1
                `, [dup.new_id]);
                
                await client.query('COMMIT');
                console.log(`   ✅ Fixed! Consolidated into older record`);
                fixed++;
                
            } catch (error) {
                await client.query('ROLLBACK');
                console.log(`   ❌ Error: ${error.message}`);
                errors++;
            }
        }
        
        console.log();
        console.log("=".repeat(80));
        console.log("🎉 COMPREHENSIVE FIX COMPLETE!");
        console.log("=".repeat(80));
        console.log(`✅ Successfully fixed: ${fixed}`);
        console.log(`❌ Errors: ${errors}`);
        console.log("=".repeat(80));
        
    } catch (error) {
        console.error('Fatal error:', error);
    } finally {
        client.release();
        await pool.end();
    }
}

fixAllDuplicates();

