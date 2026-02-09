import pool from '../config/database.js';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '../.env' });

/**
 * =================================================================================
 * VISIT DATA IMPORTER - Load extracted visits into database
 * =================================================================================
 * Imports visit data from JSON file created by extract_all_visits_async.py
 * into the centralnimozek database.
 * =================================================================================
 */

// =================================================================================
// CONFIGURATION
// =================================================================================

const BATCH_SIZE = 100; // Number of visits to import at once
const SYSTEM_USER_ID = '00000000-0000-0000-0000-000000000001'; // System user for imports

// Mapping of CeHuPo visit reason names (Czech/Russian) to our database
const REASON_MAPPING = {
  // Humanitární sklad (warehouse)
  'Vybavení domácnosti': 2,
  'Jídlo – humanitární balíček': 3,
  'Kosmetika - humanitární balíček': 4,
  'Oblečení – obuv': 5,
  'Ostatní': 6,
  
  // Asistenční centrum (assistance)
  'Konzultace': 8,
  'Doprovod': 15,
  'Psychologická pomoc': 9,
  'Bydlení': 10,
  'Zdravotnictví': 11,
  'Vzdělávání': 12,
  'Doklady – víza': 13,
  'Tlumočení': 14,
  'Zaměstnání': 30,
  
  // Komunitní centrum (community)
  'Akce': 17,
  'Děti': 18,
  'Senioři': 19,
  'Dospělí': 20,
  'Kurzy ČJ': 21,
  'Ostatní akce': 22,
  'Integrační akce': 23,
  
  // Přinesli (donations)
  'Přinesli oblečení': 25,
  'Přinesli nábytek': 26,
  'Přinesli vybavení domácnosti': 27,
  'Přinesli jídlo': 28,
  'Přinesli kosmetiku': 29
};

// =================================================================================
// HELPER FUNCTIONS
// =================================================================================

/**
 * Parse DD.MM.YYYY date format to YYYY-MM-DD
 */
function parseDateString(dateStr) {
  if (!dateStr) return null;
  
  const parts = dateStr.trim().split('.');
  if (parts.length !== 3) return null;
  
  const day = parts[0].padStart(2, '0');
  const month = parts[1].padStart(2, '0');
  const year = parts[2];
  
  return `${year}-${month}-${day}`;
}

/**
 * Parse HH:MM:SS time format
 */
function parseTimeString(timeStr) {
  if (!timeStr) return null;
  return timeStr.trim(); // PostgreSQL accepts HH:MM:SS format directly
}

/**
 * Map CeHuPo reason names to database IDs
 */
function mapReasonToId(reasonName) {
  const cleaned = reasonName.trim().replace(',', '');
  return REASON_MAPPING[cleaned] || null;
}

/**
 * Get or create system user for imports
 */
async function ensureSystemUser() {
  try {
    // Check if system user exists
    const result = await pool.query(
      'SELECT id FROM users WHERE id = $1',
      [SYSTEM_USER_ID]
    );
    
    if (result.rows.length === 0) {
      // Create system user
      await pool.query(`
        INSERT INTO users (id, username, email, password_hash, first_name, last_name, role)
        VALUES ($1, 'system', 'system@cehupo.cz', 'no-password', 'System', 'Import', 'admin')
        ON CONFLICT (id) DO NOTHING
      `, [SYSTEM_USER_ID]);
      
      console.log('✓ Created system user for imports');
    }
    
    return SYSTEM_USER_ID;
  } catch (error) {
    console.error('Error ensuring system user:', error);
    // Return null, will use current admin user
    const adminResult = await pool.query(
      "SELECT id FROM users WHERE role = 'admin' LIMIT 1"
    );
    return adminResult.rows[0]?.id || null;
  }
}

// =================================================================================
// IMPORT FUNCTIONS
// =================================================================================

/**
 * Import a single visit with its reasons
 */
async function importVisit(clientId, visit, systemUserId) {
  try {
    // Parse date
    const visitDate = parseDateString(visit.visit_date);
    if (!visitDate) {
      throw new Error(`Invalid date format: ${visit.visit_date}`);
    }
    
    // Parse time spent
    const timeSpent = parseTimeString(visit.time_spent);
    
    // Begin transaction
    await pool.query('BEGIN');
    
    try {
      // Insert visit
      const visitResult = await pool.query(`
        INSERT INTO visits (
          client_id,
          visit_date,
          time_spent,
          notes,
          created_by,
          created_at
        )
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING id
      `, [
        clientId,
        visitDate,
        timeSpent,
        visit.notes || '',
        systemUserId,
        visitDate // Use visit date as created_at for historical accuracy
      ]);
      
      const visitId = visitResult.rows[0].id;
      
      // Insert visit reasons
      const insertedReasons = [];
      for (const reasonName of visit.reasons) {
        const reasonId = mapReasonToId(reasonName);
        
        if (reasonId) {
          await pool.query(`
            INSERT INTO visit_visit_reasons (visit_id, visit_reason_id)
            VALUES ($1, $2)
            ON CONFLICT DO NOTHING
          `, [visitId, reasonId]);
          
          insertedReasons.push(reasonId);
        } else {
          console.warn(`⚠️  Unknown visit reason: "${reasonName}"`);
        }
      }
      
      await pool.query('COMMIT');
      
      return {
        success: true,
        visitId,
        reasonCount: insertedReasons.length
      };
      
    } catch (error) {
      await pool.query('ROLLBACK');
      throw error;
    }
    
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Import all visits for a single client
 */
async function importClientVisits(clientData, systemUserId, stats) {
  const { client_id, first_name, last_name, visits } = clientData;
  
  if (!visits || visits.length === 0) {
    return;
  }
  
  let successCount = 0;
  let errorCount = 0;
  
  for (const visit of visits) {
    const result = await importVisit(client_id, visit, systemUserId);
    
    if (result.success) {
      successCount++;
      stats.totalVisitsImported++;
      stats.totalReasonsLinked += result.reasonCount;
    } else {
      errorCount++;
      stats.errors.push({
        client: `${first_name} ${last_name}`,
        visit_date: visit.visit_date,
        error: result.error
      });
    }
  }
  
  if (successCount > 0) {
    stats.clientsWithImportedVisits++;
  }
  
  return { successCount, errorCount };
}

// =================================================================================
// MAIN IMPORT FUNCTION
// =================================================================================

async function importAllVisits(jsonFilePath) {
  console.log('');
  console.log('='.repeat(80));
  console.log('VISIT DATA IMPORT - Load into Database');
  console.log('='.repeat(80));
  console.log('');
  
  // Step 1: Load JSON file
  console.log('📖 Step 1: Loading JSON file...');
  
  if (!fs.existsSync(jsonFilePath)) {
    console.error(`✗ File not found: ${jsonFilePath}`);
    process.exit(1);
  }
  
  const jsonData = JSON.parse(fs.readFileSync(jsonFilePath, 'utf-8'));
  console.log(`✓ Loaded JSON file: ${path.basename(jsonFilePath)}`);
  console.log(`  Clients: ${jsonData.clients.length}`);
  console.log(`  Total visits to import: ${jsonData.statistics.total_visits}`);
  console.log('');
  
  // Step 2: Setup system user
  console.log('👤 Step 2: Setting up system user...');
  const systemUserId = await ensureSystemUser();
  console.log(`✓ Using user ID: ${systemUserId}`);
  console.log('');
  
  // Step 3: Import visits
  console.log('🚀 Step 3: Importing visits...');
  console.log('');
  
  const stats = {
    totalClients: jsonData.clients.length,
    clientsWithImportedVisits: 0,
    totalVisitsImported: 0,
    totalReasonsLinked: 0,
    errors: []
  };
  
  const startTime = Date.now();
  let processed = 0;
  
  for (const clientData of jsonData.clients) {
    await importClientVisits(clientData, systemUserId, stats);
    processed++;
    
    if (processed % 50 === 0) {
      const elapsed = (Date.now() - startTime) / 1000;
      const rate = processed / elapsed;
      const remaining = stats.totalClients - processed;
      const eta = remaining / rate;
      
      console.log(`Progress: ${processed}/${stats.totalClients} clients (${(processed/stats.totalClients*100).toFixed(1)}%) - ` +
                 `Visits: ${stats.totalVisitsImported} - ` +
                 `Rate: ${rate.toFixed(1)} clients/sec - ` +
                 `ETA: ${(eta/60).toFixed(1)} min`);
    }
  }
  
  const totalTime = (Date.now() - startTime) / 1000;
  
  console.log('');
  console.log('✅ Import complete!');
  console.log(`   Total time: ${(totalTime/60).toFixed(1)} minutes`);
  console.log(`   Clients processed: ${stats.totalClients}`);
  console.log(`   Clients with visits: ${stats.clientsWithImportedVisits}`);
  console.log(`   Total visits imported: ${stats.totalVisitsImported}`);
  console.log(`   Total reasons linked: ${stats.totalReasonsLinked}`);
  console.log(`   Errors: ${stats.errors.length}`);
  console.log('');
  
  if (stats.errors.length > 0) {
    console.log('⚠️  Errors encountered:');
    stats.errors.slice(0, 10).forEach(err => {
      console.log(`   ${err.client} (${err.visit_date}): ${err.error}`);
    });
    if (stats.errors.length > 10) {
      console.log(`   ... and ${stats.errors.length - 10} more errors`);
    }
    console.log('');
  }
  
  // Verification
  console.log('🔍 Step 4: Verifying import...');
  const verifyResult = await pool.query(`
    SELECT 
      COUNT(DISTINCT v.id) as visit_count,
      COUNT(DISTINCT v.client_id) as client_count,
      COUNT(DISTINCT vvr.visit_reason_id) as reason_count
    FROM visits v
    LEFT JOIN visit_visit_reasons vvr ON v.id = vvr.visit_id
  `);
  
  const verify = verifyResult.rows[0];
  console.log(`✓ Database verification:`);
  console.log(`   Visits in database: ${verify.visit_count}`);
  console.log(`   Unique clients: ${verify.client_count}`);
  console.log(`   Unique reasons used: ${verify.reason_count}`);
  console.log('');
  
  console.log('='.repeat(80));
  console.log('SUCCESS! Visit data has been imported into the database.');
  console.log('');
  console.log('Next steps:');
  console.log('  1. Open your app: http://94.177.164.211/visit-log');
  console.log('  2. View statistics and filter visits');
  console.log('  3. Celebrate! 🎉');
  console.log('='.repeat(80));
  console.log('');
  
  process.exit(0);
}

// =================================================================================
// ENTRY POINT
// =================================================================================

const args = process.argv.slice(2);

if (args.length === 0) {
  console.log('');
  console.log('Usage: node import-visits-from-json.js <json_file_path>');
  console.log('');
  console.log('Example:');
  console.log('  node import-visits-from-json.js complete_visits_extraction_20251112_123456.json');
  console.log('');
  process.exit(1);
}

const jsonFilePath = args[0];

importAllVisits(jsonFilePath).catch(error => {
  console.error('');
  console.error('❌ Fatal error during import:');
  console.error(error);
  console.error('');
  process.exit(1);
});

