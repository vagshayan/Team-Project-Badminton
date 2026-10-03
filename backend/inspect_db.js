const mongoose = require('mongoose');
require('dotenv').config();
const Admin = require('./models/Admin');

async function inspect() {
  try {
    console.log('--- SYNCING WITH DATABASE ---');
    await mongoose.connect(process.env.MONGODB_URI);
    
    const admins = await Admin.find().select('id username name sport avatarUrl role securityQuestion');
    
    if (admins.length === 0) {
      console.log('❗ No admin accounts found in the database.');
    } else {
      console.log(`✅ FOUND ${admins.length} ADMIN ACCOUNT(S):`);
      console.table(admins.map(a => ({
        ID: a._id.toString().slice(-6),
        NAME: a.name,
        USERNAME: a.username,
        SPORT: a.sport,
        CREATED: a.createdAt.toLocaleDateString()
      })));
    }
  } catch (err) {
    console.error('❌ Database error:', err.message);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
}

inspect();
