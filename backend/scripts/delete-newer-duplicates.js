import pool from '../config/database.js';
import dotenv from 'dotenv';

dotenv.config({ path: '../.env' });

async function deleteNewerDuplicates() {
    console.log("=".repeat(80));
    console.log("🗑️  DELETING NEWER DUPLICATE RECORDS");
    console.log("   (Keeping older records with visits)");
    console.log("=".repeat(80));
    console.log();
    
    const client = await pool.connect();
    
    try {
        // Find all duplicate names (regardless of cehupo_id)
        // Delete the NEWER one, keep the OLDER one
        const deleteSql = `
            WITH duplicates AS (
                SELECT 
                    id,
                    first_name,
                    last_name,
                    created_at,
                    ROW_NUMBER() OVER (
                        PARTITION BY LOWER(TRIM(first_name)), LOWER(TRIM(last_name))
                        ORDER BY created_at ASC
                    ) as rn
                FROM clients
            )
            DELETE FROM clients
            WHERE id IN (
                SELECT id FROM duplicates WHERE rn > 1
            )
            RETURNING first_name, last_name;
        `;
        
        const result = await client.query(deleteSql);
        
        console.log(`✅ Deleted ${result.rowCount} duplicate client records`);
        console.log();
        
        if (result.rowCount > 0) {
            console.log("Deleted clients:");
            result.rows.slice(0, 20).forEach((row, i) => {
                console.log(`  ${i+1}. ${row.first_name} ${row.last_name}`);
            });
            if (result.rowCount > 20) {
                console.log(`  ... and ${result.rowCount - 20} more`);
            }
        }
        
        console.log();
        console.log("=".repeat(80));
        console.log("🎉 CLEANUP COMPLETE!");
        console.log("=".repeat(80));
        
    } catch (error) {
        console.error('❌ Error:', error.message);
    } finally {
        client.release();
        await pool.end();
    }
}

deleteNewerDuplicates();

