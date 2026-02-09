import { query } from '../config/database.js';

async function enableUnaccent() {
    try {
        console.log('Checking for unaccent extension...');
        await query('CREATE EXTENSION IF NOT EXISTS unaccent;');
        console.log('Success: unaccent extension enabled (or already existed).');
        process.exit(0);
    } catch (error) {
        console.error('Error enabling unaccent extension:', error);
        process.exit(1);
    }
}

enableUnaccent();
