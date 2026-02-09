import { query } from './database.js';

async function checkLucie() {
    try {
        const result = await query(
            "SELECT username, role, first_name, last_name FROM users WHERE last_name iLIKE '%Bayer%';"
        );
        console.log(JSON.stringify(result.rows, null, 2));
    } catch (error) {
        console.error(error);
    } finally {
        process.exit();
    }
}

checkLucie();
