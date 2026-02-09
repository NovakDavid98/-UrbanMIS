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

async function updateAdminPassword() {
  // Generate a strong admin password
  // Format: AdminCEHUPO2025!Secure
  const newPassword = 'AdminCEHUPO2025!Secure';
  
  console.log('🔐 Updating admin password...');
  console.log('');
  console.log('New Admin Credentials:');
  console.log('Username: admin');
  console.log('Password: ' + newPassword);
  console.log('');
  console.log('⚠️  IMPORTANT: Change this password after first login!');
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

    console.log('✅ Admin password updated successfully!');
    console.log('');
    console.log('User details:');
    console.log('  ID:', result.rows[0].id);
    console.log('  Username:', result.rows[0].username);
    console.log('  Email:', result.rows[0].email);
    console.log('');
    console.log('📝 Next steps:');
    console.log('1. Login at http://localhost:5173');
    console.log('2. Go to Settings → Change Password');
    console.log('3. Set your own secure password');
    console.log('');

  } catch (error) {
    console.error('❌ Error updating password:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

updateAdminPassword();
