import pool from '../config/database.js';
import dotenv from 'dotenv';

dotenv.config({ path: '../.env' });

async function removeDuplicates() {
    console.log("=".repeat(80));
    console.log("🗑️  REMOVING DUPLICATE CLIENT RECORDS");
    console.log("=".repeat(80));
    console.log();
    
    const client = await pool.connect();
    
    try {
        // Find duplicate pairs where BOTH have cehupo_id
        // Keep the OLDER one, delete the NEWER one
        const duplicatesQuery = `
            WITH duplicate_pairs AS (
                SELECT 
                    c1.id as keep_id,
                    c1.first_name,
                    c1.last_name,
                    c1.cehupo_id as keep_cehupo_id,
                    c1.created_at as keep_created,
                    c2.id as delete_id,
                    c2.cehupo_id as delete_cehupo_id,
                    c2.created_at as delete_created
                FROM clients c1
                JOIN clients c2 ON (
                    LOWER(TRIM(c1.first_name)) = LOWER(TRIM(c2.first_name))
                    AND LOWER(TRIM(c1.last_name)) = LOWER(TRIM(c2.last_name))
                    AND c1.id != c2.id
                    AND c1.created_at < c2.created_at
                )
                WHERE c1.cehupo_id IS NOT NULL 
                  AND c2.cehupo_id IS NOT NULL
            )
            SELECT * FROM duplicate_pairs
            ORDER BY delete_created DESC
        `;
        
        const duplicates = await client.query(duplicatesQuery);
        
        console.log(`📊 Found ${duplicates.rows.length} duplicate records to remove`);
        console.log();
        
        if (duplicates.rows.length === 0) {
            console.log("✅ No duplicates found!");
            return;
        }
        
        console.log("Starting removal...");
        console.log();
        
        let deleted = 0;
        let errors = 0;
        
        for (const dup of duplicates.rows) {
            const name = `${dup.first_name} ${dup.last_name}`;
            console.log(`[${deleted + errors + 1}/${duplicates.rows.length}] Removing duplicate: ${name}...`);
            
            try {
                await client.query('BEGIN');
                
                // Delete any visits associated with the duplicate
                const deleteVisits = await client.query(`
                    DELETE FROM visits WHERE client_id = $1
                `, [dup.delete_id]);
                
                // Delete the duplicate client
                await client.query(`
                    DELETE FROM clients WHERE id = $1
                `, [dup.delete_id]);
                
                await client.query('COMMIT');
                console.log(`   ✅ Removed (deleted ${deleteVisits.rowCount} associated visits)`);
                deleted++;
                
            } catch (error) {
                await client.query('ROLLBACK');
                console.log(`   ❌ Error: ${error.message}`);
                errors++;
            }
        }
        
        console.log();
        console.log("=".repeat(80));
        console.log("🎉 REMOVAL COMPLETE!");
        console.log("=".repeat(80));
        console.log(`✅ Successfully removed: ${deleted}`);
        console.log(`❌ Errors: ${errors}`);
        console.log("=".repeat(80));
        
    } catch (error) {
        console.error('Fatal error:', error);
    } finally {
        client.release();
        await pool.end();
    }
}

removeDuplicates();

