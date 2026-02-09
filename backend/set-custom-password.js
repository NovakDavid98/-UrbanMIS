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

async function setCustomPassword() {
  const newPassword = 'Polko666';
  
  console.log('🔐 Setting custom admin password...');
  console.log('');
  console.log('New Admin Credentials:');
  console.log('Username: admin');
  console.log('Password: ' + newPassword);
  console.log('');

  try {
    // Hash the password with bcrypt (10 rounds)
    const passwordHash = await bcrypt.hash(newPassword, 10);
    console.log('🔒 Password hashed successfully');

    // Update admin password in database
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
    console.log('🎉 You can now login with:');
    console.log('   Username: admin');
    console.log('   Password: Polko666');
    console.log('');

  } catch (error) {
    console.error('❌ Error updating password:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

setCustomPassword();
