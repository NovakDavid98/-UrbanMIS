// Reset admin password script
import bcrypt from 'bcrypt';
import pg from 'pg';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
dotenv.config({ path: join(__dirname, '../.env') });

const { Pool } = pg;

const pool = new Pool({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
});

async function resetAdminPassword() {
    try {
        console.log('🔐 Resetting admin password...');
        
        const newPassword = 'admin123';
        const hashedPassword = await bcrypt.hash(newPassword, 10);
        
        const result = await pool.query(
            `UPDATE users 
             SET password = $1 
             WHERE username = 'admin' 
             RETURNING username, email`,
            [hashedPassword]
        );
        
        if (result.rows.length > 0) {
            console.log('✅ Admin password reset successfully!');
            console.log(`   Username: ${result.rows[0].username}`);
            console.log(`   Email: ${result.rows[0].email}`);
            console.log(`   New Password: ${newPassword}`);
        } else {
            console.log('❌ Admin user not found!');
        }
        
        await pool.end();
        process.exit(0);
        
    } catch (error) {
        console.error('❌ Error resetting password:', error);
        await pool.end();
        process.exit(1);
    }
}

resetAdminPassword();
