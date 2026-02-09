import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;

// Debug: Log environment variables
console.log('🔍 Database Configuration:');
console.log('  DB_HOST:', process.env.DB_HOST || 'localhost');
console.log('  DB_PORT:', process.env.DB_PORT || 5432);
console.log('  DB_NAME:', process.env.DB_NAME || 'centralnimozek_cehupo');
console.log('  DB_USER:', process.env.DB_USER || 'postgres');
console.log('  DB_PASSWORD:', process.env.DB_PASSWORD ? '***SET***' : 'EMPTY - using default');

// Database connection pool
const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    database: process.env.DB_NAME || 'centralnimozek_cehupo',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'cehupo2025',
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
});

// Test connection
pool.on('connect', () => {
    console.log('✓ Database connected successfully');
});

pool.on('error', (err) => {
    console.error('Unexpected database error:', err);
    process.exit(-1);
});

// Query helper with logging
export const query = async (text, params) => {
    const start = Date.now();
    try {
        const res = await pool.query(text, params);
        const duration = Date.now() - start;
        // Temporarily always log queries for debugging
        console.log('Executed query:', { text: text.substring(0, 200), duration, rows: res.rowCount, params });
        return res;
    } catch (error) {
        console.error('Database query error:', error);
        throw error;
    }
};

// Get a client from the pool for transactions
export const getClient = () => pool.connect();

export default pool;

