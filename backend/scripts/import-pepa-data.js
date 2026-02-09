import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { query, getClient } from '../config/database.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Path to the extracted data file
const DATA_FILE = path.join(__dirname, '../../../complete_data_extraction/all_clients_complete_data.txt');

console.log('\n╔═══════════════════════════════════════════════════════════════╗');
console.log('║                                                               ║');
console.log('║         IS PePa Data Import to Centrální Mozek CEHUPO         ║');
console.log('║                                                               ║');
console.log('╚═══════════════════════════════════════════════════════════════╝\n');

// Parse date from various formats
function parseDate(dateStr) {
    if (!dateStr || dateStr === '—' || dateStr === 'N/A') return null;
    
    try {
        // Try various date formats
        const date = new Date(dateStr);
        if (!isNaN(date.getTime())) {
            return date.toISOString().split('T')[0];
        }
    } catch (e) {
        console.warn(`Warning: Could not parse date: ${dateStr}`);
    }
    
    return null;
}

// Calculate age from date of birth
function calculateAge(dateOfBirth) {
    if (!dateOfBirth) return null;
    
    try {
        const birthDate = new Date(dateOfBirth);
        const today = new Date();
        let age = today.getFullYear() - birthDate.getFullYear();
        const monthDiff = today.getMonth() - birthDate.getMonth();
        
        if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
            age--;
        }
        
        return age;
    } catch (e) {
        return null;
    }
}

// Parse the data file
function parseDataFile(filePath) {
    console.log(`📂 Reading data file: ${filePath}`);
    
    if (!fs.existsSync(filePath)) {
        console.error(`❌ Error: Data file not found at ${filePath}`);
        console.log('\n💡 Please run the data extraction script first:');
        console.log('   cd ../complete_data_extraction');
        console.log('   python3 extract_all_client_data.py\n');
        process.exit(1);
    }
    
    const content = fs.readFileSync(filePath, 'utf-8');
    const clients = [];
    const clientBlocks = content.split('='+'='.repeat(79)).filter(block => block.trim());
    
    console.log(`📊 Found ${clientBlocks.length} client blocks\n`);
    
    for (let block of clientBlocks) {
        try {
            const client = {
                personalInfo: {},
                keyWorkers: [],
                tags: [],
                contracts: [],
                individualPlans: [],
                services: []
            };
            
            // Extract client name from header
            const nameMatch = block.match(/CLIENT:\s*(.+)/);
            if (nameMatch) {
                const fullName = nameMatch[1].trim();
                const nameParts = fullName.split(/\s+/);
                client.personalInfo.firstName = nameParts[0];
                client.personalInfo.lastName = nameParts.slice(1).join(' ');
            }
            
            // Parse personal information section
            const personalInfoMatch = block.match(/PERSONAL INFORMATION[\s\S]*?(?=KEY WORKERS|TAGS|CONTRACTS|INDIVIDUAL PLANS|SERVICE RECORDS|$)/);
            if (personalInfoMatch) {
                const personalSection = personalInfoMatch[0];
                
                // Extract fields using regex
                const extractField = (fieldName) => {
                    const regex = new RegExp(`${fieldName}:\\s*(.+?)(?=\\n|$)`, 'i');
                    const match = personalSection.match(regex);
                    return match ? match[1].trim() : null;
                };
                
                client.personalInfo.gender = extractField('Gender');
                client.personalInfo.age = extractField('Age') ? parseInt(extractField('Age')) : null;
                client.personalInfo.dateOfBirth = parseDate(extractField('Date of Birth'));
                client.personalInfo.homeAddress = extractField('Home Address');
                client.personalInfo.czechPhone = extractField('Czech Phone');
                client.personalInfo.ukrainianPhone = extractField('Ukrainian Phone');
                client.personalInfo.email = extractField('Email');
                client.personalInfo.dateOfArrivalCzech = parseDate(extractField('Date of Arrival to Czech Republic'));
                client.personalInfo.projectRegistrationDate = parseDate(extractField('Project Registration Date'));
                client.personalInfo.visaNumber = extractField('Visa Number');
                client.personalInfo.visaType = extractField('Visa Type');
                client.personalInfo.insuranceCompany = extractField('Insurance Company');
                client.personalInfo.ukrainianRegion = extractField('Ukrainian Region');
                
                // Recalculate age if date of birth is available
                if (client.personalInfo.dateOfBirth) {
                    client.personalInfo.age = calculateAge(client.personalInfo.dateOfBirth);
                }
            }
            
            // Parse services
            const servicesMatch = block.match(/SERVICE RECORDS[\s\S]*$/);
            if (servicesMatch) {
                const servicesSection = servicesMatch[0];
                const serviceBlocks = servicesSection.split(/Service \d+:/).slice(1);
                
                for (let serviceBlock of serviceBlocks) {
                    const service = {};
                    
                    const extractServiceField = (fieldName) => {
                        const regex = new RegExp(`${fieldName}:\\s*(.+?)(?=\\n|$)`, 'i');
                        const match = serviceBlock.match(regex);
                        return match ? match[1].trim() : null;
                    };
                    
                    service.subject = extractServiceField('Subject');
                    service.date = parseDate(extractServiceField('Date'));
                    service.location = extractServiceField('Location');
                    service.serviceType = extractServiceField('Service');
                    service.topic = extractServiceField('Topic');
                    service.durationMinutes = extractServiceField('Duration') ? parseInt(extractServiceField('Duration')) : null;
                    service.description = extractServiceField('Description');
                    service.author = extractServiceField('Author');
                    
                    if (service.subject && service.date) {
                        client.services.push(service);
                    }
                }
            }
            
            if (client.personalInfo.firstName && client.personalInfo.lastName) {
                clients.push(client);
            }
            
        } catch (error) {
            console.error(`⚠️  Error parsing client block:`, error.message);
        }
    }
    
    console.log(`✅ Successfully parsed ${clients.length} clients\n`);
    return clients;
}

// Import clients to database
async function importToDatabase(clients) {
    const dbClient = await getClient();
    
    try {
        await dbClient.query('BEGIN');
        
        console.log('🚀 Starting database import...\n');
        
        // Get admin user ID for created_by field
        const adminResult = await dbClient.query(
            "SELECT id FROM users WHERE username = 'admin' LIMIT 1"
        );
        const adminId = adminResult.rows[0]?.id;
        
        if (!adminId) {
            console.error('❌ Error: Admin user not found in database');
            console.log('   Please ensure the database schema has been initialized.\n');
            process.exit(1);
        }
        
        let importedClients = 0;
        let importedServices = 0;
        let skippedClients = 0;
        
        for (let clientData of clients) {
            try {
                const { personalInfo, services } = clientData;
                
                // Check if client already exists
                const existingClient = await dbClient.query(
                    'SELECT id FROM clients WHERE first_name = $1 AND last_name = $2',
                    [personalInfo.firstName, personalInfo.lastName]
                );
                
                let clientId;
                
                if (existingClient.rows.length > 0) {
                    clientId = existingClient.rows[0].id;
                    console.log(`⏭️  Skipping existing client: ${personalInfo.firstName} ${personalInfo.lastName}`);
                    skippedClients++;
                } else {
                    // Insert client
                    const clientResult = await dbClient.query(
                        `INSERT INTO clients (
                            first_name, last_name, gender, date_of_birth, age,
                            home_address, czech_phone, ukrainian_phone, email,
                            date_of_arrival_czech, project_registration_date,
                            visa_number, visa_type, insurance_company, ukrainian_region,
                            created_by
                        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
                        RETURNING id`,
                        [
                            personalInfo.firstName,
                            personalInfo.lastName,
                            personalInfo.gender,
                            personalInfo.dateOfBirth,
                            personalInfo.age,
                            personalInfo.homeAddress,
                            personalInfo.czechPhone,
                            personalInfo.ukrainianPhone,
                            personalInfo.email,
                            personalInfo.dateOfArrivalCzech,
                            personalInfo.projectRegistrationDate,
                            personalInfo.visaNumber,
                            personalInfo.visaType,
                            personalInfo.insuranceCompany,
                            personalInfo.ukrainianRegion,
                            adminId
                        ]
                    );
                    
                    clientId = clientResult.rows[0].id;
                    importedClients++;
                    console.log(`✅ Imported client: ${personalInfo.firstName} ${personalInfo.lastName} (${services.length} services)`);
                }
                
                // Import services for this client
                for (let service of services) {
                    try {
                        await dbClient.query(
                            `INSERT INTO service_records (
                                client_id, subject, service_type, service_date, duration_minutes,
                                location, topic, description, created_by
                            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
                            [
                                clientId,
                                service.subject,
                                service.serviceType,
                                service.date,
                                service.durationMinutes,
                                service.location,
                                service.topic,
                                service.description,
                                adminId
                            ]
                        );
                        
                        importedServices++;
                    } catch (error) {
                        console.warn(`   ⚠️  Could not import service: ${error.message}`);
                    }
                }
                
            } catch (error) {
                console.error(`❌ Error importing client ${clientData.personalInfo.firstName} ${clientData.personalInfo.lastName}:`, error.message);
            }
        }
        
        await dbClient.query('COMMIT');
        
        console.log('\n╔═══════════════════════════════════════════════════════════════╗');
        console.log('║                     IMPORT COMPLETE                           ║');
        console.log('╚═══════════════════════════════════════════════════════════════╝\n');
        console.log(`📊 Statistics:`);
        console.log(`   ✅ Clients imported: ${importedClients}`);
        console.log(`   ⏭️  Clients skipped (already exist): ${skippedClients}`);
        console.log(`   ✅ Services imported: ${importedServices}`);
        console.log(`   📅 Total clients in database: ${importedClients + skippedClients}\n`);
        
    } catch (error) {
        await dbClient.query('ROLLBACK');
        console.error('\n❌ Import failed:', error);
        throw error;
    } finally {
        dbClient.release();
    }
}

// Main execution
async function main() {
    try {
        const clients = parseDataFile(DATA_FILE);
        await importToDatabase(clients);
        
        console.log('🎉 Data import completed successfully!\n');
        console.log('💡 You can now start the application and view your data at:');
        console.log('   http://localhost:5173\n');
        
        process.exit(0);
    } catch (error) {
        console.error('\n❌ Fatal error:', error);
        process.exit(1);
    }
}

main();


























