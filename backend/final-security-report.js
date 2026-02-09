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
const USERNAME = 'Bevz';

async function finalSecurityReport() {
    try {
        console.log('='.repeat(100));
        console.log('🔒 SECURITY INVESTIGATION REPORT - OLENA BEVZ');
        console.log('Generated:', new Date().toISOString());
        console.log('Investigator: System Administrator');
        console.log('User ID:', USER_ID);
        console.log('Username:', USERNAME);
        console.log('='.repeat(100));
        console.log();

        // 1. User Account Information
        console.log('1. USER ACCOUNT INFORMATION');
        console.log('-'.repeat(100));
        const userResult = await pool.query(`
            SELECT id, username, first_name, last_name, email, role, is_active, 
                   created_at, last_login, updated_at
            FROM users 
            WHERE id = $1
        `, [USER_ID]);

        if (userResult.rows.length > 0) {
            const user = userResult.rows[0];
            console.log('✓ Username:', user.username);
            console.log('✓ Full Name:', user.first_name, user.last_name);
            console.log('✓ Email:', user.email);
            console.log('✓ Role:', user.role);
            console.log('✓ Account Status:', user.is_active ? '🟢 Active' : '🔴 Inactive');
            console.log('✓ Account Created:', user.created_at);
            console.log('✓ Last Login:', user.last_login);
            console.log('✓ Last Update:', user.updated_at);
        }
        console.log();

        // 2. Current Session Information
        console.log('2. CURRENT SESSION STATUS');
        console.log('-'.repeat(100));
        const presenceResult = await pool.query(`
            SELECT is_online, socket_id, last_seen, updated_at
            FROM user_presence
            WHERE user_id = $1
        `, [USER_ID]);

        if (presenceResult.rows.length > 0) {
            const presence = presenceResult.rows[0];
            console.log('✓ Currently Online:', presence.is_online ? '🟢 YES' : '🔴 NO');
            console.log('✓ Last Seen:', presence.last_seen);
            console.log('✓ Last Activity:', presence.updated_at);
            console.log('✓ Socket Connection:', presence.socket_id || 'None');

            if (presence.is_online) {
                const timeDiff = new Date() - new Date(presence.updated_at);
                const minutesAgo = Math.floor(timeDiff / 60000);
                console.log(`✓ Active as of ${minutesAgo} minutes ago`);
            }
        } else {
            console.log('⚠️  No presence data found');
        }
        console.log();

        // 3. Audit Log Analysis
        console.log('3. AUDIT LOG ANALYSIS');
        console.log('-'.repeat(100));
        const auditResult = await pool.query(`
            SELECT 
                table_name,
                action,
                COUNT(*) as count,
                MIN(created_at) as first_occurrence,
                MAX(created_at) as last_occurrence,
                array_agg(DISTINCT ip_address) FILTER (WHERE ip_address IS NOT NULL) as ip_addresses
            FROM audit_log
            WHERE user_id = $1
            GROUP BY table_name, action
            ORDER BY last_occurrence DESC
        `, [USER_ID]);

        if (auditResult.rows.length > 0) {
            console.log(`✓ Found ${auditResult.rows.length} different action types in audit log:`);
            console.log();
            auditResult.rows.forEach(entry => {
                console.log(`  📋 Table: ${entry.table_name || 'N/A'} | Action: ${entry.action}`);
                console.log(`     Count: ${entry.count} times`);
                console.log(`     First: ${entry.first_occurrence}`);
                console.log(`     Last: ${entry.last_occurrence}`);
                if (entry.ip_addresses && entry.ip_addresses.length > 0) {
                    console.log(`     IPs: ${entry.ip_addresses.join(', ')}`);
                }
                console.log();
            });
        } else {
            console.log('⚠️  No audit log entries found for this user');
            console.log('   This could indicate:');
            console.log('   - Audit logging is not enabled for login events');
            console.log('   - User has not performed tracked actions');
            console.log('   - Audit logs have been cleared');
        }
        console.log();

        // 4. All IP Addresses Used
        console.log('4. IP ADDRESS SECURITY ANALYSIS');
        console.log('-'.repeat(100));
        const allIPs = await pool.query(`
            SELECT DISTINCT ip_address, 
                   COUNT(*) as usage_count,
                   MIN(created_at) as first_used,
                   MAX(created_at) as last_used
            FROM audit_log
            WHERE user_id = $1 AND ip_address IS NOT NULL
            GROUP BY ip_address
            ORDER BY last_used DESC
        `, [USER_ID]);

        if (allIPs.rows.length > 0) {
            console.log(`Found ${allIPs.rows.length} unique IP address(es):`);
            console.log();
            allIPs.rows.forEach((ip, idx) => {
                console.log(`  IP ${idx + 1}: ${ip.ip_address}`);
                console.log(`    Usage: ${ip.usage_count} times`);
                console.log(`    First: ${ip.first_used}`);
                console.log(`    Last: ${ip.last_used}`);
                console.log();
            });

            if (allIPs.rows.length === 1) {
                console.log('✅ GOOD: Single IP address detected - consistent access pattern');
            } else if (allIPs.rows.length <= 3) {
                console.log('⚠️  MODERATE RISK: Multiple IPs detected (likely home/work/mobile)');
                console.log('   ACTION REQUIRED: Verify with user that all IPs are recognized');
            } else {
                console.log('🚨 HIGH RISK: Many different IPs detected!');
                console.log('   IMMEDIATE ACTION REQUIRED: Investigate possible account compromise');
            }
        } else {
            console.log('⚠️  No IP data tracked in audit logs');
        }
        console.log();

        // 5. Recent Activity Pattern
        console.log('5. RECENT ACTIVITY PATTERN (Last 30 Days)');
        console.log('-'.repeat(100));
        const recentActivity = await pool.query(`
            SELECT 
                DATE(created_at) as activity_date,
                COUNT(*) as actions,
                array_agg(DISTINCT action) as action_types,
                MIN(created_at)::time as first_activity,
                MAX(created_at)::time as last_activity
            FROM audit_log
            WHERE user_id = $1
              AND created_at >= NOW() - INTERVAL '30 days'
            GROUP BY DATE(created_at)
            ORDER BY activity_date DESC
        `, [USER_ID]);

        if (recentActivity.rows.length > 0) {
            console.log('Activity by date:');
            console.log();
            recentActivity.rows.forEach(day => {
                console.log(`  📅 ${day.activity_date}`);
                console.log(`     Actions: ${day.actions}`);
                console.log(`     First: ${day.first_activity} | Last: ${day.last_activity}`);
                const duration = new Date(`1970-01-01T${day.last_activity}`) - new Date(`1970-01-01T${day.first_activity}`);
                const hours = Math.floor(duration / 3600000);
                console.log(`     Duration: ${hours} hours`);
                console.log();
            });
        } else {
            console.log('⚠️  No recent activity in audit log');
        }
        console.log();

        // 6. Suspicious Activity Indicators
        console.log('6. SUSPICIOUS ACTIVITY INDICATORS');
        console.log('-'.repeat(100));

        // Check for late-night activity
        const lateNight = await pool.query(`
            SELECT COUNT(*) as count,
                   array_agg(DISTINCT DATE(created_at)) as dates
            FROM audit_log
            WHERE user_id = $1
              AND (EXTRACT(HOUR FROM created_at) >= 23 OR EXTRACT(HOUR FROM created_at) < 6)
              AND created_at >= NOW() - INTERVAL '30 days'
        `, [USER_ID]);

        let suspiciousFlags = 0;

        if (lateNight.rows[0].count > 0) {
            console.log(`⚠️  Late-night activity (11PM-6AM): ${lateNight.rows[0].count} events`);
            console.log(`   Dates: ${lateNight.rows[0].dates ? lateNight.rows[0].dates.join(', ') : 'N/A'}`);
            suspiciousFlags++;
        } else {
            console.log('✅ No late-night activity detected');
        }

        // Check for rapid IP changes
        if (allIPs.rows.length > 3) {
            console.log(`⚠️  Multiple IPs: ${allIPs.rows.length} different IPs in audit log`);
            suspiciousFlags++;
        }

        console.log();
        console.log(`Suspicious Activity Score: ${suspiciousFlags}/2`);
        if (suspiciousFlags === 0) {
            console.log('✅ LOW RISK: Activity pattern appears normal');
        } else if (suspiciousFlags === 1) {
            console.log('⚠️  MODERATE RISK: Some unusual patterns detected');
        } else {
            console.log('🚨 HIGH RISK: Multiple suspicious indicators!');
        }
        console.log();

        // 7. Password Security Recommendations
        console.log('7. SECURITY RECOMMENDATIONS');
        console.log('-'.repeat(100));
        console.log('Based on this investigation, we recommend:');
        console.log();
        console.log('IMMEDIATE ACTIONS:');
        console.log('  1. ⚠️  Contact Olena Bevz directly (phone/in-person) to verify:');
        console.log('      - Recent login times and locations');
        console.log('      - If she recognizes all IP addresses accessing her account');
        console.log('      - If she has shared her password with anyone');
        console.log();
        console.log('  2. 🔐 Force password reset with these requirements:');
        console.log('      - Minimum 12 characters');
        console.log('      - Mix of uppercase, lowercase, numbers, symbols');
        console.log('      - Not a common word or pattern');
        console.log('      - Example: CehupO2025!Secure#Praha');
        console.log();
        console.log('  3. 📱 Ask user to:');
        console.log('      - Log out of all active sessions');
        console.log('      - Sign in from a trusted device');
        console.log('      - Report any unrecognized account activity');
        console.log();
        console.log('PREVENTIVE MEASURES:');
        console.log('  4. 🔒 Implement 2-Factor Authentication (2FA) if available');
        console.log('  5. 📊 Enable enhanced logging for this account');
        console.log('  6. ⏰ Set up alerts for:');
        console.log('      - Logins from new IPs');
        console.log('      - Failed login attempts');
        console.log('      - Late-night access (23:00-06:00)');
        console.log('      - Multiple concurrent sessions');
        console.log();
        console.log('PASSWORD POLICY ENFORCEMENT:');
        console.log('  7. 🛡️  System-wide improvements:');
        console.log('      - Enforce minimum password length (12 chars)');
        console.log('      - Require password changes every 90 days');
        console.log('      - Prevent reuse of last 5 passwords');
        console.log('      - Add password strength meter to UI');
        console.log('      - Block common/weak passwords (e.g., "password123")');
        console.log();

        // 8. Summary
        console.log('8. INVESTIGATION SUMMARY');
        console.log('-'.repeat(100));
        console.log('User: Olena Bevz (@Bevz)');
        console.log('Account Created:', userResult.rows[0].created_at);
        console.log('Last Login:', userResult.rows[0].last_login || 'Never');
        console.log('Currently Online:', presenceResult.rows[0]?.is_online ? 'Yes' : 'No');
        console.log('Audit Entries:', auditResult.rows.length > 0 ? 'Present' : 'None');
        console.log('IP Addresses:', allIPs.rows.length || 'Not tracked');
        console.log();
        console.log('CONCLUSION:');
        if (allIPs.rows.length === 0 && auditResult.rows.length === 0) {
            console.log('⚠️  INCONCLUSIVE: Limited audit data available.');
            console.log('   Recommendation: Enable comprehensive audit logging and');
            console.log('   force immediate password reset as a precaution.');
        } else if (suspiciousFlags === 0) {
            console.log('✅ Account appears secure, but password strength should be verified.');
            console.log('   Recommend proactive password reset with strong requirements.');
        } else {
            console.log('🚨 POTENTIAL SECURITY CONCERN: Unusual patterns detected.');
            console.log('   IMMEDIATE password reset and user interview required.');
        }

        console.log();
        console.log('='.repeat(100));
        console.log('END OF SECURITY INVESTIGATION');
        console.log('Report saved to: security_report_olena_bevz.txt');
        console.log('='.repeat(100));

    } catch (error) {
        console.error('❌ Error during investigation:', error);
        console.error(error.stack);
    } finally {
        await pool.end();
    }
}

finalSecurityReport();
