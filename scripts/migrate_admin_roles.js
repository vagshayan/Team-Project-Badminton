const path = require('path');
const { createRequire } = require('module');

const backendRequire = createRequire(path.resolve(__dirname, '../backend/package.json'));
const dotenv = backendRequire('dotenv');
const mongoose = backendRequire('mongoose');
const { Admin } = backendRequire('./models/Admin');

dotenv.config({ path: path.resolve(__dirname, '../backend/.env') });

async function migrateAdminRoles() {
  const mongoUri = process.env.MONGODB_URI;
  if (!mongoUri) throw new Error('MONGODB_URI is required in backend/.env');

  await mongoose.connect(mongoUri);
  try {
    const result = await Admin.collection.updateMany(
      { role: 'super_admin' },
      { $set: { role: 'admin' } }
    );
    console.log(`Normalized ${result.modifiedCount} admin account(s)`);
  } finally {
    await mongoose.disconnect();
  }
}

migrateAdminRoles().catch((error) => {
  console.error(`Admin role migration failed: ${error.message}`);
  process.exitCode = 1;
});