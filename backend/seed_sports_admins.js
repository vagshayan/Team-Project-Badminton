/**
 * Seed or Reset the 3 Sports Admin Accounts for Local Development
 * Creates or updates:
 * 1. Badminton Admin (sport: badminton)
 * 2. Table Tennis Admin (sport: table-tennis)
 * 3. Carrom Admin (sport: carrom)
 */

const mongoose = require('mongoose');
require('dotenv').config();
const { Admin } = require('./models/Admin');

const DEFAULT_PASSWORD = process.env.DEFAULT_ADMIN_PASSWORD || 'Sports@123';

const sportsAdmins = [
  {
    name: 'Badminton Manager',
    username: 'badminton_admin',
    email: 'badminton@univ.jfn.ac.lk',
    sport: 'badminton',
    role: 'admin',
    securityQuestion: 'What is your primary sport domain?',
    securityAnswer: 'Badminton',
  },
  {
    name: 'Table Tennis Manager',
    username: 'tabletennis_admin',
    email: 'tabletennis@univ.jfn.ac.lk',
    sport: 'table-tennis',
    role: 'admin',
    securityQuestion: 'What is your primary sport domain?',
    securityAnswer: 'Table Tennis',
  },
  {
    name: 'Carrom Manager',
    username: 'carrom_admin',
    email: 'carrom@univ.jfn.ac.lk',
    sport: 'carrom',
    role: 'admin',
    securityQuestion: 'What is your primary sport domain?',
    securityAnswer: 'Carrom',
  },
];

async function seedAdmins() {
  const password = process.argv[2] || DEFAULT_PASSWORD;

  try {
    console.log('\n--- SEEDING 3 SPORTS ADMIN ACCOUNTS ---');
    console.log('Connecting to:', process.env.MONGODB_URI);
    await mongoose.connect(process.env.MONGODB_URI);

    for (const info of sportsAdmins) {
      let admin = await Admin.findOne({
        $or: [{ username: info.username }, { sport: info.sport }],
      });

      if (admin) {
        admin.name = info.name;
        admin.username = info.username;
        admin.email = info.email;
        admin.sport = info.sport;
        admin.role = info.role;
        admin.password = password; // Trigger pre-save bcrypt hash
        admin.securityQuestion = info.securityQuestion;
        admin.securityAnswer = info.securityAnswer;
        admin.emailVerified = true;
        await admin.save();
        console.log(`✅ Updated existing admin for ${info.sport.toUpperCase()}:`);
      } else {
        admin = new Admin({
          ...info,
          password,
          emailVerified: true,
        });
        await admin.save();
        console.log(`✅ Created new admin for ${info.sport.toUpperCase()}:`);
      }

      console.log(`   - Name:     ${info.name}`);
      console.log(`   - Username: ${info.username}`);
      console.log(`   - Sport:    ${info.sport}`);
      console.log(`   - Password: ${password}\n`);
    }

    console.log('🎉 All 3 sports admins are configured and ready to log in!\n');
  } catch (err) {
    console.error('❌ Error seeding admins:', err.message);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
}

seedAdmins();
