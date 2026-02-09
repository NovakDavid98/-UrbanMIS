import bcrypt from 'bcrypt';
import pg from 'pg';
import dotenv from 'dotenv';

const { Pool } = pg;
dotenv.config();

const pool = new Pool({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
});

async function resetPassword() {
    try {
        const newPassword = 'admin123';
        const hashedPassword = await bcrypt.hash(newPassword, 10);
        
        console.log('🔐 Resetting admin password...');
        
        const result = await pool.query(
            `UPDATE users 
             SET password_hash = $1 
             WHERE username = 'admin' 
             RETURNING username, email`,
            [hashedPassword]
        );
        
        if (result.rows.length > 0) {
            console.log('✅ Password reset successfully!');
            console.log(`   Username: ${result.rows[0].username}`);
            console.log(`   Email: ${result.rows[0].email}`);
            console.log(`   New Password: ${newPassword}`);
        } else {
            console.log('❌ Admin user not found!');
        }
        
        await pool.end();
        process.exit(0);
        
    } catch (error) {
        console.error('❌ Error:', error.message);
        await pool.end();
        process.exit(1);
    }
}

resetPassword();
