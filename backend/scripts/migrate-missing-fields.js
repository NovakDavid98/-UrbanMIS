import pool from '../config/database.js';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../.env') });

async function runMigration() {
    const client = await pool.connect();
    
    try {
        console.log('='.repeat(70));
        console.log('📊 MIGRATION 003: Adding Missing Client Fields');
        console.log('='.repeat(70));
        console.log();
        
        // Read migration SQL
        const sqlPath = path.join(__dirname, '../../database/migrations/003_add_missing_client_fields.sql');
        const sql = fs.readFileSync(sqlPath, 'utf8');
        
        // Execute migration
        console.log('⚙️  Executing migration...');
        await client.query(sql);
        
        console.log('✅ Migration completed successfully!');
        console.log();
        
        // Verify new columns
        const result = await client.query(`
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'clients' 
            AND column_name IN (
                'czech_city', 'education', 'profession_in_ukraine', 
                'hobbies', 'assistance_needed', 'has_work_in_czech',
                'needs_work_assistance', 'wants_to_volunteer', 
                'notes_for_volunteers', 'receives_free_housing', 'internal_notes'
            )
            ORDER BY column_name
        `);
        
        console.log('📋 New columns added:');
        result.rows.forEach((row, i) => {
            console.log(`   ${i+1}. ${row.column_name}`);
        });
        console.log();
        console.log('='.repeat(70));
        
    } catch (error) {
        console.error('❌ Migration failed:', error.message);
        throw error;
    } finally {
        client.release();
        await pool.end();
    }
}

runMigration().catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
});

