const mongoose = require('mongoose');
require('dotenv').config();

console.log('--- TESTING DATABASE CONNECTION ---');
console.log('URI:', process.env.MONGODB_URI.split('@')[1]); // Log the host part only for security

mongoose.connect(process.env.MONGODB_URI, {
  serverSelectionTimeoutMS: 5000
})
.then(() => {
  console.log('✅ SUCCESS: Connected to MongoDB Atlas!');
  process.exit(0);
})
.catch(err => {
  console.error('❌ FAILED:');
  console.error('Error Code:', err.code);
  console.error('Error Message:', err.message);
  console.error('Full Reason:', JSON.stringify(err.reason, null, 2));
  process.exit(1);
});
