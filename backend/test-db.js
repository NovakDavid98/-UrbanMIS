import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;

console.log('🔍 Testing Database Connection...');
console.log('  DB_HOST:', process.env.DB_HOST || 'localhost');
console.log('  DB_USER:', process.env.DB_USER || 'postgres');
console.log('  DB_NAME:', process.env.DB_NAME || 'centralnimozek_cehupo');
console.log('  DB_PASSWORD:', process.env.DB_PASSWORD ? `"${process.env.DB_PASSWORD}"` : 'EMPTY');

const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    database: process.env.DB_NAME || 'centralnimozek_cehupo',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'cehupo2025',
});

try {
    const result = await pool.query('SELECT NOW(), current_database(), current_user');
    console.log('\n✅ Database connection successful!');
    console.log('  Time:', result.rows[0].now);
    console.log('  Database:', result.rows[0].current_database);
    console.log('  User:', result.rows[0].current_user);
    
    const users = await pool.query('SELECT username, email, role FROM users LIMIT 5');
    console.log('\n📊 Users in database:', users.rows.length);
    users.rows.forEach(u => console.log(`  - ${u.username} (${u.role})`));
    
    await pool.end();
    process.exit(0);
} catch (error) {
    console.error('\n❌ Database connection failed:', error.message);
    process.exit(1);
}
