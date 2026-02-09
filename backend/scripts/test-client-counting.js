#!/usr/bin/env node

/**
 * Test Client Counting Script
 * 
 * This script tests the logic for counting clients added by workers
 * based on who performed the first service for each client since Nov 13, 2025
 */

import { query } from '../config/database.js';

async function testClientCounting() {
    console.log('🧪 Testing Client Counting Logic...');
    
    try {
        // Test the exact logic we're using in the API
        console.log('\n📊 Testing výkony-based client counting since November 13, 2025:');
        
        const testQuery = `
            SELECT 
                u.first_name,
                u.last_name,
                u.username,
                (
                  SELECT COUNT(DISTINCT v2.client_id)
                  FROM visits v2
                  WHERE v2.created_by = u.id 
                  AND v2.visit_date >= '2025-11-13'
                ) as clients_added_since_nov13_by_first_service
            FROM users u
            WHERE u.role IN ('worker', 'admin')
            ORDER BY clients_added_since_nov13_by_first_service DESC, u.last_name ASC
        `;
        
        const result = await query(testQuery);
        
        console.log('\nResults:');
        result.rows.forEach(worker => {
            console.log(`${worker.first_name} ${worker.last_name} (@${worker.username}): ${worker.clients_added_since_nov13_by_first_service} clients`);
        });
        
        // Show details of which clients were counted
        console.log('\n🔍 Detailed breakdown of clients with výkony since Nov 13, 2025:');
        
        const detailQuery = `
            SELECT DISTINCT
                c.first_name,
                c.last_name,
                u.first_name as worker_first_name,
                u.last_name as worker_last_name,
                u.username as worker_username,
                COUNT(v.id) as visit_count
            FROM visits v
            JOIN clients c ON v.client_id = c.id
            JOIN users u ON v.created_by = u.id
            WHERE v.visit_date >= '2025-11-13'
            GROUP BY c.id, c.first_name, c.last_name, u.id, u.first_name, u.last_name, u.username
            ORDER BY u.last_name ASC, c.last_name ASC
        `;
        
        const detailResult = await query(detailQuery);
        
        console.log(`\nFound ${detailResult.rows.length} clients with výkony since Nov 13, 2025:`);
        detailResult.rows.forEach(row => {
            console.log(`- ${row.first_name} ${row.last_name} → ${row.worker_first_name} ${row.worker_last_name} (@${row.worker_username}) - ${row.visit_count} visits`);
        });
        
        console.log('\n✅ Client counting test completed!');
        
    } catch (error) {
        console.error('❌ Error testing client counting:', error);
        process.exit(1);
    }
    
    process.exit(0);
}

// Run the test
testClientCounting();
