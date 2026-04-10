const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config();
const Admin = require('./models/Admin');

async function debugLogin() {
  try {
    console.log('🔍 Connecting to database...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');

    // List all admins
    const admins = await Admin.find();
    if (admins.length === 0) {
      console.log('❌ NO ADMIN ACCOUNTS FOUND!');
      console.log('📝 Create one first by accessing /admin/register on the frontend\n');
      await mongoose.disconnect();
      process.exit(0);
    }

    console.log(`📋 FOUND ${admins.length} ADMIN(S):\n`);
    admins.forEach((admin, idx) => {
      console.log(`   ${idx + 1}. ${admin.username} (${admin.sport}) - ${admin.name}`);
    });
    console.log();

    // Test login for each admin
    const testPassword = 'sports123'; // Test with this password
    
    for (const admin of admins) {
      console.log(`\n🧪 Testing login for "${admin.username}":`);
      console.log(`   Password stored in DB (hashed): ${admin.password.substring(0, 20)}...`);
      
      // Test if a password matches
      const match = await admin.comparePassword(testPassword);
      console.log(`   Does password "${testPassword}" match? ${match ? '✅ YES' : '❌ NO'}`);
      
      if (!match) {
        console.log(`   ⚠️  Try your actual password for this admin account`);
      }
    }

  } catch (err) {
    console.error('❌ Error:', err.message);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
}

debugLogin();
