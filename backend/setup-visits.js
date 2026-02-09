import { query } from './config/database.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function setupVisitsSystem() {
    try {
        console.log('🔧 Setting up visits system...\n');
        
        // Read and execute the visits schema SQL
        const sqlPath = path.join(__dirname, '../database/visits_schema.sql');
        const sql = fs.readFileSync(sqlPath, 'utf8');
        await query(sql);
        
        console.log('✅ Visits tables created successfully!');
        console.log('   - visit_reasons');
        console.log('   - visits');
        console.log('   - visit_visit_reasons');
        console.log('   - Enhanced client fields added');
        console.log('   - visits_with_details view created\n');
        
        // Seed visit reasons data
        console.log('📥 Seeding visit reasons...\n');
        
        const visitReasons = [
            // Humanitarian Warehouse (Humanitární sklad)
            { category: 'warehouse', name_cs: 'Vybavení domácnosti', name_uk: 'Обладнання для дому', name_ru: 'Оборудование для дома', order: 1 },
            { category: 'warehouse', name_cs: 'Jídlo – humanitární balíček', name_uk: 'Їжа - гуманітарний пакет', name_ru: 'Еда - гуманитарный пакет', order: 2 },
            { category: 'warehouse', name_cs: 'Kosmetika - humanitární balíček', name_uk: 'Косметика - гуманітарний пакет', name_ru: 'Косметика - гуманитарный пакет', order: 3 },
            { category: 'warehouse', name_cs: 'Oblečení – obuv', name_uk: 'Одяг - взуття', name_ru: 'Одежда - обувь', order: 4 },
            { category: 'warehouse', name_cs: 'Ostatní', name_uk: 'Інше', name_ru: 'Прочее', order: 5 },
            
            // Assistance Center (Asistenční centrum)
            { category: 'assistance', name_cs: 'Konzultace', name_uk: 'Консультація', name_ru: 'Консультация', order: 6 },
            { category: 'assistance', name_cs: 'Psychologická pomoc', name_uk: 'Психологічна допомога', name_ru: 'Психологическая помощь', order: 7 },
            { category: 'assistance', name_cs: 'Bydlení', name_uk: 'Житло', name_ru: 'Жилье', order: 8 },
            { category: 'assistance', name_cs: 'Zdravotnictví', name_uk: 'Охорона здоров\'я', name_ru: 'Здравоохранение', order: 9 },
            { category: 'assistance', name_cs: 'Vzdělávání', name_uk: 'Освіта', name_ru: 'Образование', order: 10 },
            { category: 'assistance', name_cs: 'Doklady – víza', name_uk: 'Документи - віза', name_ru: 'Документы - виза', order: 11 },
            { category: 'assistance', name_cs: 'Tlumočení', name_uk: 'Переклад', name_ru: 'Перевод', order: 12 },
            { category: 'assistance', name_cs: 'Doprovod', name_uk: 'Супровід', name_ru: 'Сопровождение', order: 13 },
            { category: 'assistance', name_cs: 'Zaměstnání', name_uk: 'Працевлаштування', name_ru: 'Трудоустройство', order: 14 },
            
            // Community Center (Komunitní centrum)
            { category: 'community', name_cs: 'Akce', name_uk: 'Події', name_ru: 'Мероприятия', order: 15 },
            { category: 'community', name_cs: 'Děti', name_uk: 'Діти', name_ru: 'Дети', order: 16 },
            { category: 'community', name_cs: 'Senioři', name_uk: 'Пенсіонери', name_ru: 'Пожилые люди', order: 17 },
            { category: 'community', name_cs: 'Dospělí', name_uk: 'Дорослі', name_ru: 'Взрослые', order: 18 },
            { category: 'community', name_cs: 'Kurzy ČJ', name_uk: 'Курси чеської мови', name_ru: 'Курсы чешского языка', order: 19 },
            { category: 'community', name_cs: 'Ostatní akce', name_uk: 'Інші заходи', name_ru: 'Другие мероприятия', order: 20 },
            { category: 'community', name_cs: 'Integrační akce', name_uk: 'Інтеграційні заходи', name_ru: 'Интеграционные мероприятия', order: 21 },
            
            // Donations (Přinesli)
            { category: 'donations', name_cs: 'Přinesli oblečení', name_uk: 'Принесли одяг', name_ru: 'Принесли одежду', order: 22 },
            { category: 'donations', name_cs: 'Přinesli nábytek', name_uk: 'Принесли меблі', name_ru: 'Принесли мебель', order: 23 },
            { category: 'donations', name_cs: 'Přinesli vybavení domácnosti', name_uk: 'Принесли обладнання для дому', name_ru: 'Принесли оборудование для дома', order: 24 },
            { category: 'donations', name_cs: 'Přinesli jídlo', name_uk: 'Принесли їжу', name_ru: 'Принесли еду', order: 25 },
            { category: 'donations', name_cs: 'Přinesli kosmetiku', name_uk: 'Принесли косметику', name_ru: 'Принесли косметику', order: 26 },
        ];
        
        for (const reason of visitReasons) {
            await query(
                `INSERT INTO visit_reasons (category, name_cs, name_uk, name_ru, display_order)
                 VALUES ($1, $2, $3, $4, $5)
                 ON CONFLICT DO NOTHING`,
                [reason.category, reason.name_cs, reason.name_uk, reason.name_ru, reason.order]
            );
        }
        
        console.log(`✅ Seeded ${visitReasons.length} visit reasons!`);
        console.log('   - Warehouse: 5 reasons');
        console.log('   - Assistance: 9 reasons');
        console.log('   - Community: 7 reasons');
        console.log('   - Donations: 5 reasons\n');
        
        console.log('🎉 Visits system setup complete!\n');
        
        process.exit(0);
    } catch (error) {
        console.error('❌ Error setting up visits system:', error.message);
        console.error(error);
        process.exit(1);
    }
}

setupVisitsSystem();
