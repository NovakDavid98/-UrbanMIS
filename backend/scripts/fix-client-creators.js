#!/usr/bin/env node

/**
 * Fix Client Creators Script
 * 
 * This script assigns clients to workers based on service records (výkony).
 * Logic: The worker who performed the first service for a client is considered
 * the one who added that client to the system.
 */

import { query } from '../config/database.js';

async function fixClientCreators() {
    console.log('🔧 Starting Client Creator Fix...');
    
    try {
        // Step 1: Find clients without created_by
        console.log('📊 Checking clients without created_by...');
        const clientsWithoutCreator = await query(`
            SELECT COUNT(*) as count 
            FROM clients 
            WHERE created_by IS NULL
        `);
        
        console.log(`Found ${clientsWithoutCreator.rows[0].count} clients without creator`);
        
        // Step 2: Update clients based on first service record
        console.log('🔄 Updating clients based on first service records...');
        
        const updateQuery = `
            UPDATE clients 
            SET created_by = first_service.created_by,
                updated_at = NOW()
            FROM (
                SELECT DISTINCT ON (client_id) 
                    client_id, 
                    created_by
                FROM service_records 
                WHERE created_by IS NOT NULL
                ORDER BY client_id, service_date ASC, created_at ASC
            ) as first_service
            WHERE clients.id = first_service.client_id 
            AND clients.created_by IS NULL
        `;
        
        const updateResult = await query(updateQuery);
        console.log(`✅ Updated ${updateResult.rowCount} clients with creators from service records`);
        
        // Step 3: For remaining clients without services, try to use key worker assignments
        console.log('🔄 Updating remaining clients based on key worker assignments...');
        
        const keyWorkerUpdateQuery = `
            UPDATE clients 
            SET created_by = kwa.worker_id,
                updated_at = NOW()
            FROM key_worker_assignments kwa
            WHERE clients.id = kwa.client_id 
            AND clients.created_by IS NULL
            AND kwa.is_primary = true
        `;
        
        const keyWorkerResult = await query(keyWorkerUpdateQuery);
        console.log(`✅ Updated ${keyWorkerResult.rowCount} clients with creators from key worker assignments`);
        
        // Step 4: For remaining clients, use ANY key worker assignment (not just primary)
        console.log('🔄 Updating remaining clients based on any key worker assignment...');
        
        const anyKeyWorkerUpdateQuery = `
            UPDATE clients 
            SET created_by = first_assignment.worker_id,
                updated_at = NOW()
            FROM (
                SELECT DISTINCT ON (client_id) 
                    client_id, 
                    worker_id
                FROM key_worker_assignments 
                ORDER BY client_id, assigned_date ASC, created_at ASC
            ) as first_assignment
            WHERE clients.id = first_assignment.client_id 
            AND clients.created_by IS NULL
        `;
        
        const anyKeyWorkerResult = await query(anyKeyWorkerUpdateQuery);
        console.log(`✅ Updated ${anyKeyWorkerResult.rowCount} clients with creators from any key worker assignments`);
        
        // Step 5: For remaining clients without any assignments, assign to admin (system import)
        console.log('🔄 Assigning remaining clients to admin (system import)...');
        
        const adminAssignQuery = `
            UPDATE clients 
            SET created_by = (SELECT id FROM users WHERE username = 'admin' LIMIT 1),
                updated_at = NOW()
            WHERE created_by IS NULL
        `;
        
        const adminAssignResult = await query(adminAssignQuery);
        console.log(`✅ Assigned ${adminAssignResult.rowCount} remaining clients to admin (system import)`);
        
        // Step 6: Final statistics
        console.log('📊 Final statistics:');
        const finalStats = await query(`
            SELECT 
                COUNT(*) as total_clients,
                COUNT(created_by) as clients_with_creator,
                COUNT(*) - COUNT(created_by) as clients_without_creator
            FROM clients
        `);
        
        const stats = finalStats.rows[0];
        console.log(`Total clients: ${stats.total_clients}`);
        console.log(`Clients with creator: ${stats.clients_with_creator}`);
        console.log(`Clients without creator: ${stats.clients_without_creator}`);
        
        // Step 7: Show clients added per worker since Nov 13, 2025
        console.log('\n📈 Clients added per worker since November 13, 2025:');
        const workerStats = await query(`
            SELECT 
                u.first_name,
                u.last_name,
                u.username,
                COUNT(c.id) as clients_added_since_nov13
            FROM users u
            LEFT JOIN clients c ON u.id = c.created_by 
                AND c.created_at >= '2025-11-13'
            WHERE u.role IN ('worker', 'admin')
            GROUP BY u.id, u.first_name, u.last_name, u.username
            ORDER BY clients_added_since_nov13 DESC, u.last_name ASC
        `);
        
        workerStats.rows.forEach(worker => {
            console.log(`${worker.first_name} ${worker.last_name} (@${worker.username}): ${worker.clients_added_since_nov13} clients`);
        });
        
        console.log('\n✅ Client creator fix completed successfully!');
        
    } catch (error) {
        console.error('❌ Error fixing client creators:', error);
        process.exit(1);
    }
    
    process.exit(0);
}

// Run the script
fixClientCreators();
