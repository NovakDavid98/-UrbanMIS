import pool from './config/database.js';

async function checkVisits() {
  try {
    const visitsCount = await pool.query('SELECT COUNT(*) FROM visits');
    console.log('✓ Visits table exists');
    console.log('  Total visits:', visitsCount.rows[0].count);
    
    const reasonsCount = await pool.query('SELECT COUNT(*) FROM visit_reasons');
    console.log('✓ Visit reasons table exists');
    console.log('  Total visit reasons:', reasonsCount.rows[0].count);
    
    const clientsCount = await pool.query('SELECT COUNT(*) FROM clients');
    console.log('✓ Clients table exists');
    console.log('  Total clients:', clientsCount.rows[0].count);
    
    process.exit(0);
  } catch (error) {
    console.error('✗ Error:', error.message);
    process.exit(1);
  }
}

checkVisits();

