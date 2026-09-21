const mongoose = require('mongoose');
const config = require('./src/config');
const Service = require('./src/modules/services/service.model');

mongoose.connect(config.mongodb.uri).then(async () => {
  const count = await Service.countDocuments({ isActive: true });
  console.log('Active Original Services:', count);
  process.exit(0);
});
