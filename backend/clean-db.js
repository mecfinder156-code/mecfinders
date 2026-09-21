const mongoose = require('mongoose');
require('dotenv').config({ path: '.env' });
const Service = require('./src/modules/services/service.model');

async function run() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to DB');
  
  // Find legacy services without a valid vehicleCategoryId
  const legacyServices = await Service.find({ vehicleCategoryId: { $exists: false } });
  console.log('Found legacy services:', legacyServices.map(s => s.name));
  
  const res = await Service.deleteMany({ vehicleCategoryId: { $exists: false } });
  console.log('Deleted:', res.deletedCount);
  
  process.exit(0);
}

run().catch(console.error);
