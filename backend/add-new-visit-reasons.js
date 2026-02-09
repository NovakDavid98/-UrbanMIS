import { query } from './config/database.js';

async function addNewReasons() {
    try {
        console.log('🔧 Adding new visit reasons...\n');

        // Add 'Logoped' to community center
        const logoped = await query(
            `INSERT INTO visit_reasons (category, name_cs, name_uk, name_ru, display_order)
             VALUES ($1, $2, $3, $4, $5)
             ON CONFLICT DO NOTHING
             RETURNING id`,
            ['community', 'Logoped', 'Логопед', 'Логопед', 22]
        );
        console.log('✅ Added: Logoped (community)', logoped.rowCount > 0 ? '- NEW' : '- already exists');

        // Add 'Terénní práce' to assistance center
        const terenni = await query(
            `INSERT INTO visit_reasons (category, name_cs, name_uk, name_ru, display_order)
             VALUES ($1, $2, $3, $4, $5)
             ON CONFLICT DO NOTHING
             RETURNING id`,
            ['assistance', 'Terénní práce', 'Теренна робота', 'Полевая работа', 15]
        );
        console.log('✅ Added: Terénní práce (assistance)', terenni.rowCount > 0 ? '- NEW' : '- already exists');

        // Add 'Nepřímá práce' to assistance center
        const neprima = await query(
            `INSERT INTO visit_reasons (category, name_cs, name_uk, name_ru, display_order)
             VALUES ($1, $2, $3, $4, $5)
             ON CONFLICT DO NOTHING
             RETURNING id`,
            ['assistance', 'Nepřímá práce', 'Непряма робота', 'Косвенная работа', 16]
        );
        console.log('✅ Added: Nepřímá práce (assistance)', neprima.rowCount > 0 ? '- NEW' : '- already exists');

        console.log('\n🎉 Done! Visit reasons updated.');
        process.exit(0);
    } catch (error) {
        console.error('❌ Error:', error);
        process.exit(1);
    }
}

addNewReasons();
