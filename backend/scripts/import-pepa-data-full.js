import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { query, getClient } from '../config/database.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const DATA_FILE = path.join(__dirname, '../../../complete_data_extraction/all_clients_complete_data.txt');

console.log('\n╔═══════════════════════════════════════════════════════════════╗');
console.log('║                                                               ║');
console.log('║    IS PePa FULL Data Import to Centrální Mozek CEHUPO        ║');
console.log('║                                                               ║');
console.log('╚═══════════════════════════════════════════════════════════════╝\n');

// Helper to parse date
function parseDate(dateStr) {
    if (!dateStr || dateStr === '—' || dateStr === 'N/A' || dateStr.trim() === '') return null;
    
    try {
        // Format: "08. 02. 1991" or "6.3.2022"
        const parts = dateStr.replace(/\s+/g, '').split('.');
        if (parts.length >= 3) {
            const day = parseInt(parts[0]);
            const month = parseInt(parts[1]);
            const year = parseInt(parts[2]);
            if (year && month && day) {
                return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            }
        }
    } catch (e) {
        console.warn(`Warning: Could not parse date: ${dateStr}`);
    }
    return null;
}

// Calculate age
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

// Extract field value from text
function extractField(text, fieldName) {
    const regex = new RegExp(`${fieldName}:\\s*(.+?)(?=\\n|$)`, 'i');
    const match = text.match(regex);
    if (match && match[1]) {
        const value = match[1].trim();
        return (value === '—' || value === 'N/A' || value === '') ? null : value;
    }
    return null;
}

// Parse the data file
function parseDataFile(filePath) {
    console.log(`📂 Reading data file: ${filePath}`);
    
    if (!fs.existsSync(filePath)) {
        console.error(`❌ Error: Data file not found`);
        process.exit(1);
    }
    
    const content = fs.readFileSync(filePath, 'utf-8');
    const clients = [];
    
    // Split by CLIENT: marker with surrounding ====
    const clientBlocks = content.split(/={80,}\n*CLIENT:/);
    
    console.log(`📊 Processing client data...\n`);
    
    for (let block of clientBlocks) {
        if (block.trim().length === 0 || block.includes('IS PEPA COMPLETE CLIENT DATA')) continue;
        
        // Add back the CLIENT: marker for parsing
        if (!block.startsWith('CLIENT:')) {
            block = 'CLIENT:' + block;
        }
        
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
                client.personalInfo.lastName = nameParts[0];
                client.personalInfo.firstName = nameParts.slice(1).filter(p => !p.match(/^\d+$/)).join(' ');
            }
            
            // Extract personal information section - capture everything until KEY WORKERS
            const personalSection = block.match(/PERSONAL INFORMATION[\s\S]*?(?=-{70,}\nKEY WORKERS|$)/);
            if (personalSection) {
                const info = personalSection[0];
                
                // Extract gender from format: (Žena) or (Muž)
                const genderMatch = info.match(/\((?:Žena|Muž)\)/);
                if (genderMatch) {
                    client.personalInfo.gender = genderMatch[0].includes('Žena') ? 'Žena' : 'Muž';
                }
                
                // Extract age from format: (34)
                const ageMatch = info.match(/\((\d+)\)/);
                if (ageMatch) {
                    client.personalInfo.age = parseInt(ageMatch[1]);
                }
                
                // Extract date of birth
                const dobMatch = info.match(/date_of_birth:\s*(.+?)(?=\n|$)/);
                if (dobMatch) {
                    client.personalInfo.dateOfBirth = parseDate(dobMatch[1].trim());
                }
                
                // Extract address
                client.personalInfo.homeAddress = extractField(info, 'address');
                
                // Extract phones and email
                const czechPhoneMatch = info.match(/czech_phone:\s*(.+?)(?=\n|$)/);
                if (czechPhoneMatch) {
                    const phone = czechPhoneMatch[1].trim();
                    if (phone && phone !== '+420' && phone.length > 4) {
                        client.personalInfo.czechPhone = phone;
                    }
                }
                
                const ukrainianPhoneMatch = info.match(/ukrainian_phone:\s*(.+?)(?=\n|$)/);
                if (ukrainianPhoneMatch) {
                    const phone = ukrainianPhoneMatch[1].trim();
                    if (phone && phone !== '+380' && phone.length > 4) {
                        client.personalInfo.ukrainianPhone = phone;
                    }
                }
                
                client.personalInfo.email = extractField(info, 'email');
                
                // Extract Ukrainian region
                client.personalInfo.ukrainianRegion = extractField(info, 'ukrainian_origin');
                
                // Extract dates
                const arrivalMatch = info.match(/arrival_date_cz:\s*(.+?)(?=\n|$)/);
                if (arrivalMatch) {
                    client.personalInfo.dateOfArrivalCzech = parseDate(arrivalMatch[1].trim());
                }
                
                const registrationMatch = info.match(/registration_date:\s*(.+?)(?=\n|$)/);
                if (registrationMatch) {
                    client.personalInfo.projectRegistrationDate = parseDate(registrationMatch[1].trim());
                }
                
                // Extract visa info
                client.personalInfo.visaNumber = extractField(info, 'visa_number');
                client.personalInfo.visaType = extractField(info, 'visa_type');
                
                // Extract insurance
                client.personalInfo.insurance = extractField(info, 'insurance');
                
                // Extract passport
                client.personalInfo.passport = extractField(info, 'pas');
                
                // Recalculate age if we have date of birth
                if (client.personalInfo.dateOfBirth) {
                    client.personalInfo.age = calculateAge(client.personalInfo.dateOfBirth);
                }
            }
            
            // Extract key workers
            const keyWorkersSection = block.match(/KEY WORKERS[\s\S]*?(?=-{70,}|$)/);
            if (keyWorkersSection) {
                const workers = keyWorkersSection[0];
                const workerMatches = workers.matchAll(/•\s*(.+)/g);
                for (let workerMatch of workerMatches) {
                    const workerName = workerMatch[1].trim();
                    if (workerName && workerName !== '(None)') {
                        client.keyWorkers.push(workerName);
                    }
                }
            }
            
            // Extract tags
            const tagsSection = block.match(/TAGS[\s\S]*?(?=-{70,}|$)/);
            if (tagsSection) {
                const tags = tagsSection[0];
                const tagMatches = tags.matchAll(/•\s*(.+)/g);
                for (let tagMatch of tagMatches) {
                    const tagName = tagMatch[1].trim();
                    if (tagName && tagName !== '(None)') {
                        client.tags.push(tagName);
                    }
                }
            }
            
            // Extract contracts
            const contractsSection = block.match(/ACTIVE CONTRACTS[\s\S]*?(?=-{70,}|$)/);
            if (contractsSection) {
                const contracts = contractsSection[0];
                const contractMatches = contracts.matchAll(/Contract \d+:([\s\S]*?)(?=\nContract \d+:|$)/g);
                for (let contractMatch of contractMatches) {
                    const contractText = contractMatch[1];
                    const contract = {};
                    
                    const nameMatch = contractText.match(/Name:\s*(.+?)(?=\n|$)/);
                    if (nameMatch) contract.name = nameMatch[1].trim();
                    
                    const typeMatch = contractText.match(/Type:\s*(.+?)(?=\n|$)/);
                    if (typeMatch) contract.type = typeMatch[1].trim();
                    
                    const startMatch = contractText.match(/Start.*?:\s*(.+?)(?=\n|$)/);
                    if (startMatch) contract.startDate = parseDate(startMatch[1].trim());
                    
                    const endMatch = contractText.match(/End.*?:\s*(.+?)(?=\n|$)/);
                    if (endMatch) contract.endDate = parseDate(endMatch[1].trim());
                    
                    if (contract.name) {
                        client.contracts.push(contract);
                    }
                }
            }
            
            // Extract individual plans
            const plansSection = block.match(/INDIVIDUAL PLANS[\s\S]*?(?=-{70,}|VÝKONY)/);
            if (plansSection) {
                const plans = plansSection[0];
                const planMatches = plans.matchAll(/Plan \d+:([\s\S]*?)(?=\nPlan \d+:|$)/g);
                for (let planMatch of planMatches) {
                    const planText = planMatch[1];
                    const plan = {};
                    
                    const nameMatch = planText.match(/Name:\s*(.+?)(?=\n|$)/);
                    if (nameMatch) plan.name = nameMatch[1].trim();
                    
                    const createdMatch = planText.match(/Created:\s*(.+?)(?=\n|$)/);
                    if (createdMatch) plan.createdDate = parseDate(createdMatch[1].trim());
                    
                    const goalMatch = planText.match(/Goal:\s*(.+?)(?=\n|$)/);
                    if (goalMatch) plan.goal = goalMatch[1].trim();
                    
                    if (plan.name) {
                        client.individualPlans.push(plan);
                    }
                }
            }
            
            // Extract services
            const servicesSection = block.match(/VÝKONY \/ SERVICE RECORDS[\s\S]*$/);
            if (servicesSection) {
                const services = servicesSection[0];
                const serviceMatches = [...services.matchAll(/Výkon \d+:([\s\S]*?)(?=\nVýkon \d+:|$)/g)];
                
                for (let serviceMatch of serviceMatches) {
                    const serviceText = serviceMatch[1];
                    const service = {};
                    
                    // Extract fields with 2-space indent
                    const subjectMatch = serviceText.match(/\s+Subject:\s*(.+?)(?=\n|$)/);
                    if (subjectMatch) service.subject = subjectMatch[1].trim();
                    
                    const dateMatch = serviceText.match(/\s+Date:\s*(.+?)(?=\n|$)/);
                    if (dateMatch) {
                        service.date = parseDate(dateMatch[1].trim());
                    }
                    
                    const locationMatch = serviceText.match(/\s+Location\/Service\/Topic:\s*(.+?)(?=\n|$)/);
                    if (locationMatch) {
                        const parts = locationMatch[1].split('/').map(p => p.trim());
                        service.location = parts[0] || null;
                        service.serviceType = parts[1] || null;
                        service.topic = parts[2] || null;
                    }
                    
                    const durationMatch = serviceText.match(/\s+Duration:\s*(\d+)/);
                    if (durationMatch) {
                        service.durationMinutes = parseInt(durationMatch[1]);
                    }
                    
                    const authorMatch = serviceText.match(/\s+Author:\s*(.+?)(?=\n|$)/);
                    if (authorMatch) service.author = authorMatch[1].trim();
                    
                    const descMatch = serviceText.match(/\s+Description:\s*([\s\S]*?)(?=\n\nVýkon|$)/);
                    if (descMatch) {
                        service.description = descMatch[1].trim().replace(/^\s+/gm, '');
                    }
                    
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

// Import to database
async function importToDatabase(clients) {
    const dbClient = await getClient();
    
    try {
        await dbClient.query('BEGIN');
        
        console.log('🚀 Starting database import...\n');
        
        const adminResult = await dbClient.query(
            "SELECT id FROM users WHERE username = 'admin' LIMIT 1"
        );
        const adminId = adminResult.rows[0]?.id;
        
        if (!adminId) {
            console.error('❌ Error: Admin user not found');
            process.exit(1);
        }
        
        let updatedClients = 0;
        let newClients = 0;
        let importedServices = 0;
        let skippedServices = 0;
        
        for (let clientData of clients) {
            try {
                const { personalInfo, services, keyWorkers, tags } = clientData;
                
                // Check if client exists
                const existingClient = await dbClient.query(
                    'SELECT id FROM clients WHERE first_name = $1 AND last_name = $2',
                    [personalInfo.firstName, personalInfo.lastName]
                );
                
                let clientId;
                
                if (existingClient.rows.length > 0) {
                    // Update existing client
                    clientId = existingClient.rows[0].id;
                    await dbClient.query(
                        `UPDATE clients SET
                            gender = $1,
                            date_of_birth = $2,
                            age = $3,
                            home_address = $4,
                            czech_phone = $5,
                            ukrainian_phone = $6,
                            email = $7,
                            date_of_arrival_czech = $8,
                            project_registration_date = $9,
                            visa_number = $10,
                            visa_type = $11,
                            insurance_company = $12,
                            ukrainian_region = $13,
                            updated_at = NOW()
                        WHERE id = $14`,
                        [
                            personalInfo.gender || null,
                            personalInfo.dateOfBirth || null,
                            personalInfo.age || null,
                            personalInfo.homeAddress || null,
                            personalInfo.czechPhone || null,
                            personalInfo.ukrainianPhone || null,
                            personalInfo.email || null,
                            personalInfo.dateOfArrivalCzech || null,
                            personalInfo.projectRegistrationDate || null,
                            personalInfo.visaNumber || null,
                            personalInfo.visaType || null,
                            personalInfo.insurance || null,
                            personalInfo.ukrainianRegion || null,
                            clientId
                        ]
                    );
                    updatedClients++;
                    console.log(`✅ Updated: ${personalInfo.firstName} ${personalInfo.lastName} (${services.length} services)`);
                } else {
                    // Insert new client
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
                            personalInfo.insurance,
                            personalInfo.ukrainianRegion,
                            adminId
                        ]
                    );
                    clientId = clientResult.rows[0].id;
                    newClients++;
                    console.log(`✅ Created: ${personalInfo.firstName} ${personalInfo.lastName} (${services.length} services)`);
                }
                
                // Import services
                for (let service of services) {
                    try {
                        // Check if service already exists
                        const existingService = await dbClient.query(
                            `SELECT id FROM service_records 
                             WHERE client_id = $1 AND service_date = $2 AND subject = $3`,
                            [clientId, service.date, service.subject]
                        );
                        
                        if (existingService.rows.length === 0) {
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
                        } else {
                            skippedServices++;
                        }
                    } catch (error) {
                        console.warn(`   ⚠️  Could not import service: ${error.message}`);
                    }
                }
                
                // Import key workers
                for (let workerName of keyWorkers) {
                    try {
                        // Try to find the worker by name or username
                        const workerResult = await dbClient.query(
                            `SELECT id FROM users WHERE username ILIKE $1 OR first_name ILIKE $1 OR 
                             CONCAT(first_name, ' ', last_name) ILIKE $1 LIMIT 1`,
                            [workerName]
                        );
                        
                        if (workerResult.rows.length > 0) {
                            const workerId = workerResult.rows[0].id;
                            // Add key worker assignment if doesn't exist
                            await dbClient.query(
                                `INSERT INTO key_worker_assignments (client_id, worker_id, assigned_date)
                                 VALUES ($1, $2, NOW())
                                 ON CONFLICT (client_id, worker_id) DO NOTHING`,
                                [clientId, workerId]
                            );
                        }
                    } catch (error) {
                        // Silently skip if worker not found or other error
                    }
                }
                
                // Import tags
                for (let tagName of tags) {
                    try {
                        // Get or create tag
                        let tagResult = await dbClient.query(
                            'SELECT id FROM tags WHERE name ILIKE $1',
                            [tagName]
                        );
                        
                        let tagId;
                        if (tagResult.rows.length === 0) {
                            // Create new tag
                            tagResult = await dbClient.query(
                                'INSERT INTO tags (name) VALUES ($1) RETURNING id',
                                [tagName]
                            );
                        }
                        tagId = tagResult.rows[0].id;
                        
                        // Link tag to client
                        await dbClient.query(
                            `INSERT INTO client_tags (client_id, tag_id, assigned_date)
                             VALUES ($1, $2, NOW())
                             ON CONFLICT (client_id, tag_id) DO NOTHING`,
                            [clientId, tagId]
                        );
                    } catch (error) {
                        // Silently skip if tag creation fails
                    }
                }
                
            } catch (error) {
                console.error(`❌ Error importing client: ${error.message}`);
            }
        }
        
        await dbClient.query('COMMIT');
        
        console.log('\n╔═══════════════════════════════════════════════════════════════╗');
        console.log('║                     IMPORT COMPLETE                           ║');
        console.log('╚═══════════════════════════════════════════════════════════════╝\n');
        console.log(`📊 Statistics:`);
        console.log(`   ✅ Clients updated: ${updatedClients}`);
        console.log(`   ✅ New clients created: ${newClients}`);
        console.log(`   ✅ Services imported: ${importedServices}`);
        console.log(`   ⏭️  Services skipped (duplicates): ${skippedServices}`);
        console.log(`   📅 Total clients in database: ${updatedClients + newClients}\n`);
        
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
        
        console.log('🎉 Full data import completed successfully!\n');
        console.log('💡 Refresh your browser at http://localhost:5173 to see all the data!\n');
        
        process.exit(0);
    } catch (error) {
        console.error('\n❌ Fatal error:', error);
        process.exit(1);
    }
}

main();

