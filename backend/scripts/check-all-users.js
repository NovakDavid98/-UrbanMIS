import pool from '../config/database.js';
import dotenv from 'dotenv';
dotenv.config({ path: '../.env' });

async function checkAllUsers() {
    const result = await pool.query(`
        SELECT 
            id, 
            username, 
            email, 
            first_name, 
            last_name, 
            role, 
            is_active,
            created_at,
            last_login,
            (SELECT COUNT(*) FROM clients WHERE created_by = users.id) as clients_created,
            (SELECT COUNT(*) FROM service_records WHERE created_by = users.id) as services_created
        FROM users
        ORDER BY created_at ASC
    `);
    
    console.log("=".repeat(80));
    console.log(`👥 ALL USERS IN SYSTEM (${result.rows.length} total)`);
    console.log("=".repeat(80));
    console.log();
    
    result.rows.forEach((user, i) => {
        const status = user.is_active ? '✅ Active' : '❌ Inactive';
        console.log(`${i+1}. ${user.first_name} ${user.last_name} (@${user.username})`);
        console.log(`   Email: ${user.email}`);
        console.log(`   Role: ${user.role}`);
        console.log(`   Status: ${status}`);
        console.log(`   Created: ${user.created_at}`);
        console.log(`   Last Login: ${user.last_login || '(never)'}`);
        console.log(`   Activity: ${user.clients_created} clients, ${user.services_created} services`);
        console.log();
    });
    
    console.log("=".repeat(80));
    
    await pool.end();
}

checkAllUsers();

