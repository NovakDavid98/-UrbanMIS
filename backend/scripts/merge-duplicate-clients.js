import pool from '../config/database.js';
import dotenv from 'dotenv';

dotenv.config({ path: '../.env' });

async function mergeDuplicates() {
    console.log("=".repeat(80));
    console.log("🔄 MERGING DUPLICATE CLIENT RECORDS");
    console.log("=".repeat(80));
    console.log();
    
    const client = await pool.connect();
    
    try {
        // Find all duplicates (same name, one with cehupo_id, one without)
        const duplicatesQuery = `
            WITH client_pairs AS (
                SELECT 
                    c1.id as old_id,
                    c1.first_name,
                    c1.last_name,
                    c1.created_at as old_created,
                    c2.id as new_id,
                    c2.cehupo_id,
                    c2.email,
                    c2.date_of_arrival_czech,
                    c2.project_registration_date,
                    c2.created_at as new_created
                FROM clients c1
                JOIN clients c2 ON (
                    LOWER(TRIM(c1.first_name)) = LOWER(TRIM(c2.first_name))
                    AND LOWER(TRIM(c1.last_name)) = LOWER(TRIM(c2.last_name))
                    AND c1.id != c2.id
                )
                WHERE c1.cehupo_id IS NULL
                  AND c2.cehupo_id IS NOT NULL
                  AND c1.created_at < c2.created_at
            )
            SELECT * FROM client_pairs
            ORDER BY new_created DESC
        `;
        
        const duplicates = await client.query(duplicatesQuery);
        
        console.log(`📊 Found ${duplicates.rows.length} duplicate client pairs`);
        console.log();
        
        if (duplicates.rows.length === 0) {
            console.log("✅ No duplicates to merge!");
            return;
        }
        
        console.log("Starting merge process...");
        console.log();
        
        let merged = 0;
        let errors = 0;
        
        for (const dup of duplicates.rows) {
            const name = `${dup.first_name} ${dup.last_name}`;
            console.log(`[${merged + errors + 1}/${duplicates.rows.length}] Merging ${name}...`);
            
            try {
                await client.query('BEGIN');
                
                // 1. Update old client with data from new client
                await client.query(`
                    UPDATE clients
                    SET cehupo_id = $1,
                        email = COALESCE($2, email),
                        date_of_arrival_czech = COALESCE($3, date_of_arrival_czech),
                        project_registration_date = COALESCE($4, project_registration_date),
                        updated_at = NOW()
                    WHERE id = $5
                `, [
                    dup.cehupo_id,
                    dup.email,
                    dup.date_of_arrival_czech,
                    dup.project_registration_date,
                    dup.old_id
                ]);
                
                // 2. Move any visits from new client to old client (if they don't already exist)
                await client.query(`
                    UPDATE visits
                    SET client_id = $1
                    WHERE client_id = $2
                      AND NOT EXISTS (
                          SELECT 1 FROM visits v2
                          WHERE v2.client_id = $1
                            AND v2.visit_date = visits.visit_date
                      )
                `, [dup.old_id, dup.new_id]);
                
                // 3. Delete duplicate visits (same client_id and visit_date)
                await client.query(`
                    DELETE FROM visits v1
                    WHERE client_id = $1
                      AND EXISTS (
                          SELECT 1 FROM visits v2
                          WHERE v2.client_id = $1
                            AND v2.visit_date = v1.visit_date
                            AND v2.id < v1.id
                      )
                `, [dup.old_id]);
                
                // 4. Delete the new duplicate client
                await client.query(`
                    DELETE FROM clients WHERE id = $1
                `, [dup.new_id]);
                
                await client.query('COMMIT');
                console.log(`   ✅ Merged successfully`);
                merged++;
                
            } catch (error) {
                await client.query('ROLLBACK');
                console.log(`   ❌ Error: ${error.message}`);
                errors++;
            }
        }
        
        console.log();
        console.log("=".repeat(80));
        console.log("🎉 MERGE COMPLETE!");
        console.log("=".repeat(80));
        console.log(`✅ Successfully merged: ${merged}`);
        console.log(`❌ Errors: ${errors}`);
        console.log("=".repeat(80));
        
    } catch (error) {
        console.error('Fatal error:', error);
    } finally {
        client.release();
        await pool.end();
    }
}

mergeDuplicates();

