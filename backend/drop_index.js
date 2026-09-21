const mongoose = require('mongoose');
const dotenv = require('dotenv');
dotenv.config();

async function run() {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/mecfinders');
    const db = mongoose.connection.db;
    try {
        await db.collection('services').dropIndex('name_1_categoryId_1');
        console.log('Dropped old index name_1_categoryId_1');
    } catch (e) {
        console.log('Index drop error:', e.message);
    }
    
    // Also drop index 'name_1_categoryId_1_cityId_1' if exists
    try {
        await db.collection('services').dropIndex('name_1_categoryId_1_cityId_1');
        console.log('Dropped old index name_1_categoryId_1_cityId_1');
    } catch (e) {}

    // Drop indexes of mechanicServices just in case
    try {
        await db.collection('mechanicservices').dropIndex('name_1_categoryId_1_cityId_1');
    } catch (e) {}

    process.exit(0);
}
run();
