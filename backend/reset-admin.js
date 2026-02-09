import bcrypt from 'bcrypt';
import pkg from 'pg';
const { Pool } = pkg;
import dotenv from 'dotenv';

dotenv.config();

const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
});

async function resetAdminPassword() {
  // Simple strong password without special chars that might cause issues
  const newPassword = 'Admin2025CEHUPO!';
  
  console.log('🔐 Resetting admin password...');
  console.log('');

  try {
    // Hash the password
    const passwordHash = await bcrypt.hash(newPassword, 10);

    // Update admin password
    const result = await pool.query(
      `UPDATE users 
       SET password_hash = $1, 
           updated_at = NOW() 
       WHERE username = 'admin'
       RETURNING id, username, email`,
      [passwordHash]
    );

    if (result.rows.length === 0) {
      console.error('❌ Admin user not found!');
      process.exit(1);
    }

    console.log('✅ Admin password reset successfully!');
    console.log('');
    console.log('═══════════════════════════════════════════════');
    console.log('  NEW LOGIN CREDENTIALS');
    console.log('═══════════════════════════════════════════════');
    console.log('');
    console.log('  Username: admin');
    console.log('  Password: ' + newPassword);
    console.log('');
    console.log('═══════════════════════════════════════════════');
    console.log('');
    console.log('📝 Login at: http://localhost:5173');
    console.log('');
    console.log('⚠️  IMPORTANT: Change this password immediately!');
    console.log('   Go to: Settings → Change Password');
    console.log('');

  } catch (error) {
    console.error('❌ Error resetting password:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

resetAdminPassword();
