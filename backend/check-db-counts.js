import { query } from './config/database.js';

async function check() {
    try {
        const sr = await query('SELECT COUNT(*) as total FROM service_records');
        const v = await query('SELECT COUNT(*) as total FROM visits');
        console.log('service_records count:', sr.rows[0].total);
        console.log('visits count:', v.rows[0].total);

        // Check latest service_records dates
        const srDates = await query('SELECT MIN(service_date) as earliest, MAX(service_date) as latest FROM service_records');
        console.log('service_records date range:', srDates.rows[0]);

        // Check latest visits dates
        const vDates = await query('SELECT MIN(visit_date) as earliest, MAX(visit_date) as latest FROM visits');
        console.log('visits date range:', vDates.rows[0]);

        process.exit(0);
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
}

check();
