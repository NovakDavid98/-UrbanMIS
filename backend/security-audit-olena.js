import dotenv from 'dotenv';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import pkg from 'pg';
const { Pool } = pkg;

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
dotenv.config({ path: join(__dirname, '.env') });

const pool = new Pool({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
});

async function securityAudit() {
    try {
        console.log('='.repeat(80));
        console.log('SECURITY AUDIT REPORT - OLENA BEVZ');
        console.log('Generated:', new Date().toISOString());
        console.log('='.repeat(80));
        console.log();

        // 1. Find Olena Bevz user
        console.log('1. USER INFORMATION');
        console.log('-'.repeat(80));
        const userResult = await pool.query(`
            SELECT id, username, first_name, last_name, email, role, is_active, 
                   created_at, last_login, updated_at
            FROM users 
            WHERE first_name ILIKE '%Olena%' 
               OR last_name ILIKE '%Bevz%'
               OR username ILIKE '%bevz%'
               OR username ILIKE '%olena%'
        `);

        if (userResult.rows.length === 0) {
            console.log('❌ User not found matching "Olena Bevz"');
            await pool.end();
            return;
        }

        const user = userResult.rows[0];
        console.log('User ID:', user.id);
        console.log('Username:', user.username);
        console.log('Full Name:', user.first_name, user.last_name);
        console.log('Email:', user.email);
        console.log('Role:', user.role);
        console.log('Active:', user.is_active);
        console.log('Created:', user.created_at);
        console.log('Last Login:', user.last_login);
        console.log();

        // 2. Check if ip_tracking table exists and get IP history
        console.log('2. IP ADDRESS TRACKING HISTORY');
        console.log('-'.repeat(80));

        const tableCheck = await pool.query(`
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_name = 'ip_tracking'
            );
        `);

        if (tableCheck.rows[0].exists) {
            const ipResult = await pool.query(`
                SELECT 
                    ip_address,
                    COUNT(*) as access_count,
                    MIN(first_seen) as first_seen,
                    MAX(last_seen) as last_seen,
                    country,
                    city,
                    user_agent
                FROM ip_tracking
                WHERE user_id = $1
                GROUP BY ip_address, country, city, user_agent
                ORDER BY last_seen DESC
                LIMIT 50
            `, [user.id]);

            if (ipResult.rows.length > 0) {
                console.log(`Found ${ipResult.rows.length} unique IP addresses:`);
                console.log();
                ipResult.rows.forEach((ip, idx) => {
                    console.log(`IP ${idx + 1}:`);
                    console.log('  Address:', ip.ip_address);
                    console.log('  Country:', ip.country || 'Unknown');
                    console.log('  City:', ip.city || 'Unknown');
                    console.log('  Access Count:', ip.access_count);
                    console.log('  First Seen:', ip.first_seen);
                    console.log('  Last Seen:', ip.last_seen);
                    console.log('  User Agent:', ip.user_agent || 'Unknown');
                    console.log();
                });
            } else {
                console.log('No IP tracking data found');
            }
        } else {
            console.log('⚠️  ip_tracking table does not exist');
        }
        console.log();

        // 3. Check user_presence for online activity patterns
        console.log('3. ONLINE PRESENCE PATTERNS');
        console.log('-'.repeat(80));
        const presenceCheck = await pool.query(`
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_name = 'user_presence'
            );
        `);

        if (presenceCheck.rows[0].exists) {
            const presenceResult = await pool.query(`
                SELECT is_online, socket_id, last_seen, updated_at
                FROM user_presence
                WHERE user_id = $1
            `, [user.id]);

            if (presenceResult.rows.length > 0) {
                const presence = presenceResult.rows[0];
                console.log('Current Online:', presence.is_online ? '🟢 YES' : '🔴 NO');
                console.log('Last Seen:', presence.last_seen);
                console.log('Last Update:', presence.updated_at);
                console.log('Socket ID:', presence.socket_id || 'None');
            } else {
                console.log('No presence data found');
            }
        } else {
            console.log('⚠️  user_presence table does not exist');
        }
        console.log();

        // 4. Check for chat activity
        console.log('4. CHAT ACTIVITY ANALYSIS');
        console.log('-'.repeat(80));
        const messagesCheck = await pool.query(`
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_name = 'messages'
            );
        `);

        if (messagesCheck.rows[0].exists) {
            const chatResult = await pool.query(`
                SELECT 
                    DATE(created_at) as date,
                    COUNT(*) as message_count,
                    MIN(created_at)::time as first_message_time,
                    MAX(created_at)::time as last_message_time
                FROM messages
                WHERE sender_id = $1
                GROUP BY DATE(created_at)
                ORDER BY date DESC
                LIMIT 30
            `, [user.id]);

            if (chatResult.rows.length > 0) {
                console.log(`Recent chat activity (last 30 days):`);
                console.log();
                chatResult.rows.forEach(day => {
                    console.log(`Date: ${day.date}`);
                    console.log(`  Messages: ${day.message_count}`);
                    console.log(`  First: ${day.first_message_time}`);
                    console.log(`  Last: ${day.last_message_time}`);
                    console.log();
                });
            } else {
                console.log('No chat messages found');
            }
        } else {
            console.log('⚠️  messages table does not exist');
        }
        console.log();

        // 5. Check for unusual activity patterns
        console.log('5. UNUSUAL ACTIVITY DETECTION');
        console.log('-'.repeat(80));

        if (tableCheck.rows[0].exists) {
            // Check for access from multiple countries
            const countriesResult = await pool.query(`
                SELECT DISTINCT country, COUNT(*) as access_count
                FROM ip_tracking
                WHERE user_id = $1 AND country IS NOT NULL
                GROUP BY country
                ORDER BY access_count DESC
            `, [user.id]);

            if (countriesResult.rows.length > 1) {
                console.log('⚠️  ALERT: Access from multiple countries detected!');
                countriesResult.rows.forEach(c => {
                    console.log(`  - ${c.country}: ${c.access_count} accesses`);
                });
            } else if (countriesResult.rows.length === 1) {
                console.log(`✅ All access from single country: ${countriesResult.rows[0].country}`);
            }
            console.log();

            // Check for late night activity (after 11 PM or before 6 AM)
            const lateNightResult = await pool.query(`
                SELECT 
                    ip_address,
                    last_seen,
                    EXTRACT(HOUR FROM last_seen) as hour
                FROM ip_tracking
                WHERE user_id = $1
                  AND (EXTRACT(HOUR FROM last_seen) >= 23 OR EXTRACT(HOUR FROM last_seen) < 6)
                ORDER BY last_seen DESC
                LIMIT 20
            `, [user.id]);

            if (lateNightResult.rows.length > 0) {
                console.log('⚠️  Late night/early morning activity detected:');
                lateNightResult.rows.forEach(entry => {
                    console.log(`  - ${entry.last_seen} (Hour: ${entry.hour}:00) from ${entry.ip_address}`);
                });
            } else {
                console.log('✅ No unusual late-night activity');
            }
        }
        console.log();

        // 6. Security recommendations
        console.log('6. SECURITY RECOMMENDATIONS');
        console.log('-'.repeat(80));
        console.log('✓ Review password strength - force password reset if weak');
        console.log('✓ Enable 2FA if available');
        console.log('✓ Check if user recognizes all IP addresses');
        console.log('✓ Review chat message content for unusual patterns');
        console.log('✓ Monitor for concurrent logins from different locations');
        console.log();

        console.log('='.repeat(80));
        console.log('END OF REPORT');
        console.log('='.repeat(80));

    } catch (error) {
        console.error('Error during security audit:', error);
    } finally {
        await pool.end();
    }
}

securityAudit();
