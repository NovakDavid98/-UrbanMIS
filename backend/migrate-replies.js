import pool from './config/database.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runMigration() {
    try {
        console.log('🔄 Running migration: Add comment replies support...');
        
        const migrationSQL = fs.readFileSync(
            path.join(__dirname, '../database/migrations/002_add_comment_replies.sql'),
            'utf8'
        );
        
        await pool.query(migrationSQL);
        
        console.log('✅ Migration completed successfully!');
        console.log('   - Added parent_comment_id column');
        console.log('   - Created indexes for performance');
        console.log('');
        console.log('Now you can use threaded replies in comments!');
        
        process.exit(0);
    } catch (error) {
        console.error('❌ Migration failed:', error);
        process.exit(1);
    }
}

runMigration();

