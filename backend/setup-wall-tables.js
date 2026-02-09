import { query } from './config/database.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function setupWallTables() {
    try {
        console.log('🔧 Setting up wall_posts tables...\n');
        
        // Read the SQL file
        const sqlPath = path.join(__dirname, '../database/wall_posts_schema.sql');
        const sql = fs.readFileSync(sqlPath, 'utf8');
        
        // Execute the SQL
        await query(sql);
        
        console.log('✅ Wall posts tables created successfully!');
        console.log('   - wall_posts');
        console.log('   - wall_post_likes');
        console.log('   - wall_post_comments');
        console.log('   - wall_posts_with_stats (view)');
        
        process.exit(0);
    } catch (error) {
        console.error('❌ Error setting up tables:', error.message);
        console.error(error);
        process.exit(1);
    }
}

setupWallTables();
