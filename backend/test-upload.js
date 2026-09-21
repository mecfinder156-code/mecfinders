const mongoose = require('mongoose');
const User = require('./src/modules/users/models/user.model');
const { connectDB, disconnectDB } = require('./src/config/database');

async function test() {
  await connectDB('mongodb://localhost:27017/mecfinders');
  const user = await User.findOne({ role: 'mechanic' });
  if (!user) {
    console.log("No mechanic found");
    return;
  }
  
  if (!user.documents) user.documents = [];
  user.documents.push({
    documentType: 'AADHAAR',
    documentUrl: 'data:image/jpeg;base64,test',
    status: 'PENDING'
  });
  
  await user.save({ validateBeforeSave: false });
  console.log("Saved successfully! Documents:", user.documents);
  await disconnectDB();
}
test();
