import { query } from './config/database.js';

async function checkTables() {
    try {
        console.log('🔍 Checking database tables...\n');
        
        // Check if wall_posts tables exist
        const result = await query(`
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name IN ('wall_posts', 'wall_post_likes', 'wall_post_comments')
            ORDER BY table_name
        `);
        
        console.log('Wall-related tables found:');
        if (result.rows.length === 0) {
            console.log('❌ NO wall_posts tables found!');
            console.log('\n🔧 You need to run: psql -U postgres -d centralnimozek_cehupo -f database/wall_posts_schema.sql');
        } else {
            result.rows.forEach(row => {
                console.log(`✅ ${row.table_name}`);
            });
        }
        
        // List all tables
        const allTables = await query(`
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public' 
            ORDER BY table_name
        `);
        
        console.log(`\n📊 Total tables in database: ${allTables.rows.length}`);
        console.log('All tables:', allTables.rows.map(r => r.table_name).join(', '));
        
        process.exit(0);
    } catch (error) {
        console.error('❌ Error:', error.message);
        process.exit(1);
    }
}

checkTables();
