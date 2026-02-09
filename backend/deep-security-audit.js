import dotenv from 'dotenv';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import pkg from 'pg';
const { Pool } = pkg;

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '.env') });

const pool = new Pool({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
});

const USER_ID = '2cf4da8c-bcf8-4a05-b3e6-1a5d7f463ff4';

async function deepSecurityAudit() {
    try {
        console.log('='.repeat(100));
        console.log('COMPREHENSIVE SECURITY AUDIT - OLENA BEVZ');
        console.log('Generated:', new Date().toISOString());
        console.log('User ID:', USER_ID);
        console.log('='.repeat(100));
        console.log();

        // 1. Check audit log structure
        console.log('1. AUDIT LOG STRUCTURE');
        console.log('-'.repeat(100));
        const columnsResult = await pool.query(`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'audit_log'
            ORDER BY ordinal_position
        `);
        console.log('Audit log columns:');
        columnsResult.rows.forEach(col => {
            console.log(`  - ${col.column_name} (${col.data_type})`);
        });
        console.log();

        // 2. Get all audit log entries for this user
        console.log('2. COMPLETE AUDIT LOG HISTORY');
        console.log('-'.repeat(100));
        const auditResult = await pool.query(`
            SELECT *
            FROM audit_log
            WHERE user_id = $1
            ORDER BY created_at DESC
            LIMIT 100
        `, [USER_ID]);

        console.log(`Found ${auditResult.rows.length} audit log entries`);
        console.log();

        if (auditResult.rows.length > 0) {
            // Group by action type
            const actionGroups = {};
            auditResult.rows.forEach(entry => {
                const action = entry.action || 'unknown';
                if (!actionGroups[action]) {
                    actionGroups[action] = [];
                }
                actionGroups[action].push(entry);
            });

            console.log('Actions breakdown:');
            Object.keys(actionGroups).forEach(action => {
                console.log(`  ${action}: ${actionGroups[action].length} times`);
            });
            console.log();

            // Show recent entries in detail
            console.log('Recent audit entries (last 50):');
            console.log('-'.repeat(100));
            auditResult.rows.slice(0, 50).forEach((entry, idx) => {
                console.log(`[${idx + 1}] ${entry.created_at}`);
                console.log(`    Action: ${entry.action || 'N/A'}`);
                console.log(`    Entity: ${entry.entity_type || 'N/A'} (ID: ${entry.entity_id || 'N/A'})`);
                console.log(`    IP: ${entry.ip_address || 'N/A'}`);
                console.log(`    Details: ${entry.details || 'N/A'}`);
                console.log();
            });
        }

        // 3. Login pattern analysis
        console.log('3. LOGIN PATTERN ANALYSIS');
        console.log('-'.repeat(100));
        const loginResult = await pool.query(`
            SELECT 
                DATE(created_at) as login_date,
                COUNT(*) as login_count,
                MIN(created_at)::time as first_login,
                MAX(created_at)::time as last_login,
                array_agg(DISTINCT ip_address) as ip_addresses
            FROM audit_log
            WHERE user_id = $1 AND action = 'login'
            GROUP BY DATE(created_at)
            ORDER BY login_date DESC
            LIMIT 30
        `, [USER_ID]);

        if (loginResult.rows.length > 0) {
            console.log('Login activity by date (last 30 days):');
            loginResult.rows.forEach(day => {
                console.log();
                console.log(`📅 ${day.login_date}`);
                console.log(`   Logins: ${day.login_count}`);
                console.log(`   First: ${day.first_login}`);
                console.log(`   Last: ${day.last_login}`);
                console.log(`   IPs: ${day.ip_addresses ? day.ip_addresses.join(', ') : 'N/A'}`);
            });
        } else {
            console.log('No login records found in audit log');
        }
        console.log();

        // 4. IP address analysis
        console.log('4. IP ADDRESS ANALYSIS');
        console.log('-'.repeat(100));
        const ipAnalysis = await pool.query(`
            SELECT 
                ip_address,
                COUNT(*) as total_actions,
                MIN(created_at) as first_seen,
                MAX(created_at) as last_seen,
                array_agg(DISTINCT action) as actions
            FROM audit_log
            WHERE user_id = $1 AND ip_address IS NOT NULL
            GROUP BY ip_address
            ORDER BY last_seen DESC
        `, [USER_ID]);

        if (ipAnalysis.rows.length > 0) {
            console.log(`Found ${ipAnalysis.rows.length} unique IP addresses:`);
            console.log();
            ipAnalysis.rows.forEach((ip, idx) => {
                console.log(`IP ${idx + 1}: ${ip.ip_address}`);
                console.log(`  Total Actions: ${ip.total_actions}`);
                console.log(`  First Seen: ${ip.first_seen}`);
                console.log(`  Last Seen: ${ip.last_seen}`);
                console.log(`  Actions: ${ip.actions ? ip.actions.join(', ') : 'N/A'}`);
                console.log();
            });

            if (ipAnalysis.rows.length > 3) {
                console.log('⚠️  WARNING: Multiple IP addresses detected! This could indicate:');
                console.log('   - User accessing from different locations (home, work, mobile)');
                console.log('   - Shared account access (security risk)');
                console.log('   - Potential unauthorized access');
                console.log();
            }
        } else {
            console.log('No IP information available in audit logs');
        }
        console.log();

        // 5. Unusual time pattern detection
        console.log('5. UNUSUAL TIME PATTERN DETECTION');
        console.log('-'.repeat(100));
        const nightActivity = await pool.query(`
            SELECT 
                created_at,
                action,
                ip_address,
                EXTRACT(HOUR FROM created_at) as hour
            FROM audit_log
            WHERE user_id = $1
              AND (EXTRACT(HOUR FROM created_at) >= 23 OR EXTRACT(HOUR FROM created_at) < 6)
            ORDER BY created_at DESC
            LIMIT 30
        `, [USER_ID]);

        if (nightActivity.rows.length > 0) {
            console.log(`⚠️  Found ${nightActivity.rows.length} late-night/early-morning activities (11 PM - 6 AM):`);
            console.log();
            nightActivity.rows.forEach(entry => {
                const hour = parseInt(entry.hour);
                console.log(`🌙 ${entry.created_at}`);
                console.log(`   Hour: ${hour}:00 (${hour >= 23 ? 'Late Night' : 'Early Morning'})`);
                console.log(`   Action: ${entry.action}`);
                console.log(`   IP: ${entry.ip_address || 'N/A'}`);
                console.log();
            });
        } else {
            console.log('✅ No unusual late-night activity detected');
        }
        console.log();

        // 6. Recent activity timeline
        console.log('6. DETAILED RECENT ACTIVITY TIMELINE');
        console.log('-'.repeat(100));
        const recentActivity = await pool.query(`
            SELECT 
                created_at,
                action,
                entity_type,
                ip_address,
                details
            FROM audit_log
            WHERE user_id = $1
            ORDER BY created_at DESC
            LIMIT 20
        `, [USER_ID]);

        console.log('Last 20 actions:');
        recentActivity.rows.forEach((entry, idx) => {
            console.log();
            console.log(`${idx + 1}. ${entry.created_at}`);
            console.log(`   Action: ${entry.action || 'N/A'}`);
            console.log(`   Entity: ${entry.entity_type || 'N/A'}`);
            console.log(`   IP: ${entry.ip_address || 'N/A'}`);
            if (entry.details) {
                console.log(`   Details: ${entry.details}`);
            }
        });
        console.log();

        // 7. Failed login attempts
        console.log('7. FAILED LOGIN ATTEMPTS');
        console.log('-'.repeat(100));
        const failedLogins = await pool.query(`
            SELECT 
                created_at,
                ip_address,
                details
            FROM audit_log
            WHERE user_id = $1 
              AND (action = 'failed_login' OR action = 'login_failed' OR details ILIKE '%failed%')
            ORDER BY created_at DESC
            LIMIT 20
        `, [USER_ID]);

        if (failedLogins.rows.length > 0) {
            console.log(`🚨 ALERT: Found ${failedLogins.rows.length} failed login attempts!`);
            failedLogins.rows.forEach(entry => {
                console.log();
                console.log(`  ${entry.created_at}`);
                console.log(`  IP: ${entry.ip_address || 'N/A'}`);
                console.log(`  Details: ${entry.details || 'N/A'}`);
            });
        } else {
            console.log('✅ No failed login attempts found');
        }
        console.log();

        console.log('='.repeat(100));
        console.log('END OF COMPREHENSIVE AUDIT');
        console.log('='.repeat(100));

    } catch (error) {
        console.error('❌ Error during audit:', error);
        console.error(error.stack);
    } finally {
        await pool.end();
    }
}

deepSecurityAudit();
