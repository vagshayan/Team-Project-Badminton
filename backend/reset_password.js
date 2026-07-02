const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config();
const Admin = require('./models/Admin');

async function resetAdminPassword() {
  const args = process.argv.slice(2);
  if (args.length !== 2) {
    console.log('Usage: node reset_password.js <username> <new_password>');
    console.log('Example: node reset_password.js admin123 mynewpassword');
    process.exit(1);
  }

  const [username, newPassword] = args;

  try {
    console.log('🔍 Connecting to database...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    const admin = await Admin.findOne({ username: username.trim() });
    if (!admin) {
      console.log(`❌ Admin with username "${username}" not found`);
      await mongoose.disconnect();
      process.exit(1);
    }

    // Update the password - schema pre-save hook will handle hashing
    admin.password = newPassword;
    await admin.save();

    console.log(`✅ Password reset successful for admin "${username}"`);
    console.log('🔑 New password is now active');

  } catch (err) {
    console.error('❌ Error:', err.message);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
}

resetAdminPassword();