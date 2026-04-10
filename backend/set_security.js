const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config();
const Admin = require('./models/Admin');

async function setSecurityQuestion() {
  const args = process.argv.slice(2);
  if (args.length !== 3) {
    console.log('Usage: node set_security.js <username> <question> <answer>');
    console.log('Example: node set_security.js badminton@gmail.com "What is your favorite sport?" "Badminton"');
    process.exit(1);
  }

  const [username, question, answer] = args;

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

    admin.securityQuestion = question;
    admin.securityAnswer = answer;
    await admin.save();

    console.log(`✅ Security question set for admin "${username}"`);
    console.log(`Question: ${question}`);

  } catch (err) {
    console.error('❌ Error:', err.message);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
}

setSecurityQuestion();